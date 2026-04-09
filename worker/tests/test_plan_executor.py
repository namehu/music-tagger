import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


WORKER_DIR = Path(__file__).resolve().parents[1]
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

TESTS_DIR = Path(__file__).resolve().parent
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))

import plan_executor  # noqa: E402
from fake_db import FakeConnection  # noqa: E402


class ExecutePlanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = FakeConnection()

    def tearDown(self) -> None:
        self.conn.close()

    def test_execute_plan_supports_tag_write_plan_type(self) -> None:
        self.conn.seed_plan(id="plan_tag", type="tag_write", status="confirmed")
        self.conn.seed_plan_item(
            id="item_1",
            planId="plan_tag",
            kind="tag_write",
            trackId="track_1",
            fromPath="/tmp/track.mp3",
            status="pending",
        )

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
        self.conn.seed_plan(id="plan_other", type="delete", status="confirmed")
        self.conn.seed_plan_item(
            id="item_other",
            planId="plan_other",
            kind="delete",
            trackId="track_2",
            fromPath="/tmp/track.mp3",
            status="pending",
        )

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

            self.conn.seed_plan(id="plan_move", type="move", status="confirmed")
            self.conn.seed_track(
                id="track_move",
                path=str(source_path),
                dirPath=str(source_dir),
                filename=source_path.name,
                fileSize=source_path.stat().st_size,
                mtimeMs=int(source_path.stat().st_mtime_ns // 1_000_000),
                updatedAt=1,
            )
            self.conn.seed_plan_item(
                id="item_move",
                planId="plan_move",
                kind="move",
                trackId="track_move",
                fromPath=str(source_path),
                toPath=str(target_dir / source_path.name),
                warningsJson="[]",
                status="pending",
            )

            with patch.dict(os.environ, {"MUSIC_ROOT": str(music_root)}):
                result = plan_executor.execute_plan(self.conn, {"planId": "plan_move"})

            self.assertEqual(result, {"total": 1, "failed": 0})
            self.assertFalse(source_path.exists())
            self.assertTrue((target_dir / source_path.name).exists())

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

            self.conn.seed_plan(id="plan_move_escape", type="move", status="confirmed")
            self.conn.seed_track(
                id="track_escape",
                path=str(source_path),
                dirPath=str(source_dir),
                filename=source_path.name,
                fileSize=source_path.stat().st_size,
                mtimeMs=int(source_path.stat().st_mtime_ns // 1_000_000),
                updatedAt=1,
            )
            self.conn.seed_plan_item(
                id="item_move_escape",
                planId="plan_move_escape",
                kind="move",
                trackId="track_escape",
                fromPath=str(source_path),
                toPath=str(Path(tmpdir).parent / "outside" / source_path.name),
                warningsJson="[]",
                status="pending",
            )

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
