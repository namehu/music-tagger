import os
import sqlite3
import sys
import tempfile
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

        CREATE TABLE "tracks" (
          "id" TEXT PRIMARY KEY,
          "path" TEXT NOT NULL,
          "dirPath" TEXT NOT NULL,
          "filename" TEXT NOT NULL,
          "fileSize" INTEGER NOT NULL,
          "mtimeMs" INTEGER NOT NULL,
          "tagsJson" TEXT,
          "titleOverride" TEXT,
          "artistOverride" TEXT,
          "albumOverride" TEXT,
          "albumArtistOverride" TEXT,
          "trackNoOverride" INTEGER,
          "discNoOverride" INTEGER,
          "yearOverride" INTEGER,
          "genreOverride" TEXT,
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
            ("plan_other", "delete", "confirmed"),
        )
        self.conn.execute(
            """
            INSERT INTO "plan_items"
              ("id", "planId", "kind", "trackId", "fromPath", "status", "createdAt", "updatedAt")
            VALUES
              (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            ("item_other", "plan_other", "delete", "track_2", "/tmp/track.mp3", "pending"),
        )
        self.conn.commit()

        with self.assertRaisesRegex(RuntimeError, "Unsupported plan type"):
            plan_executor.execute_plan(self.conn, {"planId": "plan_other"})

    def test_execute_plan_moves_file_and_updates_track_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            music_root = Path(tmpdir)
            source_dir = music_root / "source"
            target_dir = music_root / "Artist" / "Album"
            source_dir.mkdir(parents=True)
            source_path = source_dir / "song.flac"
            source_path.write_bytes(b"music")

            self.conn.execute(
                'INSERT INTO "plans" ("id", "type", "status") VALUES (?, ?, ?)',
                ("plan_move", "move", "confirmed"),
            )
            self.conn.execute(
                """
                INSERT INTO "tracks"
                  ("id", "path", "dirPath", "filename", "fileSize", "mtimeMs", "updatedAt")
                VALUES
                  (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    "track_move",
                    str(source_path),
                    str(source_dir),
                    source_path.name,
                    source_path.stat().st_size,
                    int(source_path.stat().st_mtime_ns // 1_000_000),
                ),
            )
            self.conn.execute(
                """
                INSERT INTO "plan_items"
                  ("id", "planId", "kind", "trackId", "fromPath", "toPath", "warningsJson", "status", "createdAt", "updatedAt")
                VALUES
                  (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    "item_move",
                    "plan_move",
                    "move",
                    "track_move",
                    str(source_path),
                    str(target_dir / source_path.name),
                    "[]",
                    "pending",
                ),
            )
            self.conn.commit()

            with patch.dict(os.environ, {"MUSIC_ROOT": str(music_root)}):
                result = plan_executor.execute_plan(self.conn, {"planId": "plan_move"})

            self.assertEqual(result, {"total": 1, "failed": 0})
            self.assertEqual(source_path.exists(), False)
            self.assertEqual((target_dir / source_path.name).exists(), True)

            track_row = self.conn.execute(
                'SELECT "path", "dirPath", "filename" FROM "tracks" WHERE "id" = ?',
                ("track_move",),
            ).fetchone()
            self.assertEqual(track_row["path"], str(target_dir / source_path.name))
            self.assertEqual(track_row["dirPath"], str(target_dir))
            self.assertEqual(track_row["filename"], source_path.name)

    def test_execute_plan_rejects_move_outside_music_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            music_root = Path(tmpdir)
            source_dir = music_root / "source"
            source_dir.mkdir(parents=True)
            source_path = source_dir / "song.flac"
            source_path.write_bytes(b"music")

            self.conn.execute(
                'INSERT INTO "plans" ("id", "type", "status") VALUES (?, ?, ?)',
                ("plan_move_escape", "move", "confirmed"),
            )
            self.conn.execute(
                """
                INSERT INTO "tracks"
                  ("id", "path", "dirPath", "filename", "fileSize", "mtimeMs", "updatedAt")
                VALUES
                  (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    "track_escape",
                    str(source_path),
                    str(source_dir),
                    source_path.name,
                    source_path.stat().st_size,
                    int(source_path.stat().st_mtime_ns // 1_000_000),
                ),
            )
            self.conn.execute(
                """
                INSERT INTO "plan_items"
                  ("id", "planId", "kind", "trackId", "fromPath", "toPath", "warningsJson", "status", "createdAt", "updatedAt")
                VALUES
                  (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    "item_move_escape",
                    "plan_move_escape",
                    "move",
                    "track_escape",
                    str(source_path),
                    str(Path(tmpdir).parent / "outside" / source_path.name),
                    "[]",
                    "pending",
                ),
            )
            self.conn.commit()

            with patch.dict(os.environ, {"MUSIC_ROOT": str(music_root)}):
                with self.assertRaisesRegex(RuntimeError, "Plan 执行完成，但有 1 个计划项失败"):
                    plan_executor.execute_plan(self.conn, {"planId": "plan_move_escape"})

            item_row = self.conn.execute(
                'SELECT "status", "errorJson" FROM "plan_items" WHERE "id" = ?',
                ("item_move_escape",),
            ).fetchone()
            self.assertEqual(item_row["status"], "failed")
            self.assertIn("目标文件路径超出音乐根目录", item_row["errorJson"])


if __name__ == "__main__":
    unittest.main()
