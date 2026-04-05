"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlanStatusLabel, getPlanTypeLabel, type PlanStatus } from "@/lib/plans";

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

export default function AdminPlansPage() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | PlanStatus>("all");

  const plansQuery = trpc.plans.list.useQuery({
    q: q.trim() || undefined,
    status,
    limit: 50,
  });

  React.useEffect(() => {
    if (plansQuery.error) {
      toast.error(plansQuery.error.message ?? "执行历史加载失败");
    }
  }, [plansQuery.error]);

  const plans = plansQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">执行历史</h1>
        <p className="text-sm text-muted-foreground">
          `/admin/library` 负责发起整理动作，这里只回看已经提交过的执行记录、状态和结果。
        </p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>筛选</CardTitle>
          <CardDescription>按状态或关键字过滤已有执行记录。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-4 md:flex-row">
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="搜索 planId、创建人、范围摘要"
            className="md:max-w-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | PlanStatus)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">全部状态</option>
            <option value="draft">draft</option>
            <option value="confirmed">confirmed</option>
            <option value="running">running</option>
            <option value="done">done</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <Button type="button" variant="outline" onClick={() => void plansQuery.refetch()}>
            刷新
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>记录列表</CardTitle>
          <CardDescription>
            {plansQuery.isLoading ? "加载中…" : `当前展示 ${plans.length} 条执行记录`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>记录</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>范围</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建人</TableHead>
                <TableHead>更新时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const badge = statusBadge(plan.status);
                return (
                  <TableRow
                    key={plan.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/plans/${plan.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{plan.id}</TableCell>
                    <TableCell>{getPlanTypeLabel(plan.type)}</TableCell>
                    <TableCell>{plan.scopeSummary}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {plan.previewSummary.itemCount} 项 / {plan.previewSummary.warningCount} 警告
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.text}</Badge>
                    </TableCell>
                    <TableCell>{plan.createdByName ?? "-"}</TableCell>
                    <TableCell>{formatDateTime(plan.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}

              {!plansQuery.isLoading && plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    还没有执行记录。这里当前只保留历史文件整理结果的回看入口。
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
