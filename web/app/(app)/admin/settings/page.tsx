"use client";

import React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AdminSettingsPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.get.useQuery();
  const updatePolicy = trpc.settings.updateTranscodePolicy.useMutation({
    onSuccess: async (result) => {
      setColdCacheDays(String(result.transcodePolicy.coldCacheDays));
      setBudgetGiB(String(Math.max(1, Math.round(result.transcodePolicy.budgetBytes / 1024 ** 3))));
      setPruneLimit(String(result.transcodePolicy.pruneLimit));
      toast.success("转码与缓存策略已更新");
      await Promise.all([
        utils.settings.get.invalidate(),
        utils.library.cacheCapacity.invalidate(),
        utils.library.cacheEntries.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "保存失败");
    },
  });

  const [coldCacheDays, setColdCacheDays] = React.useState("30");
  const [budgetGiB, setBudgetGiB] = React.useState("5");
  const [pruneLimit, setPruneLimit] = React.useState("200");

  React.useEffect(() => {
    if (settingsQuery.error) {
      toast.error(settingsQuery.error.message ?? "设置加载失败");
    }
  }, [settingsQuery.error]);

  React.useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setColdCacheDays(String(settingsQuery.data.transcodePolicy.coldCacheDays));
    setBudgetGiB(String(Math.max(1, Math.round(settingsQuery.data.transcodePolicy.budgetBytes / 1024 ** 3))));
    setPruneLimit(String(settingsQuery.data.transcodePolicy.pruneLimit));
  }, [settingsQuery.data]);

  const parsedColdCacheDays = Number.parseInt(coldCacheDays, 10);
  const parsedBudgetGiB = Number.parseInt(budgetGiB, 10);
  const parsedPruneLimit = Number.parseInt(pruneLimit, 10);
  const formValid =
    Number.isInteger(parsedColdCacheDays) &&
    parsedColdCacheDays >= 1 &&
    parsedColdCacheDays <= 3650 &&
    Number.isInteger(parsedBudgetGiB) &&
    parsedBudgetGiB >= 0 &&
    parsedBudgetGiB <= 1024 &&
    Number.isInteger(parsedPruneLimit) &&
    parsedPruneLimit >= 1 &&
    parsedPruneLimit <= 500;

  const currentPolicy = settingsQuery.data?.transcodePolicy;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">转码与缓存策略</h1>
        <p className="text-sm text-muted-foreground">
          统一管理冷缓存清理天数、容量预算和单次批量清理上限，缓存页会直接读取这里的配置。
        </p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>当前生效策略</CardTitle>
          <CardDescription>这些值会直接影响缓存页里的默认清理动作。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-sm text-muted-foreground">冷缓存阈值</div>
            <div className="mt-2 text-2xl font-semibold">
              {currentPolicy?.coldCacheDays ?? "-"} 天
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-sm text-muted-foreground">容量预算</div>
            <div className="mt-2 text-2xl font-semibold">
              {formatBytes(currentPolicy?.budgetBytes)}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-sm text-muted-foreground">单次清理上限</div>
            <div className="mt-2 text-2xl font-semibold">
              {currentPolicy?.pruneLimit ?? "-"} 条
            </div>
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">最后更新: {formatDateTime(settingsQuery.data?.updatedAt)}</Badge>
            <Badge variant="outline">作用范围: /admin/cache 默认动作</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>修改策略</CardTitle>
          <CardDescription>
            推荐先调整阈值，再回到缓存页执行清理；这样更接近生产环境的日常运维动作。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cold-cache-days">冷缓存阈值（天）</Label>
              <Input
                id="cold-cache-days"
                type="number"
                min={1}
                max={3650}
                value={coldCacheDays}
                onChange={(event) => setColdCacheDays(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">超过这个时间未命中的 ready 缓存，会被视为冷缓存。</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-gib">容量预算（GiB）</Label>
              <Input
                id="budget-gib"
                type="number"
                min={0}
                max={1024}
                value={budgetGiB}
                onChange={(event) => setBudgetGiB(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">缓存页的预算裁剪会按这个总量目标回收最冷的缓存。</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prune-limit">单次清理上限</Label>
              <Input
                id="prune-limit"
                type="number"
                min={1}
                max={500}
                value={pruneLimit}
                onChange={(event) => setPruneLimit(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">控制一次冷缓存批量清理最多处理多少条记录。</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={!formValid || updatePolicy.isPending}
              onClick={() =>
                updatePolicy.mutate({
                  coldCacheDays: parsedColdCacheDays,
                  budgetBytes: parsedBudgetGiB * 1024 ** 3,
                  pruneLimit: parsedPruneLimit,
                })
              }
            >
              保存策略
            </Button>
            {!formValid ? (
              <span className="text-sm text-destructive">请输入有效范围内的整数值。</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                保存后缓存页会立即使用新的阈值和预算。
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
