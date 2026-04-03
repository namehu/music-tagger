CREATE VIRTUAL TABLE "tracks_fts" USING fts5(
    "trackId" UNINDEXED,
    "title",
    "artist",
    "album",
    "filename",
    "path",
    tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO "tracks_fts" ("trackId", "title", "artist", "album", "filename", "path")
SELECT
    "id",
    COALESCE("title", ''),
    COALESCE("artist", ''),
    COALESCE("album", ''),
    COALESCE("filename", ''),
    COALESCE("path", '')
FROM "tracks";

CREATE TRIGGER "tracks_ai"
AFTER INSERT ON "tracks"
BEGIN
    INSERT INTO "tracks_fts" ("trackId", "title", "artist", "album", "filename", "path")
    VALUES (
        NEW."id",
        COALESCE(NEW."title", ''),
        COALESCE(NEW."artist", ''),
        COALESCE(NEW."album", ''),
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
        COALESCE(NEW."title", ''),
        COALESCE(NEW."artist", ''),
        COALESCE(NEW."album", ''),
        COALESCE(NEW."filename", ''),
        COALESCE(NEW."path", '')
    );
END;
