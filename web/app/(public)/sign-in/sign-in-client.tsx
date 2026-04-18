"use client";

import React from "react";
import { useRouter } from "next/navigation";
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
import {
  DEFAULT_SIGNED_IN_PATH,
  resolveSignInCallbackPath,
} from "@/lib/app-routes";
import type { AdminInitState } from "@/lib/admin-init";

type SignInMode = "setup" | "sign-in";

type SignInClientPageProps = {
  initialEmail: string;
  initialInitialized: boolean;
  initialState: AdminInitState;
  nextFromQuery: string;
};

export function SignInClientPage({
  initialEmail,
  initialInitialized,
  initialState,
  nextFromQuery,
}: SignInClientPageProps) {
  const router = useRouter();
  const callbackURL = resolveSignInCallbackPath(nextFromQuery);
  const [mode, setMode] = React.useState<SignInMode>(initialInitialized ? "sign-in" : "setup");
  const [initState, setInitState] = React.useState<AdminInitState>(initialState);
  const [email, setEmail] = React.useState(initialEmail);
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  React.useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const createAdmin = trpc.setup.createAdmin.useMutation({
    onSuccess: (_data, variables) => {
      setMode("sign-in");
      setInitState("done");
      setEmail(variables.email);
      setPassword("");
      toast.success("初始化完成，请登录。");

      const url = new URL("/sign-in", window.location.origin);
      url.searchParams.set("email", variables.email);
      if (callbackURL !== DEFAULT_SIGNED_IN_PATH) {
        url.searchParams.set("next", callbackURL);
      }
      router.replace(`${url.pathname}${url.search}`);
    },
    onError: (err) => {
      toast.error(err.message ?? "初始化失败");
    },
  });

  const isLocking = initState === "locking";

  return (
    <main className="azure-shell-bg flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-1">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{mode === "setup" ? "初始化管理员" : "登录"}</CardTitle>
            {mode === "setup" ? (
              <Badge variant={isLocking ? "secondary" : "outline"}>
                {isLocking ? "初始化中" : "未初始化"}
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            {mode === "setup"
              ? "创建首个管理员账号。完成后回到登录页继续。"
              : nextFromQuery
                ? `请登录后继续访问：${callbackURL}`
                : "登录后进入用户音乐区；管理员可再切换到管理台。"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {mode === "setup" ? (
            <SetupForm
              createPending={createAdmin.isPending}
              disabled={isLocking}
              email={email}
              name={name}
              password={password}
              onEmailChange={setEmail}
              onNameChange={setName}
              onPasswordChange={setPassword}
              onSubmit={() => {
                if (createAdmin.isPending || isLocking) return;
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
              }}
            />
          ) : (
            <SignInForm
              callbackURL={callbackURL}
              email={email}
              isPending={isSigningIn}
              password={password}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onPendingChange={setIsSigningIn}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function SetupForm({
  createPending,
  disabled,
  email,
  name,
  password,
  onEmailChange,
  onNameChange,
  onPasswordChange,
  onSubmit,
}: {
  createPending: boolean;
  disabled: boolean;
  email: string;
  name: string;
  password: string;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (disabled) {
    return (
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">系统正在初始化中，请稍后刷新页面。</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="setup-name">昵称（可选）</Label>
        <Input
          id="setup-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Admin"
          autoComplete="name"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="setup-email">邮箱</Label>
        <Input
          id="setup-email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="admin@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="setup-password">密码</Label>
          <span className="text-xs text-muted-foreground">至少 8 位</span>
        </div>
        <Input
          id="setup-password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <Button type="submit" disabled={createPending} className="w-full">
        {createPending ? "创建中..." : "创建首个管理员"}
      </Button>
    </form>
  );
}

function SignInForm({
  callbackURL,
  email,
  isPending,
  password,
  onEmailChange,
  onPasswordChange,
  onPendingChange,
}: {
  callbackURL: string;
  email: string;
  isPending: boolean;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPendingChange: (value: boolean) => void;
}) {
  const router = useRouter();

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        onPendingChange(true);
        try {
          const { signIn } = await import("@/lib/auth-client");
          const res = await signIn.email({
            email,
            password,
            callbackURL,
          });

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
          onPendingChange(false);
        }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
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
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "登录中..." : "登录"}
      </Button>
    </form>
  );
}
