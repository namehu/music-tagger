import { createHmac, timingSafeEqual } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

export const PLAYBACK_PROFILES = ["original"] as const;
export type PlaybackProfile = (typeof PLAYBACK_PROFILES)[number];

const STREAM_TOKEN_TTL_SECONDS = 60 * 60;
const STREAM_PATH_PREFIX = "/music";

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

function mapContainerPathToHostPath(trackPath: string) {
  const hostRoot = process.env.MUSIC_ROOT_HOST_PATH?.trim();
  if (!hostRoot) {
    return null;
  }

  if (trackPath === STREAM_PATH_PREFIX) {
    return hostRoot;
  }

  if (!trackPath.startsWith(`${STREAM_PATH_PREFIX}/`)) {
    return null;
  }

  const relativePath = trackPath.slice(STREAM_PATH_PREFIX.length + 1);
  return path.join(hostRoot, relativePath);
}

export async function resolveTrackSourcePath(trackPath: string) {
  const candidates = [trackPath, mapContainerPathToHostPath(trackPath)].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.R_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}
