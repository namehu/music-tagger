"use client";

import React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  AudioLinesIcon,
  Clock3Icon,
  FolderSearch2Icon,
  LibraryBigIcon,
  RefreshCwIcon,
} from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { CurrentPlaybackSummary } from "@/components/playback/current-playback-summary";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatScanFullProgressSummary,
  getJobDisplayName,
  getJobErrorSummary,
  type JobProgressEvent,
} from "@/lib/jobs";
import { useJobEventSource } from "@/lib/use-job-events";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatProgress(progress: number | null | undefined) {
  const value = typeof progress === "number" ? progress : 0;
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatBytes(bytes: number | null | undefined) {
  const value = typeof bytes === "number" ? bytes : 0;
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDuration(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "-";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  return `${(seconds / 60).toFixed(1)} min`;
}

function renderText(value: string | null | undefined, fallback = "-") {
  return value && value.trim().length > 0 ? value : fallback;
}

function statusBadge(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "failed") {
    return { variant: "destructive" as const, text: "failed" };
  }
  if (normalized === "done") {
    return { variant: "secondary" as const, text: "done" };
  }
  if (normalized === "running") {
    return { variant: "default" as const, text: "running" };
  }
  if (normalized === "pending") {
    return { variant: "outline" as const, text: "pending" };
  }
  return { variant: "outline" as const, text: status ?? "-" };
}

function OverviewStatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const utils = trpc.useUtils();
  const [activeScanJobId, setActiveScanJobId] = React.useState<string | null>(null);
  const [scanEventJob, setScanEventJob] = React.useState<JobProgressEvent | null>(null);
  const statsQuery = trpc.library.stats.useQuery({ surface: "admin" });
  const cacheOverviewQuery = trpc.library.cacheOverview.useQuery();
  const settingsQuery = trpc.settings.get.useQuery();
  const transcodeMetricsQuery = trpc.library.transcodeMetrics.useQuery();
  const jobsQuery = trpc.jobs.list.useQuery();
  const tracksQuery = trpc.tracks.list.useQuery({
    limit: 6,
    order: "recent",
    surface: "admin",
  });
  const maintainCache = trpc.library.maintainCache.useMutation({
    onSuccess: async (result) => {
      const actionLabel = result.mode === "failed" ? "失败缓存记录" : "失效缓存";
      toast.success(`已清理 ${result.removedEntries} 条${actionLabel}，删除 ${result.removedFiles} 个文件`);
      await Promise.all([
        utils.library.cacheOverview.invalidate(),
        utils.jobs.list.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message ?? "缓存维护失败");
    },
  });

  const enqueueScanFull = trpc.jobs.enqueueScanFull.useMutation({
    onSuccess: async (result) => {
      setActiveScanJobId(result.jobId);
      setScanEventJob(null);
      toast.success(result.deduped ? "已有进行中的 scan_full 任务" : "已入队");
      await Promise.all([
        utils.jobs.list.invalidate(),
        utils.library.stats.invalidate(),
        utils.library.cacheOverview.invalidate(),
        utils.tracks.list.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message ?? "触发失败");
    },
  });

  const hasActiveJobs = (jobsQuery.data ?? []).some(
    (job) => job.status === "pending" || job.status === "running",
  );
  const jobsRefetch = jobsQuery.refetch;
  const statsRefetch = statsQuery.refetch;
  const cacheOverviewRefetch = cacheOverviewQuery.refetch;
  const settingsRefetch = settingsQuery.refetch;
  const transcodeMetricsRefetch = transcodeMetricsQuery.refetch;
  const tracksRefetch = tracksQuery.refetch;

  React.useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all([
        jobsRefetch(),
        statsRefetch(),
        cacheOverviewRefetch(),
        settingsRefetch(),
        transcodeMetricsRefetch(),
        tracksRefetch(),
      ]);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [cacheOverviewRefetch, hasActiveJobs, jobsRefetch, settingsRefetch, statsRefetch, tracksRefetch, transcodeMetricsRefetch]);

  React.useEffect(() => {
    if (statsQuery.error) {
      toast.error(statsQuery.error.message ?? "统计信息加载失败");
    }
  }, [statsQuery.error]);

  React.useEffect(() => {
    if (cacheOverviewQuery.error) {
      toast.error(cacheOverviewQuery.error.message ?? "缓存概览加载失败");
    }
  }, [cacheOverviewQuery.error]);

  React.useEffect(() => {
    if (settingsQuery.error) {
      toast.error(settingsQuery.error.message ?? "策略配置加载失败");
    }
  }, [settingsQuery.error]);

  React.useEffect(() => {
    if (jobsQuery.error) {
      toast.error(jobsQuery.error.message ?? "任务信息加载失败");
    }
  }, [jobsQuery.error]);

  React.useEffect(() => {
    if (transcodeMetricsQuery.error) {
      toast.error(transcodeMetricsQuery.error.message ?? "转码观测加载失败");
    }
  }, [transcodeMetricsQuery.error]);

  React.useEffect(() => {
    if (tracksQuery.error) {
      toast.error(tracksQuery.error.message ?? "曲目列表加载失败");
    }
  }, [tracksQuery.error]);

  const jobs = jobsQuery.data ?? [];
  const recentTracks = tracksQuery.data?.items ?? [];
  const activeQueriedScanJob =
    jobs.find((job) => job.type === "scan_full" && (job.status === "pending" || job.status === "running")) ?? null;
  const latestQueriedScanJob = jobs.find((job) => job.type === "scan_full") ?? null;
  const scanEventJobId = activeQueriedScanJob?.id ?? activeScanJobId ?? null;
  const latestScanJob = scanEventJob?.id === scanEventJobId ? scanEventJob : latestQueriedScanJob;
  const latestScanProgress = latestScanJob ? formatScanFullProgressSummary(latestScanJob.progressJson) : null;
  const latestScanStatus = statusBadge(latestScanJob?.status);
  const pendingJobs = jobs.filter((job) => job.status === "pending").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const failedTranscodes = jobs.filter(
    (job) => job.type === "transcode_prepare" && job.status === "failed",
  ).length;
  const cacheOverview = cacheOverviewQuery.data;
  const transcodePolicy = settingsQuery.data?.transcodePolicy;
  const transcodeMetrics = transcodeMetricsQuery.data;
  const cacheActionsDisabled = maintainCache.isPending;

  const handleScanJobEvent = React.useCallback(
    (job: JobProgressEvent) => {
      setScanEventJob(job);
      if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
        void Promise.all([
          utils.jobs.list.invalidate(),
          utils.library.stats.invalidate(),
          utils.library.cacheOverview.invalidate(),
          utils.tracks.list.invalidate(),
        ]);
      }
    },
    [utils.jobs.list, utils.library.cacheOverview, utils.library.stats, utils.tracks.list],
  );

  useJobEventSource({
    enabled:
      Boolean(scanEventJobId) &&
      scanEventJob?.status !== "done" &&
      scanEventJob?.status !== "failed" &&
      scanEventJob?.status !== "cancelled",
    jobId: scanEventJobId,
    onJob: handleScanJobEvent,
  });

  const overviewCards = [
    {
      title: "曲目总数",
      value: statsQuery.data?.tracks ?? 0,
      description: "当前已建立索引的曲目数量",
      icon: AudioLinesIcon,
    },
    {
      title: "专辑数",
      value: statsQuery.data?.albums ?? 0,
      description: "按专辑 / 专辑艺人聚合后的统计",
      icon: LibraryBigIcon,
    },
    {
      title: "艺人数",
      value: statsQuery.data?.artists ?? 0,
      description: "当前曲库中可识别的艺人数量",
      icon: FolderSearch2Icon,
    },
    {
      title: "任务队列",
      value: runningJobs > 0 ? `${runningJobs} 运行中` : `${pendingJobs} 待处理`,
      description: failedJobs > 0 ? `${failedJobs} 个失败任务待关注` : "最近任务状态总体正常",
      icon: Clock3Icon,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={hasActiveJobs ? "default" : "secondary"}>
              {hasActiveJobs ? "扫描进行中" : "系统空闲"}
            </Badge>
            {failedJobs > 0 ? <Badge variant="destructive">{failedJobs} 个失败任务</Badge> : null}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              这里展示曲库规模、扫描状态、最近任务和最近入库曲目，方便你快速判断系统是否健康。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => enqueueScanFull.mutate()}
            disabled={enqueueScanFull.isPending}
          >
            <RefreshCwIcon data-icon="inline-start" className={cn(enqueueScanFull.isPending && "animate-spin")} />
            {enqueueScanFull.isPending ? "入队中..." : "触发 scan_full"}
          </Button>

          <Link href="/admin/library" className={buttonVariants({ variant: "outline" })}>
            前往音乐库
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <OverviewStatCard
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
            icon={card.icon}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle>最近扫描</CardTitle>
              <CardDescription>优先展示最近一次 `scan_full` 的状态，便于快速判断扫描链路是否正常。</CardDescription>
            </div>
            <CardAction>
              <Link href="/admin/jobs" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Jobs
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </CardAction>
          </CardHeader>

          <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">任务状态</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={latestScanStatus.variant}>{latestScanStatus.text}</Badge>
                <span className="text-sm text-muted-foreground">
                  {latestScanJob ? `进度 ${formatProgress(latestScanJob.progress)}` : "尚未触发扫描"}
                </span>
              </div>
              {latestScanProgress ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="font-medium">{latestScanProgress.headline}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {latestScanProgress.details.map((detail) => (
                      <span key={detail}>{detail}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">最近更新时间</div>
              <div className="mt-2 text-sm font-medium">
                {formatDateTime(latestScanJob?.updatedAt)}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">当前队列</div>
              <div className="mt-2 text-sm font-medium">
                {pendingJobs} pending / {runningJobs} running
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">异常提醒</div>
              <div className="mt-2 text-sm font-medium">
                {failedJobs > 0 ? `${failedJobs} 个任务失败，建议进入 Jobs 查看 errorJson` : "当前没有失败任务"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>快捷入口</CardTitle>
            <CardDescription>常用排查与管理动作直接从这里进入。</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 pt-4">
            <Link href="/admin/library" className={buttonVariants({ variant: "default" })}>
              打开音乐库
            </Link>
            <Link href="/admin/jobs" className={buttonVariants({ variant: "outline" })}>
              查看任务队列
            </Link>
            <Link href="/admin/cache" className={buttonVariants({ variant: "outline" })}>
              查看缓存明细
            </Link>
            <Link href="/admin/settings" className={buttonVariants({ variant: "outline" })}>
              调整缓存策略
            </Link>
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              建议使用顺序：先触发扫描，再去音乐库确认结果；如果有卡住或失败，再进入 Jobs 看详细状态。
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CurrentPlaybackSummary sessionKind="admin" />

        <Card>
          <CardHeader className="border-b">
            <CardTitle>缓存概览</CardTitle>
            <CardDescription>帮助你判断转码缓存是否在正常累积与命中。</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cacheActionsDisabled}
                onClick={() => maintainCache.mutate({ mode: "stale" })}
              >
                清理失效缓存
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cacheActionsDisabled}
                onClick={() => maintainCache.mutate({ mode: "failed" })}
              >
                清理失败记录
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">缓存目录</div>
              <div className="mt-2 font-mono text-sm">
                {cacheOverview?.hostCacheOverride ?? cacheOverview?.cacheRoot ?? "/cache"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Web 容器内路径固定为 `/cache`，开发环境可映射到宿主机目录。
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">已就绪缓存</div>
              <div className="mt-2 text-sm font-medium">
                {cacheOverview?.readyEntries ?? 0} 个文件 / {formatBytes(cacheOverview?.totalBytes)}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">缓存健康</div>
              <div className="mt-2 text-sm font-medium">
                {cacheOverview?.pendingEntries ?? 0} pending / {cacheOverview?.failedEntries ?? 0} failed
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {cacheOverview?.staleEntries ?? 0} stale / {cacheOverview?.orphanEntries ?? 0} orphan
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">失效规则</div>
              <div className="mt-2 text-sm font-medium">
                按 `trackId + profile + sourceMtimeMs` 命中，源文件更新时间变化后会自然失效并重建。
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">当前缓存策略</div>
              <div className="mt-2 text-sm font-medium">
                冷缓存 {transcodePolicy?.coldCacheDays ?? 30} 天 / 预算 {formatBytes(transcodePolicy?.budgetBytes)} / 单次上限 {transcodePolicy?.pruneLimit ?? 200} 条
              </div>
              <div className="mt-3">
                <Link href="/admin/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  调整策略
                </Link>
              </div>
            </div>
            </div>

            {cacheOverview?.failedByCategory?.length ? (
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-sm text-muted-foreground">失败分类</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cacheOverview.failedByCategory.map((item) => (
                    <Badge key={item.category} variant="outline">
                      {item.label} · {item.count}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3">
                  <Link href="/admin/cache" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    打开缓存明细
                  </Link>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>转码观测</CardTitle>
          <CardDescription>
            基于最近 {transcodeMetrics?.playbackWindowHours ?? 24} 小时播放解析与最近{" "}
            {transcodeMetrics?.transcodeWindowDays ?? 7} 天转码任务，帮助判断缓存是否真正命中、是否经常被取消或失败。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">缓存命中率</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatPercent(transcodeMetrics?.playback.hitRate)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {transcodeMetrics?.playback.cacheHits ?? 0} hit / {transcodeMetrics?.playback.cacheMisses ?? 0} miss
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">平均转码耗时</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatDuration(transcodeMetrics?.transcodes.averageDurationMs)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                最近完成 {transcodeMetrics?.transcodes.completedCount ?? 0} 条
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">P95 转码耗时</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatDuration(transcodeMetrics?.transcodes.p95DurationMs)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">用于观察慢任务尾部</div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">最近 7 天状态</div>
              <div className="mt-2 text-sm font-medium">
                {transcodeMetrics?.transcodes.completedCount ?? 0} done / {transcodeMetrics?.transcodes.failedCount ?? 0} failed / {transcodeMetrics?.transcodes.cancelledCount ?? 0} cancelled
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">最近 7 天状态趋势</div>
              <div className="mt-3 grid gap-2">
                {(transcodeMetrics?.trend ?? []).map((item) => (
                  <div key={item.date} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{item.date}</span>
                    <span>{item.done} done</span>
                    <span>{item.failed} failed</span>
                    <span>{item.cancelled} cancelled</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-sm text-muted-foreground">失败原因</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(transcodeMetrics?.failedReasons ?? []).length > 0 ? (
                    (transcodeMetrics?.failedReasons ?? []).map((item) => (
                      <Badge key={`failed-${item.category}`} variant="outline">
                        {item.label} · {item.count}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">最近 7 天没有失败转码</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-sm text-muted-foreground">取消原因</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(transcodeMetrics?.cancelledReasons ?? []).length > 0 ? (
                    (transcodeMetrics?.cancelledReasons ?? []).map((item) => (
                      <Badge key={`cancelled-${item.category}`} variant="outline">
                        {item.label} · {item.count}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">最近 7 天没有取消转码</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>最近入库曲目</CardTitle>
            <CardDescription>按最近更新时间展示，适合在扫描后快速 spot check。</CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>艺人</TableHead>
                  <TableHead>专辑</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTracks.map((track) => (
                  <TableRow key={track.id}>
                    <TableCell>{renderText(track.title, track.filename)}</TableCell>
                    <TableCell>{renderText(track.artist)}</TableCell>
                    <TableCell>{renderText(track.album)}</TableCell>
                    <TableCell>{formatDateTime(track.updatedAt)}</TableCell>
                  </TableRow>
                ))}

                {!tracksQuery.isLoading && recentTracks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      暂无曲目，请先执行一次 scan_full。
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>最近任务</CardTitle>
            <CardDescription>展示最近几条任务，快速定位是否存在卡住或失败。</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 pt-4">
            {jobs.slice(0, 5).map((job) => {
              const badge = statusBadge(job.status);
              const scanProgress = job.type === "scan_full" ? formatScanFullProgressSummary(job.progressJson) : null;
              return (
                <div key={job.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="font-medium">{getJobDisplayName(job.type, job.payloadJson)}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{job.id}</div>
                    </div>
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                  </div>
                  {job.errorJson ? (
                    <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {getJobErrorSummary(job.errorJson)}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>进度 {formatProgress(job.progress)}</span>
                    <span>{formatDateTime(job.updatedAt)}</span>
                  </div>
                  {scanProgress ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="font-medium">{scanProgress.headline}</div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {scanProgress.details.map((detail) => (
                          <span key={detail}>{detail}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!jobsQuery.isLoading && jobs.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                暂无任务记录。
              </div>
            ) : null}

            {failedTranscodes > 0 ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                当前有 {failedTranscodes} 条转码任务失败，建议前往 Jobs 页查看错误详情并执行重试。
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
