-- CreateTable
CREATE TABLE "user_ignored_tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_ignored_tracks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_ignored_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "global_ignored_tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "global_ignored_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "global_ignored_tracks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
