-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_track_cover_edits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "assetPath" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "hash" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncErrorJson" TEXT,
    "syncRequestedAt" DATETIME,
    "syncStartedAt" DATETIME,
    "syncFinishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "track_cover_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_track_cover_edits" ("assetPath", "createdAt", "fileSize", "hash", "id", "mimeType", "syncErrorJson", "syncFinishedAt", "syncRequestedAt", "syncStartedAt", "syncStatus", "trackId", "updatedAt") SELECT "assetPath", "createdAt", "fileSize", "hash", "id", "mimeType", "syncErrorJson", "syncFinishedAt", "syncRequestedAt", "syncStartedAt", "syncStatus", "trackId", "updatedAt" FROM "track_cover_edits";
DROP TABLE "track_cover_edits";
ALTER TABLE "new_track_cover_edits" RENAME TO "track_cover_edits";
CREATE UNIQUE INDEX "track_cover_edits_trackId_key" ON "track_cover_edits"("trackId");
CREATE INDEX "idx_track_cover_edits_status_updated_at" ON "track_cover_edits"("syncStatus", "updatedAt");
CREATE TABLE "new_track_lyrics_edits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "lyricsText" TEXT,
    "format" TEXT NOT NULL DEFAULT 'plain',
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncErrorJson" TEXT,
    "syncRequestedAt" DATETIME,
    "syncStartedAt" DATETIME,
    "syncFinishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "track_lyrics_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_track_lyrics_edits" ("createdAt", "format", "id", "lyricsText", "syncErrorJson", "syncFinishedAt", "syncRequestedAt", "syncStartedAt", "syncStatus", "trackId", "updatedAt") SELECT "createdAt", "format", "id", "lyricsText", "syncErrorJson", "syncFinishedAt", "syncRequestedAt", "syncStartedAt", "syncStatus", "trackId", "updatedAt" FROM "track_lyrics_edits";
DROP TABLE "track_lyrics_edits";
ALTER TABLE "new_track_lyrics_edits" RENAME TO "track_lyrics_edits";
CREATE UNIQUE INDEX "track_lyrics_edits_trackId_key" ON "track_lyrics_edits"("trackId");
CREATE INDEX "idx_track_lyrics_edits_status_updated_at" ON "track_lyrics_edits"("syncStatus", "updatedAt");
CREATE TABLE "new_track_metadata_edits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "title" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "albumArtist" TEXT,
    "trackNo" INTEGER,
    "discNo" INTEGER,
    "year" INTEGER,
    "genre" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncErrorJson" TEXT,
    "syncRequestedAt" DATETIME,
    "syncStartedAt" DATETIME,
    "syncFinishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "track_metadata_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_track_metadata_edits" ("album", "albumArtist", "artist", "createdAt", "discNo", "genre", "id", "syncErrorJson", "syncFinishedAt", "syncRequestedAt", "syncStartedAt", "syncStatus", "title", "trackId", "trackNo", "updatedAt", "year") SELECT "album", "albumArtist", "artist", "createdAt", "discNo", "genre", "id", "syncErrorJson", "syncFinishedAt", "syncRequestedAt", "syncStartedAt", "syncStatus", "title", "trackId", "trackNo", "updatedAt", "year" FROM "track_metadata_edits";
DROP TABLE "track_metadata_edits";
ALTER TABLE "new_track_metadata_edits" RENAME TO "track_metadata_edits";
CREATE UNIQUE INDEX "track_metadata_edits_trackId_key" ON "track_metadata_edits"("trackId");
CREATE INDEX "idx_track_metadata_edits_status_updated_at" ON "track_metadata_edits"("syncStatus", "updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
