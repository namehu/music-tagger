import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDisplayedPlaybackTimeSec,
  resolvePlaybackDurationSec,
} from "./playback-ui.ts";

test("resolvePlaybackDurationSec prefers browser metadata when it is finite", () => {
  assert.equal(
    resolvePlaybackDurationSec({
      elementDurationSec: 123.4,
      mediaDurationSec: 98.7,
    }),
    123.4,
  );
});

test("resolvePlaybackDurationSec falls back to media duration when browser metadata is unavailable", () => {
  assert.equal(
    resolvePlaybackDurationSec({
      elementDurationSec: Infinity,
      mediaDurationSec: 245.5,
    }),
    245.5,
  );

  assert.equal(
    resolvePlaybackDurationSec({
      elementDurationSec: Number.NaN,
      mediaDurationSec: 245.5,
    }),
    245.5,
  );

  assert.equal(
    resolvePlaybackDurationSec({
      elementDurationSec: 0,
      mediaDurationSec: 245.5,
    }),
    245.5,
  );
});

test("resolveDisplayedPlaybackTimeSec keeps current time visible when total duration is unknown", () => {
  assert.equal(
    resolveDisplayedPlaybackTimeSec({
      currentTimeSec: 37.25,
      durationSec: 0,
    }),
    37.25,
  );
});

test("resolveDisplayedPlaybackTimeSec clamps current time when duration is known", () => {
  assert.equal(
    resolveDisplayedPlaybackTimeSec({
      currentTimeSec: 85,
      durationSec: 60,
    }),
    60,
  );
});
