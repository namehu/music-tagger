import { z } from "zod";

import { getAppSettings, mergeAppSettingsDataJson } from "@/lib/app-settings";

import { adminProcedure, router } from "../trpc";

const updateTranscodePolicyInputSchema = z.object({
  coldCacheDays: z.number().int().min(1).max(3650),
  budgetBytes: z.number().int().min(0).max(1024 ** 4),
  pruneLimit: z.number().int().min(1).max(500),
});

export const settingsRouter = router({
  get: adminProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.adminSettings.findUnique({
      where: { id: "singleton" },
      select: {
        dataJson: true,
        updatedAt: true,
      },
    });

    return {
      ...getAppSettings(settings?.dataJson),
      updatedAt: settings?.updatedAt ?? null,
    };
  }),

  updateTranscodePolicy: adminProcedure
    .input(updateTranscodePolicyInputSchema)
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.prisma.adminSettings.findUnique({
        where: { id: "singleton" },
        select: {
          dataJson: true,
        },
      });

      const updated = await ctx.prisma.adminSettings.upsert({
        where: { id: "singleton" },
        update: {
          dataJson: mergeAppSettingsDataJson(current?.dataJson, {
            transcodePolicy: input,
          }),
          updatedAt: new Date(),
        },
        create: {
          id: "singleton",
          dataJson: mergeAppSettingsDataJson(null, {
            transcodePolicy: input,
          }),
          updatedAt: new Date(),
        },
        select: {
          dataJson: true,
          updatedAt: true,
        },
      });

      return {
        ...getAppSettings(updated.dataJson),
        updatedAt: updated.updatedAt,
      };
    }),
});
