"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = searchParams.get("email") ?? "";
  const nextFromQuery = searchParams.get("next") ?? "";

  const [email, setEmail] = React.useState(emailFromQuery);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    setEmail(emailFromQuery);
  }, [emailFromQuery]);

  const callbackURL = nextFromQuery.length > 0 ? nextFromQuery : "/admin/jobs";

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>登录</h1>
      <p style={{ marginBottom: 16, opacity: 0.8 }}>
        {nextFromQuery
          ? `请登录后继续访问：${nextFromQuery}`
          : "使用管理员账号登录后进入 Jobs 管理页。"}
      </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
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
              setError(maybeError.message ?? "登录失败");
              return;
            }

            const data = (res as { data?: { url?: string } } | null)?.data ?? (res as { url?: string } | null);
            router.replace(data?.url ?? callbackURL);
          } catch (err) {
            setError(err instanceof Error ? err.message : "登录失败");
          } finally {
            setIsPending(false);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
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
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #111",
            background: isPending ? "#f5f5f5" : "#111",
            color: isPending ? "#111" : "#fff",
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "登录中..." : "登录"}
        </button>

        {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}
      </form>

      <p style={{ marginTop: 14, opacity: 0.8 }}>
        还未初始化？<Link href="/setup">去初始化</Link>
      </p>
    </main>
  );
}
