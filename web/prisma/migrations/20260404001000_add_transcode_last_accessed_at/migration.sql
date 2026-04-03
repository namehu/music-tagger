ALTER TABLE "transcode_cache"
ADD COLUMN "lastAccessedAt" DATETIME;

CREATE INDEX "idx_transcode_cache_last_accessed_at"
ON "transcode_cache"("lastAccessedAt");
