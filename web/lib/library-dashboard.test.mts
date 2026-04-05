import assert from "node:assert/strict";
import test from "node:test";

import { selectRecentUniqueTrackPlays } from "./library-dashboard.ts";

test("selectRecentUniqueTrackPlays keeps the latest event for each track in order", () => {
  const plays = selectRecentUniqueTrackPlays(
    [
      { trackId: "track-1", createdAt: "2026-04-05T10:00:00.000Z" },
      { trackId: "track-2", createdAt: "2026-04-05T09:59:00.000Z" },
      { trackId: "track-1", createdAt: "2026-04-05T09:58:00.000Z" },
      { trackId: "track-3", createdAt: "2026-04-05T09:57:00.000Z" },
    ],
    6,
  );

  assert.deepEqual(
    plays.map((entry) => entry.trackId),
    ["track-1", "track-2", "track-3"],
  );
});

test("selectRecentUniqueTrackPlays skips null track ids and respects limit", () => {
  const plays = selectRecentUniqueTrackPlays(
    [
      { trackId: null, createdAt: "2026-04-05T10:00:00.000Z" },
      { trackId: "track-1", createdAt: "2026-04-05T09:59:00.000Z" },
      { trackId: "track-2", createdAt: "2026-04-05T09:58:00.000Z" },
    ],
    1,
  );

  assert.deepEqual(plays, [
    {
      trackId: "track-1",
      playedAt: "2026-04-05T09:59:00.000Z",
    },
  ]);
});
