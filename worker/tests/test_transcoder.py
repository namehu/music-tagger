import sys
import tempfile
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import patch


WORKER_DIR = Path(__file__).resolve().parents[1]
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

if "psycopg" not in sys.modules:
    psycopg_stub = ModuleType("psycopg")
    psycopg_stub.Connection = object
    sys.modules["psycopg"] = psycopg_stub

import transcoder  # noqa: E402


class FakeResult:
    def __init__(self, rows: list[dict], rowcount: int = 0) -> None:
        self.rows = rows
        self.rowcount = rowcount

    def fetchone(self):
        return self.rows[0] if self.rows else None


class FakeConnection:
    def __init__(self, track: dict) -> None:
        self.track = track
        self.transcode_cache_rows: list[dict] = []

    def execute(self, query: str, params=()):
        normalized = " ".join(query.split())

        if normalized.startswith('SELECT "id","path","filename","mtimeMs" FROM "tracks" WHERE "id" = %s'):
            if params[0] != self.track["id"]:
                return FakeResult([], 0)
            return FakeResult([self.track], 1)

        if normalized.startswith('INSERT INTO "transcode_cache" ('):
            row = {
                "id": params[0],
                "trackId": params[1],
                "profile": params[2],
                "sourceMtimeMs": params[3],
                "cachePath": params[4],
                "contentType": params[5],
                "fileSize": params[6],
                "status": params[7],
                "errorJson": params[8],
                "updatedAt": params[9],
            }
            self.transcode_cache_rows.append(row)
            return FakeResult([], 1)

        raise NotImplementedError(f"Unsupported fake query: {normalized}")

    def commit(self) -> None:
        return None


class FakeCompletedProcess:
    def __init__(self, partial_path: Path) -> None:
        self.partial_path = partial_path
        self.returncode = 0
        self._poll_calls = 0

    def poll(self):
        self._poll_calls += 1
        if self._poll_calls == 1:
            self.partial_path.parent.mkdir(parents=True, exist_ok=True)
            self.partial_path.write_bytes(b"fake-mp3-data")
            return None
        return 0

    def communicate(self):
        return ("", "")

    def terminate(self) -> None:
        return None

    def kill(self) -> None:
        return None

    def wait(self, timeout=None) -> int:
        return 0


class TranscodePrepareTests(unittest.TestCase):
    def _create_source_track(self, tmpdir: str) -> tuple[FakeConnection, dict, Path]:
        source_path = Path(tmpdir) / "song.flac"
        source_path.write_bytes(b"source-audio")
        source_mtime_ms = int(source_path.stat().st_mtime_ns // 1_000_000)
        track = {
            "id": "track-1",
            "path": str(source_path),
            "filename": source_path.name,
            "mtimeMs": source_mtime_ms,
        }
        return FakeConnection(track), track, source_path

    def test_transcode_prepare_recreates_cache_dir_after_manual_cache_deletion(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            conn, track, source_path = self._create_source_track(tmpdir)
            cache_root = Path(tmpdir) / "cache"
            cache_root.mkdir(parents=True, exist_ok=True)
            cache_root.rmdir()

            def fake_popen(args, **kwargs):
                return FakeCompletedProcess(Path(args[-1]))

            with patch.object(transcoder.subprocess, "Popen", side_effect=fake_popen), patch.object(
                transcoder.time,
                "sleep",
                side_effect=lambda _seconds: None,
            ):
                result = transcoder.transcode_prepare(
                    conn,
                    {
                        "trackId": track["id"],
                        "profile": "mp3_192",
                        "sourcePath": str(source_path),
                        "sourceMtimeMs": track["mtimeMs"],
                    },
                    cache_root=str(cache_root),
                )

            final_path = cache_root / "tracks" / track["id"] / str(track["mtimeMs"]) / "mp3_192.mp3"
            self.assertTrue(final_path.exists())
            self.assertEqual(final_path.read_bytes(), b"fake-mp3-data")
            self.assertEqual(result["fileSize"], len(b"fake-mp3-data"))
            self.assertEqual(conn.transcode_cache_rows[-1]["status"], "ready")

    def test_transcode_prepare_wraps_cache_permission_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            conn, track, source_path = self._create_source_track(tmpdir)
            cache_root = Path(tmpdir) / "cache"
            final_path = cache_root / "tracks" / track["id"] / str(track["mtimeMs"]) / "mp3_192.mp3"
            original_stat = Path.stat

            def fake_stat(path_obj: Path, *args, **kwargs):
                if path_obj == final_path:
                    raise PermissionError(
                        f"[Errno 1] Operation not permitted: '{final_path}'"
                    )
                return original_stat(path_obj, *args, **kwargs)

            with patch.object(Path, "stat", autospec=True, side_effect=fake_stat):
                with self.assertRaisesRegex(
                    RuntimeError,
                    r"缓存路径读取状态失败: .*mp3_192\.mp3.*Operation not permitted",
                ):
                    transcoder.transcode_prepare(
                        conn,
                        {
                            "trackId": track["id"],
                            "profile": "mp3_192",
                            "sourcePath": str(source_path),
                            "sourceMtimeMs": track["mtimeMs"],
                        },
                        cache_root=str(cache_root),
                    )

            self.assertEqual(conn.transcode_cache_rows[-1]["status"], "failed")
            self.assertIn("Operation not permitted", conn.transcode_cache_rows[-1]["errorJson"])

    def test_unlink_cache_path_if_exists_ignores_missing_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            missing_path = Path(tmpdir) / "missing.partial"
            self.assertFalse(transcoder._unlink_cache_path_if_exists(missing_path))


if __name__ == "__main__":
    unittest.main()
