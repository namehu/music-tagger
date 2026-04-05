import type { PlaybackHydrationStatus, PlaybackMode } from "./playback-state";

export function formatPlaybackTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getPlaybackModeLabel(mode: PlaybackMode) {
  switch (mode) {
    case "shuffle":
      return "随机";
    case "repeat_one":
      return "单曲循环";
    default:
      return "顺序";
  }
}

export function getPlaybackQueueLabel(queueSourceKey: string | null) {
  if (!queueSourceKey) {
    return "未绑定播放队列";
  }

  if (queueSourceKey === "user-library") {
    return "当前队列：音乐库";
  }

  if (queueSourceKey === "admin-library") {
    return "当前队列：管理曲库";
  }

  if (queueSourceKey.startsWith("playlist:")) {
    return "当前队列：歌单";
  }

  return "当前队列：其他上下文";
}

export function getPlaybackRestoreMessage(input: {
  hydrationStatus: PlaybackHydrationStatus;
  isPreparing: boolean;
  isAudioPlaying: boolean;
  activePlayback: boolean;
  autoPlayOnReady: boolean;
  pendingResumeTimeSec: number | null;
  resumeTimeSec: number;
}) {
  if (input.hydrationStatus === "resolving") {
    return "正在恢复上次播放会话，新的播放地址准备好后会停在上次进度。";
  }

  if (input.isPreparing) {
    return "正在准备转码播放，完成后会自动开始。";
  }

  if (
    !input.isAudioPlaying &&
    input.activePlayback &&
    !input.autoPlayOnReady &&
    typeof input.pendingResumeTimeSec === "number"
  ) {
    return `已恢复到 ${formatPlaybackTime(input.pendingResumeTimeSec)}，等待你继续播放。`;
  }

  if (!input.isAudioPlaying && input.activePlayback && input.resumeTimeSec > 0) {
    return `当前停在 ${formatPlaybackTime(input.resumeTimeSec)}，刷新后也会尽量恢复到这里。`;
  }

  return `上次恢复进度 ${formatPlaybackTime(input.resumeTimeSec)}`;
}
