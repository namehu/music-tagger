---
doc_type: page
product: music-tagger
module: jobs-progress
page: admin-jobs-page
version: v1
source_refs:
  - web/app/(app)/admin/jobs/page.tsx
  - web/server/trpc/routers/jobs.ts
  - docs/baseline/product-baseline.md
---

# Admin Jobs Page

## 目标

Jobs 页继续承担后台任务排障入口，并为 `scan_full` 展示结构化扫描计数。

## 页面行为

- Jobs 列表保留原有百分比列。
- `scan_full` 行额外展示结构化计数摘要：
  - `正在统计音乐文件`
  - `已扫描 scanned / total`
  - `已处理 processed`
  - `跳过 skipped`
  - `删除 deleted`
- 有活动 `scan_full` 时连接 SSE 并刷新该任务状态。
- 非扫描任务不展示扫描计数。

## 状态与错误

- SSE 只增强活动扫描任务，现有 2 秒轮询继续作为降级。
- 终态任务展示最终计数，不再继续连接 SSE。
- 无 `progressJson` 的旧任务只展示原百分比。
