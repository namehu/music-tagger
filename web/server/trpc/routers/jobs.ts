import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import { parseJobPayload } from "@/lib/jobs";
import {
  classifyTranscodeFailure,
  TRANSCODE_FAILURE_CATEGORIES,
  type TranscodeFailureCategory,
} from "@/lib/transcode-failure";

import { adminProcedure, router } from "../trpc";

function buildJobStateErrorJson(message: string, type: string) {
  return JSON.stringify(
    {
      message,
      type,
      atMs: Date.now(),
    },
    null,
    0,
  );
}

async function resetJobForRetry(
  ctx: Parameters<Parameters<typeof adminProcedure.mutation>[0]>[0]["ctx"],
  job: {
    id: string;
    type: string;
    payloadJson: string;
  },
) {
  const payload = parseJobPayload(job.payloadJson);
  if (job.type === "transcode_prepare" && payload?.trackId && payload.profile && payload.sourceMtimeMs) {
    await ctx.prisma.transcodeCache.updateMany({
      where: {
        trackId: payload.trackId,
        profile: payload.profile,
        sourceMtimeMs: BigInt(payload.sourceMtimeMs),
      },
      data: {
        status: "pending",
        errorJson: null,
        fileSize: 0,
      },
    });
  }

  if (job.type === "track_edit_sync" && payload?.trackId && payload.domain) {
    const now = new Date();
    if (payload.domain === "metadata") {
      await ctx.prisma.trackMetadataEdit.updateMany({
        where: { trackId: payload.trackId },
        data: {
          syncStatus: "pending",
          syncErrorJson: null,
          syncRequestedAt: now,
          syncStartedAt: null,
          syncFinishedAt: null,
        },
      });
    } else if (payload.domain === "lyrics") {
      await ctx.prisma.trackLyricsEdit.updateMany({
        where: { trackId: payload.trackId },
        data: {
          syncStatus: "pending",
          syncErrorJson: null,
          syncRequestedAt: now,
          syncStartedAt: null,
          syncFinishedAt: null,
        },
      });
    } else if (payload.domain === "cover") {
      await ctx.prisma.trackCoverEdit.updateMany({
        where: { trackId: payload.trackId },
        data: {
          syncStatus: "pending",
          syncErrorJson: null,
          syncRequestedAt: now,
          syncStartedAt: null,
          syncFinishedAt: null,
        },
      });
    }
  }

  await ctx.prisma.job.update({
    where: { id: job.id },
    data: {
      status: "pending",
      progress: 0,
      attempts: 0,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      errorJson: null,
    },
    select: { id: true },
  });
}

async function cancelJob(
  ctx: Parameters<Parameters<typeof adminProcedure.mutation>[0]>[0]["ctx"],
  job: {
    id: string;
    type: string;
    payloadJson: string;
  },
  options: {
    reason: string;
  },
) {
  const payload = parseJobPayload(job.payloadJson);
  const errorJson = buildJobStateErrorJson(options.reason, "JobCancelled");

  if (job.type === "transcode_prepare" && payload?.trackId && payload.profile && payload.sourceMtimeMs) {
    await ctx.prisma.transcodeCache.updateMany({
      where: {
        trackId: payload.trackId,
        profile: payload.profile,
        sourceMtimeMs: BigInt(payload.sourceMtimeMs),
      },
      data: {
        status: "cancelled",
        errorJson,
      },
    });
  }

  if (job.type === "track_edit_sync" && payload?.trackId && payload.domain) {
    const errorJson = buildJobStateErrorJson(options.reason, "JobCancelled");
    if (payload.domain === "metadata") {
      await ctx.prisma.trackMetadataEdit.updateMany({
        where: { trackId: payload.trackId },
        data: {
          syncStatus: "failed",
          syncErrorJson: errorJson,
        },
      });
    } else if (payload.domain === "lyrics") {
      await ctx.prisma.trackLyricsEdit.updateMany({
        where: { trackId: payload.trackId },
        data: {
          syncStatus: "failed",
          syncErrorJson: errorJson,
        },
      });
    } else if (payload.domain === "cover") {
      await ctx.prisma.trackCoverEdit.updateMany({
        where: { trackId: payload.trackId },
        data: {
          syncStatus: "failed",
          syncErrorJson: errorJson,
        },
      });
    }
  }

  await ctx.prisma.job.update({
    where: { id: job.id },
    data: {
      status: "cancelled",
      progress: 0,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      errorJson,
    },
    select: { id: true },
  });
}

