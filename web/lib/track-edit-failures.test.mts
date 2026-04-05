import assert from "node:assert/strict";
import test from "node:test";

import { classifyTrackEditFailure, getTrackEditStatusCopy } from "./track-edit-failures.ts";

test("classifyTrackEditFailure recognizes read-only music roots", () => {
  const result = classifyTrackEditFailure(
    JSON.stringify({
      message: "[Errno 30] Read-only file system: '/music/demo.flac'",
      type: "MutagenError",
    }),
  );

  assert.equal(result.kind, "readonly_music_root");
  assert.match(result.recommendation, /\/music/);
  assert.equal(result.canRetry, true);
});

test("classifyTrackEditFailure recognizes missing mutagen", () => {
  const result = classifyTrackEditFailure(
    JSON.stringify({
      message: "当前环境缺少 mutagen，无法同步曲目编辑",
      type: "RuntimeError",
    }),
  );

  assert.equal(result.kind, "missing_mutagen");
  assert.equal(result.canRetry, true);
});

test("classifyTrackEditFailure recognizes unsupported formats", () => {
  const result = classifyTrackEditFailure(
    JSON.stringify({
      message: "当前格式暂不支持歌词嵌入: .ogg",
      type: "RuntimeError",
    }),
  );

  assert.equal(result.kind, "unsupported_format");
  assert.equal(result.canRetry, false);
});

test("getTrackEditStatusCopy returns pending copy without exposing raw errors", () => {
  const result = getTrackEditStatusCopy({
    domain: "metadata",
    status: "pending",
    latestJob: null,
  });

  assert.match(result.title, /等待同步/);
  assert.equal(result.canRetry, false);
});
