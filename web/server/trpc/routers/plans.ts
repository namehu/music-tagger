import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getPlanScopeSummary,
  parseMovePlanParams,
  parsePlanPreviewSummary,
  parsePlanScope,
  parsePlanWarnings,
  parseRenamePlanParams,
  parseTagWritePlanParams,
} from "@/lib/plans";
import { getTrackDisplaySummary } from "@/lib/track-edits";

import { adminProcedure, router } from "../trpc";

const PLAN_STATUS_VALUES = ["draft", "confirmed", "running", "done", "failed", "cancelled"] as const;
const PLAN_ITEM_STATUS_VALUES = ["pending", "running", "done", "failed", "skipped"] as const;

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

function buildPlanScopeSearchText(scopeJson: string, type: string) {
  const scope = parsePlanScope(scopeJson);
  return `${type} ${getPlanScopeSummary(scope)}`.toLowerCase();
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
      throw new TRPCError({ code: "NOT_FOUND", message: "执行记录不存在" });
    }

    const executionJob =
      plan.executionJobId != null
        ? await ctx.prisma.job.findUnique({
            where: { id: plan.executionJobId },
            select: {
              id: true,
              status: true,
              progress: true,
              errorJson: true,
              updatedAt: true,
            },
          })
        : null;

    const params =
      plan.type === "rename"
        ? parseRenamePlanParams(plan.paramsJson)
        : plan.type === "move"
          ? parseMovePlanParams(plan.paramsJson)
          : parseTagWritePlanParams(plan.paramsJson);

    return {
      id: plan.id,
      type: plan.type,
      status: plan.status,
      scopeSummary: getPlanScopeSummary(parsePlanScope(plan.scopeJson)),
      params,
      previewSummary: parsePlanPreviewSummary(plan.previewSummaryJson),
      warnings: parsePlanWarnings(plan.warningsJson),
      previewedAt: plan.previewedAt,
      confirmedAt: plan.confirmedAt,
      startedAt: plan.startedAt,
      completedAt: plan.completedAt,
      errorMessage: parsePlanStateErrorJson(plan.errorJson)?.message ?? null,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      createdBy: plan.createdBy,
      executionJob,
    };
  }),

  items: adminProcedure.input(listPlanItemsInputSchema).query(async ({ ctx, input }) => {
    const items = await ctx.prisma.planItem.findMany({
      where: {
        planId: input.planId,
        ...(input.status === "all" ? {} : { status: input.status }),
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
            artist: true,
            album: true,
            albumArtist: true,
            trackNo: true,
            discNo: true,
            year: true,
            genre: true,
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
      trackLabel: item.track ? getTrackDisplaySummary(item.track).title : item.trackId ?? "未知曲目",
      artistLabel: item.track ? getTrackDisplaySummary(item.track).artist : "未知艺人",
    }));
  }),
});
