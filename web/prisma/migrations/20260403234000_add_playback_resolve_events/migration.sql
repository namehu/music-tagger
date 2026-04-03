CREATE TABLE "playback_resolve_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "trackId" TEXT,
  "profile" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_playback_resolve_events_profile_created_at"
ON "playback_resolve_events"("profile", "createdAt");

CREATE INDEX "idx_playback_resolve_events_created_at"
ON "playback_resolve_events"("createdAt");
