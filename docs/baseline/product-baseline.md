---
doc_type: baseline
product: music-tagger
module: current-system
version: 2026-04-05
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
- 已登录用户侧：进入用户音乐区、浏览曲库、搜索曲目、管理个人歌单、消费全局播放器

当前实现更接近“可播放、可扫描、可观测的音乐库控制台”，还没有完成“可编排整理计划的音乐整理工具”。

## 3. 已实现能力

### 3.1 认证与初始化

- 已接入 `better-auth`
- 已支持通过 `/setup` 创建首个管理员
- 已有 `admin` / `user` 两类角色
- 页面与 tRPC 已具备基础鉴权边界
- 登录后默认进入用户区 `/dashboard`
- 管理员从用户区右上角菜单进入 `/admin`

### 3.2 Jobs 与 Worker

- 后台 job 队列已落在 SQLite `jobs` 表
- Python worker 轮询并原子 claim job
- 已支持 `scan_full`、`transcode_prepare` 与 `track_edit_sync`
- 已支持 heartbeat、失败回写、重复转码任务取消、重试和取消接口

### 3.3 曲库与搜索

- `tracks` 表已保存曲目基础技术信息和扫描观察值
- `scan_full` 当前也会提取已有嵌入歌词正文与封面观察资产
- 已新增 `TrackMetadataEdit`、`TrackLyricsEdit`、`TrackCoverEdit` 作为编辑真值层
- 用户区 `/library` 已支持全文搜索、排序与播放
- 管理区 `/admin/library` 已支持全文搜索、排序与单曲编辑
- 列表展示和搜索当前都以最新编辑值为准

### 3.4 播放与转码缓存

- 已支持 `original` 原始音频播放
- 已支持 `mp3_192` 转码缓存播放
- 已支持 `ordered / shuffle / repeat_one` 三种全局播放模式
- `/api/stream/[trackId]` 已支持 `Range`
- 已有播放解析事件和缓存命中/未命中记录
- 前端播放状态已迁到 `zustand` 全局 store
- 已支持把当前浏览器内的队列、曲目、模式、进度、音量持久化到 `localStorage`
- 已支持刷新后重新动态签发播放 URL，并恢复到暂停状态
- 已有缓存概览、异常识别、清理与策略配置

当前限制：

- 当前恢复只覆盖单浏览器，不做数据库持久化或多设备同步
- 刷新恢复后默认暂停，不自动续播

### 3.5 Track Editing Sync

- 已支持管理员在 `/admin/library` 打开单曲编辑面板
- 已支持元数据、歌词、封面先写数据库，再异步写回音频文件
- 已支持 `track_edit_sync` job 与 worker 执行器
- 已支持编辑域级同步状态：`pending / syncing / synced / failed`
- 已支持封面资产通过 `/api/admin/tracks/[trackId]/cover` 落到应用资产目录
- `trackEdits.get` 当前会返回每个编辑域最近一次同步任务摘要，供编辑面板直接展示最近结果与排障建议
- 已支持在没有 edit 真值时，从扫描观察值回显已有歌词和封面

当前限制：

- 当前只开放管理员单曲编辑，不恢复批量编辑
- 歌词与封面写回当前优先支持常见嵌入格式，仍依赖 worker 环境安装 `mutagen`
- 编辑真值与扫描观察值已解耦，`scan_full` 不再覆盖 edit 真值；没有 edit 真值时，编辑面板会回退显示扫描到的歌词与封面

### 3.6 Plan Workflow

- 已保留 `Plan` / `PlanItem`、`plan_execute` worker 执行器与 `/admin/plans` 历史页
- `/admin/plans` 与 `/admin/plans/[planId]` 当前只承担历史记录查看

当前限制：

- Plan 模块当前不再承担日常元数据、歌词、封面编辑主线
- 更高阶的文件整理动作还没有新的主流程定义

### 3.7 Playlist

- 已支持个人歌单 `Playlist` / `PlaylistItem`
- 已支持 `/playlists` 列表页与 `/playlists/[playlistId]` 详情页
- 已支持歌单创建、重命名、删除、加入曲目、移除曲目
- 已支持按歌单保存顺序点播，并复用全局播放器切歌

当前限制：

