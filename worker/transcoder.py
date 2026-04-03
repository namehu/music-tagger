import json
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


def _utc_now_sqlite() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _parse_error_json(exc: Exception) -> str:
    return json.dumps(
        {
            "message": str(exc),
            "type": exc.__class__.__name__,
            "atMs": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
        ensure_ascii=False,
    )


def _get_cache_path(track_id: str, source_mtime_ms: int, profile: str) -> str:
    if profile != "mp3_192":
        raise RuntimeError(f"Unsupported transcode profile: {profile}")

    return f"/cache/tracks/{track_id}/{source_mtime_ms}/mp3_192.mp3"


def _content_type_for_profile(profile: str) -> str:
    if profile == "mp3_192":
        return "audio/mpeg"

    raise RuntimeError(f"Unsupported transcode profile: {profile}")


def _upsert_transcode_cache(
    conn: sqlite3.Connection,
    *,
    track_id: str,
    profile: str,
    source_mtime_ms: int,
    cache_path: str,
    content_type: str,
    file_size: int,
    status: str,
    error_json: str | None,
) -> None:
    now = _utc_now_sqlite()
    conn.execute(
        """
        INSERT INTO "transcode_cache" (
          "id","trackId","profile","sourceMtimeMs","cachePath","contentType",
          "fileSize","status","errorJson","updatedAt"
        )
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT("trackId","profile","sourceMtimeMs") DO UPDATE SET
          "cachePath" = excluded."cachePath",
          "contentType" = excluded."contentType",
          "fileSize" = excluded."fileSize",
          "status" = excluded."status",
          "errorJson" = excluded."errorJson",
          "updatedAt" = excluded."updatedAt"
        """,
        (
            f"transcode_{uuid.uuid4()}",
            track_id,
            profile,
            source_mtime_ms,
            cache_path,
            content_type,
            file_size,
            status,
            error_json,
            now,
        ),
    )
    conn.commit()


def transcode_prepare(
    conn: sqlite3.Connection,
    payload: dict[str, Any],
    *,
    cache_root: str = "/cache",
    on_progress: Callable[[float], None] | None = None,
) -> dict[str, Any]:
    track_id = str(payload.get("trackId") or "").strip()
    profile = str(payload.get("profile") or "").strip()
    source_path_text = str(payload.get("sourcePath") or "").strip()
    source_mtime_ms = int(payload.get("sourceMtimeMs") or 0)

    if not track_id or not profile or not source_path_text or source_mtime_ms <= 0:
        raise RuntimeError("Invalid transcode_prepare payload")

    cache_path = ""
    content_type = ""
    final_path = Path(cache_root) / "tracks" / track_id / str(source_mtime_ms) / "mp3_192.mp3"

    if on_progress:
        on_progress(0.05)

    try:
        cache_path = _get_cache_path(track_id, source_mtime_ms, profile)
        content_type = _content_type_for_profile(profile)
        conn.row_factory = sqlite3.Row
        track = conn.execute(
            """
            SELECT "id","path","filename","mtimeMs"
            FROM "tracks"
            WHERE "id" = ?
            """,
            (track_id,),
        ).fetchone()

        if track is None:
            raise RuntimeError("Track 不存在，无法继续转码")

        if int(track["mtimeMs"]) != source_mtime_ms:
            raise RuntimeError("源文件版本已变化，当前转码任务已失效")

        source_path = Path(source_path_text)
        if not source_path.exists() or not source_path.is_file():
            raise RuntimeError(f"源音频文件不存在: {source_path}")

        actual_mtime_ms = int(source_path.stat().st_mtime_ns // 1_000_000)
        if actual_mtime_ms != source_mtime_ms:
            raise RuntimeError("源音频文件已更新，请重新解析播放地址")

        if final_path.exists() and final_path.is_file():
            file_size = int(final_path.stat().st_size)
            _upsert_transcode_cache(
                conn,
                track_id=track_id,
                profile=profile,
                source_mtime_ms=source_mtime_ms,
                cache_path=cache_path,
                content_type=content_type,
                file_size=file_size,
                status="ready",
                error_json=None,
            )
            if on_progress:
                on_progress(1.0)
            return {
                "cachePath": cache_path,
                "fileSize": file_size,
                "contentType": content_type,
                "skipped": True,
            }

        final_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = final_path.with_name(f"{final_path.name}.{uuid.uuid4().hex}.tmp")

        _upsert_transcode_cache(
            conn,
            track_id=track_id,
            profile=profile,
            source_mtime_ms=source_mtime_ms,
            cache_path=cache_path,
            content_type=content_type,
            file_size=0,
            status="pending",
            error_json=None,
        )

        if on_progress:
            on_progress(0.15)

        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(source_path),
                "-vn",
                "-map_metadata",
                "-1",
                "-codec:a",
                "libmp3lame",
                "-b:a",
                "192k",
                "-f",
                "mp3",
                str(temp_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            message = result.stderr.strip() or f"ffmpeg exited with {result.returncode}"
            raise RuntimeError(f"ffmpeg transcode failed: {message}")

        temp_path.replace(final_path)
        file_size = int(final_path.stat().st_size)

        _upsert_transcode_cache(
            conn,
            track_id=track_id,
            profile=profile,
            source_mtime_ms=source_mtime_ms,
            cache_path=cache_path,
            content_type=content_type,
            file_size=file_size,
            status="ready",
            error_json=None,
        )

        if on_progress:
            on_progress(1.0)

        return {
            "cachePath": cache_path,
            "fileSize": file_size,
            "contentType": content_type,
            "skipped": False,
        }
    except Exception as exc:
        if cache_path and content_type:
            _upsert_transcode_cache(
                conn,
                track_id=track_id,
                profile=profile,
                source_mtime_ms=source_mtime_ms,
                cache_path=cache_path,
                content_type=content_type,
                file_size=0,
                status="failed",
                error_json=_parse_error_json(exc),
            )
        raise
    finally:
        try:
            if "temp_path" in locals() and temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass
