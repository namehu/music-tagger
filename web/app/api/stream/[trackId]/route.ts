import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { auth } from "@/lib/auth";
import {
  getPlaybackContentType,
  getPlaybackFilename,
  PLAYBACK_PROFILES,
  resolvePlaybackCachePath,
  resolveTrackSourcePath,
  verifyPlaybackToken,
  type PlaybackProfile,
} from "@/lib/playback";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

function buildContentDisposition(filename: string) {
  return `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function parseRangeHeader(rangeHeader: string | null, size: number) {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return "invalid" as const;
  }

  const [, startText, endText] = match;
  let start: number;
  let end: number;

  if (startText === "" && endText === "") {
    return "invalid" as const;
  }

  if (startText === "") {
    const suffixLength = Number(endText);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return "invalid" as const;
    }
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? size - 1 : Number(endText);
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return "invalid" as const;
  }

  return { start, end };
}

export async function GET(
  req: Request,
  context: {
    params: Promise<{ trackId: string }>;
  },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return jsonError("未登录", 401);
  }

  const { trackId } = await context.params;
  const url = new URL(req.url);
  const profile = url.searchParams.get("profile");
  const token = url.searchParams.get("token");

  if (!profile || !PLAYBACK_PROFILES.includes(profile as PlaybackProfile) || !token) {
    return jsonError("缺少必要的播放参数", 400);
  }
  const playbackProfile = profile as PlaybackProfile;

  const payload = verifyPlaybackToken(token);
  if (!payload) {
    return jsonError("播放令牌无效或已过期", 401);
  }

  if (
    payload.trackId !== trackId ||
    payload.profile !== playbackProfile ||
    payload.userId !== session.user.id
  ) {
    return jsonError("播放令牌与当前请求不匹配", 403);
  }

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      path: true,
      filename: true,
      mtimeMs: true,
    },
  });

  if (!track) {
    return jsonError("曲目不存在", 404);
  }

  let streamPath: string | null = null;
  let contentType = getPlaybackContentType(playbackProfile, track.filename);
  const filename = getPlaybackFilename(track.filename, playbackProfile);

  if (playbackProfile === "original") {
    streamPath = await resolveTrackSourcePath(track.path);
    if (!streamPath) {
      return jsonError("音频文件不存在或当前 Web 进程无法读取", 404);
    }
  } else {
    const cache = await prisma.transcodeCache.findUnique({
      where: {
        trackId_profile_sourceMtimeMs: {
          trackId: track.id,
          profile: playbackProfile,
          sourceMtimeMs: track.mtimeMs,
        },
      },
      select: {
        cachePath: true,
        contentType: true,
        status: true,
      },
    });

    if (!cache || cache.status !== "ready") {
      return jsonError("转码缓存尚未准备完成", 404);
    }

    streamPath = await resolvePlaybackCachePath(cache.cachePath);
    if (!streamPath) {
      return jsonError("转码缓存文件不存在或当前 Web 进程无法读取", 404);
    }

    contentType = cache.contentType;
  }

  const fileStat = await stat(streamPath).catch(() => null);
  if (!fileStat || !fileStat.isFile()) {
    return jsonError("音频文件不存在", 404);
  }

  const range = parseRangeHeader(req.headers.get("range"), fileStat.size);
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileStat.size}`,
      },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? fileStat.size - 1;
  const contentLength = end - start + 1;
  const body = Readable.toWeb(
    createReadStream(streamPath, {
      start,
      end,
    }),
  ) as ReadableStream<Uint8Array>;

  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": buildContentDisposition(path.basename(filename)),
      "Content-Length": String(contentLength),
      "Content-Type": contentType,
      ...(range
        ? {
            "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
          }
        : {}),
    },
  });
}
