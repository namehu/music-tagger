---
doc_type: product-prd
product: music-tagger
module: admin-plans
page_name: 文件整理执行历史页
route: /admin/plans
version: v1
source_refs:
  - web/app/(app)/admin/plans/page.tsx
  - web/server/trpc/routers/plans.ts
  - docs/baseline/product-baseline.md
---

# Music Tagger 文件整理执行历史页 PRD

## 1. 文档定位

本文档描述 `/admin/plans` 的当前真实边界。该页目前是执行历史查看页，而不是新的文件整理创建工作台。

## 2. 产品背景

系统仍保留 `Plan`、`PlanItem` 与 `plan_execute` 执行器，但新的整理主流程尚未重新产品化。因此当前页面只承担历史回看职责。

## 3. 产品目标

- 回看已经提交过的执行记录。
- 支持按状态和关键字过滤历史。
- 为进入详情页继续查看结果提供入口。

## 4. 用户与权限

- 目标用户：管理员。
- 权限边界：普通用户不可访问。
- 当前定位：只读历史页，不承担日常编辑入口。

## 5. 页面定位

这是一个“Plan 历史列表页”。

- 不负责创建新 Plan。
- 不负责预览、确认或执行新的整理任务。

## 6. 页面结构

- 页面标题区：标题与历史页定位说明。
- 筛选卡片：关键字输入、状态下拉、刷新按钮。
- 记录列表表格：
  - planId
  - 类型
  - 范围摘要
  - 预览摘要
  - 状态
  - 创建人
  - 更新时间

## 7. 页面字段定义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| q | string | 搜索 planId、创建人、范围摘要 |
| status | enum | `all / draft / confirmed / running / done / failed / cancelled` |
| previewSummary | object | 执行项数量、警告数量 |
| scopeSummary | string | 本次记录作用范围摘要 |

## 8. 关键交互

1. 页面加载最近执行记录。
2. 管理员可按状态过滤。
3. 管理员可输入关键字搜索历史。
4. 点击任意记录行进入 `/admin/plans/[planId]` 查看详情。
5. 点击“刷新”重新拉取列表。

## 9. 页面状态

- 加载中：表头保留，描述区域显示加载中。
- 正常态：展示历史记录表格。
- 空态：提示“还没有执行记录”。
- 失败态：toast 提示执行历史加载失败。

## 10. 原型与 UI 设计指导

- 页面应明显呈现“历史查看”的语义，而不是“创建计划”的语义。
- 列表行可点击进入详情，但不应出现误导性的主操作按钮。
- 状态 Badge 需要清晰区分失败、运行中、完成。

## 11. 给 LLM 的输出约束

- 不要在本页新增“新建 Plan”主流程。
- 不要把页面扩写成文件整理工作台。
- 必须保留当前事实：这里现在主要负责历史回看。

## 12. 事实依据

- 页面说明文案明确写着“`/admin/library` 负责发起整理动作，这里只回看已经提交过的执行记录”。
- 当前页面只调用 `plans.list`。
- 基线文档已明确 `/admin/plans` 当前只承担历史记录查看。
