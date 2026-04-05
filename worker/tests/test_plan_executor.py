import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


WORKER_DIR = Path(__file__).resolve().parents[1]
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

import plan_executor  # noqa: E402


def _setup_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE "plans" (
          "id" TEXT PRIMARY KEY,
          "type" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "errorJson" TEXT,
          "startedAt" TEXT,
          "completedAt" TEXT,
          "updatedAt" TEXT
        );

        CREATE TABLE "plan_items" (
          "id" TEXT PRIMARY KEY,
          "planId" TEXT NOT NULL,
          "kind" TEXT NOT NULL,
          "trackId" TEXT,
          "fromPath" TEXT,
          "toPath" TEXT,
          "warningsJson" TEXT,
          "tagDiffJson" TEXT,
          "status" TEXT NOT NULL,
          "errorJson" TEXT,
          "createdAt" TEXT,
          "updatedAt" TEXT
        );
        """
    )
    conn.commit()


class ExecutePlanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        _setup_schema(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def test_execute_plan_supports_tag_write_plan_type(self) -> None:
        self.conn.execute(
            'INSERT INTO "plans" ("id", "type", "status") VALUES (?, ?, ?)',
            ("plan_tag", "tag_write", "confirmed"),
        )
        self.conn.execute(
            """
            INSERT INTO "plan_items"
              ("id", "planId", "kind", "trackId", "fromPath", "status", "createdAt", "updatedAt")
            VALUES
              (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            ("item_1", "plan_tag", "tag_write", "track_1", "/tmp/track.mp3", "pending"),
        )
        self.conn.commit()

        with patch.object(plan_executor, "_execute_tag_write_item") as mock_execute_tag_write_item:
            result = plan_executor.execute_plan(self.conn, {"planId": "plan_tag"})

        self.assertEqual(result, {"total": 1, "failed": 0})
        mock_execute_tag_write_item.assert_called_once()

        plan_row = self.conn.execute(
            'SELECT "status", "errorJson", "completedAt" FROM "plans" WHERE "id" = ?',
            ("plan_tag",),
        ).fetchone()
        self.assertEqual(plan_row["status"], "done")
        self.assertIsNone(plan_row["errorJson"])
        self.assertIsNotNone(plan_row["completedAt"])

        item_row = self.conn.execute(
            'SELECT "status", "errorJson" FROM "plan_items" WHERE "id" = ?',
            ("item_1",),
        ).fetchone()
        self.assertEqual(item_row["status"], "done")
        self.assertIsNone(item_row["errorJson"])

    def test_execute_plan_still_rejects_unknown_plan_type(self) -> None:
        self.conn.execute(
            'INSERT INTO "plans" ("id", "type", "status") VALUES (?, ?, ?)',
            ("plan_other", "move", "confirmed"),
        )
        self.conn.execute(
            """
            INSERT INTO "plan_items"
              ("id", "planId", "kind", "trackId", "fromPath", "status", "createdAt", "updatedAt")
            VALUES
              (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            ("item_other", "plan_other", "move", "track_2", "/tmp/track.mp3", "pending"),
        )
        self.conn.commit()

        with self.assertRaisesRegex(RuntimeError, "Unsupported plan type"):
            plan_executor.execute_plan(self.conn, {"planId": "plan_other"})


if __name__ == "__main__":
    unittest.main()
