"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { trpc } from "../../_trpc/provider";

export default function AdminJobsPage() {
  const pathname = usePathname();
  const utils = trpc.useUtils();

  const jobsQuery = trpc.jobs.list.useQuery();
  const enqueueScanFull = trpc.jobs.enqueueScanFull.useMutation({
    onSuccess: async () => {
      await utils.jobs.list.invalidate();
    },
  });

  const jobsErrorCode = jobsQuery.error?.data?.code;
  const shouldShowSignInHint =
    jobsErrorCode === "UNAUTHORIZED" || jobsErrorCode === "FORBIDDEN";
  const nextHref = `/sign-in?next=${encodeURIComponent(pathname || "/admin/jobs")}`;

  return (
    <main style={{ maxWidth: 920, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Jobs</h1>
        <button
          type="button"
          onClick={() => enqueueScanFull.mutate()}
          disabled={enqueueScanFull.isPending}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #111",
            background: enqueueScanFull.isPending ? "#f5f5f5" : "#111",
            color: enqueueScanFull.isPending ? "#111" : "#fff",
            cursor: enqueueScanFull.isPending ? "not-allowed" : "pointer",
          }}
        >
          {enqueueScanFull.isPending ? "触发中..." : "触发 scan_full"}
        </button>
      </div>

      {enqueueScanFull.error ? (
        <p style={{ color: "#b00020", marginBottom: 12 }}>
          {enqueueScanFull.error.message ?? "触发失败"}
        </p>
      ) : null}

      {jobsQuery.isLoading ? <p>加载中...</p> : null}
      {jobsQuery.error ? (
        shouldShowSignInHint ? (
          <div style={{ border: "1px solid #f0d6d6", background: "#fff5f5", padding: 12, borderRadius: 10 }}>
            <p style={{ margin: 0, color: "#8a1f1f", fontWeight: 600 }}>
              {jobsErrorCode === "FORBIDDEN" ? "权限不足，请使用管理员账号登录" : "请登录后继续"}
            </p>
            <p style={{ margin: "6px 0 0", opacity: 0.85 }}>
              <Link href={nextHref}>前往登录</Link>（登录后将自动回到：<code>{pathname || "/admin/jobs"}</code>）
            </p>
          </div>
        ) : (
          <p style={{ color: "#b00020" }}>{jobsQuery.error.message ?? "加载失败"}</p>
        )
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 10 }}>
        {(jobsQuery.data ?? []).map((job) => (
          <li
            key={job.id}
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: 12,
              background: "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 600 }}>{job.id}</div>
                <div style={{ opacity: 0.8 }}>
                  type={job.type} status={job.status} progress={job.progress ?? 0} attempts=
                  {job.attempts}
                </div>
              </div>
              <div style={{ opacity: 0.7, whiteSpace: "nowrap" }}>
                {job.updatedAt ? new Date(job.updatedAt).toLocaleString() : "-"}
              </div>
            </div>

            {job.errorJson ? (
              <pre
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "#fafafa",
                  borderRadius: 8,
                  overflowX: "auto",
                  fontSize: 12,
                }}
              >
                {job.errorJson}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
