ALTER TABLE "tracks" ADD COLUMN "titleOverride" TEXT;
ALTER TABLE "tracks" ADD COLUMN "artistOverride" TEXT;
ALTER TABLE "tracks" ADD COLUMN "albumOverride" TEXT;
ALTER TABLE "tracks" ADD COLUMN "albumArtistOverride" TEXT;
ALTER TABLE "tracks" ADD COLUMN "trackNoOverride" INTEGER;
ALTER TABLE "tracks" ADD COLUMN "discNoOverride" INTEGER;
ALTER TABLE "tracks" ADD COLUMN "yearOverride" INTEGER;
ALTER TABLE "tracks" ADD COLUMN "genreOverride" TEXT;
ALTER TABLE "tracks" ADD COLUMN "metadataEditedAt" DATETIME;

DROP TRIGGER IF EXISTS "tracks_ai";
DROP TRIGGER IF EXISTS "tracks_ad";
DROP TRIGGER IF EXISTS "tracks_au";

DELETE FROM "tracks_fts";

INSERT INTO "tracks_fts" ("trackId", "title", "artist", "album", "filename", "path")
SELECT
    "id",
    COALESCE("titleOverride", "title", ''),
    COALESCE("artistOverride", "artist", ''),
    COALESCE("albumOverride", "album", ''),
    COALESCE("filename", ''),
    COALESCE("path", '')
FROM "tracks";

CREATE TRIGGER "tracks_ai"
AFTER INSERT ON "tracks"
BEGIN
    INSERT INTO "tracks_fts" ("trackId", "title", "artist", "album", "filename", "path")
    VALUES (
        NEW."id",
        COALESCE(NEW."titleOverride", NEW."title", ''),
        COALESCE(NEW."artistOverride", NEW."artist", ''),
        COALESCE(NEW."albumOverride", NEW."album", ''),
        COALESCE(NEW."filename", ''),
        COALESCE(NEW."path", '')
    );
END;

CREATE TRIGGER "tracks_ad"
AFTER DELETE ON "tracks"
BEGIN
    DELETE FROM "tracks_fts"
    WHERE "trackId" = OLD."id";
END;

CREATE TRIGGER "tracks_au"
AFTER UPDATE ON "tracks"
BEGIN
    DELETE FROM "tracks_fts"
    WHERE "trackId" = OLD."id";

    INSERT INTO "tracks_fts" ("trackId", "title", "artist", "album", "filename", "path")
    VALUES (
        NEW."id",
        COALESCE(NEW."titleOverride", NEW."title", ''),
        COALESCE(NEW."artistOverride", NEW."artist", ''),
        COALESCE(NEW."albumOverride", NEW."album", ''),
        COALESCE(NEW."filename", ''),
        COALESCE(NEW."path", '')
    );
END;
