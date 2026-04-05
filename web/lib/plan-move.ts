import path from "node:path";

import type { PlanWarning } from "./plans.ts";

export const MOVE_TEMPLATE_TOKENS = ["artist", "albumArtist", "album", "year"] as const;

export type MoveTemplateToken = (typeof MOVE_TEMPLATE_TOKENS)[number];

export type MoveTemplateTrack = {
  path: string;
  filename: string;
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  year: number | null;
};

export type MovePathResolution = {
  changed: boolean;
  toPath: string | null;
  warnings: PlanWarning[];
};

const MOVE_TEMPLATE_TOKEN_RE = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

function buildWarning(code: string, message: string, blocking = false): PlanWarning {
  return {
    code,
    message,
    blocking,
  };
}

function normalizePathInput(value: string) {
  return value.replaceAll("\\", "/");
}

function getTokenValue(track: MoveTemplateTrack, token: MoveTemplateToken) {
  if (token === "artist") {
    return track.artist?.trim() ?? "";
  }

  if (token === "albumArtist") {
    return track.albumArtist?.trim() ?? "";
  }

  if (token === "album") {
    return track.album?.trim() ?? "";
  }

  return typeof track.year === "number" ? String(track.year) : "";
}

export function getUnknownMoveTemplateTokens(template: string) {
  const unknownTokens = new Set<string>();

  template.replace(MOVE_TEMPLATE_TOKEN_RE, (_match, token: string) => {
    if (!MOVE_TEMPLATE_TOKENS.includes(token as MoveTemplateToken)) {
      unknownTokens.add(token);
    }

    return "";
  });

  return [...unknownTokens];
}

export function resolveMoveTargetPath(input: {
  musicRoot: string;
  template: string;
  track: MoveTemplateTrack;
}): MovePathResolution {
  const warnings: PlanWarning[] = [];
  const normalizedMusicRoot = path.posix.resolve(normalizePathInput(input.musicRoot));
  const unknownTokens = getUnknownMoveTemplateTokens(input.template);

  if (unknownTokens.length > 0) {
    return {
      changed: false,
      toPath: null,
      warnings: [
        buildWarning(
          "unknown_template_token",
          `目标目录模板包含未支持变量: ${unknownTokens.map((token) => `{${token}}`).join(", ")}`,
          true,
        ),
      ],
    };
  }

  const renderedTemplate = input.template.replace(MOVE_TEMPLATE_TOKEN_RE, (_match, token: string) =>
    getTokenValue(input.track, token as MoveTemplateToken),
  );
  const normalizedTemplate = normalizePathInput(renderedTemplate).trim();

  if (normalizedTemplate.length === 0) {
    return {
      changed: false,
      toPath: null,
      warnings: [buildWarning("empty_target_dir", `曲目 ${input.track.filename} 生成的目标目录为空`, true)],
    };
  }

  if (normalizedTemplate.startsWith("/")) {
    warnings.push(
      buildWarning("absolute_target_dir", `曲目 ${input.track.filename} 的目标目录不能是绝对路径`, true),
    );
  }

  if (normalizedTemplate.includes("\0")) {
    warnings.push(
      buildWarning("invalid_target_dir", `曲目 ${input.track.filename} 的目标目录包含非法字符`, true),
    );
  }

  const relativeDir = path.posix.normalize(normalizedTemplate);
  if (relativeDir === "." || relativeDir.length === 0) {
    warnings.push(buildWarning("empty_target_dir", `曲目 ${input.track.filename} 生成的目标目录为空`, true));
  }

  if (relativeDir === ".." || relativeDir.startsWith("../")) {
    warnings.push(
      buildWarning("root_escape", `曲目 ${input.track.filename} 的目标目录越界到音乐根目录之外`, true),
    );
  }

  const relativeSegments = relativeDir.split("/").filter(Boolean);
  if (relativeSegments.length === 0) {
    warnings.push(buildWarning("empty_target_dir", `曲目 ${input.track.filename} 生成的目标目录为空`, true));
  }

  if (relativeSegments.some((segment) => segment === "." || segment === ".." || segment.trim().length === 0)) {
    warnings.push(
      buildWarning("invalid_target_dir", `曲目 ${input.track.filename} 的目标目录包含非法路径段`, true),
    );
  }

  const targetDir = path.posix.join(normalizedMusicRoot, ...relativeSegments);
  const toPath = path.posix.join(targetDir, input.track.filename);
  if (toPath !== normalizedMusicRoot && !toPath.startsWith(`${normalizedMusicRoot}/`)) {
    warnings.push(
      buildWarning("root_escape", `曲目 ${input.track.filename} 的目标路径越界到音乐根目录之外`, true),
    );
  }

  if (warnings.some((warning) => warning.blocking)) {
    return {
      changed: false,
      toPath,
      warnings,
    };
  }

  return {
    changed: toPath !== normalizePathInput(input.track.path),
    toPath,
    warnings,
  };
}
