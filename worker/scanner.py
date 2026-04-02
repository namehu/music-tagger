import os
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _utc_now_sqlite() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def scan_full(conn: sqlite3.Connection, music_root: str) -> str:
    """
    全量扫描占位实现：写入（或更新）一条 tracks 记录。

    注意：SQL 中必须使用 camelCase 列名（dirPath/fileSize/mtimeMs/durationMs/...）。

    required 字段（按 migration.sql）：id,path,dirPath,filename,fileSize,mtimeMs,container,durationMs
    createdAt 有 DEFAULT CURRENT_TIMESTAMP；updatedAt 必填，需要我们写入。
    """
    music_root = str(Path(music_root))
    placeholder_filename = "placeholder.mp3"
    path = os.path.join(music_root, placeholder_filename)
    dir_path = music_root

    now = _utc_now_sqlite()
    mtime_ms = int(time.time() * 1000)
    file_size = 0
    container = "mp3"
    duration_ms = 0

    # tracks.path 有 UNIQUE 约束：用 UPSERT，确保重复运行可更新 updatedAt/mtimeMs 等字段。
    conn.execute(
        """
        INSERT INTO "tracks" (
          "id","path","dirPath","filename",
          "fileSize","mtimeMs","container","durationMs",
          "updatedAt"
        )
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT("path") DO UPDATE SET
          "dirPath" = excluded."dirPath",
          "filename" = excluded."filename",
          "fileSize" = excluded."fileSize",
          "mtimeMs" = excluded."mtimeMs",
          "container" = excluded."container",
          "durationMs" = excluded."durationMs",
          "updatedAt" = excluded."updatedAt"
        """,
        (
            uuid.uuid4().hex,
            path,
            dir_path,
            placeholder_filename,
            file_size,
            mtime_ms,
            container,
            duration_ms,
            now,
        ),
    )
    conn.commit()
    return path

