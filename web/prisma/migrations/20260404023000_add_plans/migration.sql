CREATE TABLE "plans" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdById" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "scopeJson" TEXT NOT NULL,
  "paramsJson" TEXT NOT NULL,
  "previewSummaryJson" TEXT,
  "warningsJson" TEXT,
  "status" TEXT NOT NULL,
  "executionJobId" TEXT,
  "previewedAt" DATETIME,
  "confirmedAt" DATETIME,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "errorJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "plans_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "user" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_plans_created_by" ON "plans"("createdById", "createdAt");
CREATE INDEX "idx_plans_status_updated_at" ON "plans"("status", "updatedAt");

CREATE TABLE "plan_items" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "trackId" TEXT,
  "fromPath" TEXT,
  "toPath" TEXT,
  "tagDiffJson" TEXT,
  "warningsJson" TEXT,
  "status" TEXT NOT NULL,
  "errorJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "plan_items_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "plans" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "plan_items_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "tracks" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_plan_items_plan_status" ON "plan_items"("planId", "status");
CREATE INDEX "idx_plan_items_track_id" ON "plan_items"("trackId");
