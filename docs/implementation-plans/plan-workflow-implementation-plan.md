---
doc_type: implementation-plan
product: music-tagger
module: plan-workflow
version: 2026-04-05
source_refs:
  - docs/prd/plan-workflow/summary.md
  - docs/prd/plan-workflow/admin-plans-page.md
  - docs/prd/plan-workflow/admin-plan-detail-page.md
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/server/trpc/routers/plans.ts
  - worker/plan_executor.py
---

# Plan Workflow 实施计划

## 1. 目标

- 把当前 `rename / tag_write` 的 Plan 主链路收口成真正可用的管理员整理流程。
- 本轮不扩新动作类型，重点放在：
  - `tag_write` 执行链路真正打通
  - 详情页对 preview / confirm / execute 的动作门槛解释清楚
  - 补最小自动化回归，避免再次出现“PRD 认为支持，但代码实际断链”的情况

## 2. 范围

### 2.1 本轮包含

- 修复 worker `plan_execute` 对 `tag_write` Plan 的错误拒绝
- 保持未知 Plan 类型继续显式报错
- 在 `/admin/plans/[planId]` 增加动作提示、执行项状态摘要和禁用原因说明
- 新增最小自动化测试：
  - Web 端 Plan action helper 测试
  - Worker 端 `tag_write` execute smoke test

### 2.2 本轮不包含

- `move / delete / cover / lyrics` 等高级动作
- item 级手动排除
- 按 `planId` 联动过滤 Jobs 页面
- Plan 列表分页或详情分页

## 3. 改动点

### 3.1 Worker

- 文件：`worker/plan_executor.py`
- 调整 `execute_plan` 的顶层类型检查：
  - 从只接受 `rename`
  - 改为接受 `rename | tag_write`
- 保留 item kind 粒度的分发与异常处理逻辑不变

### 3.2 Web

- 文件：`web/lib/plans.ts`
  - 新增 `getPlanActionState`
  - 新增 `getPlanExecutionCounts`
  - 新增 `getPlanExecutionHint`
- 文件：`web/app/(app)/admin/plans/[planId]/page.tsx`
  - 用 helper 统一计算按钮可用性
  - 展示“当前动作提示”
  - 展示 item 状态计数
  - 在按钮不可用时展示具体原因

### 3.3 测试

- 文件：`web/lib/plans.test.mts`
  - 覆盖 confirm / execute 动作门槛
  - 覆盖 item 状态汇总与操作提示
- 文件：`worker/tests/test_plan_executor.py`
  - 覆盖 `tag_write` Plan 可进入执行
  - 覆盖未知类型仍被拒绝

## 4. 验证

- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`
- `python3 -m unittest worker/tests/test_plan_executor.py`
- `python3 -m py_compile worker/*.py`

## 5. 回写要求

- 若本轮交付完成，保持以下文档与代码一致：
  - `docs/prd/plan-workflow/implementation-handoff.md`
  - `docs/baseline/product-baseline.md`
  - `docs/baseline/module-baseline-current-capabilities.md`
