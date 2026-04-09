import assert from "node:assert/strict";
import test from "node:test";

import { classifyTranscodeFailure } from "./transcode-failure.ts";

test("classifyTranscodeFailure maps operation not permitted to cache_io", () => {
  const errorJson = JSON.stringify({
    message:
      "缓存路径读取状态失败: /cache/tracks/track-1/123/mp3_192.mp3 ([Errno 1] Operation not permitted: '/cache/tracks/track-1/123/mp3_192.mp3')",
  });

  assert.equal(classifyTranscodeFailure(errorJson), "cache_io");
});
