import assert from "node:assert/strict";
import test from "node:test";

import {
  detectLyricsFormat,
  getTrackLyricsFormatLabel,
  validateLyricsText,
} from "./lyrics.ts";

test("detectLyricsFormat falls back to plain for untimed lyrics", () => {
  assert.equal(detectLyricsFormat("hello\nworld"), "plain");
  assert.equal(detectLyricsFormat(""), "plain");
});

test("detectLyricsFormat recognizes basic lrc lines", () => {
  assert.equal(detectLyricsFormat("[00:12.34]hello world"), "lrc");
  assert.equal(detectLyricsFormat("[00:12]hello world"), "lrc");
});

test("detectLyricsFormat recognizes enhanced lrc word timestamps", () => {
  assert.equal(
    detectLyricsFormat("[00:12.34]<00:12.50>he<00:12.80>llo"),
    "elrc",
  );
});

test("validateLyricsText accepts plain lyrics and timed lyrics when the format matches", () => {
  assert.equal(validateLyricsText({ text: "hello", format: "plain" }).ok, true);
  assert.equal(validateLyricsText({ text: "[00:12.34]hello", format: "lrc" }).ok, true);
  assert.equal(
    validateLyricsText({ text: "[00:12.34]<00:12.50>he", format: "elrc" }).ok,
    true,
  );
});

test("validateLyricsText rejects timed formats without enough timestamps", () => {
  assert.equal(validateLyricsText({ text: "hello", format: "lrc" }).ok, false);
  assert.equal(validateLyricsText({ text: "[00:12.34]hello", format: "elrc" }).ok, false);
});

test("getTrackLyricsFormatLabel formats supported values", () => {
  assert.equal(getTrackLyricsFormatLabel("plain"), "纯文本");
  assert.equal(getTrackLyricsFormatLabel("lrc"), "LRC");
  assert.equal(getTrackLyricsFormatLabel("elrc"), "增强 LRC");
});
