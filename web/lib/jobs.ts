import {
  classifyTranscodeFailure,
  getTranscodeFailureCategoryLabel,
  type TranscodeFailureCategory,
} from "@/lib/transcode-failure";

export type ParsedJobPayload = {
  jobKey?: string;
  musicRoot?: string | null;
  trackId?: string;
  profile?: string;
  sourcePath?: string;
  sourceMtimeMs?: number;
  planId?: string;
  domain?: "metadata" | "lyrics" | "cover";
};

export type ScanFullProgressPhase = "discovering" | "scanning" | "cleanup" | "done";

export type ScanFullProgress = {
  kind: "scan_full";
  phase: ScanFullProgressPhase;
  total: number | null;
  scanned: number;
  processed: number;
  skipped: number;
  deleted: number;
};

export type JobProgressEvent = {
  id: string;
  type: string;
  status: string;
  progress: number;
  progressJson: string | null;
  errorJson: string | null;
  updatedAt: string | Date;
};

export function parseScanFullProgress(progressJson: string | null | undefined): ScanFullProgress | null {
  if (!progressJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(progressJson) as Partial<ScanFullProgress> | null;
    if (!parsed || parsed.kind !== "scan_full") {
      return null;
    }

    const phase = parsed.phase;
    if (phase !== "discovering" && phase !== "scanning" && phase !== "cleanup" && phase !== "done") {
      return null;
    }

    return {
      kind: "scan_full",
      phase,
      total: typeof parsed.total === "number" && Number.isFinite(parsed.total) ? parsed.total : null,
      scanned: coerceProgressCount(parsed.scanned),
      processed: coerceProgressCount(parsed.processed),
      skipped: coerceProgressCount(parsed.skipped),
      deleted: coerceProgressCount(parsed.deleted),
    };
  } catch {
    return null;
  }
}

export function formatScanFullProgressSummary(progressJson: string | null | undefined) {
  const progress = parseScanFullProgress(progressJson);
  if (!progress) {
    return null;
  }

  const totalText = progress.total == null ? "?" : String(progress.total);
  const headline =
    progress.phase === "discovering"
      ? "正在统计音乐文件"
      : progress.phase === "cleanup"
        ? "正在清理已不存在的曲目"
        : progress.phase === "done"
          ? `扫描完成 ${progress.scanned} / ${totalText}`
          : `已扫描 ${progress.scanned} / ${totalText}`;

  return {
    headline,
    details: [
      `已处理 ${progress.processed}`,
      `跳过 ${progress.skipped}`,
      `删除 ${progress.deleted}`,
    ],
    progress,
  };
}

function coerceProgressCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function parseJobPayload(payloadJson: string | null | undefined): ParsedJobPayload | null {
  if (!payloadJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson) as ParsedJobPayload;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getJobDisplayName(jobType: string, payloadJson: string | null | undefined) {
  const payload = parseJobPayload(payloadJson);

  if (jobType === "scan_full") {
    return "全量扫描";
  }

  if (jobType === "transcode_prepare") {
    const filename = payload?.sourcePath?.split("/").filter(Boolean).at(-1);
    if (filename) {
      return `转码缓存: ${filename}`;
    }

    return "转码缓存准备";
  }

  if (jobType === "plan_execute") {
    return payload?.planId ? `执行 Plan: ${payload.planId}` : "执行 Plan";
  }

  if (jobType === "track_edit_sync") {
    const domainLabel =
      payload?.domain === "metadata"
        ? "元数据"
        : payload?.domain === "lyrics"
          ? "歌词"
          : payload?.domain === "cover"
            ? "封面"
            : "曲目编辑";
    return payload?.trackId ? `${domainLabel}同步: ${payload.trackId}` : `${domainLabel}同步`;
  }

  return jobType;
}

export function getJobScopeText(jobType: string, payloadJson: string | null | undefined) {
  const payload = parseJobPayload(payloadJson);

  if (jobType === "scan_full") {
    return payload?.musicRoot ? `目录 ${payload.musicRoot}` : "默认音乐目录";
  }

  if (jobType === "transcode_prepare") {
    const profile = payload?.profile ? `档位 ${payload.profile}` : "转码任务";
    const sourcePath = payload?.sourcePath ?? null;
    return sourcePath ? `${profile} · ${sourcePath}` : profile;
  }

  if (jobType === "plan_execute") {
    return payload?.planId ? `Plan ${payload.planId}` : payload?.jobKey ?? "Plan 执行任务";
  }

  if (jobType === "track_edit_sync") {
    const domainLabel =
      payload?.domain === "metadata"
        ? "元数据"
        : payload?.domain === "lyrics"
          ? "歌词"
          : payload?.domain === "cover"
            ? "封面"
            : "编辑";
    return payload?.trackId ? `${domainLabel} · ${payload.trackId}` : payload?.jobKey ?? "曲目编辑同步";
  }

  return payload?.jobKey ?? "无附加信息";
}

export function getJobErrorSummary(errorJson: string | null | undefined) {
  if (!errorJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(errorJson) as { message?: string };
    return parsed.message?.trim() || errorJson;
  } catch {
    return errorJson;
  }
}

export function getTranscodeFailureMeta(errorJson: string | null | undefined): {
  category: TranscodeFailureCategory;
  label: string;
} | null {
  if (!errorJson) {
    return null;
  }

  const category = classifyTranscodeFailure(errorJson);
  return {
    category,
    label: getTranscodeFailureCategoryLabel(category),
  };
}
