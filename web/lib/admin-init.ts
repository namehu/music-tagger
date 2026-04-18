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
const ADMIN_INIT_LOCK_TTL_MS = 60_000;

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

function getJsonObject(dataJson: string | null | undefined): Record<string, unknown> {
  const parsed = typeof dataJson === "string" ? safeJsonParse(dataJson) : null;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {};
}

export function getAdminInitState(dataJson: string | null | undefined): AdminInitState {
  const parsed = typeof dataJson === "string" ? safeJsonParse(dataJson) : null;
  if (!parsed || typeof parsed !== "object") return "none";

  const state = (parsed as { state?: unknown }).state;
  return state === "locking" || state === "done" ? state : "none";
}

function getAdminInitLockStartedAt(dataJson: string | null | undefined) {
  const root = getJsonObject(dataJson);
  const startedAt = root.startedAt;
  if (typeof startedAt !== "string") return null;

  const timestamp = Date.parse(startedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isActiveAdminInitLock(dataJson: string | null | undefined, now: Date) {
  if (getAdminInitState(dataJson) !== "locking") return false;
  const startedAt = getAdminInitLockStartedAt(dataJson);
  if (startedAt === null) return false;

  return now.getTime() - startedAt < ADMIN_INIT_LOCK_TTL_MS;
}

function mergeAdminInitState(
  dataJson: string | null | undefined,
  next:
    | { state: "locking"; startedAt: string }
    | { state: "done"; doneAt: string; adminUserId: string }
    | { state: "none" },
) {
  const root = getJsonObject(dataJson);

  delete root.state;
  delete root.startedAt;
  delete root.doneAt;
  delete root.adminUserId;

  if (next.state === "locking") {
    root.state = "locking";
    root.startedAt = next.startedAt;
  }

  if (next.state === "done") {
    root.state = "done";
    root.doneAt = next.doneAt;
    root.adminUserId = next.adminUserId;
  }

  return JSON.stringify(root);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;

    const errorMessage = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof errorMessage === "string" && errorMessage.trim().length > 0) return errorMessage;
  }

  return null;
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

      if (isActiveAdminInitLock(settings?.dataJson, new Date())) {
        return "locking" as const;
      }

      return getAdminInitState(settings?.dataJson) === "done" ? ("done" as const) : ("none" as const);
    })(),
    hasAdminUser(),
  ]);

  return {
    initialized: adminExists,
    state: adminExists ? ("done" as const) : settingsState === "locking" ? settingsState : ("none" as const),
  };
}

export async function initializeAdmin(input: CreateAdminInput) {
  const status = await getAdminInitializationStatus();
  if (status.initialized) {
    throw new AdminInitializationError("ALREADY_INITIALIZED", "系统已完成初始化");
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const [admin, settings] = await Promise.all([
      tx.user.findFirst({
        where: { role: "admin" },
        select: { id: true },
      }),
      tx.adminSettings.findUnique({
        where: { id: "singleton" },
        select: { dataJson: true },
      }),
    ]);

    if (admin) {
      throw new AdminInitializationError("ALREADY_INITIALIZED", "系统已完成初始化");
    }

    if (settings && isActiveAdminInitLock(settings.dataJson, now)) {
      throw new AdminInitializationError("INITIALIZING", "系统正在初始化中，请稍后再试");
    }

    const dataJson = mergeAdminInitState(settings?.dataJson, {
      state: "locking",
      startedAt: now.toISOString(),
    });

    await tx.adminSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        dataJson,
        updatedAt: now,
      },
      update: {
        dataJson,
        updatedAt: now,
      },
    });
  });

  try {
    const userId = await (async () => {
      try {
        const result = await auth.api.signUpEmail({
          body: {
            email: input.email,
            password: input.password,
            name: input.name ?? "Admin",
          },
        });

        const maybeError = (result as { error?: { message?: string } } | null)?.error;
        if (maybeError) {
          throw new Error(maybeError.message ?? "创建用户失败");
        }

        const createdUserId = result?.user?.id;
        if (createdUserId) return createdUserId;

        throw new Error("创建用户失败：未获取到 userId");
      } catch (cause) {
        const existingUser = await prisma.user.findUnique({
          where: { email: input.email },
          select: { id: true },
        });

        if (existingUser) {
          return existingUser.id;
        }

        throw cause;
      }
    })();

    await prisma.user.update({
      where: { id: userId },
      data: { role: "admin" },
    });

    const settings = await prisma.adminSettings.findUnique({
      where: { id: "singleton" },
      select: { dataJson: true },
    });

    await prisma.adminSettings.update({
      where: { id: "singleton" },
      data: {
        dataJson: mergeAdminInitState(settings?.dataJson, {
          state: "done",
          doneAt: new Date().toISOString(),
          adminUserId: userId,
        }),
        updatedAt: new Date(),
      },
    });

    return { ok: true as const, userId };
  } catch (cause) {
    await prisma.adminSettings
      .findUnique({
        where: { id: "singleton" },
        select: { dataJson: true },
      })
      .then((settings) =>
        settings
          ? prisma.adminSettings.update({
              where: { id: "singleton" },
              data: {
                dataJson: mergeAdminInitState(settings.dataJson, { state: "none" }),
                updatedAt: new Date(),
              },
            })
          : undefined,
      )
      .catch(() => undefined);

    if (cause instanceof AdminInitializationError) {
      throw cause;
    }

    throw new AdminInitializationError(
      "INITIALIZATION_FAILED",
      getErrorMessage(cause) ?? "初始化失败",
      {
        cause,
      },
    );
  }
}
