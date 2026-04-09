import { access, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import {
  getPlaybackCachePathCandidates,
  getPlaybackPartialCachePathCandidates,
} from "@/lib/playback";
export {
  classifyTranscodeFailure,
  getTranscodeFailureCategoryLabel,
  TRANSCODE_FAILURE_CATEGORIES,
  type TranscodeFailureCategory,
} from "@/lib/transcode-failure";

export async function doesCacheFileExist(cachePath: string) {
  for (const candidate of getPlaybackCachePathCandidates(cachePath)) {
    try {
      await access(candidate, fsConstants.F_OK);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

export async function doesPartialCacheFileExist(cachePath: string) {
  for (const candidate of getPlaybackPartialCachePathCandidates(cachePath)) {
    try {
      await access(candidate, fsConstants.F_OK);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

export async function removeCacheFile(cachePath: string) {
  let removed = 0;

  for (const candidate of [
    ...getPlaybackCachePathCandidates(cachePath),
    ...getPlaybackPartialCachePathCandidates(cachePath),
  ]) {
    try {
      await rm(candidate, { force: true });
      removed += 1;
    } catch {
      continue;
    }
  }

  return removed;
}
