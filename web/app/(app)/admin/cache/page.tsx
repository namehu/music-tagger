"use client";

import React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJobErrorSummary } from "@/lib/jobs";
import { cn } from "@/lib/utils";

type CacheIssueFilter = "attention" | "all" | "failed" | "stale" | "orphan";

const FILTER_OPTIONS: Array<{
  value: CacheIssueFilter;
  label: string;
  description: string;
}> = [
  { value: "attention", label: "仅异常项", description: "优先看 stale / orphan / failed" },
  { value: "failed", label: "失败转码", description: "worker 已失败退出的记录" },
  { value: "stale", label: "失效缓存", description: "源文件变化或缓存文件已丢失" },
  { value: "orphan", label: "孤儿记录", description: "记录存在但已找不到对应曲目" },
  { value: "all", label: "全部记录", description: "按更新时间查看最近缓存" },
];

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
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
  if (normalized === "ready") {
    return { variant: "secondary" as const, text: "ready" };
  }
  if (normalized === "pending") {
    return { variant: "outline" as const, text: "pending" };
  }
  return { variant: "outline" as const, text: status ?? "-" };
}

function issueBadges(entry: {
  isOrphan: boolean;
  isStale: boolean;
  isMissingReadyFile: boolean;
  status: string;
  failureLabel: string | null;
}) {
  const badges: Array<{ key: string; label: string; variant?: "destructive" | "outline" | "secondary" }> = [];

  if (entry.status === "failed") {
    badges.push({
      key: "failed",
      label: entry.failureLabel ? `失败: ${entry.failureLabel}` : "失败",
      variant: "destructive",
    });
  }
  if (entry.isStale) {
    badges.push({ key: "stale", label: "源文件已变化", variant: "outline" });
  }
  if (entry.isMissingReadyFile) {
    badges.push({ key: "missing", label: "缓存文件缺失", variant: "outline" });
  }
  if (entry.isOrphan) {
    badges.push({ key: "orphan", label: "孤儿记录", variant: "outline" });
  }

  if (badges.length === 0) {
    badges.push({ key: "healthy", label: "正常", variant: "secondary" });
  }

  return badges;
}

