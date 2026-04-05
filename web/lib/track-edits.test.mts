import assert from "node:assert/strict";
import test from "node:test";

import { getEffectiveTrackMetadata, getTrackDisplaySummary, getTrackEditSummary } from "./track-edits.ts";

test("getEffectiveTrackMetadata prefers metadata edit truth over scanned fields", () => {
  const effective = getEffectiveTrackMetadata({
    filename: "demo.flac",
    title: "Scanned Title",
    artist: "Scanned Artist",
    album: "Scanned Album",
    albumArtist: "Scanned Album Artist",
    trackNo: 1,
    discNo: 1,
    year: 2000,
    genre: "Rock",
    metadataEdit: {
      title: "Edited Title",
      artist: null,
      album: "Edited Album",
      albumArtist: null,
      trackNo: 2,
      discNo: null,
      year: null,
      genre: "Pop",
    },
  });

  assert.deepEqual(effective, {
    title: "Edited Title",
    artist: null,
    album: "Edited Album",
    albumArtist: null,
    trackNo: 2,
    discNo: null,
    year: null,
    genre: "Pop",
  });
});

test("getTrackDisplaySummary falls back to filename and unknown artist", () => {
  const display = getTrackDisplaySummary({
    filename: "fallback.mp3",
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    trackNo: null,
    discNo: null,
    year: null,
    genre: null,
    metadataEdit: null,
  });

  assert.equal(display.title, "fallback.mp3");
  assert.equal(display.artist, "未知艺人");
});

test("getTrackEditSummary prioritizes failed over syncing and pending", () => {
  const summary = getTrackEditSummary({
    metadataEdit: {
      syncStatus: "pending",
      syncErrorJson: null,
    },
    lyricsEdit: {
      syncStatus: "failed",
      syncErrorJson: '{"message":"boom"}',
    },
    coverEdit: {
      syncStatus: "syncing",
      syncErrorJson: null,
    },
  });

  assert.equal(summary.hasEdits, true);
  assert.equal(summary.state, "failed");
  assert.equal(summary.label, "同步失败");
});
