---
doc_type: gaps-and-assumptions
product: music-tagger
module: plan-workflow
version: v0.1
source_refs:
  - 本地音乐管理工具-需求与架构设计 (1).md
  - docs/superpowers/specs/2026-04-01-local-music-manager-design.md
  - docs/baseline/product-baseline.md
---

# Gaps And Assumptions

## 未决问题

| 编号 | 问题 | 影响范围 | 当前状态 | 处理建议 |
| --- | --- | --- | --- | --- |
| GAP-001 | 普通用户是否允许创建或提交 draft plan | 权限模型、页面入口、createdBy 语义 | 待确认 | v1 先按管理员独占实现 |
| GAP-002 | `tag_write` v1 允许写回哪些字段 | preview diff、worker 执行器、错误校验 | 待确认 | 先限定标题、艺人、专辑、专辑艺人、曲序、碟号、年份、流派 |
| GAP-003 | 单个 plan 是否允许用户手动排除部分 item 后再执行 | 详情页交互、PlanItem 模型 | 待确认 | v1 不做 item 级勾选排除 |
| GAP-004 | `move / delete / cover / lyrics` 是否在同一模块 v1 一起进入 | scope、params、worker 能力边界 | 待确认 | v1 仅实现 `rename / tag_write` |

## 冲突点

| 编号 | 冲突描述 | 来源 A | 来源 B | 影响范围 |
| --- | --- | --- | --- | --- |
| CONFLICT-001 | 需求稿提出多种整理动作，设计稿的里程碑描述则聚焦 `rename / tag_write` | 需求稿 | 设计稿 | v1 范围边界 |

## 已采用假设

| 编号 | 假设内容 | 原因 | 影响页面 | 是否可回退 |
| --- | --- | --- | --- | --- |
| ASSUME-001 | v1 仅管理员可见且可操作 Plan 模块 | 当前代码的管理台权限模型最简单明确 | `admin-plans-page.md`，`admin-plan-detail-page.md` | 是 |
| ASSUME-002 | confirm 后禁止直接改动 `scope` 与 `params` | 设计稿明确要求冻结 | `admin-plan-detail-page.md` | 否 |
| ASSUME-003 | 执行失败采用尽力回滚，不承诺强一致 | 设计稿已有明确边界 | `admin-plan-detail-page.md`，worker 执行器 | 否 |

## 待补充材料

| 编号 | 材料名称 | 用途 | 优先级 |
| --- | --- | --- | --- |
| NEED-001 | 媒体标签写回字段与格式能力表 | 收敛 `tag_write` preview 与执行规则 | 高 |
| NEED-002 | 计划项量级上限与分页策略 | 决定详情页是否需要服务端分页 | 中 |
