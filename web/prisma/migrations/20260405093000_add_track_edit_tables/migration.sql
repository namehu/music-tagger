CREATE TABLE "track_metadata_edits" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "track_metadata_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "track_metadata_edits_trackId_key" ON "track_metadata_edits"("trackId");
CREATE INDEX "idx_track_metadata_edits_status_updated_at" ON "track_metadata_edits"("syncStatus", "updatedAt");

CREATE TABLE "track_lyrics_edits" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "track_lyrics_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "track_lyrics_edits_trackId_key" ON "track_lyrics_edits"("trackId");
CREATE INDEX "idx_track_lyrics_edits_status_updated_at" ON "track_lyrics_edits"("syncStatus", "updatedAt");

CREATE TABLE "track_cover_edits" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "track_cover_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "track_cover_edits_trackId_key" ON "track_cover_edits"("trackId");
CREATE INDEX "idx_track_cover_edits_status_updated_at" ON "track_cover_edits"("syncStatus", "updatedAt");

INSERT INTO "track_metadata_edits" (
  "id",
  "trackId",
  "title",
  "artist",
  "album",
  "albumArtist",
  "trackNo",
  "discNo",
  "year",
  "genre",
  "syncStatus",
  "syncRequestedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'track_metadata_edit_' || lower(hex(randomblob(16))),
  t."id",
  COALESCE(t."titleOverride", t."title"),
  COALESCE(t."artistOverride", t."artist"),
  COALESCE(t."albumOverride", t."album"),
  COALESCE(t."albumArtistOverride", t."albumArtist"),
  COALESCE(t."trackNoOverride", t."trackNo"),
  COALESCE(t."discNoOverride", t."discNo"),
  COALESCE(t."yearOverride", t."year"),
  COALESCE(t."genreOverride", t."genre"),
  'pending',
  COALESCE(t."metadataEditedAt", CURRENT_TIMESTAMP),
  COALESCE(t."metadataEditedAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "tracks" AS t
WHERE
  t."metadataEditedAt" IS NOT NULL
  OR t."titleOverride" IS NOT NULL
  OR t."artistOverride" IS NOT NULL
  OR t."albumOverride" IS NOT NULL
  OR t."albumArtistOverride" IS NOT NULL
  OR t."trackNoOverride" IS NOT NULL
  OR t."discNoOverride" IS NOT NULL
  OR t."yearOverride" IS NOT NULL
  OR t."genreOverride" IS NOT NULL;
