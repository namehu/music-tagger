---
doc_type: implementation-plan
product: music-tagger
module: advanced-plan-actions
version: 2026-04-05
source_refs:
  - docs/prd/advanced-plan-actions/summary.md
  - docs/prd/advanced-plan-actions/admin-plans-page.md
  - docs/prd/advanced-plan-actions/admin-plan-detail-page.md
  - docs/prd/advanced-plan-actions/implementation-handoff.md
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
---

# Advanced Plan Actions 实施计划

## 1. 目标

- 先把 `move` 作为 `advanced-plan-actions` 的第一落地动作接入现有 Plan 框架。
- 本轮不扩 `delete / cover_write / lyrics_write`，避免在回滚、覆盖和文件格式策略未锁定前把范围做散。

## 2. 范围

### 2.1 本轮包含

- Web 类型层新增 `move`
- `/admin/plans` 创建抽屉支持 `move`
- `plans.preview` 支持生成 `move` 类型 item
- `/admin/plans/[planId]` 支持展示 `move` 的路径 diff
- worker `plan_execute` 支持执行 `move`

### 2.2 本轮不包含

- `delete`
- `cover_write`
- `lyrics_write`
- `move + rename` 组合动作
- 覆盖写入与强一致回滚

## 3. 代码改动点

### 3.1 Web

- `web/lib/plans.ts`
  - 扩展 `PlanType`
  - 新增 `MovePlanParams`
  - 新增 `move` 参数解析和 label
- `web/server/trpc/routers/plans.ts`
  - 扩展 `createPlanInputSchema`
  - 增加 `buildMovePreview`
  - 扩展 `plans.get` / `plans.preview` 的 `move` 返回
- `web/app/(app)/admin/plans/page.tsx`
  - 创建抽屉新增 `move` 类型与目标目录模板输入
- `web/app/(app)/admin/plans/[planId]/page.tsx`
  - 渲染 `move` 参数与路径 diff

### 3.2 Worker

- `worker/plan_executor.py`
  - 增加 `_execute_move_item`
  - 扩展 `execute_plan` / item kind 分发
  - 回写 `tracks.path`、`tracks.dirPath`、`tracks.filename`

## 4. 技术规则

- `move` v1 目标路径必须落在 `MUSIC_ROOT` 内
- `move` v1 保留原文件名
- 同一批 preview 内若生成重复 `toPath`，必须阻断
- 若目标路径已被其他曲目占用，必须阻断
- worker 执行时继续使用尽力回滚原则，不承诺强一致

## 5. 测试清单

- Web:
  - `plans.create` 可创建 `move`
  - `plans.preview` 会生成 `move` item 和 warning
  - 详情页能正确显示 `move` 参数和路径 diff
- Worker:
  - `move` 执行成功后更新 `tracks` 路径字段
  - 越界路径和冲突路径被拒绝
  - 未知类型仍被拒绝
- 工程验证：
  - `pnpm test:web`
  - `pnpm lint:web`
  - `pnpm build:web`
  - `python3 -m py_compile worker/*.py`

## 6. 完工后回写

- `docs/baseline/product-baseline.md`
- `docs/baseline/module-baseline-current-capabilities.md`
- `docs/prd/advanced-plan-actions/*`
- 如实现范围变化，再同步更新 `docs/prd/README.md`
