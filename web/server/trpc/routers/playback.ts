import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { stat as statFile } from "node:fs/promises";
import { z } from "zod";

import {
  createPlaybackToken,
  getPlaybackCachePath,
  getPlaybackContentType,
  getPlaybackFilename,
  LIVE_TRANSCODE_START_THRESHOLD_BYTES,
  PLAYBACK_PROFILES,
  resolvePlaybackCachePath,
  resolveTrackSourcePath,
} from "@/lib/playback";
import { getTrackDisplaySummary } from "@/lib/track-edits";
import { detectLyricsFormat } from "@/lib/lyrics";

import { parseJobPayload } from "@/lib/jobs";

import { protectedProcedure, router } from "../trpc";

const TRANSCODE_JOB_TYPE = "transcode_prepare";
const TRANSCODE_PENDING_STATUSES = ["pending", "running"] as const;

const resolvePlaybackInputSchema = z.object({
  trackId: z.string().min(1),
  profile: z.enum(PLAYBACK_PROFILES).default("original"),
});

const preparationStatusInputSchema = z.object({
  jobId: z.string().min(1),
});

const trackMediaInputSchema = z.object({
  trackId: z.string().min(1),
});

function buildTranscodeJobKey(trackId: string, profile: string, sourceMtimeMs: bigint) {
  return `transcode:${trackId}:${profile}:${sourceMtimeMs}`;
}

function buildTranscodePayload(input: {
  trackId: string;
  profile: string;
  sourcePath: string;
  sourceMtimeMs: bigint;
}) {
  return {
    jobKey: buildTranscodeJobKey(input.trackId, input.profile, input.sourceMtimeMs),
    trackId: input.trackId,
    profile: input.profile,
    sourcePath: input.sourcePath,
    sourceMtimeMs: Number(input.sourceMtimeMs),
  };
}

function serializeTranscodePayload(payload: ReturnType<typeof buildTranscodePayload>) {
  return JSON.stringify(payload);
}

function buildCancelledErrorJson(message: string) {
  return JSON.stringify({
    message,
    type: "JobCancelled",
    atMs: Date.now(),
  });
}

async function recordPlaybackResolveEvent(input: {
  ctx: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]["ctx"];
  trackId: string;
  profile: string;
  outcome: "cache_hit" | "cache_miss";
}) {
  await input.ctx.prisma.playbackResolveEvent.create({
    data: {
      id: `playback_evt_${randomUUID()}`,
      trackId: input.trackId,
      profile: input.profile,
      outcome: input.outcome,
    },
    select: { id: true },
  });
}

function buildReadyPlaybackResponse(input: {
  trackId: string;
  userId: string;
  profile: (typeof PLAYBACK_PROFILES)[number];
  filename: string;
  contentType: string;
  seekable: boolean;
  liveTranscode: boolean;
  jobId?: string | null;
}) {
  const token = createPlaybackToken({
    trackId: input.trackId,
    userId: input.userId,
    profile: input.profile,
  });

  return {
    status: "ready" as const,
    url: `/api/stream/${input.trackId}?profile=${input.profile}&token=${encodeURIComponent(token)}`,
    contentType: input.contentType,
    filename: getPlaybackFilename(input.filename, input.profile),
    seekable: input.seekable,
    liveTranscode: input.liveTranscode,
    jobId: input.jobId ?? null,
  };
}

