import json
import time
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from psycopg import Connection


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_job_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    return dict(row)


def _state_error_json(message: str, error_type: str) -> str:
    return json.dumps(
        {
            "message": message,
            "type": error_type,
            "atMs": int(time.time() * 1000),
        },
        ensure_ascii=False,
    )


def claim_next_job(
    conn: Connection,
    worker_id: str,
    *,
    heartbeat_timeout_s: int = 60,
    max_claim_retries: int = 3,
) -> Optional[Dict[str, Any]]:
    """
    领取下一条可执行任务（pending 优先，其次回收 heartbeat 超时的 running）。
    约束：attempts < maxAttempts。
    """
    for _ in range(max_claim_retries):
        now = _utc_now()
        stale_before = now - timedelta(seconds=heartbeat_timeout_s)

        with conn.transaction():
            row = conn.execute(
                """
                SELECT
                  "id","type","status","priority","payloadJson","progress",
                  "attempts","maxAttempts","lockedBy","lockedAt","heartbeatAt",
                  "errorJson","createdAt","updatedAt"
                FROM "jobs"
                WHERE
                  (
                    ("status" = 'pending')
                    OR ("status" = 'running' AND ("heartbeatAt" IS NULL OR "heartbeatAt" < %s))
                  )
                  AND "attempts" < "maxAttempts"
                ORDER BY
                  CASE WHEN "status" = 'pending' THEN 0 ELSE 1 END ASC,
                  "priority" DESC,
                  "createdAt" ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
                """,
                (stale_before,),
            ).fetchone()

            if row is None:
                return None

            claimed = conn.execute(
                """
                UPDATE "jobs"
                SET
                  "status" = 'running',
                  "lockedBy" = %s,
                  "lockedAt" = %s,
                  "heartbeatAt" = %s,
                  "attempts" = "attempts" + 1,
                  "updatedAt" = %s
                WHERE "id" = %s
                RETURNING
                  "id","type","status","priority","payloadJson","progress",
                  "attempts","maxAttempts","lockedBy","lockedAt","heartbeatAt",
                  "errorJson","createdAt","updatedAt"
                """,
                (worker_id, now, now, now, row["id"]),
            ).fetchone()

            if claimed is None:
                raise RuntimeError("job claim lost the row lock unexpectedly")

            return _as_job_dict(claimed)

    return None


def heartbeat(conn: Connection, job_id: str, worker_id: str) -> bool:
    now = _utc_now()
    cur = conn.execute(
        """
        UPDATE "jobs"
        SET "heartbeatAt" = %s, "updatedAt" = %s
        WHERE "id" = %s AND "status" = 'running' AND "lockedBy" = %s
        """,
        (now, now, job_id, worker_id),
    )
    return cur.rowcount == 1


def should_continue(conn: Connection, job_id: str, worker_id: str) -> bool:
    row = conn.execute(
        """
        SELECT "status","lockedBy"
        FROM "jobs"
        WHERE "id" = %s
        """,
        (job_id,),
    ).fetchone()
    if row is None:
        return False

    return row["status"] == "running" and row["lockedBy"] == worker_id


def cancel_duplicate_pending_jobs(
    conn: Connection,
    *,
    job_id: str,
    job_type: str,
    payload_json: str | None,
    reason: str,
) -> int:
    if job_type != "transcode_prepare" or not payload_json:
        return 0

    now = _utc_now()
    error_json = _state_error_json(reason, "DuplicateTranscodeJob")
    cur = conn.execute(
        """
        UPDATE "jobs"
        SET
          "status" = 'cancelled',
          "progress" = 0,
          "errorJson" = %s,
          "updatedAt" = %s
        WHERE
          "id" != %s
          AND "type" = 'transcode_prepare'
          AND "status" = 'pending'
          AND "payloadJson" = %s
        """,
        (error_json, now, job_id, payload_json),
    )
    conn.commit()
    return cur.rowcount


def update_progress(
    conn: Connection,
    job_id: str,
    worker_id: str,
    progress: float,
    progress_json: str | None = None,
) -> bool:
    now = _utc_now()
    safe_progress = max(0.0, min(1.0, progress))
    if progress_json is None:
        cur = conn.execute(
            """
            UPDATE "jobs"
            SET "progress" = %s, "heartbeatAt" = %s, "updatedAt" = %s
            WHERE "id" = %s AND "status" = 'running' AND "lockedBy" = %s
            """,
            (safe_progress, now, now, job_id, worker_id),
        )
    else:
        cur = conn.execute(
            """
            UPDATE "jobs"
            SET "progress" = %s, "progressJson" = %s, "heartbeatAt" = %s, "updatedAt" = %s
            WHERE "id" = %s AND "status" = 'running' AND "lockedBy" = %s
            """,
            (safe_progress, progress_json, now, now, job_id, worker_id),
        )
    conn.commit()
    return cur.rowcount == 1


def mark_done(conn: Connection, job_id: str, worker_id: str) -> None:
    now = _utc_now()
    conn.execute(
        """
        UPDATE "jobs"
        SET
          "status" = 'done',
          "progress" = 1,
          "errorJson" = NULL,
          "lockedBy" = NULL,
          "lockedAt" = NULL,
          "heartbeatAt" = NULL,
          "updatedAt" = %s
        WHERE "id" = %s AND "lockedBy" = %s
        """,
        (now, job_id, worker_id),
    )
    conn.commit()


def mark_cancelled(
    conn: Connection,
    job_id: str,
    worker_id: str,
    reason: str,
) -> None:
    now = _utc_now()
    error_json = _state_error_json(reason, "JobCancelled")
    conn.execute(
        """
        UPDATE "jobs"
        SET
          "status" = 'cancelled',
          "progress" = 0,
          "errorJson" = %s,
          "lockedBy" = NULL,
          "lockedAt" = NULL,
          "heartbeatAt" = NULL,
          "updatedAt" = %s
        WHERE "id" = %s AND "lockedBy" = %s
        """,
        (error_json, now, job_id, worker_id),
    )
    conn.commit()


def mark_failed(conn: Connection, job_id: str, worker_id: str, err: Exception) -> None:
    now = _utc_now()
    tb = traceback.format_exc()
    error_json = json.dumps(
        {
            "message": str(err),
            "type": err.__class__.__name__,
            "traceback": tb,
            "atMs": int(time.time() * 1000),
        },
        ensure_ascii=False,
    )

    conn.execute(
        """
        UPDATE "jobs"
        SET
          "status" = CASE WHEN "attempts" < "maxAttempts" THEN 'pending' ELSE 'failed' END,
          "errorJson" = %s,
          "progress" = 0,
          "lockedBy" = NULL,
          "lockedAt" = NULL,
          "heartbeatAt" = NULL,
          "updatedAt" = %s
        WHERE "id" = %s AND "lockedBy" = %s
        """,
        (error_json, now, job_id, worker_id),
    )
    conn.commit()
