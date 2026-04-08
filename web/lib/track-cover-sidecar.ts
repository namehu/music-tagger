import path from "node:path";

import { getMountedPathCandidates, mapMountedPathToHostPath, resolveReadablePathCandidates } from "./mounted-paths.ts";

export const MUSIC_PATH_PREFIX = "/music";
export const MUSIC_HOST_PATH_ENV = "MUSIC_ROOT_HOST_PATH";
export const TRACK_COVER_SIDECAR_EXTENSIONS = [".jpg", ".png"] as const;

const MIME_TYPE_BY_EXTENSION: Record<(typeof TRACK_COVER_SIDECAR_EXTENSIONS)[number], string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

export function normalizeTrackCoverSidecarExtension(extension: string) {
  const normalized = extension.trim().toLowerCase();
  return normalized === ".jpeg" ? ".jpg" : normalized;
}

export function getTrackCoverSidecarExtensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  throw new Error(`Unsupported cover MIME type: ${mimeType}`);
}

export function getTrackCoverMimeTypeForExtension(extension: string) {
  const normalized = normalizeTrackCoverSidecarExtension(extension);
  if (normalized === ".jpg" || normalized === ".png") {
    return MIME_TYPE_BY_EXTENSION[normalized];
  }

  return null;
}

export function isTrackCoverSidecarPath(assetPath: string | null | undefined) {
  if (!assetPath) {
    return false;
  }

  const extension = normalizeTrackCoverSidecarExtension(path.posix.extname(assetPath));
  return assetPath.startsWith(`${MUSIC_PATH_PREFIX}/`) && TRACK_COVER_SIDECAR_EXTENSIONS.includes(
    extension as (typeof TRACK_COVER_SIDECAR_EXTENSIONS)[number],
  );
}

export function buildTrackCoverSidecarPath(trackPath: string, extension: string) {
  const normalized = normalizeTrackCoverSidecarExtension(extension);
  if (!TRACK_COVER_SIDECAR_EXTENSIONS.includes(normalized as (typeof TRACK_COVER_SIDECAR_EXTENSIONS)[number])) {
    throw new Error(`Unsupported cover extension: ${extension}`);
  }

  return `${path.posix.join(path.posix.dirname(trackPath), path.posix.basename(trackPath, path.posix.extname(trackPath)))}${normalized}`;
}

export function getTrackCoverSidecarPathCandidates(trackPath: string, preferredAssetPath?: string | null) {
  const candidates = preferredAssetPath && isTrackCoverSidecarPath(preferredAssetPath) ? [preferredAssetPath] : [];
  for (const extension of TRACK_COVER_SIDECAR_EXTENSIONS) {
    const sidecarPath = buildTrackCoverSidecarPath(trackPath, extension);
    if (!candidates.includes(sidecarPath)) {
      candidates.push(sidecarPath);
    }
  }
  return candidates;
}

export function getTrackCoverSidecarFileCandidates(trackPath: string, preferredAssetPath?: string | null) {
  return getTrackCoverSidecarPathCandidates(trackPath, preferredAssetPath).flatMap((mountedPath) =>
    getMountedPathCandidates(mountedPath, MUSIC_PATH_PREFIX, MUSIC_HOST_PATH_ENV),
  );
}

export async function findReadableTrackCoverSidecar(trackPath: string, preferredAssetPath?: string | null) {
  const mountedCandidates = getTrackCoverSidecarPathCandidates(trackPath, preferredAssetPath);
  for (const mountedPath of mountedCandidates) {
    const readablePath = await resolveReadablePathCandidates(
      getMountedPathCandidates(mountedPath, MUSIC_PATH_PREFIX, MUSIC_HOST_PATH_ENV),
    );
    if (readablePath) {
      return {
        mountedPath,
        readablePath,
        mimeType: getTrackCoverMimeTypeForExtension(path.posix.extname(mountedPath)),
      };
    }
  }

  return null;
}

export function resolveTrackCoverSidecarWritePath(mountedPath: string) {
  return mapMountedPathToHostPath(mountedPath, MUSIC_PATH_PREFIX, MUSIC_HOST_PATH_ENV) ?? mountedPath;
}
