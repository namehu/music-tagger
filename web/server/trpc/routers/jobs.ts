import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import { parseJobPayload } from "@/lib/jobs";

import { adminProcedure, router } from "../trpc";

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

      return {
        jobId: job.id,
        status: "pending" as const,
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
