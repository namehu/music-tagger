export const TRACK_EDIT_DOMAINS = ["metadata", "lyrics", "cover"] as const;

export type TrackEditDomain = (typeof TRACK_EDIT_DOMAINS)[number];

export const TRACK_EDIT_SYNC_STATUSES = ["pending", "syncing", "synced", "failed"] as const;

export type TrackEditSyncStatus = (typeof TRACK_EDIT_SYNC_STATUSES)[number];

export type TrackMetadataValues = {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  trackNo: number | null;
  discNo: number | null;
  year: number | null;
  genre: string | null;
};

type TrackMetadataSource = TrackMetadataValues & {
  filename: string;
  metadataEdit?: TrackMetadataValues | null;
};

type TrackEditSyncRecord = {
  syncStatus: string;
  syncErrorJson: string | null;
  updatedAt?: Date;
} | null | undefined;

export function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function toNullableInt(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function getEffectiveTrackMetadata(track: TrackMetadataSource): TrackMetadataValues {
  if (track.metadataEdit) {
    return {
      title: track.metadataEdit.title,
      artist: track.metadataEdit.artist,
      album: track.metadataEdit.album,
      albumArtist: track.metadataEdit.albumArtist,
      trackNo: track.metadataEdit.trackNo,
      discNo: track.metadataEdit.discNo,
      year: track.metadataEdit.year,
      genre: track.metadataEdit.genre,
    };
  }

  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist,
    trackNo: track.trackNo,
    discNo: track.discNo,
    year: track.year,
    genre: track.genre,
  };
}

export function getTrackDisplaySummary(track: TrackMetadataSource) {
  const effective = getEffectiveTrackMetadata(track);
  return {
    ...effective,
    title: effective.title ?? track.filename,
    artist: effective.artist ?? "未知艺人",
    fallbackTitle: track.filename,
  };
}

export function parseTrackEditError(errorJson: string | null | undefined) {
  if (!errorJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(errorJson) as { message?: string };
    return parsed.message?.trim() || errorJson;
  } catch {
    return errorJson;
  }
}

function asSyncStatus(value: string | null | undefined): TrackEditSyncStatus | null {
  if (!value) {
    return null;
  }

  return TRACK_EDIT_SYNC_STATUSES.includes(value as TrackEditSyncStatus)
    ? (value as TrackEditSyncStatus)
    : null;
}

export function getTrackEditSummary(records: {
  metadataEdit?: TrackEditSyncRecord;
  lyricsEdit?: TrackEditSyncRecord;
  coverEdit?: TrackEditSyncRecord;
}) {
  const statuses = [records.metadataEdit, records.lyricsEdit, records.coverEdit]
    .map((record) => asSyncStatus(record?.syncStatus))
    .filter((status): status is TrackEditSyncStatus => status !== null);

  if (statuses.length === 0) {
    return {
      hasEdits: false,
      state: "none" as const,
      label: "未编辑",
    };
  }

  if (statuses.includes("failed")) {
    return {
      hasEdits: true,
      state: "failed" as const,
      label: "同步失败",
    };
  }

  if (statuses.includes("syncing")) {
    return {
      hasEdits: true,
      state: "syncing" as const,
      label: "同步中",
    };
  }

  if (statuses.includes("pending")) {
    return {
      hasEdits: true,
      state: "pending" as const,
      label: "待同步",
    };
  }

  return {
    hasEdits: true,
    state: "synced" as const,
    label: "已同步",
  };
}

export function getTrackEditSyncStatusLabel(status: TrackEditSyncStatus) {
  if (status === "pending") {
    return "待同步";
  }

  if (status === "syncing") {
    return "同步中";
  }

  if (status === "synced") {
    return "已同步";
  }

  return "同步失败";
}
