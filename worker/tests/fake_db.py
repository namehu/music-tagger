from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


@dataclass
class FakeResult:
    rows: list[dict[str, Any]]
    rowcount: int = 0

    def fetchone(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[dict[str, Any]]:
        return list(self.rows)


class FakeConnection:
    def __init__(self) -> None:
        self.tracks: dict[str, dict[str, Any]] = {}
        self.tracks_by_path: dict[str, str] = {}
        self.plans: dict[str, dict[str, Any]] = {}
        self.plan_items: dict[str, dict[str, Any]] = {}
        self._order = 0

    def commit(self) -> None:
        return None

    def close(self) -> None:
        return None

    def executemany(self, query: str, seq_of_params: Iterable[tuple[Any, ...]]) -> FakeResult:
        last_result = FakeResult([], 0)
        for params in seq_of_params:
            last_result = self.execute(query, params)
        return last_result

    def seed_track(self, **row: Any) -> None:
        self._order += 1
        seeded = {
            "id": row["id"],
            "path": row["path"],
            "dirPath": row["dirPath"],
            "filename": row["filename"],
            "fileSize": row["fileSize"],
            "mtimeMs": row["mtimeMs"],
            "container": row.get("container"),
            "durationMs": row.get("durationMs"),
            "bitrateKbps": row.get("bitrateKbps"),
            "sampleRate": row.get("sampleRate"),
            "bitDepth": row.get("bitDepth"),
            "channels": row.get("channels"),
            "title": row.get("title"),
            "artist": row.get("artist"),
            "album": row.get("album"),
            "albumArtist": row.get("albumArtist"),
            "trackNo": row.get("trackNo"),
            "discNo": row.get("discNo"),
            "year": row.get("year"),
            "genre": row.get("genre"),
            "tagsJson": row.get("tagsJson"),
            "artworkKind": row.get("artworkKind"),
            "artworkMime": row.get("artworkMime"),
            "artworkHash": row.get("artworkHash"),
            "observedArtworkAssetPath": row.get("observedArtworkAssetPath"),
            "lyricsKind": row.get("lyricsKind"),
            "lyricsHash": row.get("lyricsHash"),
            "observedLyricsText": row.get("observedLyricsText"),
            "titleOverride": row.get("titleOverride"),
            "artistOverride": row.get("artistOverride"),
            "albumOverride": row.get("albumOverride"),
            "albumArtistOverride": row.get("albumArtistOverride"),
            "trackNoOverride": row.get("trackNoOverride"),
            "discNoOverride": row.get("discNoOverride"),
            "yearOverride": row.get("yearOverride"),
            "genreOverride": row.get("genreOverride"),
            "metadataEditedAt": row.get("metadataEditedAt"),
            "updatedAt": row.get("updatedAt", self._order),
        }
        self.tracks[seeded["id"]] = seeded
        self.tracks_by_path[seeded["path"]] = seeded["id"]

    def seed_plan(self, **row: Any) -> None:
        self._order += 1
        self.plans[row["id"]] = {
            "id": row["id"],
            "type": row["type"],
            "status": row["status"],
            "errorJson": row.get("errorJson"),
            "startedAt": row.get("startedAt"),
            "completedAt": row.get("completedAt"),
            "updatedAt": row.get("updatedAt", self._order),
        }

    def seed_plan_item(self, **row: Any) -> None:
        self._order += 1
        self.plan_items[row["id"]] = {
            "id": row["id"],
            "planId": row["planId"],
            "kind": row["kind"],
            "trackId": row.get("trackId"),
            "fromPath": row.get("fromPath"),
            "toPath": row.get("toPath"),
            "warningsJson": row.get("warningsJson"),
            "tagDiffJson": row.get("tagDiffJson"),
            "status": row["status"],
            "errorJson": row.get("errorJson"),
            "createdAt": row.get("createdAt", self._order),
            "updatedAt": row.get("updatedAt", self._order),
        }

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> FakeResult:
        normalized = " ".join(query.split())

        if normalized == 'SELECT * FROM "tracks"':
            rows = list(self.tracks.values())
            return FakeResult(rows[:1], len(rows[:1]))

        if normalized == 'SELECT COUNT(*) AS "count" FROM "tracks"':
            return FakeResult([{"count": len(self.tracks)}], 1)

        if normalized.startswith('SELECT "id", "observedArtworkAssetPath" FROM "tracks" WHERE "path" ='):
            track_id = self.tracks_by_path.get(params[0])
            if track_id is None:
                return FakeResult([], 0)
            row = self.tracks[track_id]
            return FakeResult(
                [{"id": row["id"], "observedArtworkAssetPath": row.get("observedArtworkAssetPath")}],
                1,
            )

        if normalized.startswith('INSERT INTO "tracks" ('):
            if 'ON CONFLICT ("path") DO UPDATE SET' in normalized:
                columns = [
                    "id", "path", "dirPath", "filename", "fileSize", "mtimeMs", "container", "durationMs",
                    "bitrateKbps", "sampleRate", "bitDepth", "channels", "title", "artist", "album",
                    "albumArtist", "trackNo", "discNo", "year", "genre", "tagsJson", "artworkKind",
                    "artworkMime", "artworkHash", "observedArtworkAssetPath", "lyricsKind", "lyricsHash",
                    "observedLyricsText", "updatedAt",
                ]
                row = dict(zip(columns, params, strict=False))
                existing_id = self.tracks_by_path.get(row["path"])
                if existing_id is not None:
                    existing = self.tracks[existing_id]
                    existing.update(row)
                else:
                    self.seed_track(**row)
                return FakeResult([], 1)

        if normalized.startswith('SELECT "path", "observedArtworkAssetPath" FROM "tracks" WHERE "path" = %s OR "path" LIKE %s'):
            root_path = params[0]
            prefix = params[1].removesuffix("%")
            rows = [
                {
                    "path": row["path"],
                    "observedArtworkAssetPath": row.get("observedArtworkAssetPath"),
                }
                for row in self.tracks.values()
                if row["path"] == root_path or row["path"].startswith(prefix)
            ]
            return FakeResult(rows, len(rows))

        if normalized.startswith('DELETE FROM "tracks" WHERE "path" ='):
            path = params[0]
            track_id = self.tracks_by_path.pop(path, None)
            if track_id is None:
                return FakeResult([], 0)
            self.tracks.pop(track_id, None)
            return FakeResult([], 1)

        if normalized == 'SELECT "id", "type", "status" FROM "plans" WHERE "id" = %s':
            row = self.plans.get(params[0])
            return FakeResult([row] if row else [], 1 if row else 0)

        if normalized.startswith('SELECT "id", "kind", "trackId", "fromPath", "toPath", "warningsJson", "status" FROM "plan_items" WHERE "planId" = %s'):
            rows = [
                row for row in self.plan_items.values() if row["planId"] == params[0]
            ]
            rows.sort(key=lambda row: row["createdAt"])
            return FakeResult(rows, len(rows))

        if normalized.startswith('UPDATE "plans" SET "status" = %s, "errorJson" = %s, "startedAt" = COALESCE(%s, "startedAt"), "completedAt" = %s, "updatedAt" = %s WHERE "id" = %s'):
            row = self.plans[params[5]]
            row["status"] = params[0]
            row["errorJson"] = params[1]
            if params[2] is not None and row.get("startedAt") is None:
                row["startedAt"] = params[2]
            row["completedAt"] = params[3]
            row["updatedAt"] = params[4]
            return FakeResult([], 1)

        if normalized.startswith('UPDATE "plan_items" SET "status" = %s, "errorJson" = %s, "updatedAt" = %s WHERE "id" = %s'):
            row = self.plan_items[params[3]]
            row["status"] = params[0]
            row["errorJson"] = params[1]
            row["updatedAt"] = params[2]
            return FakeResult([], 1)

        if normalized == 'SELECT "status", "errorJson", "completedAt" FROM "plans" WHERE "id" = ?':
            row = self.plans.get(params[0])
            if row is None:
                return FakeResult([], 0)
            return FakeResult(
                [{
                    "status": row["status"],
                    "errorJson": row.get("errorJson"),
                    "completedAt": row.get("completedAt"),
                }],
                1,
            )

        if normalized == 'SELECT "status", "errorJson" FROM "plan_items" WHERE "id" = ?':
            row = self.plan_items.get(params[0])
            if row is None:
                return FakeResult([], 0)
            return FakeResult(
                [{"status": row["status"], "errorJson": row.get("errorJson")}],
                1,
            )

        if normalized.startswith('SELECT "id", "path", "dirPath", "filename", "fileSize", "mtimeMs" FROM "tracks" WHERE "id" = %s'):
            row = self.tracks.get(params[0])
            return FakeResult([row] if row else [], 1 if row else 0)

        if normalized == 'SELECT "path", "dirPath", "filename" FROM "tracks" WHERE "id" = ?':
            row = self.tracks.get(params[0])
            if row is None:
                return FakeResult([], 0)
            return FakeResult(
                [{
                    "path": row["path"],
                    "dirPath": row["dirPath"],
                    "filename": row["filename"],
                }],
                1,
            )

        if normalized.startswith('UPDATE "tracks" SET "path" = %s, "dirPath" = %s, "filename" = %s, "fileSize" = %s, "mtimeMs" = %s, "updatedAt" = %s WHERE "id" = %s'):
            row = self.tracks[params[6]]
            old_path = row["path"]
            row["path"] = params[0]
            row["dirPath"] = params[1]
            row["filename"] = params[2]
            row["fileSize"] = params[3]
            row["mtimeMs"] = params[4]
            row["updatedAt"] = params[5]
            self.tracks_by_path.pop(old_path, None)
            self.tracks_by_path[row["path"]] = row["id"]
            return FakeResult([], 1)

        raise NotImplementedError(f"Unsupported fake query: {normalized}")
