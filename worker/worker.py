import json
import os
import random
import sqlite3
import string
import time
from pathlib import Path
from typing import Optional

# 以 `python worker/worker.py` 方式运行时，sys.path[0] 为 worker/ 目录，
# 因此使用同目录导入（避免要求 worker/ 作为带 __init__.py 的包）。
from jobs import claim_next_job, heartbeat, mark_done, mark_failed, update_progress
from jobs import cancel_duplicate_pending_jobs, mark_cancelled, should_continue
from scanner import scan_full
from transcoder import JobCancelled, transcode_prepare


POLL_INTERVAL_S = 2


def _default_db_path() -> str:
    # 默认 ../web/dev.db（相对 worker/worker.py）
    return str((Path(__file__).resolve().parent / ".." / "web" / "dev.db").resolve())


def _db_path_from_env() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        return _default_db_path()

    # 仅要求支持 file: 前缀
    if url.startswith("file:"):
        p = url[len("file:") :]
        # file:../web/dev.db 这种相对路径按当前进程工作目录解析（符合常见 DATABASE_URL 行为）
        return str(Path(p).expanduser().resolve())

    # 容错：若直接给了路径，也当作 sqlite 文件路径
    return str(Path(url).expanduser().resolve())


def _default_worker_id() -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
    return f"worker-{suffix}"


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    # 让外键生效（Prisma migration 中有外键）
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    return conn


def _close_connection(conn: Optional[sqlite3.Connection]) -> None:
    if conn is None:
        return

    try:
        conn.close()
    except Exception:
        pass


def _db_fingerprint(db_path: str) -> tuple[int, int, int, int] | None:
    try:
        stat = Path(db_path).stat()
    except FileNotFoundError:
        return None

    return (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns)


def _open_connection(db_path: str) -> tuple[sqlite3.Connection, tuple[int, int, int, int] | None]:
    conn = _connect(db_path)
    return conn, _db_fingerprint(db_path)


def _reconnect(
    conn: Optional[sqlite3.Connection],
    db_path: str,
    *,
    reason: str,
) -> tuple[sqlite3.Connection, tuple[int, int, int, int] | None]:
    print(f"[worker] reconnecting SQLite connection: {reason}")
    _close_connection(conn)
    return _open_connection(db_path)


def _refresh_polling_connection(
    conn: sqlite3.Connection,
    db_path: str,
) -> tuple[sqlite3.Connection, tuple[int, int, int, int] | None]:
    _close_connection(conn)
    return _open_connection(db_path)


def _ensure_fresh_connection(
    conn: sqlite3.Connection,
    db_path: str,
    fingerprint: tuple[int, int, int, int] | None,
) -> tuple[sqlite3.Connection, tuple[int, int, int, int] | None]:
    latest_fingerprint = _db_fingerprint(db_path)
    if latest_fingerprint == fingerprint:
        return conn, fingerprint

    return _reconnect(
        conn,
        db_path,
        reason=f"database file changed from {fingerprint} to {latest_fingerprint}",
    )


def _handle_job(
    conn: sqlite3.Connection,
    worker_id: str,
    job: dict,
    music_root: str,
    cache_root: str,
) -> None:
    job_id = job["id"]
    job_type = job["type"]

    try:
        # 启动后立即打一次心跳，便于“运行中”可被观察到
        heartbeat(conn, job_id, worker_id)

        payload = {}
        try:
            payload = json.loads(job.get("payloadJson") or "{}")
        except Exception:
            payload = {}

        if job_type == "scan_full":
            root = payload.get("musicRoot") or music_root
            scan_full(
                conn,
                root,
                on_progress=lambda progress: update_progress(conn, job_id, worker_id, progress),
            )
            mark_done(conn, job_id, worker_id)
            return

        if job_type == "transcode_prepare":
            duplicate_count = cancel_duplicate_pending_jobs(
                conn,
                job_id=job_id,
                job_type=job_type,
                payload_json=job.get("payloadJson"),
                reason="同一转码任务已被更早领取，重复排队项已取消",
            )
            if duplicate_count > 0:
                print(f"[worker] cancelled {duplicate_count} duplicate pending transcode jobs for {job_id}")

            transcode_prepare(
                conn,
                payload,
                cache_root=cache_root,
                on_progress=lambda progress: update_progress(conn, job_id, worker_id, progress),
                should_continue=lambda: should_continue(conn, job_id, worker_id),
            )
            mark_done(conn, job_id, worker_id)
            return

        raise RuntimeError(f"Unsupported job type: {job_type}")
    except JobCancelled as e:
        mark_cancelled(conn, job_id, worker_id, str(e))
    except Exception as e:
        try:
            mark_failed(conn, job_id, worker_id, e)
        except sqlite3.Error as db_error:
            print(f"[worker] failed to persist job failure for {job_id}: {db_error}")
            raise


def main() -> None:
    db_path = _db_path_from_env()
    music_root = os.environ.get("MUSIC_ROOT", "/music")
    cache_root = os.environ.get("CACHE_ROOT", "/cache")
    worker_id = os.environ.get("WORKER_ID", _default_worker_id())

    print(f"[worker] WORKER_ID={worker_id}")
    print(f"[worker] DATABASE_PATH={db_path}")
    print(f"[worker] MUSIC_ROOT={music_root}")
    print(f"[worker] CACHE_ROOT={cache_root}")

    conn, fingerprint = _open_connection(db_path)

    try:
        while True:
            try:
                # 开发环境里宿主机 / Docker / Prisma / sqlite3 可能分别持有不同文件句柄，
                # 空闲轮询阶段主动刷新连接，确保下一次 claim 读取的是最新数据库视图。
                conn, fingerprint = _refresh_polling_connection(conn, db_path)
                job = claim_next_job(conn, worker_id)
            except sqlite3.Error as error:
                conn, fingerprint = _reconnect(
                    conn,
                    db_path,
                    reason=f"polling failed with sqlite error: {error}",
                )
                time.sleep(POLL_INTERVAL_S)
                continue

            if job is None:
                time.sleep(POLL_INTERVAL_S)
                continue

            print(
                f"[worker] claimed job id={job['id']} type={job['type']} "
                f"attempts={job['attempts']}/{job['maxAttempts']}"
            )

            try:
                _handle_job(conn, worker_id, job, music_root, cache_root)
            except sqlite3.Error as error:
                conn, fingerprint = _reconnect(
                    conn,
                    db_path,
                    reason=f"job {job['id']} failed with sqlite error: {error}",
                )
                time.sleep(POLL_INTERVAL_S)
    finally:
        _close_connection(conn)


if __name__ == "__main__":
    main()
