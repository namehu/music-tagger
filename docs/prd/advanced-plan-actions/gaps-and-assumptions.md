---
doc_type: gaps-and-assumptions
product: music-tagger
module: advanced-plan-actions
version: v0.1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/prd/advanced-plan-actions/summary.md
  - docs/archive/raw-requirements/2026-04-01-local-music-manager-requirements.md
---

# Gaps And Assumptions

## 未决问题

| 编号 | 问题 | 影响范围 | 当前状态 | 处理建议 |
| --- | --- | --- | --- | --- |
| GAP-001 | `move` 的目标目录模板是否只允许相对 `MUSIC_ROOT`，还是允许绝对路径 | preview 校验、worker 执行边界 | 待确认 | v1 先只允许 `MUSIC_ROOT` 内相对模板 |
| GAP-002 | `move` 是否需要支持“同时改目录和文件名” | create 表单、preview、worker 执行 | 待确认 | v1 先只移动目录，不改文件名 |
| GAP-003 | `delete` 是软删除、移入回收站，还是直接物理删除 | 后续 `delete` 动作设计 | 待确认 | 不纳入本轮实现 |
| GAP-004 | 封面与歌词写回采用嵌入标签、sidecar 文件，还是双写策略 | 后续 `cover_write` / `lyrics_write` 动作设计 | 待确认 | 不纳入本轮实现 |

## 冲突点

| 编号 | 冲突描述 | 来源 A | 来源 B | 影响范围 |
| --- | --- | --- | --- | --- |
| CONFLICT-001 | 原始材料一次性列出 `rename/move/delete/tag-write/cover/lyrics`，而当前模块只先推进 `move` | 原始需求材料 | 当前迭代范围 | 模块拆分边界 |

## 已采用假设

| 编号 | 假设内容 | 原因 | 影响页面 | 是否可回退 |
| --- | --- | --- | --- | --- |
| ASSUME-001 | `advanced-plan-actions` 不新增顶层路由，只扩展 `/admin/plans` 与 `/admin/plans/[planId]` | 当前 Plan 入口已足够承载高风险动作 | `admin-plans-page.md`，`admin-plan-detail-page.md` | 是 |
| ASSUME-002 | `move` v1 只做“改目录、不改文件名” | 先把风险最低的移动模型锁定，避免和 `rename` 混合 | 两个页面文档 | 是 |
| ASSUME-003 | `move` v1 冲突策略固定为阻断，不允许覆盖已有文件 | 当前仓库还没有完善的强一致回滚与覆盖审计能力 | `admin-plan-detail-page.md`，worker 执行器 | 否 |
| ASSUME-004 | `move` 仍然以 track 为最小执行单位，不引入目录级 PlanItem | 可复用当前 `PlanItem` 模型与详情页列表结构 | `admin-plan-detail-page.md` | 是 |

## 待补充材料

| 编号 | 材料名称 | 用途 | 优先级 |
| --- | --- | --- | --- |
| NEED-001 | `move` 模板变量白名单与示例 | 锁定前端表单和 preview 渲染规则 | 高 |
| NEED-002 | 文件移动失败后的回滚与重试矩阵 | 锁定 worker 的错误语义与 jobs 排障文案 | 中 |
