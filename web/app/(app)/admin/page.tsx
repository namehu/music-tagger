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
import { getJobDisplayName, getJobErrorSummary } from "@/lib/jobs";
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
  const statsQuery = trpc.library.stats.useQuery();
  const cacheOverviewQuery = trpc.library.cacheOverview.useQuery();
  const jobsQuery = trpc.jobs.list.useQuery();
  const tracksQuery = trpc.tracks.list.useQuery({
    limit: 6,
    order: "recent",
  });

  const enqueueScanFull = trpc.jobs.enqueueScanFull.useMutation({
    onSuccess: async (result) => {
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
        tracksRefetch(),
      ]);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [cacheOverviewRefetch, hasActiveJobs, jobsRefetch, statsRefetch, tracksRefetch]);

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
    if (jobsQuery.error) {
      toast.error(jobsQuery.error.message ?? "任务信息加载失败");
    }
  }, [jobsQuery.error]);

  React.useEffect(() => {
    if (tracksQuery.error) {
      toast.error(tracksQuery.error.message ?? "曲目列表加载失败");
    }
  }, [tracksQuery.error]);

  const jobs = jobsQuery.data ?? [];
  const recentTracks = tracksQuery.data?.items ?? [];
  const latestScanJob = jobs.find((job) => job.type === "scan_full") ?? null;
  const latestScanStatus = statusBadge(latestScanJob?.status);
  const pendingJobs = jobs.filter((job) => job.status === "pending").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const failedTranscodes = jobs.filter(
    (job) => job.type === "transcode_prepare" && job.status === "failed",
  ).length;
  const cacheOverview = cacheOverviewQuery.data;

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
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              建议使用顺序：先触发扫描，再去音乐库确认结果；如果有卡住或失败，再进入 Jobs 看详细状态。
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CurrentPlaybackSummary />

        <Card>
          <CardHeader className="border-b">
            <CardTitle>缓存概览</CardTitle>
            <CardDescription>帮助你判断转码缓存是否在正常累积与命中。</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
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
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">失效规则</div>
              <div className="mt-2 text-sm font-medium">
                按 `trackId + profile + sourceMtimeMs` 命中，源文件更新时间变化后会自然失效并重建。
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