export const jobsRouter = router({
  enqueueScanFull: adminProcedure.mutation(async ({ ctx }) => {
    const existingJob = await ctx.prisma.job.findFirst({
      where: {
        type: "scan_full",
        status: {
          in: ["pending", "running"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingJob) {
      return { jobId: existingJob.id, deduped: true as const, status: existingJob.status };
    }

    const jobId = `job_${randomUUID()}`;
    const payloadJson = JSON.stringify({
      jobKey: "scan_full:default",
      musicRoot: null,
    });

    await ctx.prisma.job.create({
      data: {
        id: jobId,
        type: "scan_full",
        status: "pending",
        payloadJson,
      },
      select: { id: true },
    });

    return { jobId, deduped: false as const, status: "pending" as const };
  }),

  get: adminProcedure
    .input(
      z.object({
        jobId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId },
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          attempts: true,
          maxAttempts: true,
          payloadJson: true,
          errorJson: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job 不存在" });
      }

      return job;
    }),

  retry: adminProcedure
    .input(
      z.object({
        jobId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId },
        select: {
          id: true,
          type: true,
          status: true,
          payloadJson: true,
        },
      });

      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job 不存在" });
      }

      if (job.status === "pending" || job.status === "running") {
        throw new TRPCError({ code: "CONFLICT", message: "任务已经在进行中，无需重试" });
      }

      await resetJobForRetry(ctx, {
        id: job.id,
        type: job.type,
        payloadJson: job.payloadJson,
      });

      return {
        jobId: job.id,
        status: "pending" as const,
      };
    }),

  cancel: adminProcedure
    .input(
      z.object({
        jobId: z.string().min(1),
        reason: z.string().trim().min(1).max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId },
        select: {
          id: true,
          type: true,
          status: true,
          payloadJson: true,
        },
      });

      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job 不存在" });
      }

      if (job.type !== "transcode_prepare" && job.status === "running") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "当前仅支持取消转码类运行中任务",
        });
      }

      if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
        return {
          jobId: job.id,
          status: job.status,
          cancelled: false as const,
        };
      }

      await cancelJob(ctx, {
        id: job.id,
        type: job.type,
        payloadJson: job.payloadJson,
      }, {
        reason: input.reason?.trim() || "任务已取消",
      });

      return {
        jobId: job.id,
        status: "cancelled" as const,
        cancelled: true as const,
      };
    }),

  retryFailedTranscodes: adminProcedure
    .input(
      z.object({
        categories: z.array(z.enum(TRANSCODE_FAILURE_CATEGORIES)).default([]),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const failedJobs = await ctx.prisma.job.findMany({
        where: {
          type: "transcode_prepare",
          status: "failed",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
        select: {
          id: true,
          type: true,
          payloadJson: true,
          errorJson: true,
        },
      });

      const requestedCategories = new Set<TranscodeFailureCategory>(input.categories);
      const matchedJobs =
        requestedCategories.size === 0
          ? failedJobs
          : failedJobs.filter((job) => requestedCategories.has(classifyTranscodeFailure(job.errorJson)));

      for (const job of matchedJobs) {
        await resetJobForRetry(ctx, {
          id: job.id,
          type: job.type,
          payloadJson: job.payloadJson,
        });
      }

      return {
        retried: matchedJobs.length,
      };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.job.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        attempts: true,
        maxAttempts: true,
        payloadJson: true,
        errorJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),
});
