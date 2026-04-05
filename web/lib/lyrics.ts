export const TRACK_LYRICS_FORMATS = ["plain", "lrc", "elrc"] as const;

export type TrackLyricsFormat = (typeof TRACK_LYRICS_FORMATS)[number];

const LRC_LINE_TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?]/;
const ELRC_WORD_TIMESTAMP_RE = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/;

export function detectLyricsFormat(text: string | null | undefined): TrackLyricsFormat {
  const normalized = text?.trim() ?? "";
  if (normalized.length === 0) {
    return "plain";
  }

  if (ELRC_WORD_TIMESTAMP_RE.test(normalized) && LRC_LINE_TIMESTAMP_RE.test(normalized)) {
    return "elrc";
  }

  if (LRC_LINE_TIMESTAMP_RE.test(normalized)) {
    return "lrc";
  }

  return "plain";
}

export function validateLyricsText(input: {
  text: string | null | undefined;
  format: TrackLyricsFormat;
}) {
  const normalized = input.text?.trim() ?? "";
  if (normalized.length === 0) {
    return {
      ok: true,
      detectedFormat: "plain" as TrackLyricsFormat,
      normalizedText: null as string | null,
    };
  }

  const detectedFormat = detectLyricsFormat(normalized);

  if (input.format === "plain") {
    return {
      ok: true,
      detectedFormat,
      normalizedText: normalized,
    };
  }

  if (input.format === "lrc" && detectedFormat !== "lrc" && detectedFormat !== "elrc") {
    return {
      ok: false,
      detectedFormat,
      normalizedText: normalized,
      message: "LRC 歌词至少需要包含可解析的行级时间戳，例如 [01:23.45]",
    };
  }

  if (input.format === "elrc" && detectedFormat !== "elrc") {
    return {
      ok: false,
      detectedFormat,
      normalizedText: normalized,
      message: "增强 LRC 歌词需要包含行级时间戳和词级时间戳，例如 [01:23.45]<01:23.60>你",
    };
  }

  return {
    ok: true,
    detectedFormat,
    normalizedText: normalized,
  };
}

export function getTrackLyricsFormatLabel(format: TrackLyricsFormat) {
  if (format === "plain") {
    return "纯文本";
  }

  if (format === "lrc") {
    return "LRC";
  }

  return "增强 LRC";
}
