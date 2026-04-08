import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

export function mapMountedPathToHostPath(mountedPath: string, mountedPrefix: string, envVarName: string) {
  const hostRoot = process.env[envVarName]?.trim();
  if (!hostRoot) {
    return null;
  }

  const absoluteHostRoot = path.resolve(hostRoot);
  if (mountedPath === mountedPrefix) {
    return absoluteHostRoot;
  }

  if (!mountedPath.startsWith(`${mountedPrefix}/`)) {
    return null;
  }

  const relativePath = mountedPath.slice(mountedPrefix.length + 1);
  return path.join(absoluteHostRoot, relativePath);
}

export function getMountedPathCandidates(mountedPath: string, mountedPrefix: string, envVarName: string) {
  return [...new Set([mountedPath, mapMountedPathToHostPath(mountedPath, mountedPrefix, envVarName)])].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
}

export async function resolveReadablePathCandidates(candidates: string[]) {
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
