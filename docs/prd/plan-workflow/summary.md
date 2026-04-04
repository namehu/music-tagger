---
doc_type: summary
product: music-tagger
module: plan-workflow
version: v0.1
source_refs:
  - docs/archive/raw-requirements/2026-04-01-local-music-manager-requirements.md
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - docs/architecture.md
---

# 产品白皮书与索引

## 产品愿景与目标

- 一句话价值：把所有高风险媒体整理动作收敛到一个可预览、可确认、可执行、可追踪的后台工作流中。
- 业务目标：
  - 替换当前“只改数据库 override、不改源文件”的临时整理方式
  - 为后续 rename、tag write、cover、lyrics、move 等能力提供统一执行框架
  - 让管理员可以在执行前看到路径变更和标签 diff，降低误操作风险
- 成功标准：
  - 管理员可以创建 `rename` 或 `tag_write` draft plan
  - 详情页可以完成 preview、查看 warnings、confirm 和 execute
  - 执行通过 `plan_execute` job 进入 worker，并回写 `Plan` / `PlanItem`
  - 失败项能够在页面与 jobs 侧被观察到

## 全局角色与权限

| 角色 | 全局权限 | 受限能力 | 说明 |
| --- | --- | --- | --- |
| 管理员 | 创建、预览、确认、执行、查看所有 plan | 无 | 本模块 v1 仅面向管理员开放 |
| 普通用户 | 无 | 不可见、不创建、不执行 | 是否支持提交草稿不纳入 v1 |

## 核心业务流程图

```mermaid
flowchart TD
  A[管理员进入 /admin/plans] --> B[创建 draft plan]
  B --> C[进入 /admin/plans/[planId]]
  C --> D[执行 preview]
  D --> E{是否存在阻断性错误}
  E -- 是 --> F[展示 warnings 或 failed item，不允许 execute]
  E -- 否 --> G[管理员 confirm]
  G --> H[计划冻结为 confirmed]
  H --> I[管理员 execute]
  I --> J[入队 plan_execute job]
  J --> K[worker 执行 plan_items]
  K --> L{执行结果}
  L -- 全部成功 --> M[plan = done]
  L -- 部分或全部失败 --> N[plan = failed]
```

## 全局业务字典

| 业务名词 | 标准定义 | 英文标识 | 备注 |
| --- | --- | --- | --- |
| 变更计划 | 一次可预览、可执行的整理操作集合 | Plan | 顶层业务实体 |
| 计划项 | Plan 拆分后的单个待执行动作 | PlanItem | 用于展示 diff 与执行状态 |
| 预览 | 根据 `scope + params` 生成 item、warning、diff 的过程 | Preview | 不直接改动源文件 |
| 确认 | 冻结 plan 参数与作用范围的动作 | Confirm | 避免 preview 与 execute 不一致 |
| 执行任务 | 用于驱动 worker 执行计划的后台 job | plan_execute job | 通过 `jobs` 队列表承载 |

## 页面路由索引

- 仅登记顶层可路由页面；页面内弹窗、抽屉和二次确认窗不进入该索引。
- `[Plans 管理页]`: `/admin/plans` -> `对应文档: admin-plans-page.md` (创建、筛选并查看计划列表)
- `[Plan 详情页]`: `/admin/plans/[planId]` -> `对应文档: admin-plan-detail-page.md` (查看预览 diff、确认并执行计划)

## 外部依赖登记

| 依赖对象 | 类型 | 触发页面/流程 | 现状 | 处理方式 |
| --- | --- | --- | --- | --- |
| SQLite | 数据库 | 创建 plan、预览、执行回写 | 已落地 | 新增 `plans` / `plan_items` 模型与索引 |
| Python worker | 异步执行器 | `execute` 后的后台执行 | 已落地 scan / transcode / plan execute | 当前已支持 `plan_execute` dispatch |
| `/music` | 文件系统 | rename / tag write 执行 | 已落地扫描和播放读取 | 执行前在 preview 阶段做路径与权限预检查 |
| Jobs 页面 | 关联观测入口 | 执行后的问题排障 | 已落地 | 当前仅提供跳转到 `/admin/jobs` 的人工排障入口，未提供 `planId` 级联过滤 |
