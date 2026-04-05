export const PLAN_TYPES = ["rename", "tag_write"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_STATUSES = [
  "draft",
  "confirmed",
  "running",
  "done",
  "failed",
  "cancelled",
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_ITEM_STATUSES = ["pending", "running", "done", "failed", "skipped"] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

export type RenamePlanScope =
  | { type: "trackIds"; trackIds: string[] }
  | { type: "album"; album: string }
  | { type: "artist"; artist: string };

export type RenamePlanParams = {
  template: string;
};

export type TagWritePlanParams = {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  trackNo?: number | null;
  discNo?: number | null;
  year?: number | null;
  genre?: string | null;
};

export type PlanWarning = {
  code: string;
  message: string;
  blocking: boolean;
};

export type PlanPreviewSummary = {
  sourceTrackCount: number;
  itemCount: number;
  warningCount: number;
  blockingCount: number;
};

type JsonObject = Record<string, unknown>;

function safeJsonParse(value: string | null | undefined): unknown {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parsePlanScope(value: string | null | undefined): RenamePlanScope | null {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as JsonObject;
  const scopeType = record.type;
  if (scopeType === "trackIds" && Array.isArray(record.trackIds)) {
    const trackIds = record.trackIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return trackIds.length > 0 ? { type: "trackIds", trackIds } : null;
  }

  if (scopeType === "album" && typeof record.album === "string" && record.album.trim().length > 0) {
    return { type: "album", album: record.album.trim() };
  }

  if (scopeType === "artist" && typeof record.artist === "string" && record.artist.trim().length > 0) {
    return { type: "artist", artist: record.artist.trim() };
  }

  return null;
}

export function parseRenamePlanParams(value: string | null | undefined): RenamePlanParams | null {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as JsonObject;
  if (typeof record.template !== "string" || record.template.trim().length === 0) {
    return null;
  }

  return {
    template: record.template.trim(),
  };
}

function normalizeOptionalString(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function normalizeOptionalInteger(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

export function parseTagWritePlanParams(value: string | null | undefined): TagWritePlanParams | null {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as JsonObject;
  const params: TagWritePlanParams = {
    title: normalizeOptionalString(record.title),
    artist: normalizeOptionalString(record.artist),
    album: normalizeOptionalString(record.album),
    albumArtist: normalizeOptionalString(record.albumArtist),
    trackNo: normalizeOptionalInteger(record.trackNo),
    discNo: normalizeOptionalInteger(record.discNo),
    year: normalizeOptionalInteger(record.year),
    genre: normalizeOptionalString(record.genre),
  };

  const hasChanges = Object.values(params).some((value) => typeof value !== "undefined");
  return hasChanges ? params : null;
}

export function parsePlanWarnings(value: string | null | undefined): PlanWarning[] {
  const parsed = safeJsonParse(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as JsonObject;
    if (
      typeof record.code !== "string" ||
      typeof record.message !== "string" ||
      typeof record.blocking !== "boolean"
    ) {
      return [];
    }

    return [
      {
        code: record.code,
        message: record.message,
        blocking: record.blocking,
      },
    ];
  });
}

export function parsePlanPreviewSummary(value: string | null | undefined): PlanPreviewSummary {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") {
    return {
      sourceTrackCount: 0,
      itemCount: 0,
      warningCount: 0,
      blockingCount: 0,
    };
  }

  const record = parsed as JsonObject;
  return {
    sourceTrackCount:
      typeof record.sourceTrackCount === "number" && Number.isFinite(record.sourceTrackCount)
        ? record.sourceTrackCount
        : 0,
    itemCount:
      typeof record.itemCount === "number" && Number.isFinite(record.itemCount)
        ? record.itemCount
        : 0,
    warningCount:
      typeof record.warningCount === "number" && Number.isFinite(record.warningCount)
        ? record.warningCount
        : 0,
    blockingCount:
      typeof record.blockingCount === "number" && Number.isFinite(record.blockingCount)
        ? record.blockingCount
        : 0,
  };
}

export function getPlanScopeSummary(scope: RenamePlanScope | null) {
  if (!scope) {
    return "未知范围";
  }

  if (scope.type === "trackIds") {
    return `${scope.trackIds.length} 首曲目`;
  }

  if (scope.type === "album") {
    return `专辑 ${scope.album}`;
  }

  return `艺人 ${scope.artist}`;
}

export function getPlanTypeLabel(type: string) {
  if (type === "rename") {
    return "批量重命名";
  }

  if (type === "tag_write") {
    return "批量写标签";
  }

  return type;
}

export function getPlanStatusLabel(status: string) {
  if (status === "draft") return "draft";
  if (status === "confirmed") return "confirmed";
  if (status === "running") return "running";
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return status;
}

export type PlanActionState = {
  canPreview: boolean;
  previewReason: string | null;
  canConfirm: boolean;
  confirmReason: string | null;
  canExecute: boolean;
  executeReason: string | null;
};

export type PlanExecutionCounts = Record<PlanItemStatus, number> & {
  total: number;
};

export function getPlanActionState(input: {
  status: PlanStatus;
  previewedAt: string | Date | null;
  previewSummary: PlanPreviewSummary;
  executionJobStatus: string | null;
}): PlanActionState {
  const canPreview = input.status === "draft";
  const previewReason = canPreview ? null : "只有 draft 状态的 Plan 才能重新生成预览";

  let confirmReason: string | null = null;
  if (input.status !== "draft") {
    confirmReason = "只有 draft 状态的 Plan 才能确认";
  } else if (!input.previewedAt) {
    confirmReason = "请先生成预览，再确认 Plan";
  } else if (input.previewSummary.itemCount <= 0) {
    confirmReason = "当前预览没有可执行项，不能确认";
  } else if (input.previewSummary.blockingCount > 0) {
    confirmReason = "当前预览包含阻断性警告，不能确认";
  }

  let executeReason: string | null = null;
  if (input.executionJobStatus === "pending" || input.executionJobStatus === "running") {
    executeReason = "当前已有进行中的执行任务";
  } else if (input.status !== "confirmed") {
    executeReason =
      input.status === "running" ? "当前计划正在执行中" : "先确认 Plan，才能提交执行";
  }

  return {
    canPreview,
    previewReason,
    canConfirm: confirmReason == null,
    confirmReason,
    canExecute: executeReason == null,
    executeReason,
  };
}

export function getPlanExecutionCounts(statuses: PlanItemStatus[]): PlanExecutionCounts {
  const counts: PlanExecutionCounts = {
    pending: 0,
    running: 0,
    done: 0,
    failed: 0,
    skipped: 0,
    total: statuses.length,
  };

  for (const status of statuses) {
    counts[status] += 1;
  }

  return counts;
}

export function getPlanExecutionHint(input: {
  status: PlanStatus;
  previewSummary: PlanPreviewSummary;
  executionJobStatus: string | null;
  actionState: PlanActionState;
  counts: PlanExecutionCounts;
}) {
  if (input.status === "draft" && input.previewSummary.itemCount <= 0) {
    return "先生成预览，确认本次计划会产生哪些变更。";
  }

  if (input.status === "draft" && input.previewSummary.blockingCount > 0) {
    return "先处理阻断性警告，再确认 Plan。";
  }

  if (input.status === "confirmed") {
    return "预览已经冻结，可以把这次计划提交给 worker 执行。";
  }

  if (input.executionJobStatus === "pending" || input.executionJobStatus === "running") {
    return "执行任务仍在进行中，页面会自动刷新最新状态。";
  }

  if (input.status === "failed" || input.counts.failed > 0) {
    return "执行已结束，但仍有失败项；先检查错误信息和 Jobs 日志。";
  }

  if (input.status === "done") {
    return "本次计划已执行完成，可以继续创建下一批整理任务。";
  }

  if (!input.actionState.canExecute && input.actionState.executeReason) {
    return input.actionState.executeReason;
  }

  return "当前计划会先预览、再确认、最后进入后台执行。";
}
