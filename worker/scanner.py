import hashlib
import json
import os
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from track_cover_sidecar import build_track_cover_sidecar_path, find_existing_track_cover_sidecar, get_track_cover_sidecar_candidates


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


def _coerce_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        parts = [part for item in value if (part := _coerce_text(item))]
        return "\n".join(parts) if parts else None
    text = str(value).strip()
    return text or None


def _detect_image_mime(image_bytes: bytes, declared_mime: str | None = None) -> str | None:
    normalized_mime = declared_mime.lower().strip() if declared_mime else None
    if normalized_mime in {"image/jpeg", "image/png"}:
        return normalized_mime
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return normalized_mime


def _cover_extension_for_mime(mime_type: str | None) -> str:
    if mime_type == "image/png":
        return ".png"
    return ".jpg"


def _extract_embedded_media(path: Path) -> dict[str, Any]:
    result = {
        "lyrics_text": None,
        "lyrics_kind": None,
        "lyrics_hash": None,
        "artwork_bytes": None,
        "artwork_kind": None,
        "artwork_mime": None,
        "artwork_hash": None,
    }

    try:
        from mutagen import File as MutagenFile  # type: ignore
    except ModuleNotFoundError:
        return result

    media = MutagenFile(str(path), easy=False)
    if media is None:
        return result

    suffix = path.suffix.lower()
    lyrics_text: str | None = None
    artwork_bytes: bytes | None = None
    artwork_mime: str | None = None

    if suffix == ".mp3":
        tags = getattr(media, "tags", None)
        if tags is not None and hasattr(tags, "getall"):
            lyrics_frames = tags.getall("USLT")
            lyrics_parts = []
            for frame in lyrics_frames:
                if text := _coerce_text(getattr(frame, "text", None)):
                    lyrics_parts.append(text)
            if lyrics_parts:
                lyrics_text = "\n\n".join(lyrics_parts)

            for frame in tags.getall("APIC"):
                data = getattr(frame, "data", None)
                if data:
                    artwork_bytes = bytes(data)
                    artwork_mime = _detect_image_mime(artwork_bytes, getattr(frame, "mime", None))
                    break
    elif suffix == ".flac":
        for key in ("LYRICS", "UNSYNCEDLYRICS", "LYRIC", "UNSYNCED LYRICS"):
            if text := _coerce_text(media.get(key) or media.get(key.lower())):
                lyrics_text = text
                break

        pictures = getattr(media, "pictures", None) or []
        if pictures:
            picture = pictures[0]
            data = getattr(picture, "data", None)
            if data:
                artwork_bytes = bytes(data)
                artwork_mime = _detect_image_mime(artwork_bytes, getattr(picture, "mime", None))
    elif suffix in {".m4a", ".mp4", ".alac"}:
        tags = getattr(media, "tags", None) or {}
        lyrics_text = _coerce_text(tags.get("\xa9lyr"))
        covers = tags.get("covr") or []
        if covers:
            artwork_bytes = bytes(covers[0])
            image_format = getattr(covers[0], "imageformat", None)
            artwork_mime = "image/png" if image_format == 14 else "image/jpeg" if image_format == 13 else None
            artwork_mime = _detect_image_mime(artwork_bytes, artwork_mime)
    else:
        tags = getattr(media, "tags", None) or {}
        for key in ("lyrics", "LYRICS", "unsyncedlyrics", "UNSYNCEDLYRICS"):
            if text := _coerce_text(tags.get(key)):
                lyrics_text = text
                break

    if lyrics_text:
        result["lyrics_text"] = lyrics_text
        result["lyrics_kind"] = "embedded"
        result["lyrics_hash"] = hashlib.sha256(lyrics_text.encode("utf-8")).hexdigest()

    if artwork_bytes:
        result["artwork_bytes"] = artwork_bytes
        result["artwork_kind"] = "embedded"
        result["artwork_mime"] = artwork_mime
        result["artwork_hash"] = hashlib.sha256(artwork_bytes).hexdigest()

    return result


def _delete_track_cover_sidecars(track_path: Path, preferred_asset_path: str | None = None) -> None:
    for candidate in get_track_cover_sidecar_candidates(track_path, preferred_asset_path):
        candidate.unlink(missing_ok=True)


def _read_sidecar_cover(track_path: Path, preferred_asset_path: str | None = None) -> dict[str, Any] | None:
    sidecar_path = find_existing_track_cover_sidecar(track_path, preferred_asset_path)
    if sidecar_path is None:
        return None

    image_bytes = sidecar_path.read_bytes()
    mime_type = _detect_image_mime(image_bytes)
    if mime_type not in {"image/jpeg", "image/png"}:
        return None

    return {
        "artwork_bytes": image_bytes,
        "artwork_kind": "sidecar",
        "artwork_mime": mime_type,
        "artwork_hash": hashlib.sha256(image_bytes).hexdigest(),
        "observed_artwork_asset_path": str(sidecar_path),
    }


