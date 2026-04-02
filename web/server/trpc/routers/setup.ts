import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

import { publicProcedure, router } from "../trpc";

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

type AdminSettingsState = "locking" | "done";

function getStateFromSettings(dataJson: string | null | undefined): AdminSettingsState | null {
  const parsed = typeof dataJson === "string" ? safeJsonParse(dataJson) : null;
  if (!parsed || typeof parsed !== "object") return null;
  const state = (parsed as { state?: unknown }).state;
  return state === "locking" || state === "done" ? state : null;
}

export const setupRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.adminSettings.findUnique({
      where: { id: "singleton" },
      select: { dataJson: true },
    });

    const state = settings?.dataJson ? getStateFromSettings(settings.dataJson) : null;

    return {
      initialized: state === "done",
      state: state ?? "none",
    };
  }),

  createAdmin: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1) acquire initialization lock (AdminSettings singleton row)
      try {
        await ctx.prisma.adminSettings.create({
          data: {
            id: "singleton",
            dataJson: JSON.stringify({
              state: "locking",
              startedAt: new Date().toISOString(),
            }),
            updatedAt: new Date(),
          },
        });
      } catch {
        // lock already exists (already initializing / done)
        const existing = await ctx.prisma.adminSettings.findUnique({
          where: { id: "singleton" },
          select: { dataJson: true },
        });
        const state = existing?.dataJson ? getStateFromSettings(existing.dataJson) : null;

        if (state === "done") {
          throw new TRPCError({ code: "CONFLICT", message: "系统已完成初始化" });
        }
        throw new TRPCError({ code: "CONFLICT", message: "系统正在初始化中，请稍后再试" });
      }

      // 2) create admin user; if anything fails, remove lock row
      try {
        const result = await auth.api.signUpEmail({
          body: {
            email: input.email,
            password: input.password,
            name: input.name ?? "Admin",
          },
        });

        const userId = result?.user?.id;
        if (!userId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "创建用户失败：未获取到 userId",
          });
        }

        await ctx.prisma.user.update({
          where: { id: userId },
          data: { role: "admin" },
        });

        await ctx.prisma.adminSettings.update({
          where: { id: "singleton" },
          data: {
            dataJson: JSON.stringify({
              state: "done",
              doneAt: new Date().toISOString(),
              adminUserId: userId,
            }),
            updatedAt: new Date(),
          },
        });

        return { ok: true };
      } catch (err) {
        // failure => delete lock
        await ctx.prisma.adminSettings
          .delete({ where: { id: "singleton" } })
          .catch(() => undefined);

        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "初始化失败",
          cause: err,
        });
      }
    }),
});

