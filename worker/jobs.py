import json
import sqlite3
import time
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional


def _utc_now_sqlite() -> str:
    """
    Prisma/SQLite 默认 CURRENT_TIMESTAMP 形如：'YYYY-MM-DD HH:MM:SS'（UTC）。
    这里统一按该格式写入，便于 DATETIME 比较。
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _as_job_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return dict(row)  # Row -> dict


def claim_next_job(
    conn: sqlite3.Connection,
    worker_id: str,
    *,
    heartbeat_timeout_s: int = 60,
    max_claim_retries: int = 3,
) -> Optional[Dict[str, Any]]:
    """
    领取下一条可执行任务（pending 优先，其次回收 heartbeat 超时的 running）。
    约束：attempts < maxAttempts。

    注意：SQL 中必须使用 camelCase 列名（payloadJson/lockedBy/lockedAt/heartbeatAt/maxAttempts/...）。
    """
    conn.row_factory = sqlite3.Row

    for _ in range(max_claim_retries):
        now = _utc_now_sqlite()
        stale_before = (
            datetime.strptime(now, "%Y-%m-%d %H:%M:%S")
            - timedelta(seconds=heartbeat_timeout_s)
        ).strftime("%Y-%m-%d %H:%M:%S")

        # BEGIN IMMEDIATE：避免并发 worker 同时 claim 同一条 job
        conn.execute("BEGIN IMMEDIATE")
        try:
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
                    OR ("status" = 'running' AND ("heartbeatAt" IS NULL OR "heartbeatAt" < ?))
                  )
                  AND "attempts" < "maxAttempts"
                ORDER BY
                  CASE WHEN "status" = 'pending' THEN 0 ELSE 1 END ASC,
                  "priority" DESC,
                  "createdAt" ASC
                LIMIT 1
                """,
                (stale_before,),
            ).fetchone()

            if row is None:
                conn.execute("COMMIT")
                return None

            job_id = row["id"]
            # 原子更新：仅当仍满足可领取条件时才更新成功
            cur = conn.execute(
                """
                UPDATE "jobs"
                SET
                  "status" = 'running',
                  "lockedBy" = ?,
                  "lockedAt" = ?,
                  "heartbeatAt" = ?,
                  "attempts" = "attempts" + 1,
                  "updatedAt" = ?
                WHERE
                  "id" = ?
                  AND (
                    ("status" = 'pending')
                    OR ("status" = 'running' AND ("heartbeatAt" IS NULL OR "heartbeatAt" < ?))
                  )
                  AND "attempts" < "maxAttempts"
                """,
                (worker_id, now, now, now, job_id, stale_before),
            )

            if cur.rowcount != 1:
                # 被其他 worker 抢走或状态变化：重试
                conn.execute("ROLLBACK")
                continue

            claimed = conn.execute(
                """
                SELECT
                  "id","type","status","priority","payloadJson","progress",
                  "attempts","maxAttempts","lockedBy","lockedAt","heartbeatAt",
                  "errorJson","createdAt","updatedAt"
                FROM "jobs"
                WHERE "id" = ?
                """,
                (job_id,),
            ).fetchone()
            conn.execute("COMMIT")
            return _as_job_dict(claimed)
        except Exception:
            conn.execute("ROLLBACK")
            raise

    return None


def heartbeat(conn: sqlite3.Connection, job_id: str, worker_id: str) -> bool:
    """更新 running job 的 heartbeatAt（仅允许锁持有者更新）。"""
    now = _utc_now_sqlite()
    cur = conn.execute(
        """
        UPDATE "jobs"
        SET "heartbeatAt" = ?, "updatedAt" = ?
        WHERE "id" = ? AND "status" = 'running' AND "lockedBy" = ?
        """,
        (now, now, job_id, worker_id),
    )
    return cur.rowcount == 1


def mark_done(conn: sqlite3.Connection, job_id: str, worker_id: str) -> None:
    """标记任务完成，释放锁。"""
    now = _utc_now_sqlite()
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
          "updatedAt" = ?
        WHERE "id" = ? AND "lockedBy" = ?
        """,
        (now, job_id, worker_id),
    )
    conn.commit()


def mark_failed(conn: sqlite3.Connection, job_id: str, worker_id: str, err: Exception) -> None:
    """
    标记任务失败：
    - 若 attempts < maxAttempts：回到 pending（允许重试）
    - 否则：标记 failed
    """
    conn.row_factory = sqlite3.Row
    now = _utc_now_sqlite()
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

    row = conn.execute(
        """
        SELECT "attempts","maxAttempts"
        FROM "jobs"
        WHERE "id" = ?
        """,
        (job_id,),
    ).fetchone()

    # 如果查不到（极端情况），直接当作 failed
    if row is None:
        next_status = "failed"
    else:
        next_status = "pending" if row["attempts"] < row["maxAttempts"] else "failed"

    conn.execute(
        f"""
        UPDATE "jobs"
        SET
          "status" = '{next_status}',
          "errorJson" = ?,
          "progress" = 0,
          "lockedBy" = NULL,
          "lockedAt" = NULL,
          "heartbeatAt" = NULL,
          "updatedAt" = ?
        WHERE "id" = ? AND "lockedBy" = ?
        """,
        (error_json, now, job_id, worker_id),
    )
    conn.commit()

