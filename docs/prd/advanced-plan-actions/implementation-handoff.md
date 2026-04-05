---
doc_type: implementation-handoff
product: music-tagger
module: advanced-plan-actions
version: v0.1
source_refs:
  - docs/prd/advanced-plan-actions/summary.md
  - docs/prd/advanced-plan-actions/admin-plans-page.md
  - docs/prd/advanced-plan-actions/admin-plan-detail-page.md
  - docs/baseline/product-baseline.md
---

# Implementation Handoff

## 1. 影响范围

- 页面：
  - 继续使用 `/admin/plans`
  - 继续使用 `/admin/plans/[planId]`
- tRPC：
  - 扩展 `plans.create`
  - 扩展 `plans.preview`
  - 复用 `plans.get`
  - 复用 `plans.items`
  - 复用 `plans.confirm`
  - 复用 `plans.execute`
- Prisma：
  - 预期复用 `Plan` 与 `PlanItem`
  - `Plan.type` 需要扩展 `move`
- Worker / Jobs：
  - 扩展 `plan_execute`
  - 扩展 `plan_executor.py`

## 2. 数据与接口变更

| 类型 | 名称 | 变更说明 |
| --- | --- | --- |
| route | `/admin/plans` | 创建抽屉新增 `move` 类型与 `targetDirTemplate` 参数 |
| route | `/admin/plans/[planId]` | 详情页展示 `move` 路径 diff、warning 与执行态 |
| trpc router | `plans.create` | 支持创建 `move` draft plan |
| trpc router | `plans.preview` | 支持生成 `move` 类型 `plan_items` |
| trpc router | `plans.get` | 兼容返回 `move` params |
| trpc router | `plans.items` | 兼容返回 `move` item 列表 |
| prisma enum/field | `Plan.type` | 需要扩展为 `rename / tag_write / move` |
| job contract | `plan_execute` | payload 继续至少包含 `planId`、`jobKey=plan_execute:{planId}` |

## 3. 开发顺序

1. 先扩展 `web/lib/plans.ts` 的类型、label 和参数解析。
2. 再扩展 `plans.create` / `plans.preview` 的 `move` 参数与 preview 逻辑。
3. 然后扩展 `/admin/plans` 创建抽屉和 `/admin/plans/[planId]` 详情展示。
4. 最后扩展 worker `plan_execute` 对 `move` 的执行与错误回写。
5. 实现完成后补最小自动化回归，并回写 baseline / PRD 状态。

## 4. v1 范围控制

- 只实现 `move`
- `move` 只移动目录，不改文件名
- `move` 冲突策略固定为阻断，不做覆盖
- 不做 `delete`
- 不做 `cover_write`
- 不做 `lyrics_write`

## 5. 测试与验收

- 正常流程：
  - 创建 `move` draft plan
  - preview 成功生成路径 diff
  - confirm 后状态冻结
  - execute 后生成 `plan_execute` job 并进入 `done`
- 风险流程：
  - preview 阶段检测到目标路径冲突
  - preview 阶段检测到越界到 `MUSIC_ROOT` 之外
  - execute 阶段单个 item 失败
  - 重复 execute 不重复入队
- 回归范围：
  - 现有 `rename / tag_write`
  - `/admin/plans` 列表页筛选
  - `/admin/plans/[planId]` 动作提示与 item 列表
  - worker 对 `scan_full`、`transcode_prepare`、`plan_execute` 的既有处理

## 6. 当前实现状态

- 当前代码已经落地 `move` v1：
  - `/admin/plans` 可创建 `move` draft plan
  - `/admin/plans/[planId]` 可预览 `move` 路径 diff、确认并执行
  - worker `plan_execute` 已支持 `move` 执行与 `tracks.path` 回写
- 当前仍未落地：
  - `delete`
  - `cover_write`
  - `lyrics_write`
