"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { trpc } from "../_trpc/provider";

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
  });

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

  if (showDone || initialized || redirectEmail) {
    const signInHref =
      redirectEmail && redirectEmail.length > 0
        ? `/sign-in?email=${encodeURIComponent(redirectEmail)}`
        : "/sign-in";

    return (
      <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
          {redirectEmail ? "初始化完成" : "系统已初始化"}
        </h1>
        <p style={{ marginBottom: 16, opacity: 0.8 }}>
          {redirectEmail
            ? "初始化已完成，入口已关闭。即将前往登录页继续。"
            : "系统已完成初始化，入口已关闭。即将前往登录页继续。"}
        </p>
        <p>
          如果没有自动跳转，请点击 <a href={signInHref}>去登录</a>
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
        初始化管理员
      </h1>

      <p style={{ marginBottom: 16, opacity: 0.8 }}>
        当前状态：{statusQuery.data?.state ?? (statusQuery.isLoading ? "loading" : "unknown")}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createAdmin.mutate({ email, password, name: name || undefined });
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>昵称（可选）</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Admin"
            autoComplete="name"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>邮箱</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
            required
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>密码（至少 8 位）</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <button
          type="submit"
          disabled={createAdmin.isPending || statusQuery.isLoading}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #111",
            background: createAdmin.isPending ? "#f5f5f5" : "#111",
            color: createAdmin.isPending ? "#111" : "#fff",
            cursor: createAdmin.isPending ? "not-allowed" : "pointer",
          }}
        >
          {createAdmin.isPending ? "创建中..." : "创建首个管理员"}
        </button>

        {createAdmin.error ? (
          <p style={{ color: "#b00020" }}>
            {createAdmin.error.message ?? "初始化失败"}
          </p>
        ) : null}
      </form>
    </main>
  );
}
