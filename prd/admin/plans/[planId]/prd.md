---
doc_type: product-prd
product: music-tagger
module: admin-plan-detail
page_name: 文件整理执行详情页
route: /admin/plans/[planId]
version: v1
source_refs:
  - web/app/(app)/admin/plans/[planId]/page.tsx
  - web/server/trpc/routers/plans.ts
  - docs/baseline/product-baseline.md
---

# Music Tagger 文件整理执行详情页 PRD

## 1. 文档定位

本文档描述 `/admin/plans/[planId]` 的当前详情页。它用于回看某条历史执行记录的参数、结果和逐项状态，不是新的执行控制台。

## 2. 产品背景

当前 Plan 能力保留了历史查看链路。详情页需要帮助管理员理解一条历史记录做了什么、成功了多少、失败在哪里。

## 3. 产品目标

- 展示某条执行记录的概要信息。
- 展示预览摘要、警告和执行结果计数。
- 展示每个执行项的具体变更与失败原因。

## 4. 用户与权限

- 目标用户：管理员。
- 权限边界：普通用户不可访问。
- 当前限制：仅支持查看，不提供重新编辑计划内容。

## 5. 页面定位

这是一个“执行结果详情页”。

- 强调回看、理解和排障。
- 不承担创建、确认或取消新计划。

## 6. 页面结构

- 顶部标题区：planId、状态 Badge、类型与范围摘要。
- 摘要卡：
  - 类型、范围、参数、创建人、时间、关联 Job
- 预览与结果卡：
  - 源曲目数、执行项数、警告/阻断数
  - 执行项状态计数
  - 全局警告与错误消息
- 执行项表格：
  - 曲目
  - 类型
  - 变更内容
  - 警告/错误
  - 状态
  - 更新时间

## 7. 页面字段定义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| planId | route param | 当前执行记录 ID |
| params | object | 根据 plan 类型显示模板或字段写回信息 |
| previewSummary | object | 源曲目数、执行项数、warning/blocking 数 |
| executionJob | object | 关联后台任务 ID 与状态 |
| itemStatus filter | enum | `all / pending / running / done / failed / skipped` |

## 8. 关键交互

1. 页面根据 `planId` 读取记录详情与执行项。
2. 当计划仍在 `running` 时，详情与执行项按轮询自动刷新。
3. 用户可按执行项状态过滤当前表格。
4. 页面提供跳往 `/admin/jobs` 的入口以继续排障。

## 9. 页面状态

- 加载中：标题和卡片显示加载态文案。
- 运行中：定时刷新，状态 Badge 显示 running。
- 正常态：展示摘要、警告和执行项明细。
- 空态：在当前筛选条件下没有执行项时显示空提示。
- 错误态：toast 提示详情或执行项加载失败。

## 10. 原型与 UI 设计指导

- 页面应偏“审计/结果查看”而不是“流程向导”。
- 执行项表格中，“变更内容”需要保留足够宽度展示路径或 tag diff。
- 全局警告和错误信息需要与普通统计卡明显区分。

## 11. 给 LLM 的输出约束

- 不要增加编辑参数、再次执行或取消计划的主按钮。
- 不要把页面重写成多步骤创建向导。
- 必须保留“当前主要用于回看历史记录”的定位。

## 12. 事实依据

- 页面当前只调用 `plans.get` 和 `plans.items`。
- `running` 状态下会自动轮询刷新。
- 详情页文案明确写着“这里回看这条文件整理记录当时的参数、范围和执行状态”。
