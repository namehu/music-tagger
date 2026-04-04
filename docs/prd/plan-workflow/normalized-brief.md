---
doc_type: normalized-brief
product: music-tagger
module: plan-workflow
version: v0.1
source_refs:
  - docs/archive/raw-requirements/2026-04-01-local-music-manager-requirements.md
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - docs/architecture.md
---

# Normalized Brief

## 1. 产品与模块

- 产品名称：Music Tagger
- 模块名称：Plan Workflow
- 业务目标：为所有会修改文件系统或媒体标签的动作建立统一的 `Plan -> 预览 -> 确认 -> 执行` 工作流，替代当前直接修改数据库 override 的做法，形成可审阅、可回放、可观测的整理能力。

## 2. 角色与权限线索

| 角色 | 当前事实 | 待确认项 | 来源 |
| --- | --- | --- | --- |
| 管理员 | 当前已具备 jobs、settings、library 管理权限 | 是否允许普通用户提交 draft plan | README.md，docs/architecture.md，需求稿 |
| 普通用户 | 当前已登录后可浏览、搜索、播放 | 本模块 v1 是否开放任何可见或可提交能力 | docs/architecture.md，需求稿 |

## 3. 页面与从属交互清单

| 名称 | 类型 | 页面职责 | 归属页面/上游入口 | 下游去向 | 来源 |
| --- | --- | --- | --- | --- | --- |
| Plans 管理页 | 独立页面 | 创建 draft、筛选和查看计划列表 | 后台导航入口 `/admin/plans` | 进入 Plan 详情页 | 需求稿，当前实现 |
| Plan 详情页 | 独立页面 | 查看预览 diff、警告、执行状态并执行关键操作 | 从 Plans 管理页进入 | 返回列表或进入 jobs 观测 | 需求稿，当前实现 |
| 创建 Plan 抽屉 | 页面内抽屉 | 选择操作类型、作用范围、参数模板 | 归属 `admin-plans-page.md` | 创建 draft 后跳转详情页 | 本 PRD 归纳 |

## 4. 外部系统与依赖

| 依赖对象 | 依赖类型 | 影响范围 | 已知规则 | 待确认项 |
| --- | --- | --- | --- | --- |
| SQLite | 数据存储 | `plans`、`plan_items`、`jobs` | 当前系统唯一业务数据库 | 无 |
| Python worker | 异步执行 | `plan_execute` job 执行 | 当前 worker 已支持 scan/transcode/plan execute | 无 |
| `/music` 文件系统 | 文件系统 | rename / tag write 生效位置 | Web 与 worker 均挂载音乐目录 | 权限失败时的降级策略 |
| ffmpeg / ffprobe | 媒体工具 | 本模块 v1 不直接依赖 | 仅播放/转码已使用 | 无 |

## 5. 状态与动作

| 实体 | 状态/动作 | 说明 | 来源 |
| --- | --- | --- | --- |
| Plan | draft / confirmed / running / done / failed / cancelled | 模块主状态 | 需求稿，本 PRD 收敛 |
| PlanItem | pending / running / done / failed / skipped | 单项执行状态 | 需求稿 |
| Plan 操作 | create / preview / confirm / execute / get / list items | 模块 v1 最小控制面 | 需求稿，本 PRD 收敛 |
| Job | `plan_execute` | 用于串接 worker 异步执行 | 需求稿，本 PRD 收敛 |

## 6. 字段与约束

| 字段 | 约束 | 默认值 | 适用页面 | 来源 |
| --- | --- | --- | --- | --- |
| `type` | v1 限定为 `rename`、`tag_write` | 无 | 列表页创建抽屉 | 本 PRD 收敛 |
| `scope` | 至少支持按 trackIds / album / artist 建立作用范围 | 无 | 列表页创建抽屉 | 需求稿 |
| `params` | 随 `type` 变化；preview 前可编辑，confirm 后冻结 | 无 | 列表页创建抽屉，详情页 | 本 PRD 收敛 |
| `warnings` | preview 生成，可为空 | `[]` | 详情页 | 本 PRD 收敛 |
| `jobKey` | `plan_execute:{planId}` | 自动生成 | 执行链路 | 本 PRD 收敛 |

## 7. 冲突与缺口

| 类型 | 描述 | 影响范围 | 建议处理 |
| --- | --- | --- | --- |
| 待确认 | 普通用户是否能提交草稿计划 | 权限模型、页面入口 | v1 先按管理员闭环实现 |
| 待确认 | v1 是否支持部分 item 取消勾选后执行 | 详情页交互、PlanItem 生成策略 | 先不纳入 v1 |
| 待确认 | tag_write 的字段白名单与文件格式能力映射 | worker 执行器、预览 diff | 先限定基础文本字段 |
| 待确认 | 失败后的自动回滚粒度 | worker 执行逻辑 | v1 按尽力回滚处理并明确不承诺强一致 |
