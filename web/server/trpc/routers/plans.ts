import path from "node:path";
import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getPlanScopeSummary,
  parseRenamePlanParams,
  parsePlanPreviewSummary,
  parsePlanScope,
  parseTagWritePlanParams,
  parsePlanWarnings,
  type PlanPreviewSummary,
  type PlanWarning,
} from "@/lib/plans";

import { adminProcedure, router } from "../trpc";

const PLAN_TYPE_VALUES = ["rename", "tag_write"] as const;
const PLAN_STATUS_VALUES = ["draft", "confirmed", "running", "done", "failed", "cancelled"] as const;
const PLAN_ITEM_STATUS_VALUES = ["pending", "running", "done", "failed", "skipped"] as const;
const MAX_SCOPE_TRACKS = 200;
const INVALID_FILENAME_RE = /[\/\0]/;
const RENAME_TEMPLATE_TOKEN_RE = /\{([a-zA-Z][a-zA-Z0-9]*)(?::(\d+))?\}/g;
const TAG_WRITE_SUPPORTED_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".mp4", ".ogg", ".opus"]);

const createPlanInputSchema = z.object({
  type: z.enum(PLAN_TYPE_VALUES),
  scope: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("trackIds"),
      trackIds: z.array(z.string().min(1)).min(1).max(MAX_SCOPE_TRACKS),
    }),
    z.object({
      type: z.literal("album"),
      album: z.string().trim().min(1).max(300),
    }),
    z.object({
      type: z.literal("artist"),
      artist: z.string().trim().min(1).max(300),
    }),
  ]),
  params: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("rename"),
      template: z.string().trim().min(1).max(200),
    }),
    z
      .object({
        type: z.literal("tag_write"),
        title: z.string().trim().max(300).nullable().optional(),
        artist: z.string().trim().max(300).nullable().optional(),
        album: z.string().trim().max(300).nullable().optional(),
        albumArtist: z.string().trim().max(300).nullable().optional(),
        trackNo: z.number().int().min(0).max(999).nullable().optional(),
        discNo: z.number().int().min(0).max(99).nullable().optional(),
        year: z.number().int().min(0).max(9999).nullable().optional(),
        genre: z.string().trim().max(200).nullable().optional(),
      })
      .refine(
        (input) =>
          typeof input.title !== "undefined" ||
          typeof input.artist !== "undefined" ||
          typeof input.album !== "undefined" ||
          typeof input.albumArtist !== "undefined" ||
          typeof input.trackNo !== "undefined" ||
          typeof input.discNo !== "undefined" ||
          typeof input.year !== "undefined" ||
          typeof input.genre !== "undefined",
        {
          message: "至少提供一个要写回的标签字段",
        },
      ),
  ]),
});

