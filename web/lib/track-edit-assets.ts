import crypto from "node:crypto";
import path from "node:path";

export const TRACK_EDIT_ASSET_ROOT_ENV = "TRACK_EDIT_ASSET_ROOT";

export function getTrackEditAssetRoot() {
  const configuredRoot = process.env[TRACK_EDIT_ASSET_ROOT_ENV]?.trim();
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(process.cwd(), "storage", "track-edit-assets");
}

export function buildTrackCoverAssetKey(trackId: string, extension: string, basename = "cover") {
  const normalizedExtension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  const safeTrackId = trackId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.posix.join(safeTrackId, `${basename}${normalizedExtension}`);
}

export function resolveTrackEditAssetPath(assetPathOrKey: string) {
  if (path.isAbsolute(assetPathOrKey)) {
    return path.normalize(assetPathOrKey);
  }

  return path.join(getTrackEditAssetRoot(), assetPathOrKey);
}

export function sha256Hex(input: Uint8Array) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
