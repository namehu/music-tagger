---
doc_type: baseline
product: music-tagger
module: current-system
version: 2026-04-03
source_refs:
  - README.md
  - docs/architecture.md
  - web/prisma/schema.prisma
  - web/server/trpc/root.ts
  - web/app/api/stream/[trackId]/route.ts
  - worker/worker.py
---

# 当前系统基线

## 1. 文档目的

本文档只记录仓库当前已经存在、可以从代码直接确认的系统事实。未来模块 PRD 一律以本文和相关 `module-baseline-*` 文档作为起点，不允许直接复用旧设计稿中的目标态描述替代当前事实。

## 2. 当前产品定位

当前仓库是一个面向自托管场景的本地音乐管理控制台，核心定位已经落在以下两条主线：

- 管理员侧：扫描本地音乐目录、观察 jobs、管理转码缓存、调整后台策略
- 已登录用户侧：浏览曲库、搜索曲目、触发播放、消费全局播放器

当前实现更接近“可播放、可扫描、可观测的音乐库控制台”，还没有完成“可编排整理计划的音乐整理工具”。

## 3. 已实现能力

### 3.1 认证与初始化

- 已接入 `better-auth`
- 已支持通过 `/setup` 创建首个管理员
- 已有 `admin` / `user` 两类角色
- 页面与 tRPC 已具备基础鉴权边界

### 3.2 Jobs 与 Worker

- 后台 job 队列已落在 SQLite `jobs` 表
- Python worker 轮询并原子 claim job
- 已支持 `scan_full` 与 `transcode_prepare`
- 已支持 heartbeat、失败回写、重复转码任务取消、重试和取消接口

### 3.3 曲库与搜索

- `tracks` 表已保存曲目基础技术信息和部分元数据
- 已支持元数据 override 字段
- 曲库页面已支持全文搜索、排序、单曲编辑、批量编辑
- 已落地 FTS 搜索路径与普通 LIKE 降级路径

### 3.4 播放与转码缓存

- 已支持 `original` 原始音频播放
- 已支持 `mp3_192` 转码缓存播放
- `/api/stream/[trackId]` 已支持 `Range`
- 已有播放解析事件和缓存命中/未命中记录
- 已有缓存概览、异常识别、清理与策略配置

### 3.5 Plan Workflow

- 已支持 `rename` / `tag_write` 类型 Plan 的创建
- 已支持 preview、confirm、execute 主链路
- 已支持 `plan_execute` job 与 worker 执行器
- 已支持 Plan 列表页与详情页

当前限制：

- `tag_write` 只覆盖基础文本/数字标签字段
- `tag_write` 当前仅支持常见格式，依赖 worker 环境安装 `mutagen`
- 封面、歌词、move、delete 等动作尚未进入 Plan 执行器

### 3.6 管理台 UI

- 已有 Dashboard shell
- 已有 `/admin`、`/admin/jobs`、`/admin/library`、`/admin/cache`、`/admin/settings`
- 已有 `/admin/plans`、`/admin/plans/[planId]`
- 已有全局播放器与当前播放摘要

## 4. 部分实现能力

- Dashboard 首页：已有数据卡片和摘要，但还不是完整的首页产品模块
- 元数据维护：已支持 override 编辑，但还没有进入完整的 Plan 驱动整理链路
- 当前播放摘要：已有 UI 与状态，但没有扩展为播放模式与队列策略模块

## 5. 未实现能力

以下能力仅存在于历史需求材料或长期规划中，当前代码未形成完整主线：

- 歌单 CRUD 与排序
- 用户级忽略曲目
- 顺序 / 随机 / 单曲循环播放模式
- 扫描增量策略的独立产品化界面
- 面向普通用户的独立产品入口
- 封面、歌词、move、delete 等更高阶 Plan 类型

## 6. 当前 public interfaces

### 6.1 tRPC routers

当前 `appRouter` 暴露：

- `library`
- `jobs`
- `playback`
- `plans`
- `settings`
- `setup`
- `tracks`

这些 router 已经构成前后端的事实契约，未来 PRD 若要修改相关行为，必须在模块文档中明确声明影响范围。

### 6.2 Route Handlers

- `/api/auth/[...all]`
- `/api/trpc/[trpc]`
- `/api/setup/create-admin`
- `/api/stream/[trackId]`

其中 `/api/stream/[trackId]` 是当前唯一必须处理 `Range` 的业务流媒体接口，不能被普通 tRPC 调用替代。

### 6.3 Prisma models

当前 Prisma schema 中的业务核心模型为：

- `AdminSettings`
- `Job`
- `Plan`
- `PlanItem`
- `Track`
- `TranscodeCache`
- `PlaybackResolveEvent`

认证相关模型为：

- `User`
- `Session`
- `Account`
- `Verification`

## 7. 当前系统边界

### 7.1 Web

- Next.js 16 App Router
- tRPC 控制面
- Prisma 直接操作 SQLite
- 负责管理页面、登录、播放 URL 解析与流输出

### 7.2 Worker

- Python 单 worker 主循环
- 负责扫描与转码
- 通过 SQLite 领取和回写 jobs

### 7.3 存储

- SQLite 是当前唯一业务数据库
- `/music` 是源文件读取根目录
- `/cache` 是转码缓存目录

## 8. 当前工程缺口

### 8.1 测试基线缺失

仓库当前没有项目级自动化测试基线，现有代码主要依赖人工验收和运行观察。这会直接影响后续 `Plan`、歌单、忽略、播放模式等高风险模块的开发效率与回归成本。

### 8.2 文档状态混杂

当前标准文档体系已经收口到：

- `README.md` 作为入口与索引
- `docs/architecture.md` 描述当前真实架构
- `docs/baseline/*` 描述当前系统事实
- `docs/prd/*` 描述未来模块目标
- `docs/implementation-plans/*` 描述工程实施计划

仓库根目录仍保留原始需求材料作为历史输入，但它不再作为标准事实源。

### 8.3 模块边界尚未产品化

当前很多能力在代码层已经成形，但文档和需求边界还没有以模块方式被正式命名，例如：

- 播放与转码缓存
- 曲库编辑
- jobs 观测
- 后台策略配置

## 9. 后续文档使用规则

- 当前事实变更时，优先更新本 baseline
- 新功能前，先在 `docs/prd/<module>/` 中定义目标模块
- 代码实现完成后，回写 baseline 与必要的 ADR
