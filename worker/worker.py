import json
import os
import random
import string
import time
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from psycopg import Connection, Error as PsycopgError, connect, sql
from psycopg.rows import dict_row

# 以 `python worker/worker.py` 方式运行时，sys.path[0] 为 worker/ 目录，
# 因此使用同目录导入（避免要求 worker/ 作为带 __init__.py 的包）。
from jobs import claim_next_job, heartbeat, mark_done, mark_failed, update_progress
from jobs import cancel_duplicate_pending_jobs, mark_cancelled, should_continue
from plan_executor import execute_plan
from scanner import scan_full
from track_edit_sync import execute_track_edit_sync
from transcoder import JobCancelled, transcode_prepare


POLL_INTERVAL_S = 2


def _database_dsn_from_env() -> tuple[str, str | None]:
    dsn = os.environ.get("DATABASE_URL", "").strip()
    if not dsn:
        raise RuntimeError("DATABASE_URL must be set to a PostgreSQL DSN")

    if dsn.startswith("file:"):
        raise RuntimeError("DATABASE_URL must point to PostgreSQL, not SQLite")

    parts = urlsplit(dsn)
    query_items = parse_qsl(parts.query, keep_blank_values=True)
    schema = None
    filtered_query: list[tuple[str, str]] = []
    for key, value in query_items:
        if key == "schema" and value.strip():
            schema = value.strip()
            continue
        filtered_query.append((key, value))

    normalized_dsn = urlunsplit(parts._replace(query=urlencode(filtered_query)))
    return normalized_dsn, schema


def _redact_dsn(dsn: str) -> str:
    parts = urlsplit(dsn)
    if "@" not in parts.netloc:
        return dsn

    credentials, host = parts.netloc.rsplit("@", 1)
    if ":" not in credentials:
        return dsn

    username, _password = credentials.split(":", 1)
    return urlunsplit(parts._replace(netloc=f"{username}:***@{host}"))


def _default_worker_id() -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
    return f"worker-{suffix}"


def _connect(dsn: str, schema: str | None) -> Connection:
    conn = connect(dsn, connect_timeout=30, autocommit=True, row_factory=dict_row)
    conn.execute("SET TIME ZONE 'UTC'")
    if schema:
        conn.execute(
            sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)),
        )
    return conn


def _close_connection(conn: Optional[Connection]) -> None:
    if conn is None:
        return

    try:
        conn.close()
    except Exception:
        pass


def _open_connection(dsn: str, schema: str | None) -> Connection:
    return _connect(dsn, schema)


def _reconnect(
    conn: Optional[Connection],
    dsn: str,
    schema: str | None,
    *,
    reason: str,
) -> Connection:
    print(f"[worker] reconnecting PostgreSQL connection: {reason}")
    _close_connection(conn)
    return _open_connection(dsn, schema)


def _handle_job(
    conn: Connection,
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
                on_progress=lambda progress, progress_detail: update_progress(
                    conn,
                    job_id,
                    worker_id,
                    progress,
                    json.dumps(progress_detail, ensure_ascii=False),
                ),
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

        if job_type == "plan_execute":
            execute_plan(
                conn,
                payload,
                on_progress=lambda progress: update_progress(conn, job_id, worker_id, progress),
                should_continue=lambda: should_continue(conn, job_id, worker_id),
            )
            mark_done(conn, job_id, worker_id)
            return

        if job_type == "track_edit_sync":
            execute_track_edit_sync(
                conn,
                payload,
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
        except PsycopgError as db_error:
            print(f"[worker] failed to persist job failure for {job_id}: {db_error}")
            raise


def main() -> None:
    dsn, schema = _database_dsn_from_env()
    music_root = os.environ.get("MUSIC_ROOT", "/music")
    cache_root = os.environ.get("CACHE_ROOT", "/cache")
    worker_id = os.environ.get("WORKER_ID", _default_worker_id())

    print(f"[worker] WORKER_ID={worker_id}")
    print(f"[worker] DATABASE_URL={_redact_dsn(dsn)}")
    if schema:
        print(f"[worker] DATABASE_SCHEMA={schema}")
    print(f"[worker] MUSIC_ROOT={music_root}")
    print(f"[worker] CACHE_ROOT={cache_root}")

    conn = _open_connection(dsn, schema)

    try:
        while True:
            try:
                job = claim_next_job(conn, worker_id)
            except PsycopgError as error:
                conn = _reconnect(
                    conn,
                    dsn,
                    schema,
                    reason=f"polling failed with postgres error: {error}",
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
            except PsycopgError as error:
                conn = _reconnect(
                    conn,
                    dsn,
                    schema,
                    reason=f"job {job['id']} failed with postgres error: {error}",
                )
                time.sleep(POLL_INTERVAL_S)
    finally:
        _close_connection(conn)


if __name__ == "__main__":
    main()
