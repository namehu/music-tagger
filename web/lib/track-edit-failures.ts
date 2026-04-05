import type { TrackEditDomain, TrackEditSyncStatus } from "@/lib/track-edits";

type TrackEditFailureKind =
  | "readonly_music_root"
  | "missing_mutagen"
  | "missing_source"
  | "missing_cover_asset"
  | "unsupported_format"
  | "permission_denied"
  | "unknown";

type TrackEditFailureDescriptor = {
  kind: TrackEditFailureKind;
  title: string;
  detail: string;
  recommendation: string;
  canRetry: boolean;
};

export type TrackEditLatestJob = {
  jobId: string;
  status: string;
  progress: number;
  attempts: number;
  maxAttempts: number;
  updatedAt: string | Date;
  errorSummary: string | null;
  errorJson: string | null;
} | null;

function parseErrorPayload(errorJson: string | null | undefined) {
  if (!errorJson) {
    return null;
  }

  try {
    return JSON.parse(errorJson) as { message?: string; type?: string };
  } catch {
    return {
      message: errorJson,
      type: undefined,
    };
  }
}

export function getTrackEditDomainLabel(domain: TrackEditDomain) {
  if (domain === "metadata") {
    return "元数据";
  }

  if (domain === "lyrics") {
    return "歌词";
  }

  return "封面";
}

export function classifyTrackEditFailure(errorJson: string | null | undefined): TrackEditFailureDescriptor {
  const parsed = parseErrorPayload(errorJson);
  const message = (parsed?.message ?? "").toLowerCase();
  const errorType = (parsed?.type ?? "").toLowerCase();

  if (message.includes("read-only file system") || message.includes("只读")) {
    return {
      kind: "readonly_music_root",
      title: "音乐目录当前是只读挂载",
      detail: "数据库里的编辑值已经保存，但 worker 没有权限把改动写回源文件。",
      recommendation: "把 worker 的 `/music` 挂载改成可写后，再手动重试同步。",
      canRetry: true,
    };
  }

  if (message.includes("缺少 mutagen") || errorType.includes("modulenotfound")) {
    return {
      kind: "missing_mutagen",
      title: "worker 运行环境缺少 mutagen",
      detail: "当前环境无法对音频标签做读写，所以文件同步没有真正开始。",
      recommendation: "重新安装 worker 依赖，或重建并重启 worker 容器后再重试。",
      canRetry: true,
    };
  }

  if (message.includes("源文件不存在")) {
    return {
      kind: "missing_source",
      title: "源文件已经不存在",
      detail: "数据库里还有这首歌的索引，但 worker 在音乐目录里找不到对应文件。",
      recommendation: "先确认文件路径，再执行一次 `scan_full` 更新曲库索引。",
      canRetry: false,
    };
  }

  if (message.includes("封面资产不存在")) {
    return {
      kind: "missing_cover_asset",
      title: "封面资产文件已经丢失",
      detail: "数据库记录还在，但应用资产目录中的封面文件不存在。",
      recommendation: "重新上传封面后再触发同步。",
      canRetry: false,
    };
  }

  if (message.includes("暂不支持") || message.includes("not support") || message.includes("easy api")) {
    return {
      kind: "unsupported_format",
      title: "当前格式暂不支持这类写回",
      detail: "这首歌仍可在数据库里显示最新编辑值，但暂时无法把该域安全写回源文件。",
      recommendation: "保留数据库编辑值，或换成支持的格式后再同步。",
      canRetry: false,
    };
  }

  if (message.includes("permission denied")) {
    return {
      kind: "permission_denied",
      title: "worker 没有写入权限",
      detail: "worker 可以看到源文件，但当前运行账户没有足够权限去改写它。",
      recommendation: "检查宿主机目录权限和容器运行身份后再重试。",
      canRetry: true,
    };
  }

  return {
    kind: "unknown",
    title: "后台同步失败",
    detail: "数据库里的最新编辑值已经保存，但这次写回源文件没有成功。",
    recommendation: "先到 Jobs 查看原始错误详情，定位后再决定是否重试。",
    canRetry: true,
  };
}

export function getTrackEditStatusCopy(input: {
  domain: TrackEditDomain;
  status: TrackEditSyncStatus;
  latestJob: TrackEditLatestJob;
  errorJson?: string | null;
}) {
  if (input.status === "failed") {
    return classifyTrackEditFailure(input.errorJson ?? input.latestJob?.errorJson ?? null);
  }

  if (input.status === "pending") {
    return {
      kind: "unknown" as const,
      title: `${getTrackEditDomainLabel(input.domain)}已保存，等待同步`,
      detail: "数据库中的最新编辑值已经生效，后台稍后会把它写回源文件。",
      recommendation: "暂时不需要额外操作，稍后刷新即可。",
      canRetry: false,
    };
  }

  if (input.status === "syncing") {
    return {
      kind: "unknown" as const,
      title: `后台正在同步${getTrackEditDomainLabel(input.domain)}`,
      detail: "这次编辑已经进入 worker 处理阶段，源文件正在写回中。",
      recommendation: "稍等片刻再刷新；如果长时间不变，再去 Jobs 排查。",
      canRetry: false,
    };
  }

  return {
    kind: "unknown" as const,
    title: `${getTrackEditDomainLabel(input.domain)}已同步完成`,
    detail: "数据库值和源文件标签已经对齐，当前不需要额外处理。",
    recommendation: "后续如需修改，直接继续编辑即可。",
    canRetry: false,
  };
}
