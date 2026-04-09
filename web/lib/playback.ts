import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";

import { mapMountedPathToHostPath, resolveReadablePathCandidates } from "@/lib/mounted-paths";

export const PLAYBACK_PROFILES = ["original", "mp3_192"] as const;
export type PlaybackProfile = (typeof PLAYBACK_PROFILES)[number];
export const LIVE_TRANSCODE_START_THRESHOLD_BYTES = 256 * 1024;

const STREAM_TOKEN_TTL_SECONDS = 60 * 60;
const STREAM_PATH_PREFIX = "/music";
const CACHE_PATH_PREFIX = "/cache";

type PlaybackTokenPayload = {
  trackId: string;
  userId: string;
  profile: PlaybackProfile;
  exp: number;
};

function getPlaybackSecret() {
  return process.env.BETTER_AUTH_SECRET?.trim() || "dev-playback-secret";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPayload(payload: string) {
  return createHmac("sha256", getPlaybackSecret()).update(payload).digest("base64url");
}

export function createPlaybackToken(input: {
  trackId: string;
  userId: string;
  profile: PlaybackProfile;
}) {
  const payload: PlaybackTokenPayload = {
    trackId: input.trackId,
    userId: input.userId,
    profile: input.profile,
    exp: Math.floor(Date.now() / 1000) + STREAM_TOKEN_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyPlaybackToken(token: string): PlaybackTokenPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expectedSignature, "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as PlaybackTokenPayload;
    if (
      !payload ||
      typeof payload.trackId !== "string" ||
      typeof payload.userId !== "string" ||
      !PLAYBACK_PROFILES.includes(payload.profile) ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getAudioContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".flac":
      return "audio/flac";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ogg":
      return "audio/ogg";
    case ".opus":
      return "audio/ogg; codecs=opus";
    case ".wav":
      return "audio/wav";
    case ".aiff":
      return "audio/aiff";
    case ".wma":
      return "audio/x-ms-wma";
    case ".ape":
      return "audio/ape";
    case ".alac":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

export function getPlaybackContentType(profile: PlaybackProfile, filename: string) {
  if (profile === "mp3_192") {
    return "audio/mpeg";
  }

  return getAudioContentType(filename);
}

export function getPlaybackFilename(filename: string, profile: PlaybackProfile) {
  if (profile === "mp3_192") {
    return `${path.basename(filename, path.extname(filename))}.mp3`;
  }

  return filename;
}

export function getPlaybackCachePath(input: {
  trackId: string;
  sourceMtimeMs: bigint | number;
  profile: PlaybackProfile;
}) {
  if (input.profile !== "mp3_192") {
    throw new Error(`Playback profile ${input.profile} does not use the transcode cache`);
  }

  return path.posix.join(
    CACHE_PATH_PREFIX,
    "tracks",
    input.trackId,
    String(input.sourceMtimeMs),
    "mp3_192.mp3",
  );
}

export function getPlaybackPartialCachePath(input: {
  trackId: string;
  sourceMtimeMs: bigint | number;
  profile: PlaybackProfile;
}) {
  return `${getPlaybackCachePath(input)}.partial`;
}

function getMountedPathCandidates(mountedPath: string, mountedPrefix: string, envVarName: string) {
  return [mountedPath, mapMountedPathToHostPath(mountedPath, mountedPrefix, envVarName)].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
}

export async function resolveTrackSourcePath(trackPath: string) {
  return resolveReadablePathCandidates(
    getMountedPathCandidates(trackPath, STREAM_PATH_PREFIX, "MUSIC_ROOT_HOST_PATH"),
  );
}

export function getPlaybackCachePathCandidates(cachePath: string) {
  return getMountedPathCandidates(cachePath, CACHE_PATH_PREFIX, "CACHE_ROOT_HOST_PATH");
}

export async function resolvePlaybackCachePath(cachePath: string) {
  return resolveReadablePathCandidates(
    getMountedPathCandidates(cachePath, CACHE_PATH_PREFIX, "CACHE_ROOT_HOST_PATH"),
  );
}

export function getPlaybackPartialCachePathCandidates(cachePath: string) {
  return getPlaybackCachePathCandidates(`${cachePath}.partial`);
}

export async function resolvePlaybackPartialCachePath(cachePath: string) {
  return resolveReadablePathCandidates(getPlaybackPartialCachePathCandidates(cachePath));
}
