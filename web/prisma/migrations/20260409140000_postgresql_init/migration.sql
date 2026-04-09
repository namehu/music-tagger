-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "dataJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payloadJson" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "errorJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "dirPath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mtimeMs" BIGINT NOT NULL,
    "container" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "bitrateKbps" INTEGER,
    "sampleRate" INTEGER,
    "bitDepth" INTEGER,
    "channels" INTEGER,
    "title" TEXT,
    "titleOverride" TEXT,
    "artist" TEXT,
    "artistOverride" TEXT,
    "album" TEXT,
    "albumOverride" TEXT,
    "albumArtist" TEXT,
    "albumArtistOverride" TEXT,
    "trackNo" INTEGER,
    "trackNoOverride" INTEGER,
    "discNo" INTEGER,
    "discNoOverride" INTEGER,
    "year" INTEGER,
    "yearOverride" INTEGER,
    "genre" TEXT,
    "genreOverride" TEXT,
    "metadataEditedAt" TIMESTAMP(3),
    "tagsJson" TEXT,
    "artworkKind" TEXT,
    "artworkMime" TEXT,
    "artworkHash" TEXT,
    "observedArtworkAssetPath" TEXT,
    "lyricsKind" TEXT,
    "lyricsHash" TEXT,
    "observedLyricsText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_metadata_edits" (
    "id" TEXT NOT NULL,
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
    "syncRequestedAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "syncFinishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_metadata_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_lyrics_edits" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "lyricsText" TEXT,
    "format" TEXT NOT NULL DEFAULT 'plain',
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncErrorJson" TEXT,
    "syncRequestedAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "syncFinishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_lyrics_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_cover_edits" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "assetPath" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "hash" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncErrorJson" TEXT,
    "syncRequestedAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "syncFinishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_cover_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ignored_tracks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ignored_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_ignored_tracks" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_ignored_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_items" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "previewSummaryJson" TEXT,
    "warningsJson" TEXT,
    "status" TEXT NOT NULL,
    "executionJobId" TEXT,
    "previewedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "trackId" TEXT,
    "fromPath" TEXT,
    "toPath" TEXT,
    "tagDiffJson" TEXT,
    "warningsJson" TEXT,
    "status" TEXT NOT NULL,
    "errorJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcode_cache" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "sourceMtimeMs" BIGINT NOT NULL,
    "cachePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorJson" TEXT,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_resolve_events" (
    "id" TEXT NOT NULL,
    "trackId" TEXT,
    "profile" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playback_resolve_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "idx_jobs_status_pri" ON "jobs"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "idx_jobs_locked" ON "jobs"("lockedAt", "lockedBy");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_path_key" ON "tracks"("path");

-- CreateIndex
CREATE INDEX "idx_tracks_dir_path" ON "tracks"("dirPath");

-- CreateIndex
CREATE INDEX "idx_tracks_album" ON "tracks"("album", "albumArtist");

-- CreateIndex
CREATE INDEX "idx_tracks_artist" ON "tracks"("artist");

-- CreateIndex
CREATE INDEX "idx_tracks_updated_at" ON "tracks"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "track_metadata_edits_trackId_key" ON "track_metadata_edits"("trackId");

-- CreateIndex
CREATE INDEX "idx_track_metadata_edits_status_updated_at" ON "track_metadata_edits"("syncStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "track_lyrics_edits_trackId_key" ON "track_lyrics_edits"("trackId");

-- CreateIndex
CREATE INDEX "idx_track_lyrics_edits_status_updated_at" ON "track_lyrics_edits"("syncStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "track_cover_edits_trackId_key" ON "track_cover_edits"("trackId");

-- CreateIndex
CREATE INDEX "idx_track_cover_edits_status_updated_at" ON "track_cover_edits"("syncStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_user_ignored_tracks_user_created_at" ON "user_ignored_tracks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_user_ignored_tracks_track_id" ON "user_ignored_tracks"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "user_ignored_tracks_userId_trackId_key" ON "user_ignored_tracks"("userId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "global_ignored_tracks_trackId_key" ON "global_ignored_tracks"("trackId");

-- CreateIndex
CREATE INDEX "idx_global_ignored_tracks_created_by_created_at" ON "global_ignored_tracks"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "idx_playlists_user_updated_at" ON "playlists"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_playlist_items_playlist_position" ON "playlist_items"("playlistId", "position");

-- CreateIndex
CREATE INDEX "idx_playlist_items_track_id" ON "playlist_items"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_playlistId_position_key" ON "playlist_items"("playlistId", "position");

-- CreateIndex
CREATE INDEX "idx_plans_created_by" ON "plans"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "idx_plans_status_updated_at" ON "plans"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_plan_items_plan_status" ON "plan_items"("planId", "status");

-- CreateIndex
CREATE INDEX "idx_plan_items_track_id" ON "plan_items"("trackId");

-- CreateIndex
CREATE INDEX "idx_transcode_cache_last_accessed_at" ON "transcode_cache"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "idx_transcode_cache_profile_status" ON "transcode_cache"("profile", "status");

-- CreateIndex
CREATE INDEX "idx_transcode_cache_updated_at" ON "transcode_cache"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "transcode_cache_trackId_profile_sourceMtimeMs_key" ON "transcode_cache"("trackId", "profile", "sourceMtimeMs");

-- CreateIndex
CREATE INDEX "idx_playback_resolve_events_profile_created_at" ON "playback_resolve_events"("profile", "createdAt");

-- CreateIndex
CREATE INDEX "idx_playback_resolve_events_created_at" ON "playback_resolve_events"("createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_metadata_edits" ADD CONSTRAINT "track_metadata_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_lyrics_edits" ADD CONSTRAINT "track_lyrics_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_cover_edits" ADD CONSTRAINT "track_cover_edits_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ignored_tracks" ADD CONSTRAINT "user_ignored_tracks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ignored_tracks" ADD CONSTRAINT "user_ignored_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_ignored_tracks" ADD CONSTRAINT "global_ignored_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_ignored_tracks" ADD CONSTRAINT "global_ignored_tracks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcode_cache" ADD CONSTRAINT "transcode_cache_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
