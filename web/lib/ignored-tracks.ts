export const TRACK_VISIBILITY_SURFACES = ["user", "admin"] as const;

export type TrackVisibilitySurface = (typeof TRACK_VISIBILITY_SURFACES)[number];
export type TrackIgnoreSource = "none" | "mine" | "global";

export function resolveTrackIgnoreSource(input: {
  hasGlobalIgnore: boolean;
  hasMineIgnore: boolean;
}): TrackIgnoreSource {
  if (input.hasGlobalIgnore) {
    return "global";
  }

  if (input.hasMineIgnore) {
    return "mine";
  }

  return "none";
}

export function shouldHideTrackFromDefaultBrowse(input: {
  surface: TrackVisibilitySurface;
  hasGlobalIgnore: boolean;
  hasMineIgnore: boolean;
}) {
  if (input.surface === "admin") {
    return input.hasGlobalIgnore;
  }

  return input.hasGlobalIgnore || input.hasMineIgnore;
}

export function canCurrentUserUnignoreTrack(source: TrackIgnoreSource) {
  return source === "mine";
}