const listPlansInputSchema = z.object({
  status: z.enum(["all", ...PLAN_STATUS_VALUES]).default("all"),
  q: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const getPlanInputSchema = z.object({
  planId: z.string().min(1),
});

const listPlanItemsInputSchema = z.object({
  planId: z.string().min(1),
  status: z.enum(["all", ...PLAN_ITEM_STATUS_VALUES]).default("all"),
});

type PlanTrackSnapshot = {
  id: string;
  path: string;
  dirPath: string;
  filename: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  trackNo: number | bigint | null;
  discNo: number | bigint | null;
  year: number | bigint | null;
  genre: string | null;
};

type DraftPreviewItem = {
  id: string;
  kind: "rename" | "tag_write";
  trackId: string | null;
  fromPath: string;
  toPath: string | null;
  tagDiffJson: string | null;
  warnings: PlanWarning[];
};

function toNullableNumber(value: number | bigint | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePlanStateErrorJson(errorJson: string | null | undefined) {
  if (!errorJson) {
    return null;
  }

  try {
    return JSON.parse(errorJson) as { message?: string };
  } catch {
    return null;
  }
}

function buildPlanJobKey(planId: string) {
  return `plan_execute:${planId}`;
}

function buildPlanPayload(planId: string) {
  return JSON.stringify({
    jobKey: buildPlanJobKey(planId),
    planId,
  });
}

function buildPlanScopeSearchText(scopeJson: string, type: string) {
  const scope = parsePlanScope(scopeJson);
  return `${type} ${getPlanScopeSummary(scope)}`.toLowerCase();
}

function buildWarning(code: string, message: string, blocking = false): PlanWarning {
  return {
    code,
    message,
    blocking,
  };
}

function normalizeTextValue(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

function getTrackFieldValue(track: PlanTrackSnapshot, field: string) {
  if (field === "title") return normalizeTextValue(track.title);
  if (field === "artist") return normalizeTextValue(track.artist);
  if (field === "album") return normalizeTextValue(track.album);
  if (field === "albumArtist") return normalizeTextValue(track.albumArtist);
  if (field === "trackNo") return toNullableNumber(track.trackNo);
  if (field === "discNo") return toNullableNumber(track.discNo);
  if (field === "year") return toNullableNumber(track.year);
  if (field === "genre") return normalizeTextValue(track.genre);
  return null;
}

function renderRenameTemplate(template: string, track: PlanTrackSnapshot) {
  const filenameBase = path.parse(track.filename).name;

  return template.replace(RENAME_TEMPLATE_TOKEN_RE, (_match, token: string, widthText?: string) => {
    const width = widthText ? Number.parseInt(widthText, 10) : null;
    const fieldValue: string | number | null =
      token === "title"
        ? track.title ?? filenameBase
        : token === "artist"
          ? track.artist
          : token === "album"
            ? track.album
            : token === "albumArtist"
              ? track.albumArtist
              : token === "trackNo"
                ? toNullableNumber(track.trackNo)
                : token === "discNo"
                  ? toNullableNumber(track.discNo)
                  : token === "year"
                    ? toNullableNumber(track.year)
                    : token === "genre"
                      ? track.genre
                      : token === "filenameBase"
                        ? filenameBase
                        : null;

    if (typeof fieldValue === "number") {
      const rendered = String(fieldValue);
      return width ? rendered.padStart(width, "0") : rendered;
    }

    return typeof fieldValue === "string" ? fieldValue.trim() : "";
  });
}

async function resolveScopeTracks(
  prisma: PrismaClient,
  scopeJson: string,
): Promise<PlanTrackSnapshot[]> {
  const scope = parsePlanScope(scopeJson);
  if (!scope) {
    return [];
  }

  if (scope.type === "trackIds") {
    return prisma.$queryRaw<PlanTrackSnapshot[]>(Prisma.sql`
      SELECT
        t."id",
        t."path",
        t."dirPath",
        t."filename",
        COALESCE(t."titleOverride", t."title") AS "title",
        COALESCE(t."artistOverride", t."artist") AS "artist",
        COALESCE(t."albumOverride", t."album") AS "album",
        COALESCE(t."albumArtistOverride", t."albumArtist") AS "albumArtist",
        COALESCE(t."trackNoOverride", t."trackNo") AS "trackNo",
        COALESCE(t."discNoOverride", t."discNo") AS "discNo",
        COALESCE(t."yearOverride", t."year") AS "year",
        COALESCE(t."genreOverride", t."genre") AS "genre"
      FROM "tracks" AS t
      WHERE t."id" IN (${Prisma.join(scope.trackIds)})
      ORDER BY
        COALESCE(t."albumOverride", t."album", '') ASC,
        COALESCE(t."discNoOverride", t."discNo", 0) ASC,
        COALESCE(t."trackNoOverride", t."trackNo", 0) ASC,
        t."filename" ASC
    `);
  }

  if (scope.type === "album") {
    return prisma.$queryRaw<PlanTrackSnapshot[]>(Prisma.sql`
      SELECT
        t."id",
        t."path",
        t."dirPath",
        t."filename",
        COALESCE(t."titleOverride", t."title") AS "title",
        COALESCE(t."artistOverride", t."artist") AS "artist",
        COALESCE(t."albumOverride", t."album") AS "album",
        COALESCE(t."albumArtistOverride", t."albumArtist") AS "albumArtist",
        COALESCE(t."trackNoOverride", t."trackNo") AS "trackNo",
        COALESCE(t."discNoOverride", t."discNo") AS "discNo",
        COALESCE(t."yearOverride", t."year") AS "year",
        COALESCE(t."genreOverride", t."genre") AS "genre"
      FROM "tracks" AS t
      WHERE COALESCE(t."albumOverride", t."album") = ${scope.album}
      ORDER BY
        COALESCE(t."discNoOverride", t."discNo", 0) ASC,
        COALESCE(t."trackNoOverride", t."trackNo", 0) ASC,
        t."filename" ASC
    `);
  }

  return prisma.$queryRaw<PlanTrackSnapshot[]>(Prisma.sql`
    SELECT
      t."id",
      t."path",
      t."dirPath",
      t."filename",
      COALESCE(t."titleOverride", t."title") AS "title",
      COALESCE(t."artistOverride", t."artist") AS "artist",
      COALESCE(t."albumOverride", t."album") AS "album",
      COALESCE(t."albumArtistOverride", t."albumArtist") AS "albumArtist",
      COALESCE(t."trackNoOverride", t."trackNo") AS "trackNo",
      COALESCE(t."discNoOverride", t."discNo") AS "discNo",
      COALESCE(t."yearOverride", t."year") AS "year",
      COALESCE(t."genreOverride", t."genre") AS "genre"
    FROM "tracks" AS t
    WHERE COALESCE(t."artistOverride", t."artist") = ${scope.artist}
    ORDER BY
      COALESCE(t."albumOverride", t."album", '') ASC,
      COALESCE(t."discNoOverride", t."discNo", 0) ASC,
      COALESCE(t."trackNoOverride", t."trackNo", 0) ASC,
      t."filename" ASC
  `);
}

async function buildRenamePreview(
  prisma: PrismaClient,
  input: {
    scopeJson: string;
    template: string;
  },
): Promise<{
  items: DraftPreviewItem[];
  globalWarnings: PlanWarning[];
  summary: PlanPreviewSummary;
}> {
  const tracks = await resolveScopeTracks(prisma, input.scopeJson);
  const globalWarnings: PlanWarning[] = [];
  const items: DraftPreviewItem[] = [];

  if (tracks.length === 0) {
    const warning = buildWarning("scope_empty", "当前作用范围没有匹配到任何曲目", true);
    return {
      items,
      globalWarnings: [warning],
      summary: {
        sourceTrackCount: 0,
        itemCount: 0,
        warningCount: 1,
        blockingCount: 1,
      },
    };
  }

  for (const track of tracks) {
    const extension = path.extname(track.filename);
    const nextBaseName = renderRenameTemplate(input.template, track).trim();
    const warnings: PlanWarning[] = [];

    if (nextBaseName.length === 0) {
      warnings.push(buildWarning("empty_filename", `曲目 ${track.filename} 生成的目标文件名为空`, true));
    }

    const nextFilename = `${nextBaseName}${extension}`;
    if (INVALID_FILENAME_RE.test(nextFilename)) {
      warnings.push(buildWarning("invalid_filename", `曲目 ${track.filename} 生成的文件名包含非法路径字符`, true));
    }

    if (nextFilename.length > 240) {
      warnings.push(buildWarning("filename_too_long", `曲目 ${track.filename} 生成的文件名过长`, true));
    }

    const toPath = path.join(track.dirPath, nextFilename);
    if (toPath === track.path) {
      continue;
    }

    items.push({
      id: `plan_item_${randomUUID()}`,
      kind: "rename",
      trackId: track.id,
      fromPath: track.path,
      toPath,
      tagDiffJson: null,
      warnings,
    });
  }

  if (items.length === 0) {
    globalWarnings.push(buildWarning("no_changes", "预览结果没有生成任何需要执行的重命名项", true));
  }

  const duplicateTargetMap = new Map<string, DraftPreviewItem[]>();
  for (const item of items) {
    if (!item.toPath) {
      continue;
    }
    const bucket = duplicateTargetMap.get(item.toPath) ?? [];
    bucket.push(item);
    duplicateTargetMap.set(item.toPath, bucket);
  }

  for (const bucket of duplicateTargetMap.values()) {
    if (bucket.length < 2) {
      continue;
    }

    for (const item of bucket) {
      item.warnings.push(buildWarning("duplicate_target", "多个计划项生成了相同目标路径", true));
    }
  }

  const uniqueTargetPaths = [...new Set(items.map((item) => item.toPath).filter((value): value is string => Boolean(value)))];
  if (uniqueTargetPaths.length > 0) {
    const conflicts = await prisma.track.findMany({
      where: {
        path: {
          in: uniqueTargetPaths,
        },
        id: {
          notIn: items
            .map((item) => item.trackId)
            .filter((value): value is string => Boolean(value)),
        },
      },
      select: {
        id: true,
        path: true,
      },
    });

    const conflictSet = new Set(conflicts.map((item) => item.path));
    for (const item of items) {
      if (item.toPath && conflictSet.has(item.toPath)) {
        item.warnings.push(buildWarning("target_exists", "目标路径已经被其他曲目占用", true));
      }
    }
  }

  const warningCount =
    globalWarnings.length + items.reduce((count, item) => count + item.warnings.length, 0);
  const blockingCount =
    globalWarnings.filter((warning) => warning.blocking).length +
    items.reduce(
      (count, item) => count + item.warnings.filter((warning) => warning.blocking).length,
      0,
    );

  return {
    items,
    globalWarnings,
    summary: {
      sourceTrackCount: tracks.length,
      itemCount: items.length,
      warningCount,
      blockingCount,
    },
  };
}

async function buildTagWritePreview(
  prisma: PrismaClient,
  input: {
    scopeJson: string;
    paramsJson: string;
  },
): Promise<{
  items: DraftPreviewItem[];
  globalWarnings: PlanWarning[];
  summary: PlanPreviewSummary;
}> {
  const tracks = await resolveScopeTracks(prisma, input.scopeJson);
  const params = parseTagWritePlanParams(input.paramsJson);
  if (!params) {
    const warning = buildWarning("invalid_params", "tag_write 参数无效或没有可写字段", true);
    return {
      items: [],
      globalWarnings: [warning],
      summary: { sourceTrackCount: tracks.length, itemCount: 0, warningCount: 1, blockingCount: 1 },
    };
  }

  if (tracks.length === 0) {
    const warning = buildWarning("scope_empty", "当前作用范围没有匹配到任何曲目", true);
    return {
      items: [],
      globalWarnings: [warning],
      summary: { sourceTrackCount: 0, itemCount: 0, warningCount: 1, blockingCount: 1 },
    };
  }

  const items: DraftPreviewItem[] = [];
  for (const track of tracks) {
    const warnings: PlanWarning[] = [];
    const extension = path.extname(track.filename).toLowerCase();
    if (!TAG_WRITE_SUPPORTED_EXTENSIONS.has(extension)) {
      warnings.push(buildWarning("unsupported_extension", `当前文件格式暂不支持标签写回: ${track.filename}`, true));
    }

    const diffEntries: Array<{ field: string; from: string | number | null; to: string | number | null }> = [];
    for (const [field, nextValue] of Object.entries(params)) {
      if (typeof nextValue === "undefined") {
        continue;
      }

      const currentValue = getTrackFieldValue(track, field);
      if (currentValue === nextValue) {
        continue;
      }

      diffEntries.push({
        field,
        from: currentValue,
        to: nextValue,
      });
    }

    if (diffEntries.length === 0) {
      continue;
    }

    items.push({
      id: `plan_item_${randomUUID()}`,
      kind: "tag_write",
      trackId: track.id,
      fromPath: track.path,
      toPath: null,
      tagDiffJson: JSON.stringify(diffEntries),
      warnings,
    });
  }

  const globalWarnings: PlanWarning[] = [];
  if (items.length === 0) {
    globalWarnings.push(buildWarning("no_changes", "预览结果没有生成任何标签写回项", true));
  }

  const warningCount =
    globalWarnings.length + items.reduce((count, item) => count + item.warnings.length, 0);
  const blockingCount =
    globalWarnings.filter((warning) => warning.blocking).length +
    items.reduce(
      (count, item) => count + item.warnings.filter((warning) => warning.blocking).length,
      0,
    );

  return {
    items,
    globalWarnings,
    summary: {
      sourceTrackCount: tracks.length,
      itemCount: items.length,
      warningCount,
      blockingCount,
    },
  };
}

export const plansRouter = router({
  list: adminProcedure.input(listPlansInputSchema).query(async ({ ctx, input }) => {
    const plans = await ctx.prisma.plan.findMany({
      take: input.limit,
      orderBy: {
        updatedAt: "desc",
      },
      where:
        input.status === "all"
          ? undefined
          : {
              status: input.status,
            },
      select: {
        id: true,
        type: true,
        status: true,
        scopeJson: true,
        previewSummaryJson: true,
        executionJobId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const search = input.q?.trim().toLowerCase();

    return plans
      .filter((plan) => {
        if (!search) {
          return true;
        }

        const searchText = [
          plan.id,
          plan.type,
          plan.status,
          buildPlanScopeSearchText(plan.scopeJson, plan.type),
          plan.createdBy.name,
          plan.createdBy.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(search);
      })
      .map((plan) => ({
        id: plan.id,
        type: plan.type,
        status: plan.status,
        scopeSummary: getPlanScopeSummary(parsePlanScope(plan.scopeJson)),
        previewSummary: parsePlanPreviewSummary(plan.previewSummaryJson),
        executionJobId: plan.executionJobId,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        createdByName: plan.createdBy.name,
      }));
  }),

  create: adminProcedure.input(createPlanInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const planId = `plan_${randomUUID()}`;
    if (input.type !== input.params.type) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Plan 类型与参数类型不匹配" });
    }

    await ctx.prisma.plan.create({
      data: {
        id: planId,
        createdById: userId,
        type: input.type,
        scopeJson: JSON.stringify(input.scope),
        paramsJson: JSON.stringify(
          input.params.type === "rename"
            ? {
                template: input.params.template,
              }
            : {
                title: typeof input.params.title === "undefined" ? undefined : normalizeTextValue(input.params.title),
                artist: typeof input.params.artist === "undefined" ? undefined : normalizeTextValue(input.params.artist),
                album: typeof input.params.album === "undefined" ? undefined : normalizeTextValue(input.params.album),
                albumArtist:
                  typeof input.params.albumArtist === "undefined"
                    ? undefined
                    : normalizeTextValue(input.params.albumArtist),
                trackNo: input.params.trackNo,
                discNo: input.params.discNo,
                year: input.params.year,
                genre: typeof input.params.genre === "undefined" ? undefined : normalizeTextValue(input.params.genre),
              },
        ),
        status: "draft",
      },
      select: {
        id: true,
      },
    });

    return {
      planId,
      status: "draft" as const,
    };
  }),

  get: adminProcedure.input(getPlanInputSchema).query(async ({ ctx, input }) => {
    const plan = await ctx.prisma.plan.findUnique({
      where: { id: input.planId },
      select: {
        id: true,
        type: true,
        scopeJson: true,
        paramsJson: true,
        previewSummaryJson: true,
        warningsJson: true,
        status: true,
        executionJobId: true,
        previewedAt: true,
        confirmedAt: true,
        startedAt: true,
        completedAt: true,
        errorJson: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!plan) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Plan 不存在" });
    }

    const executionJob =
      plan.executionJobId != null
        ? await ctx.prisma.job.findUnique({
            where: { id: plan.executionJobId },
            select: {
              id: true,
              status: true,
              errorJson: true,
              updatedAt: true,
            },
          })
        : null;

    return {
      id: plan.id,
      type: plan.type,
      status: plan.status,
      scope: parsePlanScope(plan.scopeJson),
      scopeSummary: getPlanScopeSummary(parsePlanScope(plan.scopeJson)),
      params:
        plan.type === "rename"
          ? parseRenamePlanParams(plan.paramsJson)
          : parseTagWritePlanParams(plan.paramsJson),
      previewSummary: parsePlanPreviewSummary(plan.previewSummaryJson),
      warnings: parsePlanWarnings(plan.warningsJson),
      executionJob,
      previewedAt: plan.previewedAt,
      confirmedAt: plan.confirmedAt,
      startedAt: plan.startedAt,
      completedAt: plan.completedAt,
      errorMessage: parsePlanStateErrorJson(plan.errorJson)?.message ?? null,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      createdBy: plan.createdBy,
    };
  }),

  items: adminProcedure.input(listPlanItemsInputSchema).query(async ({ ctx, input }) => {
    const items = await ctx.prisma.planItem.findMany({
      where: {
        planId: input.planId,
        ...(input.status === "all"
          ? {}
          : {
              status: input.status,
            }),
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        kind: true,
        trackId: true,
        fromPath: true,
        toPath: true,
        tagDiffJson: true,
        warningsJson: true,
        status: true,
        errorJson: true,
        updatedAt: true,
        track: {
          select: {
            filename: true,
            title: true,
            titleOverride: true,
            artist: true,
            artistOverride: true,
          },
        },
      },
    });

    return items.map((item) => ({
      id: item.id,
      kind: item.kind,
      trackId: item.trackId,
      fromPath: item.fromPath,
      toPath: item.toPath,
      tagDiff:
        item.tagDiffJson != null
          ? (() => {
              try {
                return JSON.parse(item.tagDiffJson) as Array<{ field: string; from: unknown; to: unknown }>;
              } catch {
                return [];
              }
            })()
          : [],
      warnings: parsePlanWarnings(item.warningsJson),
      status: item.status,
      errorMessage: parsePlanStateErrorJson(item.errorJson)?.message ?? null,
      updatedAt: item.updatedAt,
      trackLabel:
        item.track?.titleOverride ??
        item.track?.title ??
        item.track?.filename ??
        item.trackId ??
        "未知曲目",
      artistLabel: item.track?.artistOverride ?? item.track?.artist ?? "未知艺人",
    }));
  }),

  preview: adminProcedure.input(getPlanInputSchema).mutation(async ({ ctx, input }) => {
    const plan = await ctx.prisma.plan.findUnique({
      where: { id: input.planId },
      select: {
        id: true,
        type: true,
        status: true,
        scopeJson: true,
        paramsJson: true,
      },
    });

    if (!plan) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Plan 不存在" });
    }

    if (plan.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "只有 draft 状态的 Plan 才能重新生成预览" });
    }

    const preview = await (
      plan.type === "rename"
        ? (() => {
            const params = parseRenamePlanParams(plan.paramsJson);
            const template = params?.template?.trim();
            if (!template) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Plan 缺少合法的 rename template" });
            }

            return buildRenamePreview(ctx.prisma, {
              scopeJson: plan.scopeJson,
              template,
            });
          })()
        : buildTagWritePreview(ctx.prisma, {
            scopeJson: plan.scopeJson,
            paramsJson: plan.paramsJson,
          })
    );

    await ctx.prisma.$transaction(async (prisma) => {
      await prisma.planItem.deleteMany({
        where: {
          planId: plan.id,
        },
      });

      if (preview.items.length > 0) {
        await prisma.planItem.createMany({
          data: preview.items.map((item) => ({
            id: item.id,
            planId: plan.id,
            kind: item.kind,
            trackId: item.trackId,
            fromPath: item.fromPath,
            toPath: item.toPath,
            tagDiffJson: item.tagDiffJson,
            warningsJson: JSON.stringify(item.warnings),
            status: "pending",
            errorJson: null,
          })),
        });
      }

      await prisma.plan.update({
        where: { id: plan.id },
        data: {
          previewSummaryJson: JSON.stringify(preview.summary),
          warningsJson: JSON.stringify(preview.globalWarnings),
          previewedAt: new Date(),
          errorJson: null,
        },
        select: { id: true },
      });
    });

    return {
      planId: plan.id,
      status: "draft" as const,
      summary: preview.summary,
      warnings: preview.globalWarnings,
      itemCount: preview.items.length,
    };
  }),

  confirm: adminProcedure.input(getPlanInputSchema).mutation(async ({ ctx, input }) => {
    const plan = await ctx.prisma.plan.findUnique({
      where: { id: input.planId },
      select: {
        id: true,
        status: true,
        previewSummaryJson: true,
        previewedAt: true,
      },
    });

    if (!plan) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Plan 不存在" });
    }

    if (plan.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "当前 Plan 状态不允许确认" });
    }

    if (!plan.previewedAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "请先生成预览，再确认 Plan" });
    }

    const summary = parsePlanPreviewSummary(plan.previewSummaryJson);
    if (summary.itemCount <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "当前预览没有可执行项，不能确认" });
    }

    if (summary.blockingCount > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "当前预览包含阻断性警告，不能确认" });
    }

    await ctx.prisma.plan.update({
      where: { id: plan.id },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        errorJson: null,
      },
      select: { id: true },
    });

    return {
      planId: plan.id,
      status: "confirmed" as const,
    };
  }),

  execute: adminProcedure.input(getPlanInputSchema).mutation(async ({ ctx, input }) => {
    const plan = await ctx.prisma.plan.findUnique({
      where: { id: input.planId },
      select: {
        id: true,
        type: true,
        status: true,
        executionJobId: true,
      },
    });

    if (!plan) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Plan 不存在" });
    }

    if (plan.status !== "confirmed" && plan.status !== "running") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "只有 confirmed 状态的 Plan 才能执行" });
    }

    if (plan.executionJobId) {
      const existingJob = await ctx.prisma.job.findUnique({
        where: { id: plan.executionJobId },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingJob && (existingJob.status === "pending" || existingJob.status === "running")) {
        return {
          planId: plan.id,
          jobId: existingJob.id,
          status: plan.status,
          deduped: true as const,
        };
      }
    }

    const jobId = `job_${randomUUID()}`;
    await ctx.prisma.$transaction([
      ctx.prisma.job.create({
        data: {
          id: jobId,
          type: "plan_execute",
          status: "pending",
          payloadJson: buildPlanPayload(plan.id),
          maxAttempts: 1,
        },
        select: { id: true },
      }),
      ctx.prisma.plan.update({
        where: { id: plan.id },
        data: {
          status: "running",
          executionJobId: jobId,
          errorJson: null,
          completedAt: null,
        },
        select: { id: true },
      }),
    ]);

    return {
      planId: plan.id,
      jobId,
      status: "running" as const,
      deduped: false as const,
    };
  }),
});
