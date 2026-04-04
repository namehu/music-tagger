# AGENT Guide

本文件用于帮助新会话中的开发 Agent 或协作者快速进入项目，并按当前仓库约定开展工作。

## 1. 先看什么

新会话进入仓库后，默认按这个顺序建立上下文：

1. `README.md`
2. `docs/architecture.md`
3. `docs/baseline/product-baseline.md`
4. `docs/baseline/module-baseline-current-capabilities.md`
5. `docs/prd/README.md`
6. 目标模块的 `docs/prd/<module>/`
7. 对应代码文件

不要跳过 baseline 直接从旧需求稿或印象开始实现。

## 2. 事实源顺序

当文档与代码不一致时，按以下优先级判断：

1. 代码、Prisma migrations、worker 行为
2. `docs/architecture.md`
3. `docs/baseline/*`
4. `docs/prd/<module>/*`
5. `docs/implementation-plans/*`
6. `docs/archive/raw-requirements/*`

说明：

- `docs/archive/raw-requirements/*` 只是历史输入，不是当前事实源。
- 已删除的 `docs/superpowers/*` 不再是有效上下文。

## 3. 当前项目状态

当前仓库不是从 0 到 1 的空白需求阶段，而是已经有运行中的基线。

已实现主线：

- `/setup` 首个管理员初始化
- better-auth 登录与基础角色控制
- SQLite `jobs` 队列 + Python worker
- `scan_full`
- 曲库浏览、全文搜索、metadata override 编辑
- 原始播放与 `mp3_192` 转码缓存播放
- 缓存治理与后台策略配置
- `rename` / 基础 `tag_write` 的 Plan preview / confirm / execute

当前未完成主线：

- 歌单
- 用户级忽略曲目
- 播放模式
- 更高阶 Plan 类型：封面、歌词、move、delete

## 4. 代码结构速览

- `web/`
  - Next.js 16 App Router
  - tRPC 控制面
  - Prisma schema / migrations
  - 管理页面与流媒体 Route Handler
- `worker/`
  - Python worker 主循环
  - job claim / heartbeat / done / failed
  - scanner / transcoder / plan executor
- `docs/`
  - `architecture.md`：当前架构
  - `baseline/`：当前事实
  - `prd/`：未来模块规格
  - `implementation-plans/`：工程计划
  - `archive/`：历史输入

## 5. 默认开发流程

### 5.1 行为变更、新模块、跨层改动

满足以下任一条件时，先走文档，再写代码：

- 新增模块
- 改变页面行为边界
- 新增或修改 Prisma model
- 新增或修改 tRPC router contract
- 新增或修改 worker job contract
- 新增顶层路由

标准流程：

1. 确认 `docs/baseline/*` 仍然准确
2. 新建或更新 `docs/prd/<module>/`
3. 必要时补 `docs/implementation-plans/<module>-implementation-plan.md`
4. 再进入代码实现
5. 实现完成后回写 baseline / PRD / ADR

### 5.2 纯 bug 修复或非语义微调

以下情况通常可以直接改代码：

- 视觉样式修复
- 已有行为内的 bug 修复
- 文案修复
- 不改变接口边界的重构

但如果修着修着发现已经影响行为边界，要及时回到 PRD 流程。

## 6. 实施时的硬规则

- 搜索文件优先用 `rg`。
- 不要把 archive 文档或历史草稿当成当前实现事实。
- 不要新增第二份“架构设计稿”或“大而全需求稿”。
- 新功能优先沉淀到模块级 PRD，而不是往 README 里塞需求。
- `/api/stream/[trackId]` 是当前唯一必须保留的流媒体例外接口，不要随意改成普通 tRPC。
- Plan 模块当前只把 `rename` 和基础 `tag_write` 视为已落地能力。
- `/admin/library` 的 override 编辑仍然存在；任何 metadata 相关改动都要考虑它与 Plan 的边界。

## 7. 常用入口

代码入口：

- `web/server/trpc/root.ts`
- `web/prisma/schema.prisma`
- `web/app/(app)/admin/*`
- `worker/worker.py`
- `worker/jobs.py`

文档入口：

- `docs/prd/README.md`
- `docs/prd/plan-workflow/summary.md`
- `docs/archive/README.md`

## 8. 验证命令

常用命令：

```bash
pnpm install
pnpm dev:web
pnpm lint:web
pnpm build:web
pnpm prisma:migrate
pnpm -C web exec prisma generate
python3 -m py_compile worker/*.py
```

如涉及 worker 依赖，注意：

```bash
python3 -m pip install -r worker/requirements.txt
```

## 9. 完成任务前的检查清单

- 代码是否和当前 PRD / baseline 一致
- 是否误把历史需求稿当成当前事实
- 是否新增了 router / schema / worker contract 但没写回文档
- 是否说明了未验证项或风险
- 是否给出最小可复现的验证结果

## 10. 当前推荐起点

如果用户没有明确指定模块，当前默认优先级是：

1. `playlist`
2. `ignored-tracks`
3. `playback-modes`
4. `library-dashboard`

开始新模块前，先看：

- `docs/baseline/product-baseline.md`
- `docs/baseline/module-baseline-current-capabilities.md`
- `docs/prd/_template/README.md`
