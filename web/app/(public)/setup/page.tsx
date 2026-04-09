"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function SetupPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const statusQuery = trpc.setup.status.useQuery();
  const [redirectEmail, setRedirectEmail] = React.useState<string | null>(null);
  const [showDone, setShowDone] = React.useState(false);
  const createAdmin = trpc.setup.createAdmin.useMutation({
    onSuccess: async (_data, variables) => {
      setRedirectEmail(variables.email);
      setShowDone(true);
      await utils.setup.status.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "初始化失败");
    },
  });

  const statusErrorMessage = statusQuery.error?.message;
  React.useEffect(() => {
    if (!statusErrorMessage) return;
    toast.error(statusErrorMessage);
  }, [statusErrorMessage]);

  React.useEffect(() => {
    if (!redirectEmail) return;
    // 给用户一个明确的“初始化已完成，入口已关闭”的提示，然后再跳转到登录页
    const timer = setTimeout(() => {
      const nextUrl = `/sign-in?email=${encodeURIComponent(redirectEmail)}`;
      router.replace(nextUrl);
    }, 1200);
    return () => clearTimeout(timer);
  }, [redirectEmail, router]);

  React.useEffect(() => {
    // 如果已完成初始化但不是由本页创建触发（例如刷新 /setup），也直接引导去登录页
    if (statusQuery.data?.initialized && !redirectEmail) {
      setShowDone(true);
      const timer = setTimeout(() => {
        router.replace("/sign-in");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [redirectEmail, router, statusQuery.data?.initialized]);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");

  const initialized = statusQuery.data?.initialized;
  const state = statusQuery.data?.state ?? (statusQuery.isLoading ? "loading" : "unknown");
  const isLocking = state === "locking";

  const handleCreate = React.useCallback(() => {
    if (createAdmin.isPending || isLocking || initialized) return;
    if (email.trim().length === 0) {
      toast.error("请输入邮箱");
      return;
    }
    if (password.length < 8) {
      toast.error("密码至少 8 位");
      return;
    }
    createAdmin.mutate({
      email: email.trim(),
      password,
      name: name.trim().length > 0 ? name.trim() : undefined,
    });
  }, [createAdmin, email, initialized, isLocking, name, password]);

  const statusBadge = (() => {
    if (statusQuery.isLoading) return { text: "加载中", variant: "secondary" as const };
    if (initialized) return { text: "已初始化", variant: "secondary" as const };
    if (state === "locking") return { text: "初始化中", variant: "secondary" as const };
    if (state === "none") return { text: "未初始化", variant: "outline" as const };
    return { text: state, variant: "outline" as const };
  })();

  if (showDone || initialized || redirectEmail) {
    const signInHref =
      redirectEmail && redirectEmail.length > 0
        ? `/sign-in?email=${encodeURIComponent(redirectEmail)}`
        : "/sign-in";

    return (
      <main className="azure-shell-bg flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{redirectEmail ? "初始化完成" : "入口已关闭"}</CardTitle>
              <Badge variant="secondary">完成</Badge>
            </div>
            <CardDescription>
              {redirectEmail
                ? "初始化已完成，入口已关闭。即将前往登录页继续。"
                : "系统已完成初始化，入口已关闭。即将前往登录页继续。"}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              如果没有自动跳转，请{" "}
              <Link href={signInHref} className="text-foreground underline underline-offset-4">
                点击去登录
              </Link>
              。
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="azure-shell-bg flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-1">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>初始化管理员</CardTitle>
            <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
          </div>
          <CardDescription>创建首个管理员账号。成功后将关闭初始化入口并跳转至登录页。</CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {isLocking ? (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                系统正在初始化中（已加锁）。请稍后刷新页面，或直接前往登录页。
              </p>
              <p className="text-sm">
                <Link href="/sign-in" className="underline underline-offset-4">
                  去登录
                </Link>
              </p>
            </div>
          ) : (
            <form
              className="grid gap-4"
              method="post"
              action="/api/setup/create-admin"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="name">昵称（可选）</Label>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Admin"
                  autoComplete="name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">密码</Label>
                  <span className="text-xs text-muted-foreground">至少 8 位</span>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              {/* NOTE: 这里不用 shadcn/base-ui 的 ButtonPrimitive 做 submit，
                  避免它在某些情况下把 submit 按钮错误地标记为 disabled。 */}
              <button
                type="submit"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "w-full",
                  (createAdmin.isPending || isLocking || initialized) && "pointer-events-none opacity-50"
                )}
              >
                {createAdmin.isPending ? "创建中..." : "创建首个管理员"}
              </button>

              <p className="rounded-[1.1rem] bg-[color:var(--surface-container-low)] px-3 py-2 text-xs text-muted-foreground">
                提示：初始化成功后会显示“初始化已完成，入口已关闭”，随后自动跳转到登录页。
              </p>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            已有管理员？{" "}
            <Link href="/sign-in" className="text-foreground underline underline-offset-4">
              去登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
