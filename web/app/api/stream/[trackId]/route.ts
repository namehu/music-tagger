import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { auth } from "@/lib/auth";
import {
  getPlaybackContentType,
  getPlaybackFilename,
  PLAYBACK_PROFILES,
  resolvePlaybackCachePath,
  resolvePlaybackPartialCachePath,
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

function isAllowedLiveRange(rangeHeader: string | null) {
  if (!rangeHeader) {
    return true;
  }

  return /^bytes=0-$/i.test(rangeHeader.trim());
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createLiveTranscodeStream(input: {
  streamPath: string;
  trackId: string;
  profile: PlaybackProfile;
  sourceMtimeMs: bigint;
}) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const fileHandle = await open(input.streamPath, "r");
      let position = 0;

      try {
        while (true) {
          const currentStat = await fileHandle.stat().catch(() => null);
          const availableSize = currentStat?.size ?? position;
          if (availableSize > position) {
            const length = Math.min(64 * 1024, availableSize - position);
            const buffer = Buffer.allocUnsafe(length);
            const { bytesRead } = await fileHandle.read(buffer, 0, length, position);
            if (bytesRead > 0) {
              position += bytesRead;
              controller.enqueue(buffer.subarray(0, bytesRead));
              continue;
            }
          }

          const cache = await prisma.transcodeCache.findUnique({
            where: {
              trackId_profile_sourceMtimeMs: {
                trackId: input.trackId,
                profile: input.profile,
                sourceMtimeMs: input.sourceMtimeMs,
              },
            },
            select: {
              status: true,
              errorJson: true,
            },
          });

          if (cache?.status === "ready") {
            break;
          }

          if (cache?.status === "failed" || cache?.status === "cancelled") {
            const message =
              cache.errorJson != null
                ? "转码流已中断，请稍后重试"
                : "转码流已中断";
            controller.error(new Error(message));
            return;
          }

          if (cache?.status !== "streaming" && cache?.status !== "pending") {
            break;
          }

          await wait(250);
        }
      } finally {
        await fileHandle.close().catch(() => undefined);
      }

      controller.close();
    },
  });
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
  const rangeHeader = req.headers.get("range");

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

    if (!cache) {
      return jsonError("转码缓存尚未准备完成", 404);
    }

    if (cache.status === "streaming") {
      if (!isAllowedLiveRange(rangeHeader)) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": "bytes */*",
          },
        });
      }

      streamPath = await resolvePlaybackPartialCachePath(cache.cachePath);
      if (!streamPath) {
        return jsonError("转码流尚未准备完成", 404);
      }

      contentType = cache.contentType;
      const body = createLiveTranscodeStream({
        streamPath,
        trackId: track.id,
        profile: playbackProfile,
        sourceMtimeMs: track.mtimeMs,
      });

      return new Response(body, {
        status: 200,
        headers: {
          "Accept-Ranges": "none",
          "Cache-Control": "private, no-store, no-transform",
          "Content-Disposition": buildContentDisposition(path.basename(filename)),
          "Content-Type": contentType,
          "X-Accel-Buffering": "no",
        },
      });
    }

    if (cache.status !== "ready") {
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

  const range = parseRangeHeader(rangeHeader, fileStat.size);
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
