import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


WORKER_DIR = Path(__file__).resolve().parents[1]
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

import scanner  # noqa: E402


def _setup_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE "tracks" (
          "id" TEXT PRIMARY KEY,
          "path" TEXT NOT NULL UNIQUE,
          "dirPath" TEXT NOT NULL,
          "filename" TEXT NOT NULL,
          "fileSize" INTEGER NOT NULL,
          "mtimeMs" INTEGER NOT NULL,
          "container" TEXT NOT NULL,
          "durationMs" INTEGER NOT NULL,
          "bitrateKbps" INTEGER,
          "sampleRate" INTEGER,
          "bitDepth" INTEGER,
          "channels" INTEGER,
          "title" TEXT,
          "artist" TEXT,
          "album" TEXT,
          "albumArtist" TEXT,
          "trackNo" INTEGER,
          "discNo" INTEGER,
          "year" INTEGER,
          "genre" TEXT,
          "tagsJson" TEXT,
          "artworkKind" TEXT,
          "artworkMime" TEXT,
          "artworkHash" TEXT,
          "observedArtworkAssetPath" TEXT,
          "lyricsKind" TEXT,
          "lyricsHash" TEXT,
          "observedLyricsText" TEXT,
          "updatedAt" TEXT
        );
        """
    )
    conn.commit()


class ScanFullTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        _setup_schema(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def test_scan_full_extracts_embedded_cover_into_track_sidecar(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            music_root = Path(tmpdir) / "music"
            music_root.mkdir()
            track_path = music_root / "song.mp3"
            track_path.write_bytes(b"fake-audio")

            with patch.object(
                scanner,
                "_probe_audio_file",
                return_value={
                    "duration_ms": 1000,
                    "bitrate_kbps": 320,
                    "sample_rate": 44100,
                    "bit_depth": 16,
                    "channels": 2,
                    "title": "Song",
                    "artist": "Artist",
                    "album": "Album",
                    "album_artist": "Artist",
                    "track_no": 1,
                    "disc_no": 1,
                    "year": 2024,
                    "genre": "Pop",
                    "tags_json": None,
                },
            ), patch.object(
                scanner,
                "_extract_embedded_media",
                return_value={
                    "lyrics_text": "hello world",
                    "lyrics_kind": "embedded",
                    "lyrics_hash": "lyrics-hash",
                    "artwork_bytes": b"\xff\xd8\xffcover",
                    "artwork_kind": "embedded",
                    "artwork_mime": "image/jpeg",
                    "artwork_hash": "cover-hash",
                },
            ):
                result = scanner.scan_full(self.conn, str(music_root))

            self.assertEqual(result, {"processed": 1, "skipped": 0, "deleted": 0})
            row = self.conn.execute('SELECT * FROM "tracks"').fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["lyricsKind"], "embedded")
            self.assertEqual(row["lyricsHash"], "lyrics-hash")
            self.assertEqual(row["observedLyricsText"], "hello world")
            self.assertEqual(row["artworkKind"], "sidecar")
            self.assertEqual(row["artworkMime"], "image/jpeg")
            self.assertTrue(str(row["observedArtworkAssetPath"]).endswith("/song.jpg"))

            observed_asset = Path(row["observedArtworkAssetPath"])
            self.assertTrue(observed_asset.exists())
            self.assertEqual(observed_asset.read_bytes(), b"\xff\xd8\xffcover")

    def test_scan_full_prefers_existing_sidecar_over_embedded_cover(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            music_root = Path(tmpdir) / "music"
            music_root.mkdir()
            track_path = music_root / "song.mp3"
            track_path.write_bytes(b"fake-audio")
            sidecar_path = music_root / "song.png"
            sidecar_path.write_bytes(b"\x89PNG\r\n\x1a\nsidecar")

            with patch.object(
                scanner,
                "_probe_audio_file",
                return_value={
                    "duration_ms": 1000,
                    "bitrate_kbps": 320,
                    "sample_rate": 44100,
                    "bit_depth": 16,
                    "channels": 2,
                    "title": "Song",
                    "artist": "Artist",
                    "album": "Album",
                    "album_artist": "Artist",
                    "track_no": 1,
                    "disc_no": 1,
                    "year": 2024,
                    "genre": "Pop",
                    "tags_json": None,
                },
            ), patch.object(
                scanner,
                "_extract_embedded_media",
                return_value={
                    "lyrics_text": None,
                    "lyrics_kind": None,
                    "lyrics_hash": None,
                    "artwork_bytes": b"\xff\xd8\xffembedded",
                    "artwork_kind": "embedded",
                    "artwork_mime": "image/jpeg",
                    "artwork_hash": "embedded-hash",
                },
            ):
                scanner.scan_full(self.conn, str(music_root))

            row = self.conn.execute('SELECT * FROM "tracks"').fetchone()
            self.assertEqual(row["artworkKind"], "sidecar")
            self.assertEqual(row["artworkMime"], "image/png")
            self.assertEqual(row["observedArtworkAssetPath"], str(sidecar_path.resolve()))
            self.assertEqual(sidecar_path.read_bytes(), b"\x89PNG\r\n\x1a\nsidecar")

    def test_scan_full_deletes_sidecar_for_stale_tracks(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            music_root = Path(tmpdir) / "music"
            music_root.mkdir()
            track_path = music_root / "song.mp3"
            track_path.write_bytes(b"fake-audio")

            with patch.object(
                scanner,
                "_probe_audio_file",
                return_value={
                    "duration_ms": 1000,
                    "bitrate_kbps": 320,
                    "sample_rate": 44100,
                    "bit_depth": 16,
                    "channels": 2,
                    "title": "Song",
                    "artist": "Artist",
                    "album": "Album",
                    "album_artist": "Artist",
                    "track_no": 1,
                    "disc_no": 1,
                    "year": 2024,
                    "genre": "Pop",
                    "tags_json": None,
                },
            ), patch.object(
                scanner,
                "_extract_embedded_media",
                return_value={
                    "lyrics_text": None,
                    "lyrics_kind": None,
                    "lyrics_hash": None,
                    "artwork_bytes": b"\x89PNG\r\n\x1a\ncover",
                    "artwork_kind": "embedded",
                    "artwork_mime": "image/png",
                    "artwork_hash": "cover-hash",
                },
            ):
                scanner.scan_full(self.conn, str(music_root))

            observed_asset = music_root / "song.png"
            self.assertTrue(observed_asset.exists())

            track_path.unlink()
            result = scanner.scan_full(self.conn, str(music_root))

            self.assertEqual(result, {"processed": 0, "skipped": 0, "deleted": 1})
            remaining = self.conn.execute('SELECT COUNT(*) AS "count" FROM "tracks"').fetchone()
            self.assertEqual(remaining["count"], 0)
            self.assertFalse(observed_asset.exists())


if __name__ == "__main__":
    unittest.main()
