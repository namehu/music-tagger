import json
import os
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


def _utc_now_sqlite() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


SUPPORTED_AUDIO_EXTENSIONS = {
    ".aac",
    ".aiff",
    ".alac",
    ".ape",
    ".flac",
    ".m4a",
    ".mp3",
    ".ogg",
    ".opus",
    ".wav",
    ".wma",
}


def _iter_audio_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
            continue
        files.append(path.resolve())
    files.sort()
    return files


def _parse_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def _parse_fraction_int(value: Any) -> int | None:
    if not isinstance(value, str):
        return _parse_int(value)
    part = value.split("/", 1)[0].strip()
    return _parse_int(part)


def _normalize_tags(tags: dict[str, Any] | None) -> dict[str, str]:
    if not tags:
        return {}
    normalized: dict[str, str] = {}
    for key, value in tags.items():
        if value is None:
            continue
        text = str(value).strip()
        if not text:
            continue
        normalized[key.lower()] = text
    return normalized


def _probe_audio_file(path: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or f"ffprobe exited with {result.returncode}"
        raise RuntimeError(f"ffprobe failed for {path}: {message}")

    payload = json.loads(result.stdout or "{}")
    streams = payload.get("streams") or []
    audio_stream = next((stream for stream in streams if stream.get("codec_type") == "audio"), {})
    format_info = payload.get("format") or {}
    tags = _normalize_tags(format_info.get("tags"))

    duration_seconds = format_info.get("duration")
    duration_ms = 0
    if duration_seconds not in (None, ""):
        try:
            duration_ms = max(0, int(float(duration_seconds) * 1000))
        except (TypeError, ValueError):
            duration_ms = 0

    bitrate_raw = format_info.get("bit_rate") or audio_stream.get("bit_rate")
    bitrate_bps = _parse_int(bitrate_raw)
    bit_depth = _parse_int(audio_stream.get("bits_per_raw_sample")) or _parse_int(
        audio_stream.get("bits_per_sample")
    )

    return {
        "duration_ms": duration_ms,
        "bitrate_kbps": int(round(bitrate_bps / 1000)) if bitrate_bps else None,
        "sample_rate": _parse_int(audio_stream.get("sample_rate")),
        "bit_depth": bit_depth,
        "channels": _parse_int(audio_stream.get("channels")),
        "title": tags.get("title"),
        "artist": tags.get("artist"),
        "album": tags.get("album"),
        "album_artist": tags.get("album_artist") or tags.get("albumartist"),
        "track_no": _parse_fraction_int(tags.get("track")),
        "disc_no": _parse_fraction_int(tags.get("disc")),
        "year": _parse_int(tags.get("date")) or _parse_int(tags.get("year")),
        "genre": tags.get("genre"),
        "tags_json": json.dumps(tags, ensure_ascii=False) if tags else None,
    }


def _upsert_track(conn: sqlite3.Connection, track: dict[str, Any]) -> None:
    now = _utc_now_sqlite()
    conn.execute(
        """
        INSERT INTO "tracks" (
          "id","path","dirPath","filename",
          "fileSize","mtimeMs","container","durationMs",
          "bitrateKbps","sampleRate","bitDepth","channels",
          "title","artist","album","albumArtist","trackNo","discNo","year","genre","tagsJson",
          "updatedAt"
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT("path") DO UPDATE SET
          "dirPath" = excluded."dirPath",
          "filename" = excluded."filename",
          "fileSize" = excluded."fileSize",
          "mtimeMs" = excluded."mtimeMs",
          "container" = excluded."container",
          "durationMs" = excluded."durationMs",
          "bitrateKbps" = excluded."bitrateKbps",
          "sampleRate" = excluded."sampleRate",
          "bitDepth" = excluded."bitDepth",
          "channels" = excluded."channels",
          "title" = excluded."title",
          "artist" = excluded."artist",
          "album" = excluded."album",
          "albumArtist" = excluded."albumArtist",
          "trackNo" = excluded."trackNo",
          "discNo" = excluded."discNo",
          "year" = excluded."year",
          "genre" = excluded."genre",
          "tagsJson" = excluded."tagsJson",
          "updatedAt" = excluded."updatedAt"
        """,
        (
            track["id"],
            track["path"],
            track["dirPath"],
            track["filename"],
            track["fileSize"],
            track["mtimeMs"],
            track["container"],
            track["durationMs"],
            track["bitrateKbps"],
            track["sampleRate"],
            track["bitDepth"],
            track["channels"],
            track["title"],
            track["artist"],
            track["album"],
            track["albumArtist"],
            track["trackNo"],
            track["discNo"],
            track["year"],
            track["genre"],
            track["tagsJson"],
            now,
        ),
    )


def _cleanup_stale_tracks(conn: sqlite3.Connection, root: Path, seen_paths: set[str]) -> int:
    root_path = str(root)
    root_prefix = f"{root_path}{os.sep}"
    rows = conn.execute(
        """
        SELECT "path"
        FROM "tracks"
        WHERE "path" = ? OR "path" LIKE ?
        """,
        (root_path, f"{root_prefix}%"),
    ).fetchall()

    stale_paths = [row["path"] for row in rows if row["path"] not in seen_paths]
    if not stale_paths:
        return 0

    conn.executemany(
        """
        DELETE FROM "tracks"
        WHERE "path" = ?
        """,
        ((path,) for path in stale_paths),
    )
    conn.commit()
    return len(stale_paths)


def _build_track_record(path: Path) -> dict[str, Any]:
    stat = path.stat()
    probe = _probe_audio_file(path)
    return {
        "id": uuid.uuid4().hex,
        "path": str(path),
        "dirPath": str(path.parent),
        "filename": path.name,
        "fileSize": int(stat.st_size),
        "mtimeMs": int(stat.st_mtime_ns // 1_000_000),
        "container": path.suffix.lower().lstrip("."),
        "durationMs": probe["duration_ms"],
        "bitrateKbps": probe["bitrate_kbps"],
        "sampleRate": probe["sample_rate"],
        "bitDepth": probe["bit_depth"],
        "channels": probe["channels"],
        "title": probe["title"],
        "artist": probe["artist"],
        "album": probe["album"],
        "albumArtist": probe["album_artist"],
        "trackNo": probe["track_no"],
        "discNo": probe["disc_no"],
        "year": probe["year"],
        "genre": probe["genre"],
        "tagsJson": probe["tags_json"],
    }


def scan_full(
    conn: sqlite3.Connection,
    music_root: str,
    *,
    on_progress: Callable[[float], None] | None = None,
) -> dict[str, int]:
    """
    全量扫描真实音乐目录，并用 path 做 UPSERT。

    - 递归遍历支持的音频文件扩展名
    - 使用 ffprobe 填充最小技术信息与常见标签
    - 清理扫描根目录下已经不存在的陈旧 tracks 记录
    """
    root = Path(music_root).expanduser().resolve()
    if not root.exists():
        raise RuntimeError(f"MUSIC_ROOT does not exist: {root}")
    if not root.is_dir():
        raise RuntimeError(f"MUSIC_ROOT is not a directory: {root}")

    audio_files = _iter_audio_files(root)
    total = len(audio_files)
    seen_paths: set[str] = set()
    processed = 0
    skipped = 0

    if on_progress:
        on_progress(0.0)

    for index, path in enumerate(audio_files, start=1):
        try:
            track = _build_track_record(path)
            _upsert_track(conn, track)
            conn.commit()
            seen_paths.add(track["path"])
            processed += 1
        except Exception as exc:
            skipped += 1
            print(f"[scanner] skipped {path}: {exc}")
        finally:
            if on_progress and total > 0:
                on_progress(index / total)

    deleted = _cleanup_stale_tracks(conn, root, seen_paths)

    if on_progress:
        on_progress(1.0)

    return {
        "processed": processed,
        "skipped": skipped,
        "deleted": deleted,
    }
