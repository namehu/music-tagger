"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
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

export default function AdminJobsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const utils = trpc.useUtils();

  const jobsQuery = trpc.jobs.list.useQuery();
  const { refetch } = jobsQuery;
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
    return { variant: "outline" as const, text: status ?? "-" };
  };

  const formatProgress = (progress: number | null | undefined) => {
    const p = typeof progress === "number" ? progress : 0;
    if (!Number.isFinite(p)) return "-";
    return `${Math.round(p * 100)}%`;
  };

  const formatDateTime = (value: string | Date | null | undefined) => {
    if (!value) return "-";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  };

  const prettyErrorJson = (raw: string) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  };

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

      <Card>
        <CardHeader className="border-b">
          <CardTitle>任务列表</CardTitle>
          <CardDescription>
            {jobsQuery.isLoading ? "加载中…" : `共 ${(jobsQuery.data ?? []).length} 条`}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>id</TableHead>
                <TableHead>type</TableHead>
                <TableHead>status</TableHead>
                <TableHead>progress</TableHead>
                <TableHead>attempts</TableHead>
                <TableHead>updatedAt</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {(jobsQuery.data ?? []).map((job) => {
                const badge = statusBadge(job.status);
                return (
                  <React.Fragment key={job.id}>
                    <TableRow>
                      <TableCell className="font-mono text-xs">{job.id}</TableCell>
                      <TableCell className="font-mono text-xs">{job.type}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                      </TableCell>
                      <TableCell>{formatProgress(job.progress)}</TableCell>
                      <TableCell>{job.attempts}</TableCell>
                      <TableCell>{formatDateTime(job.updatedAt)}</TableCell>
                    </TableRow>

                    {job.errorJson ? (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6} className="py-3">
                          <details>
                            <summary className="cursor-pointer text-sm font-medium">
                              查看 errorJson
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

              {!jobsQuery.isLoading && (jobsQuery.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
