"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { CurrentPlaybackSummary } from "@/components/playback/current-playback-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  getJobDisplayName,
  getJobErrorSummary,
  getJobScopeText,
  getTranscodeFailureMeta,
} from "@/lib/jobs";
import { getTranscodeFailureCategoryLabel, TRANSCODE_FAILURE_CATEGORIES } from "@/lib/transcode-failure";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function formatProgress(progress: number | null | undefined) {
  const p = typeof progress === "number" ? progress : 0;
  if (!Number.isFinite(p)) return "-";
  return `${Math.round(p * 100)}%`;
}

function prettyErrorJson(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function AdminJobsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const utils = trpc.useUtils();

  const jobsQuery = trpc.jobs.list.useQuery();
  const { refetch } = jobsQuery;
  const retryJob = trpc.jobs.retry.useMutation({
    onSuccess: async () => {
      toast.success("任务已重新入队");
      await Promise.all([
        utils.jobs.list.invalidate(),
        utils.library.cacheOverview.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message ?? "重试失败");
    },
  });
  const retryFailedTranscodes = trpc.jobs.retryFailedTranscodes.useMutation({
    onSuccess: async (result) => {
      toast.success(result.retried > 0 ? `已批量重试 ${result.retried} 条转码任务` : "没有匹配的失败转码任务");
      await Promise.all([
        utils.jobs.list.invalidate(),
        utils.library.cacheOverview.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message ?? "批量重试失败");
    },
  });
  const enqueueScanFull = trpc.jobs.enqueueScanFull.useMutation({
    onSuccess: async (result) => {
      toast.success(result.deduped ? "已有进行中的 scan_full 任务" : "已入队");
      await utils.jobs.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "触发失败");
    },
  });

  const hasActiveJobs = (jobsQuery.data ?? []).some((job) =>
    job.status === "pending" || job.status === "running"
  );

  React.useEffect(() => {
    if (!hasActiveJobs) return;

    const timer = window.setInterval(() => {
      void refetch();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [hasActiveJobs, refetch]);

  const jobsErrorCode = jobsQuery.error?.data?.code;
  const shouldShowSignInHint =
    jobsErrorCode === "UNAUTHORIZED" || jobsErrorCode === "FORBIDDEN";
  const nextHref = `/sign-in?next=${encodeURIComponent(pathname || "/admin/jobs")}`;
  const statusBadge = (status: string | null | undefined) => {
    const s = (status ?? "").toLowerCase();
    if (s === "failed") return { variant: "destructive" as const, text: "failed" };
    if (s === "done") return { variant: "secondary" as const, text: "done" };
    if (s === "running") return { variant: "default" as const, text: "running" };
    if (s === "pending") return { variant: "outline" as const, text: "pending" };
    if (s === "cancelled") return { variant: "outline" as const, text: "cancelled" };
    return { variant: "outline" as const, text: status ?? "-" };
  };

  const jobs = jobsQuery.data ?? [];
  const pendingJobs = jobs.filter((job) => job.status === "pending").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const transcodeJobs = jobs.filter((job) => job.type === "transcode_prepare");
  const failedTranscodeJobs = transcodeJobs.filter((job) => job.status === "failed").length;
  const failedTranscodeByCategory = TRANSCODE_FAILURE_CATEGORIES.map((category) => {
    const count = transcodeJobs.filter((job) => {
      if (job.status !== "failed") {
        return false;
      }

      return getTranscodeFailureMeta(job.errorJson)?.category === category;
    }).length;

    return {
      category,
      label: getTranscodeFailureCategoryLabel(category),
      count,
    };
  }).filter((item) => item.count > 0);
  const jobsSnapshotAt = jobsQuery.dataUpdatedAt;
  const longPendingJobs = jobs.filter((job) => {
    if (job.status !== "pending") {
      return false;
    }

    const updatedAt = new Date(job.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) {
      return false;
    }

    return jobsSnapshotAt - updatedAt.getTime() > 15_000;
  }).length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            仅展示最近 50 条任务（按 createdAt 倒序）。
          </p>
        </div>

        <Button
          type="button"
          onClick={() => enqueueScanFull.mutate()}
          disabled={enqueueScanFull.isPending}
        >
          <RefreshCwIcon data-icon="inline-start" className={cn(enqueueScanFull.isPending && "animate-spin")} />
          {enqueueScanFull.isPending ? "入队中..." : "触发 scan_full"}
        </Button>
      </div>

      {jobsQuery.error ? (
        shouldShowSignInHint ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="border-b">
              <CardTitle>
                {jobsErrorCode === "FORBIDDEN"
                  ? "权限不足：请使用管理员账号登录"
                  : "需要登录后继续"}
              </CardTitle>
              <CardDescription>
                登录后将自动回到：<code className="font-mono">{pathname || "/admin/jobs"}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button type="button" onClick={() => router.push(nextHref)}>
                前往登录
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="border-b">
              <CardTitle>加载失败</CardTitle>
              <CardDescription>{jobsQuery.error.message ?? "未知错误"}</CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <CurrentPlaybackSummary compact />

        <Card>
          <CardHeader className="border-b">
            <CardTitle>队列摘要</CardTitle>
            <CardDescription>方便快速判断当前是扫描问题、转码问题，还是队列整体异常。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">队列状态</div>
              <div className="mt-2 text-sm font-medium">
                {pendingJobs} pending / {runningJobs} running / {failedJobs} failed
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">转码任务</div>
              <div className="mt-2 text-sm font-medium">
                最近 {transcodeJobs.length} 条中有 {failedTranscodeJobs} 条失败
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4 md:col-span-2">
              <div className="text-sm text-muted-foreground">排障提醒</div>
              <div className="mt-2 text-sm font-medium">
                {longPendingJobs > 0
                  ? `${longPendingJobs} 条任务 pending 超过 15 秒，建议检查 worker 日志与数据库连接`
                  : "当前没有明显卡住的 pending 任务"}
              </div>
            </div>
            {failedTranscodeByCategory.length > 0 ? (
              <div className="rounded-xl border bg-muted/20 p-4 md:col-span-2">
                <div className="text-sm text-muted-foreground">失败分类</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {failedTranscodeByCategory.map((item) => (
                    <Badge key={item.category} variant="outline">
                      {item.label} · {item.count}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {failedTranscodeByCategory.map((item) => (
                    <Button
                      key={`${item.category}-retry`}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={retryFailedTranscodes.isPending}
                      onClick={() =>
                        retryFailedTranscodes.mutate({ categories: [item.category], limit: 100 })
                      }
                    >
                      重试{item.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={retryFailedTranscodes.isPending}
                    onClick={() => retryFailedTranscodes.mutate({ categories: [], limit: 100 })}
                  >
                    批量重试全部失败转码
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>任务列表</CardTitle>
          <CardDescription>{jobsQuery.isLoading ? "加载中…" : `共 ${jobs.length} 条`}</CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务</TableHead>
                <TableHead>范围</TableHead>
                <TableHead>status</TableHead>
                <TableHead>progress</TableHead>
                <TableHead>attempts</TableHead>
                <TableHead>updatedAt</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {jobs.map((job) => {
                const badge = statusBadge(job.status);
                const canRetry = job.status === "failed" || job.status === "cancelled";
                const failureMeta =
                  job.type === "transcode_prepare" && job.status === "failed"
                    ? getTranscodeFailureMeta(job.errorJson)
                    : null;
                return (
                  <React.Fragment key={job.id}>
                    <TableRow>
                      <TableCell className="min-w-52">
                        <div className="space-y-1">
                          <div className="font-medium">{getJobDisplayName(job.type, job.payloadJson)}</div>
                          <div className="truncate font-mono text-xs text-muted-foreground">{job.id}</div>
                          {failureMeta ? <Badge variant="outline">{failureMeta.label}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-80">
                        <div className="truncate text-sm text-muted-foreground">
                          {getJobScopeText(job.type, job.payloadJson)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                      </TableCell>
                      <TableCell>{formatProgress(job.progress)}</TableCell>
                      <TableCell>
                        {job.attempts}/{job.maxAttempts}
                      </TableCell>
                      <TableCell>{formatDateTime(job.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        {canRetry ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={retryJob.isPending}
                            onClick={() => retryJob.mutate({ jobId: job.id })}
                          >
                            重试
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {job.errorJson ? (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={7} className="py-3">
                          <details className="space-y-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              错误摘要：{getJobErrorSummary(job.errorJson)}
                            </summary>
                            <pre className="mt-2 max-h-80 overflow-auto rounded-lg border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap">
                              {prettyErrorJson(job.errorJson)}
                            </pre>
                          </details>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })}

              {!jobsQuery.isLoading && jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    暂无任务
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
