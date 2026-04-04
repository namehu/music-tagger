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
};

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
