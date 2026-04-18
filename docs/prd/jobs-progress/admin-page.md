---
doc_type: page
product: music-tagger
module: jobs-progress
page: admin-page
version: v1
source_refs:
  - web/app/(app)/admin/page.tsx
  - web/server/trpc/routers/jobs.ts
  - docs/baseline/product-baseline.md
---

# Admin Page

## 目标

管理首页继续作为管理员日常运维入口。触发 `scan_full` 后，页面必须能展示最新扫描任务的结构化进度。

## 页面行为

- 点击“触发 scan_full”后，页面使用返回的 `jobId` 作为活动扫描任务。
- 如果返回的是去重任务，仍然连接同一个已有 `jobId`。
- 页面有活动扫描任务时连接 `/api/admin/jobs/[jobId]/events`。
- 页面展示：
  - discovering：`正在统计音乐文件`
  - scanning：`已扫描 scanned / total`
  - cleanup：`正在清理已不存在的曲目`
  - done：`扫描完成 scanned / total`
- 同时展示 `processed / skipped / deleted` 计数。
- 不显示当前文件名或完整路径。

## 状态与错误

- SSE 连接失败时，保留现有 tRPC 轮询作为降级。
- job 进入 `done / failed / cancelled` 后关闭 SSE，页面保留最终状态。
- job 失败时展示现有错误摘要，不改变重试入口。
