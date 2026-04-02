import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import { adminProcedure, protectedProcedure, router } from "../trpc";

export const jobsRouter = router({
  enqueueScanFull: adminProcedure.mutation(async ({ ctx }) => {
    const jobId = `job_${randomUUID()}`;

    await ctx.prisma.job.create({
      data: {
        id: jobId,
        type: "scan_full",
        status: "pending",
        payloadJson: JSON.stringify({
          jobKey: jobId,
        }),
      },
      select: { id: true },
    });

    return { jobId };
  }),

  get: protectedProcedure
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
          errorJson: true,
          updatedAt: true,
        },
      });

      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job 不存在" });
      }

      return job;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.job.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        attempts: true,
        errorJson: true,
        updatedAt: true,
      },
    });
  }),
});

