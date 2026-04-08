---
doc_type: product-prd
product: music-tagger
module: admin-jobs
page_name: 后台任务页
route: /admin/jobs
version: v1
source_refs:
  - web/app/(app)/admin/jobs/page.tsx
  - web/server/trpc/routers/jobs.ts
  - docs/baseline/product-baseline.md
---

# Music Tagger 后台任务页 PRD

## 1. 文档定位

本文档描述 `/admin/jobs` 的现状单页 PRD。它是后台任务与排障页，不是通用日志平台。

## 2. 产品背景

当前系统的后台任务统一落在 SQLite `jobs` 表中，已覆盖 `scan_full`、`transcode_prepare`、`track_edit_sync` 和 `plan_execute`。任务页负责查看最近 50 条任务并提供最小重试入口。

## 3. 产品目标

- 集中展示最近任务及其状态。
- 优先突出编辑同步失败与转码失败，方便排障。
- 提供触发扫描和重试失败任务的轻量动作。

## 4. 用户与权限

- 目标用户：管理员。
- 权限边界：普通用户不可作为正常路径访问。
- 未登录或权限不足：页面会给出去登录的明确引导。

## 5. 页面定位

这是一个“任务观察 + 轻量排障页”。

- 核心模块：任务概览卡、编辑同步区、其他任务区。
- 辅助动作：触发扫描、重试单条任务、批量重试失败转码。

## 6. 页面结构

- 顶部标题区：标题、最近 50 条任务说明、触发 `scan_full` 按钮。
- 状态卡区：运行中、失败任务、编辑同步失败、转码失败。
- 编辑同步卡片：优先显示单曲编辑落盘结果与建议动作。
- 其他任务卡片：扫描、转码、Plan 等任务列表与错误摘要。

## 7. 页面字段定义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| 任务类型 | enum | 例如 `scan_full`、`transcode_prepare`、`track_edit_sync` |
| 任务状态 | enum | `pending / running / done / failed / cancelled` |
| progress | number | 进度百分比 |
| errorJson / 结构化错误摘要 | string/object | 排障信息 |
| payload scope | string | 任务作用范围说明 |

## 8. 关键交互

1. 页面加载最近任务列表。
2. 管理员可直接触发 `scan_full`。
3. 若存在活动任务，页面每 2 秒自动刷新。
4. 对失败任务可执行单条重试；对失败转码可执行批量重试。
5. 未登录或无权限时，页面显示引导卡片并允许跳转登录。

## 9. 页面状态

- 正常态：展示任务概览与列表。
- 活跃态：有 pending/running 任务时自动轮询。
- 鉴权失败态：显示“需要登录”或“权限不足”说明。
- 空态：当前实现仍以最近任务列表为主，不单独建设空白运营页。

## 10. 原型与 UI 设计指导

- 视觉优先级应是“失败任务 > 运行中 > 已完成”。
- 编辑同步区应独立于其他任务，强调这会直接影响管理员单曲编辑落盘。
- 原始错误 JSON 可以次级展示，先给结构化结论。

## 11. 给 LLM 的输出约束

- 不要把页面做成通用日志检索工具。
- 不要把任务历史无限延展；当前语义是“最近 50 条”。
- 保留“先给结论，再展开原始错误”的排障表达。

## 12. 事实依据

- 页面当前展示最近 50 条任务。
- 已实现 `retry`、`retryFailedTranscodes` 和 `enqueueScanFull`。
- 鉴权失败时会展示前往 `/sign-in?next=/admin/jobs` 的引导。
