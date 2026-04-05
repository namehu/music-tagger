"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import {
  getPlanActionState,
  getPlanExecutionCounts,
  getPlanExecutionHint,
  getPlanStatusLabel,
  getPlanTypeLabel,
  type PlanItemStatus,
  type PlanStatus,
} from "@/lib/plans";
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

export default function AdminPlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const planId = typeof params?.planId === "string" ? params.planId : "";
  const utils = trpc.useUtils();
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
    {
      planId,
      status: itemStatus,
    },
    {
      enabled: planId.length > 0,
      refetchInterval: () => (planQuery.data?.status === "running" ? 2000 : false),
    },
  );

  const previewPlan = trpc.plans.preview.useMutation({
    onSuccess: async () => {
      toast.success("预览已生成");
      await Promise.all([utils.plans.get.invalidate({ planId }), utils.plans.items.invalidate({ planId, status: itemStatus })]);
    },
    onError: (error) => {
      toast.error(error.message ?? "预览失败");
    },
  });

  const confirmPlan = trpc.plans.confirm.useMutation({
    onSuccess: async () => {
      toast.success("Plan 已确认");
      await utils.plans.get.invalidate({ planId });
    },
    onError: (error) => {
      toast.error(error.message ?? "确认失败");
    },
  });

  const executePlan = trpc.plans.execute.useMutation({
    onSuccess: async (result) => {
      toast.success(result.deduped ? "已有进行中的执行任务" : "Plan 已提交执行");
      await Promise.all([utils.plans.get.invalidate({ planId }), utils.plans.items.invalidate({ planId, status: itemStatus }), utils.jobs.list.invalidate()]);
    },
    onError: (error) => {
      toast.error(error.message ?? "执行失败");
    },
  });

  React.useEffect(() => {
    if (planQuery.error) {
      toast.error(planQuery.error.message ?? "Plan 详情加载失败");
    }
  }, [planQuery.error]);

  React.useEffect(() => {
    if (itemsQuery.error) {
      toast.error(itemsQuery.error.message ?? "Plan 项加载失败");
    }
  }, [itemsQuery.error]);

  const plan = planQuery.data;
  const items = itemsQuery.data ?? [];
  const planBadge = statusBadge(plan?.status ?? "draft");
  const executionCounts = getPlanExecutionCounts(items.map((item) => item.status as PlanItemStatus));
  const currentPlanStatus = (plan?.status ?? "draft") as PlanStatus;
  const actionState = getPlanActionState({
    status: currentPlanStatus,
    previewedAt: plan?.previewedAt ?? null,
    previewSummary:
      plan?.previewSummary ?? {
        sourceTrackCount: 0,
        itemCount: 0,
        warningCount: 0,
        blockingCount: 0,
      },
    executionJobStatus: plan?.executionJob?.status ?? null,
  });
  const executionHint = getPlanExecutionHint({
    status: currentPlanStatus,
    previewSummary:
      plan?.previewSummary ?? {
        sourceTrackCount: 0,
        itemCount: 0,
        warningCount: 0,
        blockingCount: 0,
      },
    executionJobStatus: plan?.executionJob?.status ?? null,
    actionState,
    counts: executionCounts,
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{plan?.id ?? "Plan 详情"}</h1>
            <Badge variant={planBadge.variant}>{planBadge.text}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {plan ? `${getPlanTypeLabel(plan.type)} · ${plan.scopeSummary}` : "加载中…"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => previewPlan.mutate({ planId })}
            disabled={!planId || previewPlan.isPending || !actionState.canPreview}
          >
            {previewPlan.isPending ? "生成中…" : plan?.previewedAt ? "刷新预览" : "生成预览"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => confirmPlan.mutate({ planId })}
            disabled={!planId || confirmPlan.isPending || !actionState.canConfirm}
          >
            {confirmPlan.isPending ? "确认中…" : "确认 Plan"}
          </Button>
          <Button
            type="button"
            onClick={() => executePlan.mutate({ planId })}
            disabled={!planId || executePlan.isPending || !actionState.canExecute}
          >
            {executePlan.isPending ? "提交中…" : "执行 Plan"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>摘要</CardTitle>
            <CardDescription>作用范围、模板参数和当前执行状态。</CardDescription>
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
                <div className="text-sm text-muted-foreground">模板</div>
                <div className="mt-2 break-all text-sm font-medium">
                  {plan?.type === "rename"
                    ? (plan.params as { template?: string } | null)?.template ?? "-"
                    : "字段写回计划"}
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
                <div>confirmed: {formatDateTime(plan?.confirmedAt)}</div>
                <div>updated: {formatDateTime(plan?.updatedAt)}</div>
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
            <CardTitle>预览与风险</CardTitle>
            <CardDescription>只有没有阻断性警告的 preview 才能确认执行。</CardDescription>
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
              <div className="font-medium">当前动作提示</div>
              <div className="mt-1 text-muted-foreground">{executionHint}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">pending {executionCounts.pending}</Badge>
                <Badge variant="outline">running {executionCounts.running}</Badge>
                <Badge variant="outline">done {executionCounts.done}</Badge>
                <Badge variant={executionCounts.failed > 0 ? "destructive" : "outline"}>
                  failed {executionCounts.failed}
                </Badge>
                <Badge variant="outline">skipped {executionCounts.skipped}</Badge>
              </div>
            </div>

            {plan?.warnings?.length ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">全局警告</div>
                <div className="flex flex-col gap-2">
                  {plan.warnings.map((warning) => (
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

            {!actionState.canConfirm && actionState.confirmReason ? (
              <div className="rounded-lg border border-muted-foreground/20 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                确认条件：{actionState.confirmReason}
              </div>
            ) : null}

            {!actionState.canExecute && actionState.executeReason ? (
              <div className="rounded-lg border border-muted-foreground/20 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                执行条件：{actionState.executeReason}
              </div>
            ) : null}

            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              回滚策略：当前实现为尽力回滚，不承诺强一致。
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>计划项</CardTitle>
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
              <Button type="button" variant="outline" onClick={() => void itemsQuery.refetch()}>
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>曲目</TableHead>
                <TableHead>路径 diff</TableHead>
                <TableHead>标签 diff</TableHead>
                <TableHead>警告</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>错误</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无计划项
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const badge = itemStatusBadge(item.status);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.trackLabel}</div>
                        <div className="text-xs text-muted-foreground">{item.artistLabel}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="break-all text-muted-foreground">{item.fromPath ?? "-"}</div>
                        <div className="mt-1 break-all font-medium">{item.toPath ?? "-"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.tagDiff.length === 0 ? (
                          <span className="text-muted-foreground">无</span>
                        ) : (
                          <div className="space-y-1">
                            {item.tagDiff.map((entry) => (
                              <div key={`${item.id}-${entry.field}`}>
                                <span className="font-medium">{entry.field}</span>: {String(entry.from ?? "-")} →{" "}
                                {String(entry.to ?? "-")}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.warnings.length === 0 ? (
                          <span className="text-muted-foreground">无</span>
                        ) : (
                          <div className="space-y-1">
                            {item.warnings.map((warning) => (
                              <div key={`${item.id}-${warning.code}-${warning.message}`}>{warning.message}</div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive">
                        {item.errorMessage ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