- 暂不支持拖拽排序
- 暂不支持共享、公开链接或协作歌单

### 3.8 Ignored Tracks

- 已支持双层忽略曲目：
  - 用户侧“我的忽略”
  - 管理侧“全局忽略”
- 已支持用户区 `/ignored-tracks`
- 已支持管理区 `/admin/ignored-tracks`
- 已支持用户区 `/library` 默认过滤 `global + mine`
- 已支持管理区 `/admin/library` 默认过滤 `global`
- 已支持用户区在曲库中加入“我的忽略”
- 已支持管理区在曲库中设置“全局忽略”与批量全局忽略
- 已支持歌单详情页展示忽略来源标记，并允许用户解除自己的忽略

当前限制：

- v1 只支持 track 级忽略，不支持目录规则或扫描期自动规则
- v1 不提供普通曲库内的“显示已忽略曲目”切换器
- 用户不能解除全局忽略，只能由管理员在管理区解除

### 3.9 管理台 UI

- 已有 Dashboard shell
- 已有 `/admin`、`/admin/jobs`、`/admin/library`、`/admin/ignored-tracks`、`/admin/cache`、`/admin/settings`
- 已有 `/admin/plans`、`/admin/plans/[planId]`
- 已有全局播放器与当前播放摘要
- 已有用户区 shell：`/dashboard`、`/library`、`/playlists`、`/ignored-tracks`
- `/admin/jobs` 当前已按“编辑同步”与“扫描/转码/其他任务”分区，编辑同步失败会优先显示结构化结论与建议动作

## 4. 部分实现能力

- Dashboard 首页：用户区 `/dashboard` 已经产品化为“继续收听 + 最近使用”的用户首页，但管理区 `/admin` 仍然是偏运维概览的 partial 模块
- 文件整理动作：Plan 历史仍在，但新的轻量文件整理主流程还没有重新定义
- 当前播放摘要：已支持模式与恢复摘要，但仍未扩展到账号级同步或持久队列模块

## 5. 未实现能力

以下能力仅存在于历史需求材料或长期规划中，当前代码未形成完整主线：

- 扫描增量策略的独立产品化界面
- 更高阶的文件整理动作主流程

## 6. 当前 public interfaces

### 6.1 tRPC routers

当前 `appRouter` 暴露：

- `library`
- `jobs`
- `playback`
- `ignoredTracks`
- `playlists`
- `plans`
- `settings`
- `setup`
- `trackEdits`
- `tracks`

这些 router 已经构成前后端的事实契约，未来 PRD 若要修改相关行为，必须在模块文档中明确声明影响范围。

### 6.2 Route Handlers

- `/api/auth/[...all]`
- `/api/trpc/[trpc]`
- `/api/setup/create-admin`
- `/api/admin/tracks/[trackId]/cover`
- `/api/stream/[trackId]`

其中 `/api/stream/[trackId]` 是当前唯一必须处理 `Range` 的业务流媒体接口，不能被普通 tRPC 调用替代。

### 6.3 Prisma models

当前 Prisma schema 中的业务核心模型为：

- `AdminSettings`
- `Job`
- `Plan`
- `PlanItem`
- `Playlist`
- `PlaylistItem`
- `TrackMetadataEdit`
- `TrackLyricsEdit`
- `TrackCoverEdit`
- `UserIgnoredTrack`
- `GlobalIgnoredTrack`
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
- 负责用户页面、管理页面、登录、播放 URL 解析与流输出

### 7.2 Worker

- Python 单 worker 主循环
- 负责扫描与转码
- 通过 SQLite 领取和回写 jobs

### 7.3 存储

- SQLite 是当前唯一业务数据库
- `/music` 是源文件读取根目录
- `/cache` 是转码缓存目录

## 8. 当前工程缺口

### 8.1 测试基线仍然偏弱

仓库已开始引入最小自动化校验，但仍没有完整的项目级测试体系。后续 `Plan`、忽略曲目、播放模式等高风险模块依然需要更系统的回归基线。

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
- 多设备播放会话同步

## 9. 后续文档使用规则

- 当前事实变更时，优先更新本 baseline
- 新功能前，先在 `docs/prd/<module>/` 中定义目标模块
- 代码实现完成后，回写 baseline 与必要的 ADR
