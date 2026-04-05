import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from track_edit_assets import resolve_track_edit_asset_path
from transcoder import JobCancelled


METADATA_FIELDS = (
    "title",
    "artist",
    "album",
    "albumArtist",
    "trackNo",
    "discNo",
    "year",
    "genre",
)


def _utc_now_sqlite() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _error_json(message: str, error_type: str) -> str:
    return json.dumps(
        {
            "message": message,
            "type": error_type,
            "atMs": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
        ensure_ascii=False,
    )


def _assert_should_continue(should_continue: Callable[[], bool] | None) -> None:
    if should_continue and not should_continue():
        raise JobCancelled("曲目编辑同步已取消")


def _set_domain_status(
    conn: sqlite3.Connection,
    *,
    table: str,
    track_id: str,
    status: str,
    error_json: str | None = None,
    started_at: str | None = None,
    finished_at: str | None = None,
) -> None:
    now = _utc_now_sqlite()
    conn.execute(
        f"""
        UPDATE "{table}"
        SET
          "syncStatus" = ?,
          "syncErrorJson" = ?,
          "syncStartedAt" = COALESCE(?, "syncStartedAt"),
          "syncFinishedAt" = ?,
          "updatedAt" = ?
        WHERE "trackId" = ?
        """,
        (status, error_json, started_at, finished_at, now, track_id),
    )
    conn.commit()


def _refresh_track_file_snapshot(conn: sqlite3.Connection, track_id: str, source_path: Path) -> None:
    stat = source_path.stat()
    now = _utc_now_sqlite()
    conn.execute(
        """
        UPDATE "tracks"
        SET
          "fileSize" = ?,
          "mtimeMs" = ?,
          "updatedAt" = ?
        WHERE "id" = ?
        """,
        (int(stat.st_size), int(stat.st_mtime_ns // 1_000_000), now, track_id),
    )
    conn.commit()


def _get_mutagen_easy_file(path: Path):
    try:
        from mutagen import File as MutagenFile  # type: ignore
    except ModuleNotFoundError as exc:
        raise RuntimeError("当前环境缺少 mutagen，无法同步曲目编辑") from exc

    media = MutagenFile(str(path), easy=True)
    if media is None:
        raise RuntimeError(f"当前文件格式不支持元数据 easy API 写回: {path.name}")

    return media


def _write_tag_values(path: Path, tag_diff: list[dict[str, Any]]) -> None:
    media = _get_mutagen_easy_file(path)
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


def _metadata_from_track_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "albumArtist": row["albumArtist"],
        "trackNo": row["trackNo"],
        "discNo": row["discNo"],
        "year": row["year"],
        "genre": row["genre"],
    }


def _metadata_from_edit_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None

    return {
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "albumArtist": row["albumArtist"],
        "trackNo": row["trackNo"],
        "discNo": row["discNo"],
        "year": row["year"],
        "genre": row["genre"],
    }


def _same_metadata(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return all(left.get(field) == right.get(field) for field in METADATA_FIELDS)


def _build_tag_diff(target: dict[str, Any]) -> list[dict[str, Any]]:
    return [{"field": field, "to": target.get(field)} for field in METADATA_FIELDS]


def _write_embedded_lyrics(path: Path, lyrics_text: str | None) -> None:
    suffix = path.suffix.lower()

    if suffix == ".mp3":
        from mutagen.id3 import ID3, ID3NoHeaderError, USLT  # type: ignore
        from mutagen.mp3 import MP3  # type: ignore

        audio = MP3(str(path))
        try:
            audio.tags = ID3(str(path))
        except ID3NoHeaderError:
            audio.add_tags()

        if audio.tags is None:
            audio.add_tags()

        for key in [key for key in list(audio.tags.keys()) if key.startswith("USLT")]:
            del audio.tags[key]

        if lyrics_text:
            audio.tags.add(USLT(encoding=3, lang="eng", desc="", text=lyrics_text))

        audio.save()
        return

    if suffix == ".flac":
        from mutagen.flac import FLAC  # type: ignore

        audio = FLAC(str(path))
        for key in ("LYRICS", "UNSYNCEDLYRICS"):
            try:
                del audio[key]
            except Exception:
                pass

        if lyrics_text:
            audio["LYRICS"] = [lyrics_text]

        audio.save()
        return

    if suffix in {".m4a", ".mp4", ".alac"}:
        from mutagen.mp4 import MP4  # type: ignore

        audio = MP4(str(path))
        if lyrics_text:
            audio["\xa9lyr"] = [lyrics_text]
        else:
            audio.pop("\xa9lyr", None)

        audio.save()
        return

    raise RuntimeError(f"当前格式暂不支持歌词嵌入: {path.suffix or path.name}")


def _write_embedded_cover(path: Path, cover_edit: sqlite3.Row | None) -> None:
    suffix = path.suffix.lower()
    asset_path = cover_edit["assetPath"] if cover_edit is not None else None
    mime_type = cover_edit["mimeType"] if cover_edit is not None else None
    resolved_asset_path = resolve_track_edit_asset_path(asset_path)
    image_bytes = resolved_asset_path.read_bytes() if resolved_asset_path else None

    if suffix == ".mp3":
        from mutagen.id3 import APIC, ID3, ID3NoHeaderError  # type: ignore
        from mutagen.mp3 import MP3  # type: ignore

        audio = MP3(str(path))
        try:
            audio.tags = ID3(str(path))
        except ID3NoHeaderError:
            audio.add_tags()

        if audio.tags is None:
            audio.add_tags()

        for key in [key for key in list(audio.tags.keys()) if key.startswith("APIC")]:
            del audio.tags[key]

        if image_bytes and mime_type:
            audio.tags.add(APIC(encoding=3, mime=mime_type, type=3, desc="Cover", data=image_bytes))

        audio.save()
        return

    if suffix == ".flac":
        from mutagen.flac import FLAC, Picture  # type: ignore

        audio = FLAC(str(path))
        audio.clear_pictures()

        if image_bytes and mime_type:
            picture = Picture()
            picture.type = 3
            picture.mime = mime_type
            picture.data = image_bytes
            audio.add_picture(picture)

        audio.save()
        return

    if suffix in {".m4a", ".mp4", ".alac"}:
        from mutagen.mp4 import MP4, MP4Cover  # type: ignore

        audio = MP4(str(path))
        if image_bytes and mime_type:
            if mime_type == "image/png":
                cover = MP4Cover(image_bytes, imageformat=MP4Cover.FORMAT_PNG)
            elif mime_type == "image/jpeg":
                cover = MP4Cover(image_bytes, imageformat=MP4Cover.FORMAT_JPEG)
            else:
                raise RuntimeError(f"当前格式不支持该封面 MIME 类型: {mime_type}")

            audio["covr"] = [cover]
        else:
            audio.pop("covr", None)

        audio.save()
        return

    raise RuntimeError(f"当前格式暂不支持封面嵌入: {path.suffix or path.name}")


def _load_track(conn: sqlite3.Connection, track_id: str) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT
          "id",
          "path",
          "title",
          "artist",
          "album",
          "albumArtist",
          "trackNo",
          "discNo",
          "year",
          "genre"
        FROM "tracks"
        WHERE "id" = ?
        """,
        (track_id,),
    ).fetchone()
    if row is None:
        raise RuntimeError("关联曲目不存在")
    return row


def _load_metadata_edit(conn: sqlite3.Connection, track_id: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT
          "trackId",
          "title",
          "artist",
          "album",
          "albumArtist",
          "trackNo",
          "discNo",
          "year",
          "genre"
        FROM "track_metadata_edits"
        WHERE "trackId" = ?
        """,
        (track_id,),
    ).fetchone()


def _load_lyrics_edit(conn: sqlite3.Connection, track_id: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT "trackId", "lyricsText"
        FROM "track_lyrics_edits"
        WHERE "trackId" = ?
        """,
        (track_id,),
    ).fetchone()


def _load_cover_edit(conn: sqlite3.Connection, track_id: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT "trackId", "assetPath", "mimeType", "hash"
        FROM "track_cover_edits"
        WHERE "trackId" = ?
        """,
        (track_id,),
    ).fetchone()


def _sync_metadata(conn: sqlite3.Connection, track_id: str) -> None:
    track = _load_track(conn, track_id)
    edit = _load_metadata_edit(conn, track_id)
    source_path = Path(track["path"])
    if not source_path.exists() or not source_path.is_file():
        raise RuntimeError(f"源文件不存在: {source_path}")

    observed_metadata = _metadata_from_track_row(track)
    target_metadata = _metadata_from_edit_row(edit) or observed_metadata
    _write_tag_values(source_path, _build_tag_diff(target_metadata))
    _refresh_track_file_snapshot(conn, track_id, source_path)

    if edit is not None:
        if _same_metadata(target_metadata, observed_metadata):
            conn.execute(
                """
                DELETE FROM "track_metadata_edits"
                WHERE "trackId" = ?
                """,
                (track_id,),
            )
            conn.commit()
        else:
            _set_domain_status(
                conn,
                table="track_metadata_edits",
                track_id=track_id,
                status="synced",
                error_json=None,
                finished_at=_utc_now_sqlite(),
            )


def _sync_lyrics(conn: sqlite3.Connection, track_id: str) -> None:
    track = _load_track(conn, track_id)
    edit = _load_lyrics_edit(conn, track_id)
    if edit is None:
        raise RuntimeError("歌词编辑记录不存在")

    source_path = Path(track["path"])
    if not source_path.exists() or not source_path.is_file():
        raise RuntimeError(f"源文件不存在: {source_path}")

    lyrics_text = edit["lyricsText"]
    _write_embedded_lyrics(source_path, lyrics_text)
    _refresh_track_file_snapshot(conn, track_id, source_path)
    now = _utc_now_sqlite()
    lyrics_hash = hashlib.sha256(lyrics_text.encode("utf-8")).hexdigest() if lyrics_text else None
    conn.execute(
        """
        UPDATE "tracks"
        SET
          "lyricsKind" = ?,
          "lyricsHash" = ?,
          "observedLyricsText" = ?,
          "updatedAt" = ?
        WHERE "id" = ?
        """,
        ("embedded" if lyrics_text else None, lyrics_hash, lyrics_text, now, track_id),
    )
    conn.commit()
    _set_domain_status(
        conn,
        table="track_lyrics_edits",
        track_id=track_id,
        status="synced",
        error_json=None,
        finished_at=now,
    )


def _sync_cover(conn: sqlite3.Connection, track_id: str) -> None:
    track = _load_track(conn, track_id)
    edit = _load_cover_edit(conn, track_id)
    if edit is None:
        raise RuntimeError("封面编辑记录不存在")

    source_path = Path(track["path"])
    if not source_path.exists() or not source_path.is_file():
        raise RuntimeError(f"源文件不存在: {source_path}")

    resolved_asset_path = resolve_track_edit_asset_path(edit["assetPath"])
    if edit["assetPath"] and (resolved_asset_path is None or not resolved_asset_path.exists()):
        raise RuntimeError(f"封面资产不存在: {edit['assetPath']}")

    _write_embedded_cover(source_path, edit)
    _refresh_track_file_snapshot(conn, track_id, source_path)
    now = _utc_now_sqlite()
    conn.execute(
        """
        UPDATE "tracks"
        SET
          "artworkKind" = ?,
          "artworkMime" = ?,
          "artworkHash" = ?,
          "observedArtworkAssetPath" = ?,
          "updatedAt" = ?
        WHERE "id" = ?
        """,
        (
            "embedded" if edit["assetPath"] else None,
            edit["mimeType"] if edit["assetPath"] else None,
            edit["hash"] if edit["assetPath"] else None,
            edit["assetPath"] if edit["assetPath"] else None,
            now,
            track_id,
        ),
    )
    conn.commit()
    _set_domain_status(
        conn,
        table="track_cover_edits",
        track_id=track_id,
        status="synced",
        error_json=None,
        finished_at=now,
    )


def execute_track_edit_sync(
    conn: sqlite3.Connection,
    payload: dict[str, Any],
    *,
    on_progress: Callable[[float], None] | None = None,
    should_continue: Callable[[], bool] | None = None,
) -> None:
    track_id = str(payload.get("trackId") or "").strip()
    domain = str(payload.get("domain") or "").strip()
    if not track_id or domain not in {"metadata", "lyrics", "cover"}:
        raise RuntimeError("Invalid track_edit_sync payload")

    conn.row_factory = sqlite3.Row
    table = (
        "track_metadata_edits"
        if domain == "metadata"
        else "track_lyrics_edits"
        if domain == "lyrics"
        else "track_cover_edits"
    )
    started_at = _utc_now_sqlite()
    _set_domain_status(
        conn,
        table=table,
        track_id=track_id,
        status="syncing",
        error_json=None,
        started_at=started_at,
    )

    if on_progress:
        on_progress(0.1)

    _assert_should_continue(should_continue)

    try:
        if domain == "metadata":
            _sync_metadata(conn, track_id)
        elif domain == "lyrics":
            _sync_lyrics(conn, track_id)
        else:
            _sync_cover(conn, track_id)

        if on_progress:
            on_progress(1.0)
    except Exception as exc:
        _set_domain_status(
            conn,
            table=table,
            track_id=track_id,
            status="failed",
            error_json=_error_json(str(exc), exc.__class__.__name__),
            started_at=started_at,
            finished_at=_utc_now_sqlite(),
        )
        raise
