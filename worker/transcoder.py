import json
import os
import sqlite3
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

LIVE_TRANSCODE_START_THRESHOLD_BYTES = 256 * 1024


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


class JobCancelled(RuntimeError):
    pass


def _get_cache_path(track_id: str, source_mtime_ms: int, profile: str) -> str:
    if profile != "mp3_192":
        raise RuntimeError(f"Unsupported transcode profile: {profile}")

    return f"/cache/tracks/{track_id}/{source_mtime_ms}/mp3_192.mp3"


def _content_type_for_profile(profile: str) -> str:
    if profile == "mp3_192":
        return "audio/mpeg"

    raise RuntimeError(f"Unsupported transcode profile: {profile}")


def _get_partial_cache_path(cache_path: str) -> str:
    return f"{cache_path}.partial"


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


def _check_should_continue(
    should_continue: Callable[[], bool] | None,
    message: str,
) -> None:
    if should_continue and not should_continue():
        raise JobCancelled(message)


def _terminate_process(process: subprocess.Popen[str] | None) -> None:
    if process is None or process.poll() is not None:
        return

    process.terminate()
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=3)


def _wait_for_other_worker(
    *,
    final_path: Path,
    lock_path: Path,
    should_continue: Callable[[], bool] | None,
    on_progress: Callable[[float], None] | None,
) -> int:
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        _check_should_continue(should_continue, "转码任务已取消")
        if final_path.exists() and final_path.is_file():
            if on_progress:
                on_progress(0.95)
            return int(final_path.stat().st_size)
        if not lock_path.exists():
            raise JobCancelled("转码任务已被更新的请求替代")
        time.sleep(0.5)

    raise RuntimeError("等待其他 worker 完成转码超时")


def _safe_stat_size(path: Path) -> int:
    try:
        return int(path.stat().st_size)
    except FileNotFoundError:
        return 0


def _sync_partial_cache_state(
    conn: sqlite3.Connection,
    *,
    track_id: str,
    profile: str,
    source_mtime_ms: int,
    cache_path: str,
    content_type: str,
    partial_size: int,
) -> str:
    next_status = (
        "streaming" if partial_size >= LIVE_TRANSCODE_START_THRESHOLD_BYTES else "pending"
    )
    _upsert_transcode_cache(
        conn,
        track_id=track_id,
        profile=profile,
        source_mtime_ms=source_mtime_ms,
        cache_path=cache_path,
        content_type=content_type,
        file_size=partial_size,
        status=next_status,
        error_json=None,
    )
    return next_status


def transcode_prepare(
    conn: sqlite3.Connection,
    payload: dict[str, Any],
    *,
    cache_root: str = "/cache",
    on_progress: Callable[[float], None] | None = None,
    should_continue: Callable[[], bool] | None = None,
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
    partial_path = Path(f"{final_path}.partial")
    lock_path = final_path.with_name(f"{final_path.name}.lock")
    lock_fd: int | None = None
    process: subprocess.Popen[str] | None = None

    if on_progress:
        on_progress(0.05)

    try:
        _check_should_continue(should_continue, "转码任务已取消")
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
            raise JobCancelled("源音频文件已更新，请重新解析播放地址")

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
        try:
            if partial_path.exists():
                partial_path.unlink()
        except FileNotFoundError:
            pass
        try:
            lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(lock_fd, f"{os.getpid()}\n".encode("utf-8"))
        except FileExistsError:
            file_size = _wait_for_other_worker(
                final_path=final_path,
                lock_path=lock_path,
                should_continue=should_continue,
                on_progress=on_progress,
            )
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

        process = subprocess.Popen(
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
                str(partial_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        last_partial_size = -1
        last_status = "pending"
        while process.poll() is None:
            _check_should_continue(should_continue, "转码任务已取消")
            partial_size = _safe_stat_size(partial_path)
            next_status = (
                "streaming"
                if partial_size >= LIVE_TRANSCODE_START_THRESHOLD_BYTES
                else "pending"
            )
            if partial_size != last_partial_size or next_status != last_status:
                _sync_partial_cache_state(
                    conn,
                    track_id=track_id,
                    profile=profile,
                    source_mtime_ms=source_mtime_ms,
                    cache_path=cache_path,
                    content_type=content_type,
                    partial_size=partial_size,
                )
                last_partial_size = partial_size
                last_status = next_status
            if on_progress:
                on_progress(0.6 if next_status == "streaming" else 0.4)
            time.sleep(0.5)

        stdout_text, stderr_text = process.communicate()
        if process.returncode != 0:
            message = stderr_text.strip() or stdout_text.strip() or f"ffmpeg exited with {process.returncode}"
            raise RuntimeError(f"ffmpeg transcode failed: {message}")

        _check_should_continue(should_continue, "转码任务已取消")
        file_size = _safe_stat_size(partial_path)
        partial_path.replace(final_path)
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
        _terminate_process(process)
        if cache_path and content_type:
            _upsert_transcode_cache(
                conn,
                track_id=track_id,
                profile=profile,
                source_mtime_ms=source_mtime_ms,
                cache_path=cache_path,
                content_type=content_type,
                file_size=0,
                status="cancelled" if isinstance(exc, JobCancelled) else "failed",
                error_json=_parse_error_json(exc),
            )
        raise
    finally:
        try:
            if partial_path.exists():
                partial_path.unlink()
        except Exception:
            pass
        try:
            if lock_fd is not None:
                os.close(lock_fd)
        except Exception:
            pass
        try:
            if lock_fd is not None and lock_path.exists():
                lock_path.unlink()
        except Exception:
            pass
