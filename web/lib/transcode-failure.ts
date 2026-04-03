export const TRANSCODE_FAILURE_CATEGORIES = [
  "source_missing",
  "source_changed",
  "ffmpeg_failed",
  "invalid_payload",
  "cache_io",
  "unknown",
] as const;

export type TranscodeFailureCategory = (typeof TRANSCODE_FAILURE_CATEGORIES)[number];

export const TRANSCODE_CANCELLATION_CATEGORIES = [
  "user_switched",
  "source_changed",
  "duplicate",
  "superseded",
  "manual",
  "unknown",
] as const;

export type TranscodeCancellationCategory = (typeof TRANSCODE_CANCELLATION_CATEGORIES)[number];

function parseErrorPayload(errorJson: string | null | undefined) {
  if (!errorJson) {
    return null;
  }

  try {
    return JSON.parse(errorJson) as { message?: string; type?: string };
  } catch {
    return null;
  }
}

export function classifyTranscodeFailure(errorJson: string | null | undefined): TranscodeFailureCategory {
  const payload = parseErrorPayload(errorJson);
  const message = payload?.message?.toLowerCase() ?? errorJson?.toLowerCase() ?? "";

  if (!message) {
    return "unknown";
  }

  if (message.includes("invalid transcode_prepare payload")) {
    return "invalid_payload";
  }

  if (message.includes("源文件版本已变化") || message.includes("源音频文件已更新")) {
    return "source_changed";
  }

  if (message.includes("track 不存在") || message.includes("源音频文件不存在")) {
    return "source_missing";
  }

  if (message.includes("ffmpeg transcode failed")) {
    return "ffmpeg_failed";
  }

  if (
    message.includes("/cache") ||
    message.includes("no space left") ||
    message.includes("permission denied") ||
    message.includes("read-only file system")
  ) {
    return "cache_io";
  }

  return "unknown";
}

export function getTranscodeFailureCategoryLabel(category: TranscodeFailureCategory) {
  switch (category) {
    case "source_missing":
      return "源文件缺失";
    case "source_changed":
      return "源文件已变化";
    case "ffmpeg_failed":
      return "ffmpeg 转码失败";
    case "invalid_payload":
      return "任务载荷异常";
    case "cache_io":
      return "缓存读写异常";
    default:
      return "未知异常";
  }
}

export function classifyTranscodeCancellation(
  errorJson: string | null | undefined,
): TranscodeCancellationCategory {
  const payload = parseErrorPayload(errorJson);
  const message = payload?.message?.toLowerCase() ?? errorJson?.toLowerCase() ?? "";

  if (!message) {
    return "unknown";
  }

  if (message.includes("用户切换到其他曲目")) {
    return "user_switched";
  }

  if (message.includes("源文件版本已更新") || message.includes("源音频文件已更新")) {
    return "source_changed";
  }

  if (message.includes("重复排队项已取消") || message.includes("同一转码任务已被更早领取")) {
    return "duplicate";
  }

  if (message.includes("更新的请求替代") || message.includes("旧的转码任务已取消")) {
    return "superseded";
  }

  if (message.includes("任务已取消") || message.includes("转码任务已取消")) {
    return "manual";
  }

  return "unknown";
}

export function getTranscodeCancellationCategoryLabel(category: TranscodeCancellationCategory) {
  switch (category) {
    case "user_switched":
      return "切歌取消";
    case "source_changed":
      return "源文件变化";
    case "duplicate":
      return "重复任务去重";
    case "superseded":
      return "被新请求替代";
    case "manual":
      return "手动取消";
    default:
      return "未知取消";
  }
}
