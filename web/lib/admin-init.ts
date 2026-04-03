import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const createAdminInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export type CreateAdminInput = z.infer<typeof createAdminInputSchema>;
export type AdminInitState = "none" | "locking" | "done";

function isMissingTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2021"
  );
}

export class AdminInitializationError extends Error {
  constructor(
    public readonly code: "ALREADY_INITIALIZED" | "INITIALIZING" | "INITIALIZATION_FAILED",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AdminInitializationError";
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getAdminInitState(dataJson: string | null | undefined): AdminInitState {
  const parsed = typeof dataJson === "string" ? safeJsonParse(dataJson) : null;
  if (!parsed || typeof parsed !== "object") return "none";

  const state = (parsed as { state?: unknown }).state;
  return state === "locking" || state === "done" ? state : "none";
}

async function hasAdminUser() {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true },
    });
    return Boolean(admin);
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }

    return false;
  }
}

export async function getAdminInitializationStatus() {
  const [settingsState, adminExists] = await Promise.all([
    (async () => {
      let settings: { dataJson: string } | null = null;
      try {
        settings = await prisma.adminSettings.findUnique({
          where: { id: "singleton" },
          select: { dataJson: true },
        });
      } catch (error) {
        if (!isMissingTableError(error)) {
          throw error;
        }
      }

      return getAdminInitState(settings?.dataJson);
    })(),
    hasAdminUser(),
  ]);

  return {
    initialized: adminExists,
    state: adminExists ? ("done" as const) : settingsState,
  };
}

export async function initializeAdmin(input: CreateAdminInput) {
  const status = await getAdminInitializationStatus();
  if (status.initialized) {
    throw new AdminInitializationError("ALREADY_INITIALIZED", "系统已完成初始化");
  }

  try {
    await prisma.adminSettings.create({
      data: {
        id: "singleton",
        dataJson: JSON.stringify({
          state: "locking",
          startedAt: new Date().toISOString(),
        }),
        updatedAt: new Date(),
      },
    });
  } catch (cause) {
    const latestStatus = await getAdminInitializationStatus();
    if (latestStatus.initialized) {
      throw new AdminInitializationError("ALREADY_INITIALIZED", "系统已完成初始化", {
        cause,
      });
    }

    throw new AdminInitializationError("INITIALIZING", "系统正在初始化中，请稍后再试", {
      cause,
    });
  }

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
      throw new Error("创建用户失败：未获取到 userId");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: "admin" },
    });

    await prisma.adminSettings.update({
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

    return { ok: true as const, userId };
  } catch (cause) {
    await prisma.adminSettings.delete({ where: { id: "singleton" } }).catch(() => undefined);

    if (cause instanceof AdminInitializationError) {
      throw cause;
    }

    throw new AdminInitializationError("INITIALIZATION_FAILED", "初始化失败", {
      cause,
    });
  }
}
