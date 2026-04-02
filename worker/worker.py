import json
import os
import random
import sqlite3
import string
import time
from pathlib import Path

# 以 `python worker/worker.py` 方式运行时，sys.path[0] 为 worker/ 目录，
# 因此使用同目录导入（避免要求 worker/ 作为带 __init__.py 的包）。
from jobs import claim_next_job, heartbeat, mark_done, mark_failed
from scanner import scan_full


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
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # 让外键生效（Prisma migration 中有外键）
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _handle_job(conn: sqlite3.Connection, worker_id: str, job: dict, music_root: str) -> None:
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
            scan_full(conn, root)
            mark_done(conn, job_id, worker_id)
            return

        raise RuntimeError(f"Unsupported job type: {job_type}")
    except Exception as e:
        mark_failed(conn, job_id, worker_id, e)


def main() -> None:
    db_path = _db_path_from_env()
    music_root = os.environ.get("MUSIC_ROOT", "/music")
    worker_id = os.environ.get("WORKER_ID", _default_worker_id())

    print(f"[worker] WORKER_ID={worker_id}")
    print(f"[worker] DATABASE_PATH={db_path}")
    print(f"[worker] MUSIC_ROOT={music_root}")

    conn = _connect(db_path)

    while True:
        job = claim_next_job(conn, worker_id)
        if job is None:
            time.sleep(2)
            continue

        print(f"[worker] claimed job id={job['id']} type={job['type']} attempts={job['attempts']}/{job['maxAttempts']}")
        _handle_job(conn, worker_id, job, music_root)


if __name__ == "__main__":
    main()
