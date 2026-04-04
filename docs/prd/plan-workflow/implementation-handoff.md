# Implementation Handoff

## 1. 影响范围

- 页面：
  - 已新增 `/admin/plans`
  - 已新增 `/admin/plans/[planId]`
- tRPC：
  - 已新增 `plans` router
  - `jobs` router 暂未提供按 `planId` 关联查询
- Prisma：
  - 已新增 `Plan`
  - 已新增 `PlanItem`
  - `Job` 已增加 `plan_execute` 使用约定
- Worker / Jobs：
  - `worker.py` 已增加 `plan_execute` dispatch
  - 已新增 plan executor 模块

## 2. 数据与接口变更

| 类型 | 名称 | 变更说明 |
| --- | --- | --- |
| route | `/admin/plans` | 新增计划列表与创建入口 |
| route | `/admin/plans/[planId]` | 新增计划详情与执行入口 |
| trpc router | `plans.list` | 列表查询，当前支持状态和关键字筛选 |
| trpc router | `plans.create` | 创建 `draft` plan |
| trpc router | `plans.get` | 查询 plan 基础信息 |
| trpc router | `plans.preview` | 生成或刷新 `plan_items` 与 warnings |
| trpc router | `plans.confirm` | 将 `draft` 冻结为 `confirmed` |
| trpc router | `plans.execute` | 入队 `plan_execute` job |
| trpc router | `plans.items` | 查询 plan item 列表与筛选 |
| prisma model | `Plan` | 保存 scope、params、status、createdBy |
| prisma model | `PlanItem` | 保存 item kind、path diff、tag diff、warning、status、error |
| job contract | `plan_execute` | payload 至少包含 `planId`、`jobKey=plan_execute:{planId}` |

## 3. 开发顺序

1. 已在 Prisma schema 中引入 `Plan` 与 `PlanItem`，并补 migration。
2. 已落 `plans` router 的读写与状态流转。
3. 已实现 `/admin/plans` 与 `/admin/plans/[planId]` 的最小页面。
4. 已在 worker 中引入 `plan_execute` dispatcher 和 executor。
5. 当前保留跳转到 `/admin/jobs` 的人工排障入口；按 `planId` 深度联动作为后续增强。

## 4. v1 范围控制

- 只实现 `rename` 与 `tag_write`
- `tag_write` 只覆盖当前曲库页面已支持的基础元数据字段
- 不做普通用户 draft 提交
- 不做 item 级手动排除
- 不做强一致回滚

## 5. 测试与验收

- 正常流程：
  - 创建 draft plan
  - preview 成功生成 items
  - confirm 后状态冻结
  - execute 后生成 `plan_execute` job 并进入 `done`
- 权限失败：
  - 普通用户无法访问页面
  - 普通用户无法调用 `plans.*`
- 异常流程：
  - preview 阶段检测到路径冲突
  - execute 阶段单个 item 失败
  - 重复 execute 不重复入队
- 回归范围：
  - 现有 `/admin/library` 编辑功能
  - 现有 jobs 页面轮询
  - worker 对 `scan_full` 与 `transcode_prepare` 的既有处理
