import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import {
  createPlaybackToken,
  getPlaybackCachePath,
  getPlaybackContentType,
  getPlaybackFilename,
  PLAYBACK_PROFILES,
  resolvePlaybackCachePath,
  resolveTrackSourcePath,
} from "@/lib/playback";

import { protectedProcedure, router } from "../trpc";

const TRANSCODE_JOB_TYPE = "transcode_prepare";
const TRANSCODE_PENDING_STATUSES = ["pending", "running"] as const;

const resolvePlaybackInputSchema = z.object({
  trackId: z.string().min(1),
  profile: z.enum(PLAYBACK_PROFILES).default("original"),
});

function buildTranscodeJobKey(trackId: string, profile: string, sourceMtimeMs: bigint) {
  return `transcode:${trackId}:${profile}:${sourceMtimeMs}`;
}

export const playbackRouter = router({
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

      const token = createPlaybackToken({
        trackId: track.id,
        userId,
        profile: input.profile,
      });

      return {
        status: "ready" as const,
        url: `/api/stream/${track.id}?profile=${input.profile}&token=${encodeURIComponent(token)}`,
        contentType: getPlaybackContentType(input.profile, track.filename),
        filename: getPlaybackFilename(track.filename, input.profile),
      };
    }

    const sourceMtimeMs = track.mtimeMs;
    const cachePath = getPlaybackCachePath({
      trackId: track.id,
      sourceMtimeMs,
      profile: input.profile,
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
        status: true,
      },
    });

    if (existingCache?.status === "ready") {
      const readableCachePath = await resolvePlaybackCachePath(existingCache.cachePath);
      if (readableCachePath) {
        const token = createPlaybackToken({
          trackId: track.id,
          userId,
          profile: input.profile,
        });

        return {
          status: "ready" as const,
          url: `/api/stream/${track.id}?profile=${input.profile}&token=${encodeURIComponent(token)}`,
          contentType: existingCache.contentType,
          filename: getPlaybackFilename(track.filename, input.profile),
        };
      }
    }

    const jobKey = buildTranscodeJobKey(track.id, input.profile, sourceMtimeMs);

    const existingJob = await ctx.prisma.job.findFirst({
      where: {
        type: TRANSCODE_JOB_TYPE,
        status: {
          in: [...TRANSCODE_PENDING_STATUSES],
        },
        payloadJson: {
          contains: jobKey,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
      },
    });

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

    const jobId = existingJob?.id ?? `job_${randomUUID()}`;

    if (!existingJob) {
      await ctx.prisma.job.create({
        data: {
          id: jobId,
          type: TRANSCODE_JOB_TYPE,
          status: "pending",
          payloadJson: JSON.stringify({
            jobKey,
            trackId: track.id,
            profile: input.profile,
            sourcePath: track.path,
            sourceMtimeMs: Number(sourceMtimeMs),
          }),
        },
        select: { id: true },
      });
    }

    return {
      status: "preparing" as const,
      jobId,
      poll: {
        jobId,
      },
    };
  }),
});
