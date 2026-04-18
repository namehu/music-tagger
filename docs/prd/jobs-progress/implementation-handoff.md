---
doc_type: implementation-handoff
product: music-tagger
module: jobs-progress
version: v1
source_refs:
  - docs/prd/jobs-progress/summary.md
  - docs/prd/jobs-progress/admin-page.md
  - docs/prd/jobs-progress/admin-jobs-page.md
---

# Implementation Handoff

## 交付目标

为 `scan_full` 增加结构化扫描计数，并在管理员页面通过 SSE 展示。

## 关键约束

- `jobs.progress` 继续保留。
- `jobs.progressJson` 可空，旧任务兼容。
- 不在事件或 UI 中暴露当前文件名、完整路径。
- SSE route 必须管理员鉴权。
