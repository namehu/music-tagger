"use client";

import Link from "next/link";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const enqueueScanFull = trpc.jobs.enqueueScanFull.useMutation({
    onSuccess: () => {
      toast.success("已入队");
    },
    onError: (err) => {
      toast.error(err.message ?? "触发失败");
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          登录后默认首页。这里提供概览与快捷入口（占位），后续可扩展为关键指标/最近任务等。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>欢迎回来</CardTitle>
            <CardDescription>从这里开始：查看任务、调整设置，或触发一次全量扫描。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground">
              这是一个 shadcn 风格的 Dashboard 占位页，内容以可读性与布局为主，确保放在 AppShell
              下显示良好。
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/admin/library" className={buttonVariants({ variant: "default" })}>
                音乐库
              </Link>
              <Link href="/admin/jobs" className={buttonVariants({ variant: "default" })}>
                Jobs
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>状态说明</CardTitle>
            <CardDescription>用于引导与自检的简要说明（占位）。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• 音乐库：查看扫描结果并做基础搜索。</li>
              <li>• Jobs：查看最近任务与运行状态。</li>
              <li>• scan_full：管理员触发的全量扫描任务。</li>
            </ul>

            <Button
              type="button"
              variant="secondary"
              onClick={() => enqueueScanFull.mutate()}
              disabled={enqueueScanFull.isPending}
            >
              {enqueueScanFull.isPending ? "入队中..." : "触发 scan_full（可选）"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
