"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  return (
    <React.Suspense fallback={<SignInPageFallback />}>
      <SignInPageContent />
    </React.Suspense>
  );
}

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = searchParams.get("email") ?? "";
  const nextFromQuery = searchParams.get("next") ?? "";

  const [email, setEmail] = React.useState(emailFromQuery);
  const [password, setPassword] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    setEmail(emailFromQuery);
  }, [emailFromQuery]);

  const callbackURL = nextFromQuery.length > 0 ? nextFromQuery : "/admin/library";

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="border-b">
          <CardTitle>登录</CardTitle>
          <CardDescription>
            {nextFromQuery
              ? `请登录后继续访问：${nextFromQuery}`
              : "使用管理员账号登录后进入 Jobs 管理页。"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsPending(true);
              try {
                const res = await signIn.email({
                  email,
                  password,
                  callbackURL,
                });

                // better-auth 可能返回 { data, error }，也可能直接返回 data
                const maybeError = (res as { error?: { message?: string } | null } | null)?.error;
                if (maybeError) {
                  toast.error(maybeError.message ?? "登录失败");
                  return;
                }

                const data =
                  (res as { data?: { url?: string } } | null)?.data ??
                  (res as { url?: string } | null);
                router.replace(data?.url ?? callbackURL);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "登录失败");
              } finally {
                setIsPending(false);
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            还未初始化？{" "}
            <Link href="/setup" className="text-foreground underline underline-offset-4">
              去初始化
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

function SignInPageFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="border-b">
          <CardTitle>登录</CardTitle>
          <CardDescription>正在准备登录页面…</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">请稍候。</div>
        </CardContent>
      </Card>
    </main>
  );
}
