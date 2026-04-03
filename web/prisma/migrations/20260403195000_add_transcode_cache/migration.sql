-- CreateTable
CREATE TABLE "transcode_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "sourceMtimeMs" BIGINT NOT NULL,
    "cachePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transcode_cache_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "transcode_cache_trackId_profile_sourceMtimeMs_key" ON "transcode_cache"("trackId", "profile", "sourceMtimeMs");

-- CreateIndex
CREATE INDEX "idx_transcode_cache_profile_status" ON "transcode_cache"("profile", "status");

-- CreateIndex
CREATE INDEX "idx_transcode_cache_updated_at" ON "transcode_cache"("updatedAt");
