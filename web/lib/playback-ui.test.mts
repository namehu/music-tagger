import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPlaybackTime,
  getPlaybackModeLabel,
  getPlaybackQueueLabel,
  getPlaybackRestoreMessage,
} from "./playback-ui.ts";

test("getPlaybackModeLabel formats all supported modes", () => {
  assert.equal(getPlaybackModeLabel("ordered"), "顺序");
  assert.equal(getPlaybackModeLabel("shuffle"), "随机");
  assert.equal(getPlaybackModeLabel("repeat_one"), "单曲循环");
});

test("getPlaybackQueueLabel formats known queue sources", () => {
  assert.equal(getPlaybackQueueLabel("user-library"), "当前队列：音乐库");
  assert.equal(getPlaybackQueueLabel("admin:library"), "当前队列：管理曲库");
  assert.equal(getPlaybackQueueLabel("dashboard:recent-plays"), "当前队列：最近播放");
  assert.equal(getPlaybackQueueLabel("playlist:123"), "当前队列：歌单");
  assert.equal(getPlaybackQueueLabel(null), "未绑定播放队列");
});

test("getPlaybackRestoreMessage prefers restore and preparing states", () => {
  assert.equal(
    getPlaybackRestoreMessage({
      hydrationStatus: "resolving",
      isPreparing: false,
      isAudioPlaying: false,
      activePlayback: false,
      autoPlayOnReady: false,
      pendingResumeTimeSec: null,
      resumeTimeSec: 0,
    }),
    "正在恢复上次播放会话，新的播放地址准备好后会停在上次进度。",
  );

  assert.equal(
    getPlaybackRestoreMessage({
      hydrationStatus: "ready",
      isPreparing: true,
      isAudioPlaying: false,
      activePlayback: false,
      autoPlayOnReady: true,
      pendingResumeTimeSec: null,
      resumeTimeSec: 0,
    }),
    "正在准备转码播放，完成后会自动开始。",
  );
});

test("formatPlaybackTime renders a stable mm:ss string", () => {
  assert.equal(formatPlaybackTime(0), "00:00");
  assert.equal(formatPlaybackTime(65.9), "01:05");
});
