---
doc_type: normalized-brief
product: music-tagger
module: jobs-progress
version: v1
source_refs:
  - README.md
  - docs/architecture.md
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/server/trpc/routers/jobs.ts
  - web/app/(app)/admin/page.tsx
  - web/app/(app)/admin/jobs/page.tsx
  - worker/scanner.py
---

# Normalized Brief

## 1. 产品与模块

- 产品名称：Music Tagger
- 模块名称：jobs-progress
- 业务目标：让管理员在触发 `scan_full` 后看到可解释的扫描计数，而不只看到抽象百分比。

## 2. 角色与权限线索

| 角色 | 当前事实 | 待确认项 | 来源 |
| --- | --- | --- | --- |
| 管理员 | 可触发 `scan_full`，可进入 `/admin` 和 `/admin/jobs` 观察任务 | 无 | `docs/baseline/product-baseline.md` |
| 普通用户 | 不可访问 jobs 管理能力 | 无 | `docs/architecture.md` |

## 3. 页面与从属交互清单

| 名称 | 类型 | 页面职责 | 归属页面/上游入口 | 下游去向 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 管理首页 | 独立页面 | 触发扫描并展示最近扫描状态 | `/admin` | SSE 任务事件流 | `web/app/(app)/admin/page.tsx` |
| Jobs 页 | 独立页面 | 展示扫描、转码、编辑同步任务列表 | `/admin/jobs` | SSE 任务事件流 | `web/app/(app)/admin/jobs/page.tsx` |
| 任务事件流 | Route Handler | 按 jobId 推送最新任务状态 | `/api/admin/jobs/[jobId]/events` | 浏览器 EventSource | 本轮新增 PRD |

## 4. 外部系统与依赖

| 依赖对象 | 依赖类型 | 影响范围 | 已知规则 | 待确认项 |
| --- | --- | --- | --- | --- |
| `jobs` 表 | PostgreSQL 队列 | 任务状态、百分比、结构化进度 | 已有 `progress` 字段 | 新增可空 `progressJson` |
| Python worker | 后台执行 | 扫描时回写进度 | 当前只写百分比 | 需要写入扫描计数 |
| tRPC jobs router | 管理端控制面 | `jobs.get` / `jobs.list` | 仅 HTTP 查询和 mutation | 返回 `progressJson` |
| SSE Route Handler | Web 推送 | 管理端实时观察 | 当前无 SSE | 新增 admin-only 单向事件流 |

## 5. 状态与动作

| 实体 | 状态/动作 | 说明 | 来源 |
| --- | --- | --- | --- |
| scan_full progress | discovering / scanning / cleanup / done | 反映扫描阶段，不显示当前文件名 | 本轮新增 PRD |
| scan counters | total / scanned / processed / skipped / deleted | 给管理员提供可解释计数 | 本轮新增 PRD |
| Job SSE stream | open / event / close | 终态任务发送最后事件后关闭 | 本轮新增 PRD |

## 6. 字段与约束

| 字段 | 约束 | 默认值 | 适用页面 | 来源 |
| --- | --- | --- | --- | --- |
| `Job.progressJson` | 可空 JSON 字符串，运行状态明细 | `null` | `/admin` `/admin/jobs` | 本轮新增 PRD |
| `progressJson.kind` | 固定为 `scan_full` | 无 | 扫描任务 | 本轮新增 PRD |
| `progressJson.total` | 统计完成前为 `null` | `null` | 扫描任务 | 本轮新增 PRD |
| `progressJson.scanned` | 已尝试扫描的音频文件数 | `0` | 扫描任务 | 本轮新增 PRD |
| `progressJson.processed` | 成功写入或更新的音频文件数 | `0` | 扫描任务 | 本轮新增 PRD |
| `progressJson.skipped` | 扫描失败并跳过的音频文件数 | `0` | 扫描任务 | 本轮新增 PRD |
| `progressJson.deleted` | 清理掉的失效曲目数 | `0` | 扫描任务 | 本轮新增 PRD |

## 7. 冲突与缺口

| 类型 | 描述 | 影响范围 | 建议处理 |
| --- | --- | --- | --- |
| 范围边界 | 本轮只做管理员侧扫描进度，不扩展普通用户通知中心 | UI / 权限 | 保持 admin-only |
| 隐私边界 | 不显示当前文件名或完整路径 | SSE payload / UI | 只发送计数 |
| 架构取舍 | 不引入 WebSocket、Redis 或消息队列 | Web / worker | SSE 由 Web 轮询数据库并推给浏览器 |
