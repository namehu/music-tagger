"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { MOVE_TEMPLATE_TOKENS } from "@/lib/plan-move";
import {
  getPlanStatusLabel,
  getPlanTypeLabel,
  type PlanType,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export default function AdminPlansPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | PlanStatus>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [planType, setPlanType] = React.useState<PlanType>("rename");
  const [scopeType, setScopeType] = React.useState<"trackIds" | "album" | "artist">("album");
  const [scopeValue, setScopeValue] = React.useState("");
  const [template, setTemplate] = React.useState("{trackNo:02} - {title}");
  const [moveTargetDirTemplate, setMoveTargetDirTemplate] = React.useState("{artist}/{album}");
  const [tagForm, setTagForm] = React.useState({
    title: "",
    artist: "",
    album: "",
    albumArtist: "",
    trackNo: "",
    discNo: "",
    year: "",
    genre: "",
  });

  const plansQuery = trpc.plans.list.useQuery({
    q: q.trim() || undefined,
    status,
    limit: 50,
  });

  const createPlan = trpc.plans.create.useMutation({
    onSuccess: async (result) => {
      toast.success("Plan 已创建");
      setCreateOpen(false);
      setScopeValue("");
      await utils.plans.list.invalidate();
      router.push(`/admin/plans/${result.planId}`);
    },
    onError: (error) => {
      toast.error(error.message ?? "创建 Plan 失败");
    },
  });

  React.useEffect(() => {
    if (plansQuery.error) {
      toast.error(plansQuery.error.message ?? "Plan 列表加载失败");
    }
  }, [plansQuery.error]);

  function submitCreatePlan() {
    const trimmed = scopeValue.trim();
    if (!trimmed) {
      toast.error("请先填写作用范围");
      return;
    }

    if (planType === "rename" && template.trim().length === 0) {
      toast.error("请填写 rename 模板");
      return;
    }

    if (planType === "move" && moveTargetDirTemplate.trim().length === 0) {
      toast.error("请填写目标目录模板");
      return;
    }

    const sharedScope =
      scopeType === "trackIds"
        ? {
            type: "trackIds" as const,
            trackIds: trimmed
              .split(/[\s,]+/)
              .map((item) => item.trim())
              .filter(Boolean),
          }
        : scopeType === "album"
          ? {
              type: "album" as const,
              album: trimmed,
            }
          : {
              type: "artist" as const,
              artist: trimmed,
            };

    if (sharedScope.type === "trackIds" && sharedScope.trackIds.length === 0) {
      toast.error("请至少提供一个 trackId");
      return;
    }

    if (planType === "tag_write") {
      const parseOptionalInt = (value: string) => {
        const normalized = value.trim();
        if (normalized.length === 0) return undefined;
        const parsed = Number.parseInt(normalized, 10);
        return Number.isInteger(parsed) ? parsed : undefined;
      };

      const payload = {
        title: tagForm.title.trim().length > 0 ? tagForm.title.trim() : undefined,
        artist: tagForm.artist.trim().length > 0 ? tagForm.artist.trim() : undefined,
        album: tagForm.album.trim().length > 0 ? tagForm.album.trim() : undefined,
        albumArtist: tagForm.albumArtist.trim().length > 0 ? tagForm.albumArtist.trim() : undefined,
        trackNo: parseOptionalInt(tagForm.trackNo),
        discNo: parseOptionalInt(tagForm.discNo),
        year: parseOptionalInt(tagForm.year),
        genre: tagForm.genre.trim().length > 0 ? tagForm.genre.trim() : undefined,
      };

      if (Object.values(payload).every((value) => typeof value === "undefined")) {
        toast.error("请至少填写一个要写回的标签字段");
        return;
      }

      createPlan.mutate({
        type: "tag_write",
        scope: sharedScope,
        params: {
          type: "tag_write",
          ...payload,
        },
      });
      return;
    }

    if (planType === "move") {
      createPlan.mutate({
        type: "move",
        scope: sharedScope,
        params: {
          type: "move",
          targetDirTemplate: moveTargetDirTemplate.trim(),
        },
      });
      return;
    }

    createPlan.mutate({
      type: "rename",
      scope: sharedScope,
      params: {
        type: "rename",
        template: template.trim(),
      },
    });
  }

  const plans = plansQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            所有会改动文件系统或媒体标签的整理动作都先走预览，再进入确认和执行。
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          创建 Plan
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>筛选</CardTitle>
          <CardDescription>按状态或关键字过滤已有计划。</CardDescription>
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
          <CardTitle>计划列表</CardTitle>
          <CardDescription>
            {plansQuery.isLoading ? "加载中…" : `当前展示 ${plans.length} 条计划`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>范围</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>预览摘要</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无计划
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => {
                  const badge = statusBadge(plan.status);
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="font-medium">{plan.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {getPlanTypeLabel(plan.type)} · {plan.createdByName}
                        </div>
                      </TableCell>
                      <TableCell>{plan.scopeSummary}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {plan.previewSummary.itemCount} items / {plan.previewSummary.warningCount} warnings
                      </TableCell>
                      <TableCell>{formatDateTime(plan.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/admin/plans/${plan.id}`)}
                        >
                          查看详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>创建 Plan</SheetTitle>
            <SheetDescription>
              当前已支持 `rename`、`move` 与基础 `tag_write`。`tag_write` 依赖 worker 环境安装 `mutagen`。
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="plan-type">计划类型</Label>
              <select
                id="plan-type"
                value={planType}
                onChange={(event) => setPlanType(event.target.value as PlanType)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="rename">rename</option>
                <option value="move">move</option>
                <option value="tag_write">tag_write</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-type">范围类型</Label>
              <select
                id="scope-type"
                value={scopeType}
                onChange={(event) => setScopeType(event.target.value as "trackIds" | "album" | "artist")}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="album">按专辑</option>
                <option value="artist">按艺人</option>
                <option value="trackIds">按 trackIds</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-value">
                {scopeType === "album"
                  ? "专辑名"
                  : scopeType === "artist"
                    ? "艺人名"
                    : "trackIds"}
              </Label>
              <Input
                id="scope-value"
                value={scopeValue}
                onChange={(event) => setScopeValue(event.target.value)}
                placeholder={
                  scopeType === "trackIds" ? "多个 ID 用空格或逗号分隔" : "输入精确匹配值"
                }
              />
            </div>

            {planType === "rename" ? (
              <div className="space-y-2">
                <Label htmlFor="template">rename 模板</Label>
                <Input
                  id="template"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                  placeholder="{trackNo:02} - {title}"
                />
                <p className="text-xs text-muted-foreground">
                  可用变量：`title`、`artist`、`album`、`albumArtist`、`trackNo`、`discNo`、`year`、`genre`、`filenameBase`
                </p>
              </div>
            ) : planType === "move" ? (
              <div className="space-y-2">
                <Label htmlFor="move-target-dir-template">目标目录模板</Label>
                <Input
                  id="move-target-dir-template"
                  value={moveTargetDirTemplate}
                  onChange={(event) => setMoveTargetDirTemplate(event.target.value)}
                  placeholder="{artist}/{album}"
                />
                <p className="text-xs text-muted-foreground">
                  `move` v1 只移动目录，不改文件名。可用变量：
                  {MOVE_TEMPLATE_TOKENS.map((token) => ` \`${token}\``).join("、")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tag-title">标题</Label>
                  <Input id="tag-title" value={tagForm.title} onChange={(event) => setTagForm((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-artist">艺人</Label>
                  <Input id="tag-artist" value={tagForm.artist} onChange={(event) => setTagForm((current) => ({ ...current, artist: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-album">专辑</Label>
                  <Input id="tag-album" value={tagForm.album} onChange={(event) => setTagForm((current) => ({ ...current, album: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-album-artist">专辑艺人</Label>
                  <Input id="tag-album-artist" value={tagForm.albumArtist} onChange={(event) => setTagForm((current) => ({ ...current, albumArtist: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-track-no">曲序</Label>
                  <Input id="tag-track-no" value={tagForm.trackNo} onChange={(event) => setTagForm((current) => ({ ...current, trackNo: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-disc-no">碟号</Label>
                  <Input id="tag-disc-no" value={tagForm.discNo} onChange={(event) => setTagForm((current) => ({ ...current, discNo: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-year">年份</Label>
                  <Input id="tag-year" value={tagForm.year} onChange={(event) => setTagForm((current) => ({ ...current, year: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-genre">流派</Label>
                  <Input id="tag-genre" value={tagForm.genre} onChange={(event) => setTagForm((current) => ({ ...current, genre: event.target.value }))} />
                </div>
                <p className="text-xs text-muted-foreground md:col-span-2">
                  当前 `tag_write` 通过 worker 使用 `mutagen` 写回标签，仅支持常见格式，preview 会提前标出不支持的文件。
                </p>
              </div>
            )}
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={submitCreatePlan} disabled={createPlan.isPending}>
              {createPlan.isPending ? "创建中…" : "创建"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
