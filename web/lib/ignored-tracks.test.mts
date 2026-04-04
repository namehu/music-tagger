import test from "node:test";
import assert from "node:assert/strict";

import {
  canCurrentUserUnignoreTrack,
  resolveTrackIgnoreSource,
  shouldHideTrackFromDefaultBrowse,
} from "./ignored-tracks.ts";

test("global ignore has higher priority than mine ignore", () => {
  assert.equal(
    resolveTrackIgnoreSource({
      hasGlobalIgnore: true,
      hasMineIgnore: true,
    }),
    "global",
  );
});

test("mine ignore is returned when there is no global ignore", () => {
  assert.equal(
    resolveTrackIgnoreSource({
      hasGlobalIgnore: false,
      hasMineIgnore: true,
    }),
    "mine",
  );
});

test("user surface hides both global and mine ignored tracks", () => {
  assert.equal(
    shouldHideTrackFromDefaultBrowse({
      surface: "user",
      hasGlobalIgnore: false,
      hasMineIgnore: true,
    }),
    true,
  );
  assert.equal(
    shouldHideTrackFromDefaultBrowse({
      surface: "user",
      hasGlobalIgnore: true,
      hasMineIgnore: false,
    }),
    true,
  );
});

test("admin surface only hides global ignored tracks", () => {
  assert.equal(
    shouldHideTrackFromDefaultBrowse({
      surface: "admin",
      hasGlobalIgnore: false,
      hasMineIgnore: true,
    }),
    false,
  );
  assert.equal(
    shouldHideTrackFromDefaultBrowse({
      surface: "admin",
      hasGlobalIgnore: true,
      hasMineIgnore: false,
    }),
    true,
  );
});

test("only mine ignored tracks can be unignored by the current user", () => {
  assert.equal(canCurrentUserUnignoreTrack("mine"), true);
  assert.equal(canCurrentUserUnignoreTrack("global"), false);
  assert.equal(canCurrentUserUnignoreTrack("none"), false);
});