def _write_embedded_cover_to_sidecar(
    track_path: Path,
    artwork_bytes: bytes | None,
    artwork_mime: str | None,
    previous_asset_path: str | None,
) -> dict[str, Any] | None:
    if not artwork_bytes:
        return None

    sidecar_path = Path(build_track_cover_sidecar_path(track_path, _cover_extension_for_mime(artwork_mime))).resolve()
    sidecar_path.parent.mkdir(parents=True, exist_ok=True)
    sidecar_path.write_bytes(artwork_bytes)

    for candidate in get_track_cover_sidecar_candidates(track_path, previous_asset_path):
        if candidate != sidecar_path:
            candidate.unlink(missing_ok=True)

    return {
        "artwork_bytes": artwork_bytes,
        "artwork_kind": "sidecar",
        "artwork_mime": artwork_mime,
        "artwork_hash": hashlib.sha256(artwork_bytes).hexdigest(),
        "observed_artwork_asset_path": str(sidecar_path),
    }


def _lookup_existing_track(conn: sqlite3.Connection, path: Path) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT "id", "observedArtworkAssetPath"
        FROM "tracks"
        WHERE "path" = ?
        """,
        (str(path),),
    ).fetchone()


def _upsert_track(conn: sqlite3.Connection, track: dict[str, Any]) -> None:
    now = _utc_now_sqlite()
    conn.execute(
        """
        INSERT INTO "tracks" (
          "id","path","dirPath","filename",
          "fileSize","mtimeMs","container","durationMs",
          "bitrateKbps","sampleRate","bitDepth","channels",
          "title","artist","album","albumArtist","trackNo","discNo","year","genre","tagsJson",
          "artworkKind","artworkMime","artworkHash","observedArtworkAssetPath",
          "lyricsKind","lyricsHash","observedLyricsText",
          "updatedAt"
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
          "artworkKind" = excluded."artworkKind",
          "artworkMime" = excluded."artworkMime",
          "artworkHash" = excluded."artworkHash",
          "observedArtworkAssetPath" = excluded."observedArtworkAssetPath",
          "lyricsKind" = excluded."lyricsKind",
          "lyricsHash" = excluded."lyricsHash",
          "observedLyricsText" = excluded."observedLyricsText",
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
            track["artworkKind"],
            track["artworkMime"],
            track["artworkHash"],
            track["observedArtworkAssetPath"],
            track["lyricsKind"],
            track["lyricsHash"],
            track["observedLyricsText"],
            now,
        ),
    )


def _cleanup_stale_tracks(conn: sqlite3.Connection, root: Path, seen_paths: set[str]) -> int:
    root_path = str(root)
    root_prefix = f"{root_path}{os.sep}"
    rows = conn.execute(
        """
        SELECT "path", "observedArtworkAssetPath"
        FROM "tracks"
        WHERE "path" = ? OR "path" LIKE ?
        """,
        (root_path, f"{root_prefix}%"),
    ).fetchall()

    stale_rows = [row for row in rows if row["path"] not in seen_paths]
    if not stale_rows:
        return 0

    for row in stale_rows:
        _delete_track_cover_sidecars(Path(row["path"]), row["observedArtworkAssetPath"])

    conn.executemany(
        """
        DELETE FROM "tracks"
        WHERE "path" = ?
        """,
        ((row["path"],) for row in stale_rows),
    )
    conn.commit()
    return len(stale_rows)


def _build_track_record(
    path: Path,
    track_id: str,
    embedded_media: dict[str, Any],
    artwork_observation: dict[str, Any] | None,
) -> dict[str, Any]:
    stat = path.stat()
    probe = _probe_audio_file(path)
    return {
        "id": track_id,
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
        "artworkKind": artwork_observation["artwork_kind"] if artwork_observation is not None else None,
        "artworkMime": artwork_observation["artwork_mime"] if artwork_observation is not None else None,
        "artworkHash": artwork_observation["artwork_hash"] if artwork_observation is not None else None,
        "observedArtworkAssetPath": artwork_observation["observed_artwork_asset_path"] if artwork_observation is not None else None,
        "lyricsKind": embedded_media["lyrics_kind"],
        "lyricsHash": embedded_media["lyrics_hash"],
        "observedLyricsText": embedded_media["lyrics_text"],
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
    - 提取已有的嵌入歌词和封面，更新 tracks 观察值
    - 清理扫描根目录下已经不存在的陈旧 tracks 记录
    """
    root = Path(music_root).expanduser().resolve()
    if not root.exists():
        raise RuntimeError(f"MUSIC_ROOT does not exist: {root}")
    if not root.is_dir():
        raise RuntimeError(f"MUSIC_ROOT is not a directory: {root}")

    conn.row_factory = sqlite3.Row
    audio_files = _iter_audio_files(root)
    total = len(audio_files)
    seen_paths: set[str] = set()
    processed = 0
    skipped = 0

    if on_progress:
        on_progress(0.0)

    for index, path in enumerate(audio_files, start=1):
        try:
            existing_track = _lookup_existing_track(conn, path)
            track_id = existing_track["id"] if existing_track is not None else uuid.uuid4().hex
            embedded_media = _extract_embedded_media(path)
            previous_asset_path = existing_track["observedArtworkAssetPath"] if existing_track is not None else None
            artwork_observation = _read_sidecar_cover(path, previous_asset_path)
            if artwork_observation is None:
                artwork_observation = _write_embedded_cover_to_sidecar(
                    path,
                    embedded_media["artwork_bytes"],
                    embedded_media["artwork_mime"],
                    previous_asset_path,
                )
            if artwork_observation is None:
                _delete_track_cover_sidecars(path, previous_asset_path)

            track = _build_track_record(path, track_id, embedded_media, artwork_observation)
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
