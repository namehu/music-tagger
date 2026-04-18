---
doc_type: gaps-and-assumptions
product: music-tagger
module: jobs-progress
version: v1
source_refs:
  - docs/architecture.md
  - docs/baseline/product-baseline.md
  - worker/scanner.py
  - web/server/trpc/routers/jobs.ts
---

# Gaps and Assumptions

## 已确认假设

| 编号 | 假设 | 处理 |
| --- | --- | --- |
| A-001 | 只需要管理员侧实时反馈 | SSE route 使用管理员鉴权 |
| A-002 | 只显示计数，不显示文件名或完整路径 | `progressJson` 不包含路径字段 |
| A-003 | 不引入 WebSocket、Redis 或消息队列 | Web 通过数据库轮询生成 SSE |
| A-004 | 兼容现有百分比进度 | 保留 `jobs.progress` |

## 缺口

| 编号 | 缺口 | 处理 |
| --- | --- | --- |
| G-001 | 旧任务没有 `progressJson` | UI 回退显示百分比 |
| G-002 | discovering 阶段无法知道 total | `total` 使用 `null` |
| G-003 | 多页面同时观察同一任务会建立多条 SSE 连接 | v1 接受，后续如有压力再做共享状态 |
