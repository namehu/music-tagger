---
doc_type: summary
product: music-tagger
module: advanced-plan-actions
version: v0.1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - docs/architecture.md
  - docs/prd/plan-workflow/summary.md
  - docs/archive/raw-requirements/2026-04-01-local-music-manager-requirements.md
---

# 产品白皮书与索引

## 产品愿景与目标

- 一句话价值：在现有 Plan 框架上继续扩展“真正会改动文件位置”的整理动作，并保持可预览、可确认、可执行、可追踪。
- 业务目标：
  - 先把 `move` 纳入统一的 `preview -> confirm -> execute` 工作流
  - 让管理员在执行前看到完整路径变化与冲突风险
  - 为后续 `delete`、`cover_write`、`lyrics_write` 预留同一套模块边界
- 成功标准：
  - 管理员可以创建 `move` draft plan
  - 详情页可以预览 `move` 的路径变更与风险提示
  - `move` 可以经 `confirm` 后进入 `plan_execute` job
  - `move` 执行完成后回写 `Plan` / `PlanItem` 状态

## 全局角色与权限

| 角色 | 全局权限 | 受限能力 | 说明 |
| --- | --- | --- | --- |
| 管理员 | 创建、预览、确认、执行 `move` 计划 | 无 | 当前模块仅扩展管理员侧 Plan 能力 |
| 普通用户 | 无 | 不可见、不创建、不执行 | 不引入用户侧 draft 或建议入口 |

## 核心业务流程图

```mermaid
flowchart TD
  A[管理员进入 /admin/plans] --> B[创建 move draft plan]
  B --> C[进入 /admin/plans/[planId]]
  C --> D[生成 move 预览]
  D --> E{是否存在阻断性风险}
  E -- 是 --> F[展示冲突/越界/非法路径 warning]
  E -- 否 --> G[管理员确认 Plan]
  G --> H[冻结为 confirmed]
  H --> I[管理员执行 Plan]
  I --> J[入队 plan_execute job]
  J --> K[worker 逐项执行 move]
  K --> L{执行结果}
  L -- 全部成功 --> M[plan = done]
  L -- 部分或全部失败 --> N[plan = failed]
```

## 全局业务字典

| 业务名词 | 标准定义 | 英文标识 | 备注 |
| --- | --- | --- | --- |
| 高阶 Plan 动作 | 超出 `rename / tag_write` 的后续整理动作模块 | Advanced Plan Actions | 当前先落 `move` |
| 移动计划 | 只改变目标目录、不改变文件名的计划 | Move Plan | 首个落地动作 |
| 目标目录模板 | 用于生成目标目录的字符串模板 | targetDirTemplate | v1 只允许基础字段变量 |
| 根目录越界 | 目标路径超出 `MUSIC_ROOT` 的情况 | Root Escape | 预览阶段必须阻断 |
| 路径冲突 | 目标路径已被现有曲目或同批计划项占用 | Path Conflict | 默认阻断，不覆盖写入 |

## 页面路由索引

- `[Plans 管理页]`: `/admin/plans` -> `对应文档: admin-plans-page.md` (扩展创建抽屉，允许创建 `move` draft plan)
- `[Plan 详情页]`: `/admin/plans/[planId]` -> `对应文档: admin-plan-detail-page.md` (查看 `move` 预览、风险、确认与执行)

## 外部依赖登记

| 依赖对象 | 类型 | 触发页面/流程 | 现状 | 处理方式 |
| --- | --- | --- | --- | --- |
| SQLite | 数据库 | 保存 `move` plan 与 `plan_items` | 已落地 | 复用现有 `Plan` / `PlanItem` |
| Python worker | 异步执行器 | `move` execute 后后台执行 | 已支持 `plan_execute` | 扩展 `move` 分发与执行 |
| `/music` | 文件系统 | 预览与执行目录移动 | 已落地 | 所有目标路径必须受 `MUSIC_ROOT` 约束 |
| Jobs 页面 | 关联观测入口 | 执行后的排障 | 已落地 | 继续通过 `/admin/jobs` 查看后台结果 |