export const playbackRouter = router({
  getTrackMedia: protectedProcedure.input(trackMediaInputSchema).query(async ({ ctx, input }) => {
    const track = await ctx.prisma.track.findUnique({
      where: { id: input.trackId },
      select: {
        id: true,
        filename: true,
        title: true,
        artist: true,
        album: true,
        albumArtist: true,
        trackNo: true,
        discNo: true,
        year: true,
        genre: true,
        updatedAt: true,
        observedArtworkAssetPath: true,
        observedLyricsText: true,
        metadataEdit: {
          select: {
            title: true,
            artist: true,
            album: true,
            albumArtist: true,
            trackNo: true,
            discNo: true,
            year: true,
            genre: true,
          },
        },
        lyricsEdit: {
          select: {
            lyricsText: true,
            format: true,
            updatedAt: true,
          },
        },
        coverEdit: {
          select: {
            assetPath: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!track) {
      throw new TRPCError({ code: "NOT_FOUND", message: "曲目不存在" });
    }

    const display = getTrackDisplaySummary({
      filename: track.filename,
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumArtist: track.albumArtist,
      trackNo: track.trackNo,
      discNo: track.discNo,
      year: track.year,
      genre: track.genre,
      metadataEdit: track.metadataEdit,
    });
    const lyricsSource =
      track.lyricsEdit != null ? "edit" : track.observedLyricsText ? "scan" : "none";
    const coverSource =
      track.coverEdit != null ? "edit" : track.observedArtworkAssetPath ? "scan" : "none";
    const coverTimestamp = track.coverEdit?.updatedAt?.getTime() ?? track.updatedAt.getTime();

    return {
      trackId: track.id,
      display: {
        title: display.title,
        artist: display.artist,
        album: display.album,
        albumArtist: display.albumArtist,
      },
      coverUrl:
        coverSource !== "none" ? `/api/tracks/${track.id}/cover?ts=${coverTimestamp}` : null,
      lyricsText: track.lyricsEdit?.lyricsText ?? track.observedLyricsText ?? null,
      lyricsFormat:
        track.lyricsEdit?.format != null
          ? track.lyricsEdit.format
          : detectLyricsFormat(track.observedLyricsText),
      mediaSourceSummary: {
        cover: coverSource,
        lyrics: lyricsSource,
      },
    };
  }),

  getPreparationStatus: protectedProcedure
    .input(preparationStatusInputSchema)
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId },
        select: {
          id: true,
          type: true,
          status: true,
          payloadJson: true,
          errorJson: true,
        },
      });

      if (!job || job.type !== TRANSCODE_JOB_TYPE) {
        throw new TRPCError({ code: "NOT_FOUND", message: "转码准备任务不存在" });
      }

      const payload = parseJobPayload(job.payloadJson);
      let streamStatus: string | null = null;
      let bytesReady = 0;
      let canStartPlayback = false;

      if (payload?.trackId && payload.profile && payload.sourceMtimeMs) {
        const cache = await ctx.prisma.transcodeCache.findUnique({
          where: {
            trackId_profile_sourceMtimeMs: {
              trackId: payload.trackId,
              profile: payload.profile,
              sourceMtimeMs: BigInt(payload.sourceMtimeMs),
            },
          },
          select: {
            status: true,
            fileSize: true,
          },
        });

        streamStatus = cache?.status ?? null;
        bytesReady = cache?.fileSize ?? 0;
        canStartPlayback =
          cache?.status === "ready" ||
          (cache?.status === "streaming" && cache.fileSize >= LIVE_TRANSCODE_START_THRESHOLD_BYTES);
      }

      return {
        ...job,
        streamStatus,
        bytesReady,
        canStartPlayback,
      };
    }),

  resolve: protectedProcedure.input(resolvePlaybackInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录后播放" });
    }

    const track = await ctx.prisma.track.findUnique({
      where: { id: input.trackId },
      select: {
        id: true,
        path: true,
        filename: true,
        fileSize: true,
        mtimeMs: true,
      },
    });

    if (!track) {
      throw new TRPCError({ code: "NOT_FOUND", message: "曲目不存在" });
    }

    if (input.profile === "original") {
      const sourcePath = await resolveTrackSourcePath(track.path);
      if (!sourcePath) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "音频文件不存在或当前 Web 进程无法读取",
        });
      }

      return buildReadyPlaybackResponse({
        trackId: track.id,
        userId,
        profile: input.profile,
        filename: track.filename,
        contentType: getPlaybackContentType(input.profile, track.filename),
        seekable: true,
        liveTranscode: false,
      });
    }

    let sourceMtimeMs = track.mtimeMs;
    const readableSourcePath = await resolveTrackSourcePath(track.path);
    if (readableSourcePath) {
      const sourceStat = await statFile(readableSourcePath).catch(() => null);
      const actualMtimeMs =
        sourceStat != null ? BigInt(Math.floor(sourceStat.mtimeMs)) : null;
      const actualFileSize =
        sourceStat != null && Number.isFinite(sourceStat.size) ? Number(sourceStat.size) : null;

      if (
        actualMtimeMs != null &&
        (actualMtimeMs !== track.mtimeMs ||
          (typeof actualFileSize === "number" && actualFileSize !== track.fileSize))
      ) {
        await ctx.prisma.track.update({
          where: { id: track.id },
          data: {
            mtimeMs: actualMtimeMs,
            fileSize: typeof actualFileSize === "number" ? actualFileSize : track.fileSize,
          },
          select: { id: true },
        });
        sourceMtimeMs = actualMtimeMs;
      }
    }

    const cachePath = getPlaybackCachePath({
      trackId: track.id,
      sourceMtimeMs,
      profile: input.profile,
    });
    const payload = buildTranscodePayload({
      trackId: track.id,
      profile: input.profile,
      sourcePath: track.path,
      sourceMtimeMs,
    });
    const payloadJson = serializeTranscodePayload(payload);
    const exactJob = await ctx.prisma.job.findFirst({
      where: {
        type: TRANSCODE_JOB_TYPE,
        payloadJson,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
      },
    });

    const existingCache = await ctx.prisma.transcodeCache.findUnique({
      where: {
        trackId_profile_sourceMtimeMs: {
          trackId: track.id,
          profile: input.profile,
          sourceMtimeMs,
        },
      },
      select: {
        id: true,
        cachePath: true,
        contentType: true,
        fileSize: true,
        status: true,
      },
    });

    if (existingCache?.status === "ready") {
      const readableCachePath = await resolvePlaybackCachePath(existingCache.cachePath);
      if (readableCachePath) {
        await ctx.prisma.transcodeCache.update({
          where: {
            trackId_profile_sourceMtimeMs: {
              trackId: track.id,
              profile: input.profile,
              sourceMtimeMs,
            },
          },
          data: {
            lastAccessedAt: new Date(),
          },
          select: { id: true },
        });
        await recordPlaybackResolveEvent({
          ctx,
          trackId: track.id,
          profile: input.profile,
          outcome: "cache_hit",
        });
        return buildReadyPlaybackResponse({
          trackId: track.id,
          userId,
          profile: input.profile,
          filename: track.filename,
          contentType: existingCache.contentType,
          seekable: true,
          liveTranscode: false,
        });
      }
    }

    const canStartLiveStream =
      existingCache?.status === "streaming" &&
      existingCache.fileSize >= LIVE_TRANSCODE_START_THRESHOLD_BYTES &&
      (exactJob?.status === "pending" || exactJob?.status === "running");

    if (canStartLiveStream) {
      await recordPlaybackResolveEvent({
        ctx,
        trackId: track.id,
        profile: input.profile,
        outcome: "cache_miss",
      });
      return buildReadyPlaybackResponse({
        trackId: track.id,
        userId,
        profile: input.profile,
        filename: track.filename,
        contentType: existingCache.contentType,
        seekable: false,
        liveTranscode: true,
        jobId: exactJob?.id ?? null,
      });
    }

    await recordPlaybackResolveEvent({
      ctx,
      trackId: track.id,
      profile: input.profile,
      outcome: "cache_miss",
    });

    if (exactJob?.status === "pending" || exactJob?.status === "running") {
      return {
        status: "preparing" as const,
        jobId: exactJob.id,
        poll: {
          jobId: exactJob.id,
        },
      };
    }

    const obsoleteJobs = await ctx.prisma.job.findMany({
      where: {
        type: TRANSCODE_JOB_TYPE,
        status: {
          in: [...TRANSCODE_PENDING_STATUSES],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        payloadJson: true,
      },
    });

    const obsoletePayloads = obsoleteJobs
      .map((job) => ({
        id: job.id,
        payload: parseJobPayload(job.payloadJson),
      }))
      .filter(
        (job) =>
          job.payload?.trackId === track.id &&
          job.payload?.profile === input.profile &&
          Number(job.payload?.sourceMtimeMs ?? 0) !== Number(sourceMtimeMs),
      );

    if (obsoletePayloads.length > 0) {
      const obsoleteReason = "源文件版本已更新，旧的转码任务已取消";
      const obsoleteErrorJson = buildCancelledErrorJson(obsoleteReason);
      await ctx.prisma.job.updateMany({
        where: {
          id: {
            in: obsoletePayloads.map((job) => job.id),
          },
        },
        data: {
          status: "cancelled",
          progress: 0,
          lockedBy: null,
          lockedAt: null,
          heartbeatAt: null,
          errorJson: obsoleteErrorJson,
        },
      });
      await ctx.prisma.transcodeCache.updateMany({
        where: {
          trackId: track.id,
          profile: input.profile,
          sourceMtimeMs: {
            not: sourceMtimeMs,
          },
          status: {
            in: ["pending", "running"],
          },
        },
        data: {
          status: "cancelled",
          errorJson: obsoleteErrorJson,
        },
      });
    }

    await ctx.prisma.transcodeCache.upsert({
      where: {
        trackId_profile_sourceMtimeMs: {
          trackId: track.id,
          profile: input.profile,
          sourceMtimeMs,
        },
      },
      create: {
        id: `transcode_${randomUUID()}`,
        trackId: track.id,
        profile: input.profile,
        sourceMtimeMs,
        cachePath,
        contentType: getPlaybackContentType(input.profile, track.filename),
        fileSize: 0,
        status: "pending",
        errorJson: null,
      },
      update: {
        cachePath,
        contentType: getPlaybackContentType(input.profile, track.filename),
        fileSize: 0,
        status: "pending",
        errorJson: null,
      },
    });

    if (exactJob?.status === "failed" || exactJob?.status === "cancelled") {
      await ctx.prisma.job.update({
        where: { id: exactJob.id },
        data: {
          status: "pending",
          progress: 0,
          attempts: 0,
          lockedBy: null,
          lockedAt: null,
          heartbeatAt: null,
          errorJson: null,
          payloadJson,
        },
        select: { id: true },
      });

      return {
        status: "preparing" as const,
        jobId: exactJob.id,
        poll: {
          jobId: exactJob.id,
        },
      };
    }

    const jobId = `job_${randomUUID()}`;
    await ctx.prisma.job.create({
      data: {
        id: jobId,
        type: TRANSCODE_JOB_TYPE,
        status: "pending",
        payloadJson,
      },
      select: { id: true },
    });

    return {
      status: "preparing" as const,
      jobId,
      poll: {
        jobId,
      },
    };
  }),
});
