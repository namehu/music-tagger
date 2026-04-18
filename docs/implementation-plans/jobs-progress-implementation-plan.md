---
doc_type: implementation-plan
product: music-tagger
module: jobs-progress
version: v1
source_refs:
  - docs/prd/jobs-progress/summary.md
  - docs/prd/jobs-progress/admin-page.md
  - docs/prd/jobs-progress/admin-jobs-page.md
  - web/server/trpc/routers/jobs.ts
  - worker/scanner.py
---

# Jobs Progress Implementation Plan

## Summary

为 `scan_full` 增加结构化扫描计数，保留现有百分比进度，并通过 admin-only SSE route 推送给 `/admin` 与 `/admin/jobs`。

## Implementation Changes

- 数据层：在 `Job` model 增加可空 `progressJson String?`，新增 PostgreSQL migration `ALTER TABLE "jobs" ADD COLUMN "progressJson" TEXT`。
- Worker：扩展 `jobs.update_progress` 支持可选 `progress_json`；`scan_full` 改为接收结构化 progress callback，在 discovering、scanning、cleanup、done 阶段写入计数。
- Web API：`jobs.get` / `jobs.list` 返回 `progressJson`；新增 `/api/admin/jobs/[jobId]/events`，管理员鉴权后轮询数据库并发送 SSE。
- UI：新增扫描进度解析与展示 helper；`/admin` 和 `/admin/jobs` 在活动 `scan_full` 上连接 SSE，显示 `已扫描 / 已处理 / 跳过 / 删除`。
- 文档：实现后回写 baseline，记录 Jobs Queue 已支持结构化扫描进度与 SSE 观察通道。

## Test Plan

- `python3 -m py_compile worker/*.py`
- worker scanner 单元测试覆盖结构化进度阶段和跳过计数。
- `pnpm -C web lint`
- 手动验证 `/admin` 触发扫描后能看到计数，刷新后仍从 jobs 查询恢复。

## Assumptions

- v1 只定义 `scan_full` 的 `progressJson` 结构。
- SSE 只做单向状态通知，不承担取消或控制命令。
- 无 `progressJson` 的历史任务仍按现有百分比展示。
