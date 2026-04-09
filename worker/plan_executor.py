import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from psycopg import Connection

from transcoder import JobCancelled


def _utc_now_sqlite() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _error_json(message: str, error_type: str) -> str:
    return json.dumps(
        {
            "message": message,
            "type": error_type,
            "atMs": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
        ensure_ascii=False,
    )


def _parse_warnings(value: str | None) -> list[dict[str, Any]]:
    if not value:
        return []

    try:
        parsed = json.loads(value)
    except Exception:
        return []

    if not isinstance(parsed, list):
        return []

    return [item for item in parsed if isinstance(item, dict)]


def _parse_tag_diff(value: str | None) -> list[dict[str, Any]]:
    if not value:
        return []

    try:
        parsed = json.loads(value)
    except Exception:
        return []

    if not isinstance(parsed, list):
        return []

    return [item for item in parsed if isinstance(item, dict)]


def _set_plan_status(
    conn: Connection,
    *,
    plan_id: str,
    status: str,
    error_json: str | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
) -> None:
    now = _utc_now_sqlite()
    conn.execute(
        """
        UPDATE "plans"
        SET
          "status" = %s,
          "errorJson" = %s,
          "startedAt" = COALESCE(%s, "startedAt"),
          "completedAt" = %s,
          "updatedAt" = %s
        WHERE "id" = %s
        """,
        (status, error_json, started_at, completed_at, now, plan_id),
    )
    conn.commit()


def _set_plan_item_state(
    conn: Connection,
    *,
    item_id: str,
    status: str,
    error_json: str | None = None,
) -> None:
    now = _utc_now_sqlite()
    conn.execute(
        """
        UPDATE "plan_items"
        SET
          "status" = %s,
          "errorJson" = %s,
          "updatedAt" = %s
        WHERE "id" = %s
        """,
        (status, error_json, now, item_id),
    )
    conn.commit()


def _assert_should_continue(should_continue: Callable[[], bool] | None) -> None:
    if should_continue and not should_continue():
        raise JobCancelled("Plan 执行已取消")


def _get_music_root() -> Path:
    return Path(os.environ.get("MUSIC_ROOT", "/music")).resolve()


def _is_path_within_root(candidate: Path, root: Path) -> bool:
    resolved_candidate = candidate.resolve(strict=False)
    return resolved_candidate == root or root in resolved_candidate.parents


def _execute_rename_item(conn: Connection, item: dict[str, Any]) -> None:
    track_id = item["trackId"]
    from_path_text = item["fromPath"]
    to_path_text = item["toPath"]

    if not track_id or not from_path_text or not to_path_text:
        raise RuntimeError("rename 计划项缺少必要字段")

    warnings = _parse_warnings(item["warningsJson"])
    if any(bool(warning.get("blocking")) for warning in warnings):
        raise RuntimeError("计划项包含阻断性预览警告，不能执行")

    from_path = Path(from_path_text)
    to_path = Path(to_path_text)

    track = conn.execute(
        """
        SELECT "id", "path", "dirPath", "filename", "fileSize", "mtimeMs"
        FROM "tracks"
        WHERE "id" = %s
        """,
        (track_id,),
    ).fetchone()

    if track is None:
        raise RuntimeError("关联曲目不存在")

    if str(to_path) == track["path"] and to_path.exists():
        stat = to_path.stat()
        now = _utc_now_sqlite()
        conn.execute(
            """
            UPDATE "tracks"
            SET
              "path" = %s,
              "dirPath" = %s,
              "filename" = %s,
              "fileSize" = %s,
              "mtimeMs" = %s,
              "updatedAt" = %s
            WHERE "id" = %s
            """,
            (
                str(to_path),
                str(to_path.parent),
                to_path.name,
                int(stat.st_size),
                int(stat.st_mtime_ns // 1_000_000),
                now,
                track_id,
            ),
        )
        conn.commit()
        return

    if not from_path.exists() or not from_path.is_file():
        raise RuntimeError(f"源文件不存在: {from_path}")

    if to_path.exists() and str(to_path) != str(from_path):
        raise RuntimeError(f"目标文件已存在: {to_path}")

    to_path.parent.mkdir(parents=True, exist_ok=True)
    os.replace(from_path, to_path)

    stat = to_path.stat()
    now = _utc_now_sqlite()
    conn.execute(
        """
        UPDATE "tracks"
        SET
          "path" = %s,
          "dirPath" = %s,
          "filename" = %s,
          "fileSize" = %s,
          "mtimeMs" = %s,
          "updatedAt" = %s
        WHERE "id" = %s
        """,
        (
            str(to_path),
            str(to_path.parent),
            to_path.name,
            int(stat.st_size),
            int(stat.st_mtime_ns // 1_000_000),
            now,
            track_id,
        ),
    )
    conn.commit()


def _execute_move_item(conn: Connection, item: dict[str, Any]) -> None:
    from_path_text = item["fromPath"]
    to_path_text = item["toPath"]
    if not from_path_text or not to_path_text:
        raise RuntimeError("move 计划项缺少必要字段")

    music_root = _get_music_root()
    from_path = Path(from_path_text)
    to_path = Path(to_path_text)
    if not _is_path_within_root(from_path, music_root):
        raise RuntimeError(f"源文件路径超出音乐根目录: {from_path}")
    if not _is_path_within_root(to_path, music_root):
        raise RuntimeError(f"目标文件路径超出音乐根目录: {to_path}")

    # move v1 只改变目录不改变文件名，但底层仍然复用同一条文件移动与 tracks 回写逻辑。
    _execute_rename_item(conn, item)


def _get_mutagen_file(path: Path):
    try:
        from mutagen import File as MutagenFile  # type: ignore
    except ModuleNotFoundError as exc:
        raise RuntimeError("当前环境缺少 mutagen，无法执行 tag_write Plan") from exc

    media = MutagenFile(str(path), easy=True)
    if media is None:
        raise RuntimeError(f"当前文件格式无法通过 mutagen easy API 写回标签: {path.name}")
    return media


def _write_tag_values(path: Path, tag_diff: list[dict[str, Any]]) -> None:
    media = _get_mutagen_file(path)
    for entry in tag_diff:
        field = entry.get("field")
        next_value = entry.get("to")
        if not isinstance(field, str):
            continue

        if field == "trackNo":
            key = "tracknumber"
        elif field == "discNo":
            key = "discnumber"
        elif field == "year":
            key = "date"
        else:
            key = field

        if next_value is None:
            try:
                del media[key]
            except Exception:
                pass
            continue

        media[key] = [str(next_value)]

    media.save()


def _merge_track_tags_json(existing_json: str | None, tag_diff: list[dict[str, Any]]) -> str | None:
    base: dict[str, Any] = {}
    if existing_json:
        try:
            parsed = json.loads(existing_json)
            if isinstance(parsed, dict):
                base = parsed
        except Exception:
            base = {}

    for entry in tag_diff:
        field = entry.get("field")
        next_value = entry.get("to")
        if not isinstance(field, str):
            continue

        key = (
            "track"
            if field == "trackNo"
            else "disc"
            if field == "discNo"
            else "date"
            if field == "year"
            else "album_artist"
            if field == "albumArtist"
            else field.lower()
        )

        if next_value is None:
            base.pop(key, None)
        else:
            base[key] = str(next_value)

    return json.dumps(base, ensure_ascii=False) if base else None


def _execute_tag_write_item(conn: Connection, item: dict[str, Any]) -> None:
    track_id = item["trackId"]
    from_path_text = item["fromPath"]
    if not track_id or not from_path_text:
        raise RuntimeError("tag_write 计划项缺少必要字段")

    warnings = _parse_warnings(item["warningsJson"])
    if any(bool(warning.get("blocking")) for warning in warnings):
        raise RuntimeError("计划项包含阻断性预览警告，不能执行")

    tag_diff = _parse_tag_diff(item["tagDiffJson"])
    if not tag_diff:
        raise RuntimeError("tag_write 计划项没有可执行的字段变更")

    source_path = Path(from_path_text)
    if not source_path.exists() or not source_path.is_file():
        raise RuntimeError(f"源文件不存在: {source_path}")

    _write_tag_values(source_path, tag_diff)

    track = conn.execute(
        """
        SELECT
          "id",
          "title",
          "artist",
          "album",
          "albumArtist",
          "trackNo",
          "discNo",
          "year",
          "genre",
          "titleOverride",
          "artistOverride",
          "albumOverride",
          "albumArtistOverride",
          "trackNoOverride",
          "discNoOverride",
          "yearOverride",
          "genreOverride",
          "tagsJson",
          "metadataEditedAt"
        FROM "tracks"
        WHERE "id" = %s
        """,
        (track_id,),
    ).fetchone()

    if track is None:
        raise RuntimeError("关联曲目不存在")

    touched_fields: set[str] = set()
    for entry in tag_diff:
        field = entry.get("field")
        if not isinstance(field, str) or field not in METADATA_FIELDS:
            continue
        touched_fields.add(field)

    field_to_override = {
        "title": "titleOverride",
        "artist": "artistOverride",
        "album": "albumOverride",
        "albumArtist": "albumArtistOverride",
        "trackNo": "trackNoOverride",
        "discNo": "discNoOverride",
        "year": "yearOverride",
        "genre": "genreOverride",
    }
    next_values = {field: track[field] for field in METADATA_FIELDS}
    next_overrides = {
        "titleOverride": track["titleOverride"],
        "artistOverride": track["artistOverride"],
        "albumOverride": track["albumOverride"],
        "albumArtistOverride": track["albumArtistOverride"],
        "trackNoOverride": track["trackNoOverride"],
        "discNoOverride": track["discNoOverride"],
        "yearOverride": track["yearOverride"],
        "genreOverride": track["genreOverride"],
    }

    for field in touched_fields:
        next_values[field] = next((entry.get("to") for entry in tag_diff if entry.get("field") == field), track[field])
        next_overrides[field_to_override[field]] = None

    new_metadata_edited_at = None if all(value is None for value in next_overrides.values()) else track["metadataEditedAt"]

    now = _utc_now_sqlite()
    conn.execute(
        """
        UPDATE "tracks"
        SET
          "title" = %s,
          "artist" = %s,
          "album" = %s,
          "albumArtist" = %s,
          "trackNo" = %s,
          "discNo" = %s,
          "year" = %s,
          "genre" = %s,
          "titleOverride" = %s,
          "artistOverride" = %s,
          "albumOverride" = %s,
          "albumArtistOverride" = %s,
          "trackNoOverride" = %s,
          "discNoOverride" = %s,
          "yearOverride" = %s,
          "genreOverride" = %s,
          "tagsJson" = %s,
          "metadataEditedAt" = %s,
          "updatedAt" = %s
        WHERE "id" = %s
        """,
        (
            next_values["title"],
            next_values["artist"],
            next_values["album"],
            next_values["albumArtist"],
            next_values["trackNo"],
            next_values["discNo"],
            next_values["year"],
            next_values["genre"],
            next_overrides["titleOverride"],
            next_overrides["artistOverride"],
            next_overrides["albumOverride"],
            next_overrides["albumArtistOverride"],
            next_overrides["trackNoOverride"],
            next_overrides["discNoOverride"],
            next_overrides["yearOverride"],
            next_overrides["genreOverride"],
            _merge_track_tags_json(track["tagsJson"], tag_diff),
            new_metadata_edited_at,
            now,
            track_id,
        ),
    )
    conn.commit()


def execute_plan(
    conn: Connection,
    payload: dict[str, Any],
    *,
    on_progress: Callable[[float], None] | None = None,
    should_continue: Callable[[], bool] | None = None,
) -> dict[str, int]:
    plan_id = str(payload.get("planId") or "").strip()
    if not plan_id:
        raise RuntimeError("Invalid plan_execute payload")

    plan = conn.execute(
        """
        SELECT "id", "type", "status"
        FROM "plans"
        WHERE "id" = %s
        """,
        (plan_id,),
    ).fetchone()
    if plan is None:
        raise RuntimeError("Plan 不存在")

    if plan["type"] not in {"rename", "tag_write", "move"}:
        raise RuntimeError(f"Unsupported plan type: {plan['type']}")

    items = conn.execute(
        """
        SELECT
          "id",
          "kind",
          "trackId",
          "fromPath",
          "toPath",
          "warningsJson",
          "status"
        FROM "plan_items"
        WHERE "planId" = %s
        ORDER BY "createdAt" ASC
        """,
        (plan_id,),
    ).fetchall()

    if not items:
        raise RuntimeError("Plan 没有可执行项")

    started_at = _utc_now_sqlite()
    _set_plan_status(conn, plan_id=plan_id, status="running", error_json=None, started_at=started_at)

    total = len(items)
    completed = 0
    failed = 0

    if on_progress:
        on_progress(0.0)

    for item in items:
        _assert_should_continue(should_continue)

        if item["status"] == "done":
            completed += 1
            if on_progress and total > 0:
                on_progress(completed / total)
            continue

        _set_plan_item_state(conn, item_id=item["id"], status="running", error_json=None)
        try:
            if item["kind"] == "rename":
                _execute_rename_item(conn, item)
            elif item["kind"] == "move":
                _execute_move_item(conn, item)
            elif item["kind"] == "tag_write":
                _execute_tag_write_item(conn, item)
            else:
                raise RuntimeError(f"Unsupported plan item kind: {item['kind']}")
            _set_plan_item_state(conn, item_id=item["id"], status="done", error_json=None)
        except Exception as exc:
            failed += 1
            _set_plan_item_state(
                conn,
                item_id=item["id"],
                status="failed",
                error_json=_error_json(str(exc), exc.__class__.__name__),
            )
        finally:
            completed += 1
            if on_progress and total > 0:
                on_progress(completed / total)

    completed_at = _utc_now_sqlite()
    if failed > 0:
        message = f"Plan 执行完成，但有 {failed} 个计划项失败"
        _set_plan_status(
            conn,
            plan_id=plan_id,
            status="failed",
            error_json=_error_json(message, "PlanExecutionFailed"),
            completed_at=completed_at,
        )
        raise RuntimeError(message)

    _set_plan_status(
        conn,
        plan_id=plan_id,
        status="done",
        error_json=None,
        completed_at=completed_at,
    )

    if on_progress:
        on_progress(1.0)

    return {
        "total": total,
        "failed": failed,
    }