export default function AdminCachePage() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = React.useState<CacheIssueFilter>("attention");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const query = deferredSearch.trim();

  const cacheOverviewQuery = trpc.library.cacheOverview.useQuery();
  const cacheEntriesQuery = trpc.library.cacheEntries.useQuery({
    issue: filter,
    q: query.length > 0 ? query : undefined,
    limit: 100,
  });
  const maintainCache = trpc.library.maintainCache.useMutation({
    onSuccess: async (result) => {
      const actionLabel = result.mode === "failed" ? "失败缓存记录" : "失效缓存";
      toast.success(`已清理 ${result.removedEntries} 条${actionLabel}，删除 ${result.removedFiles} 个文件`);
      await Promise.all([
        utils.library.cacheOverview.invalidate(),
        utils.library.cacheEntries.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message ?? "缓存维护失败");
    },
  });

  React.useEffect(() => {
    if (cacheOverviewQuery.error) {
      toast.error(cacheOverviewQuery.error.message ?? "缓存概览加载失败");
    }
  }, [cacheOverviewQuery.error]);

  React.useEffect(() => {
    if (cacheEntriesQuery.error) {
      toast.error(cacheEntriesQuery.error.message ?? "缓存明细加载失败");
    }
  }, [cacheEntriesQuery.error]);

  const hasPendingEntries = (cacheEntriesQuery.data ?? []).some((entry) => entry.status === "pending");

  React.useEffect(() => {
    if (!hasPendingEntries) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all([
        cacheEntriesQuery.refetch(),
        cacheOverviewQuery.refetch(),
      ]);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [cacheEntriesQuery, cacheOverviewQuery, hasPendingEntries]);

  const cacheOverview = cacheOverviewQuery.data;
  const cacheEntries = cacheEntriesQuery.data ?? [];
  const cacheActionsDisabled = maintainCache.isPending;

  const summaryCards = [
    {
      title: "异常缓存",
      value: (cacheOverview?.staleEntries ?? 0) + (cacheOverview?.failedEntries ?? 0) + (cacheOverview?.orphanEntries ?? 0),
      description: "失效、失败、孤儿记录的总和",
    },
    {
      title: "已就绪缓存",
      value: cacheOverview?.readyEntries ?? 0,
      description: `${formatBytes(cacheOverview?.totalBytes)} 已可直接命中`,
    },
    {
      title: "待处理转码",
      value: cacheOverview?.pendingEntries ?? 0,
      description: "仍在 worker 中准备或排队",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">缓存明细</h1>
          <p className="text-sm text-muted-foreground">
            聚焦排查 stale / orphan / failed 缓存，并直接看到它们对应哪一首歌、哪条路径、为什么失效。
          </p>
        </div>

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
          <Link href="/admin/jobs" className={buttonVariants({ variant: "outline", size: "sm" })}>
            查看 Jobs
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="border-b">
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>筛选</CardTitle>
              <CardDescription>
                {cacheEntriesQuery.isLoading ? "加载中…" : `当前展示 ${cacheEntries.length} 条缓存记录`}
              </CardDescription>
            </div>

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="按标题、艺人、路径、档位或 cachePath 搜索"
              className="w-full lg:w-96"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filter === option.value ? "default" : "outline"}
                onClick={() => {
                  React.startTransition(() => {
                    setFilter(option.value);
                  });
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{FILTER_OPTIONS.find((option) => option.value === filter)?.description}</Badge>
            <Badge variant="outline">
              {cacheOverview?.hostCacheOverride ?? cacheOverview?.cacheRoot ?? "/cache"}
            </Badge>
            {query.length > 0 ? <Badge variant="secondary">搜索: {query}</Badge> : null}
            {deferredSearch !== search ? <span>搜索中…</span> : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>曲目</TableHead>
                <TableHead>问题</TableHead>
                <TableHead>档位 / 状态</TableHead>
                <TableHead>源文件</TableHead>
                <TableHead>缓存文件</TableHead>
                <TableHead>更新时间</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {cacheEntries.map((entry) => {
                const badge = statusBadge(entry.status);
                const title = renderText(entry.track?.title, entry.track?.filename ?? entry.trackId);
                const artist = renderText(entry.track?.artist, entry.isOrphan ? "曲目已不存在" : "未知艺人");
                const issueLabels = issueBadges(entry);

                return (
                  <React.Fragment key={entry.id}>
                    <TableRow className={cn(issueLabels.some((item) => item.key !== "healthy") && "bg-muted/20")}>
                      <TableCell className="min-w-56">
                        <div className="space-y-1">
                          <div className="font-medium">{title}</div>
                          <div className="text-sm text-muted-foreground">{artist}</div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            trackId: {entry.trackId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-52">
                        <div className="flex flex-wrap gap-2">
                          {issueLabels.map((item) => (
                            <Badge key={item.key} variant={item.variant ?? "outline"}>
                              {item.label}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-40">
                        <div className="space-y-1">
                          <div className="font-medium">{entry.profile}</div>
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(entry.fileSize)} · {entry.contentType}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <div className="truncate font-mono text-xs">{entry.track?.path ?? "-"}</div>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <div className="truncate font-mono text-xs">{entry.cachePath}</div>
                      </TableCell>
                      <TableCell>{formatDateTime(entry.updatedAt)}</TableCell>
                    </TableRow>

                    <TableRow className="bg-muted/10">
                      <TableCell colSpan={6} className="space-y-2 py-3">
                        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                          <div>专辑: {renderText(entry.track?.album)}</div>
                          <div>创建时间: {formatDateTime(entry.createdAt)}</div>
                          <div>源文件 mtime: {String(entry.sourceMtimeMs)}</div>
                          <div>记录 ID: <span className="font-mono">{entry.id}</span></div>
                        </div>
                        {entry.errorJson ? (
                          <details className="space-y-2">
                            <summary className="cursor-pointer text-sm font-medium text-foreground">
                              错误摘要：{getJobErrorSummary(entry.errorJson)}
                            </summary>
                            <pre className="max-h-64 overflow-auto rounded-lg border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap">
                              {entry.errorJson}
                            </pre>
                          </details>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}

              {!cacheEntriesQuery.isLoading && cacheEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    当前筛选下没有匹配的缓存记录。
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
