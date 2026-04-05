"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlanStatusLabel, getPlanTypeLabel, type PlanItemStatus } from "@/lib/plans";

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusBadge(status: string) {
  if (status === "failed") return { variant: "destructive" as const, text: getPlanStatusLabel(status) };
  if (status === "done") return { variant: "secondary" as const, text: getPlanStatusLabel(status) };
  if (status === "running") return { variant: "default" as const, text: getPlanStatusLabel(status) };
  return { variant: "outline" as const, text: getPlanStatusLabel(status) };
}

function itemStatusBadge(status: string) {
  if (status === "failed") return { variant: "destructive" as const, text: status };
  if (status === "done") return { variant: "secondary" as const, text: status };
  if (status === "running") return { variant: "default" as const, text: status };
  return { variant: "outline" as const, text: status };
}

function summarizeItemStatuses(statuses: PlanItemStatus[]) {
  return statuses.reduce(
    (acc, status) => {
      acc[status] += 1;
      return acc;
    },
    {
      pending: 0,
      running: 0,
      done: 0,
      failed: 0,
      skipped: 0,
    } satisfies Record<PlanItemStatus, number>,
  );
}

export default function AdminPlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const planId = typeof params?.planId === "string" ? params.planId : "";
  const [itemStatus, setItemStatus] = React.useState<"all" | PlanItemStatus>("all");

  const planQuery = trpc.plans.get.useQuery(
    { planId },
    {
      enabled: planId.length > 0,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "running" ? 2000 : false;
      },
    },
  );
  const itemsQuery = trpc.plans.items.useQuery(
    { planId, status: itemStatus },
    {
      enabled: planId.length > 0,
      refetchInterval: () => (planQuery.data?.status === "running" ? 2000 : false),
    },
  );

  React.useEffect(() => {
    if (planQuery.error) {
      toast.error(planQuery.error.message ?? "执行记录详情加载失败");
    }
  }, [planQuery.error]);

  React.useEffect(() => {
    if (itemsQuery.error) {
      toast.error(itemsQuery.error.message ?? "执行项加载失败");
    }
  }, [itemsQuery.error]);

  const plan = planQuery.data;
  const items = itemsQuery.data ?? [];
  const badge = statusBadge(plan?.status ?? "draft");
  const counts = summarizeItemStatuses(items.map((item) => item.status as PlanItemStatus));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{plan?.id ?? "执行记录详情"}</h1>
          <Badge variant={badge.variant}>{badge.text}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {plan ? `${getPlanTypeLabel(plan.type)} · ${plan.scopeSummary}` : "加载中…"}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>摘要</CardTitle>
            <CardDescription>这里回看这条文件整理记录当时的参数、范围和执行状态。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">类型</div>
              <div className="mt-2 text-sm font-medium">{plan ? getPlanTypeLabel(plan.type) : "-"}</div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">范围</div>
              <div className="mt-2 text-sm font-medium">{plan?.scopeSummary ?? "-"}</div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">参数</div>
              <div className="mt-2 break-all text-sm font-medium">
                {plan?.type === "rename"
                  ? (plan.params as { template?: string } | null)?.template ?? "-"
                  : plan?.type === "move"
                    ? (plan.params as { targetDirTemplate?: string } | null)?.targetDirTemplate ?? "-"
                    : "字段写回记录"}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">创建人</div>
              <div className="mt-2 text-sm font-medium">{plan?.createdBy.name ?? plan?.createdBy.email ?? "-"}</div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">时间</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>preview: {formatDateTime(plan?.previewedAt)}</div>
                <div>queued: {formatDateTime(plan?.confirmedAt)}</div>
                <div>updated: {formatDateTime(plan?.updatedAt)}</div>
                <div>completed: {formatDateTime(plan?.completedAt)}</div>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm text-muted-foreground">执行任务</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>{plan?.executionJob?.id ?? "-"}</div>
                <div className="text-muted-foreground">{plan?.executionJob?.status ?? "未创建"}</div>
                <Link href="/admin/jobs" className="text-primary underline underline-offset-4">
                  打开 Jobs
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>预览与结果</CardTitle>
            <CardDescription>这里展示当时的预览摘要、全局警告和执行结果计数。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-sm text-muted-foreground">源曲目</div>
                <div className="mt-2 text-xl font-semibold">{plan?.previewSummary.sourceTrackCount ?? 0}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-sm text-muted-foreground">执行项</div>
                <div className="mt-2 text-xl font-semibold">{plan?.previewSummary.itemCount ?? 0}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-sm text-muted-foreground">警告 / 阻断</div>
                <div className="mt-2 text-xl font-semibold">
                  {plan?.previewSummary.warningCount ?? 0} / {plan?.previewSummary.blockingCount ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
              <div className="font-medium">执行项状态</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">pending {counts.pending}</Badge>
                <Badge variant="outline">running {counts.running}</Badge>
                <Badge variant="outline">done {counts.done}</Badge>
                <Badge variant={counts.failed > 0 ? "destructive" : "outline"}>failed {counts.failed}</Badge>
                <Badge variant="outline">skipped {counts.skipped}</Badge>
              </div>
            </div>

            {plan?.warnings?.length ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">全局警告</div>
                <div className="flex flex-col gap-2">
                  {plan.warnings.map((warning: { code: string; message: string }) => (
                    <div
                      key={`${warning.code}-${warning.message}`}
                      className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm"
                    >
                      {warning.message}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                当前没有全局警告。
              </div>
            )}

            {plan?.errorMessage ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
                {plan.errorMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>执行项</CardTitle>
              <CardDescription>
                {itemsQuery.isLoading ? "加载中…" : `当前展示 ${items.length} 条执行项`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={itemStatus}
                onChange={(event) => setItemStatus(event.target.value as "all" | PlanItemStatus)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="pending">pending</option>
                <option value="running">running</option>
                <option value="done">done</option>
                <option value="failed">failed</option>
                <option value="skipped">skipped</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>曲目</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>变更</TableHead>
                <TableHead>警告</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const itemBadge = itemStatusBadge(item.status);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.trackLabel}</div>
                        <div className="text-xs text-muted-foreground">{item.artistLabel}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanTypeLabel(item.kind)}</TableCell>
                    <TableCell className="max-w-[28rem] text-xs">
                      <div className="space-y-1 font-mono">
                        {item.toPath ? (
                          <>
                            <div className="truncate text-muted-foreground">{item.fromPath}</div>
                            <div className="truncate">{item.toPath}</div>
                          </>
                        ) : item.tagDiff.length > 0 ? (
                          item.tagDiff.map((entry) => (
                            <div key={`${item.id}-${entry.field}`} className="truncate">
                              {entry.field}: {String(entry.from ?? "空")} → {String(entry.to ?? "空")}
                            </div>
                          ))
                        ) : (
                          <div className="truncate text-muted-foreground">{item.fromPath}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.warnings.length > 0 ? item.warnings.map((warning) => warning.message).join("；") : "-"}
                      {item.errorMessage ? (
                        <div className="mt-1 text-destructive">{item.errorMessage}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={itemBadge.variant}>{itemBadge.text}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}

              {!itemsQuery.isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    当前筛选条件下没有执行项。
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
