---
doc_type: baseline
product: music-tagger
module: current-capability-matrix
version: 2026-04-05
source_refs:
  - web/app/(app)/admin/page.tsx
  - web/app/(app)/admin/jobs/page.tsx
  - web/app/(app)/admin/library/page.tsx
  - web/store/playback-store.ts
  - web/components/playback/playback-runtime.tsx
  - web/server/trpc/routers/library.ts
  - web/server/trpc/routers/jobs.ts
  - web/server/trpc/routers/playback.ts
  - web/server/trpc/routers/tracks.ts
---

# 当前能力矩阵

## 模块状态定义

- `implemented`：代码闭环已存在
- `partial`：有部分能力，但未形成完整模块
- `planned`：仅存在于历史需求材料或后续规划

## 模块矩阵

| 模块 | 状态 | 当前入口 | 主要接口/模型 | 备注 |
| --- | --- | --- | --- | --- |
| Setup / Auth | implemented | `/setup` `/sign-in` | `setup` router, better-auth models | 首个管理员初始化已落地 |
| Jobs Queue | implemented | `/admin` `/admin/jobs` | `Job`, `jobs` router, `worker.py` | 已支持 scan 与转码任务 |
| User Dashboard | implemented | `/dashboard` | `library.dashboard`, `playback` components, `PlaybackResolveEvent` | 已支持继续收听、最近播放、最近更新歌单和最近更新曲目 |
| Library Browse | implemented | `/library` `/admin/library` | `tracks.list`, `library.stats`, `Track` | 用户区与管理区共享浏览/播放层 |
| Metadata Override Editing | partial | `/admin/library` | `tracks.updateMetadata`, `Track` override fields | 仅支持数据库 override，不写回源文件 |
| Playback Resolve | implemented | 全局播放器 | `playback.resolve`, `playback.getPreparationStatus`, `/api/stream/[trackId]` | 已支持原始与 `mp3_192`，并支持刷新后重新动态签发 |
| Transcode Cache Ops | implemented | `/admin/cache` `/admin/settings` | `TranscodeCache`, `library.cacheOverview`, settings router | 已支持容量治理与失败分类 |
| Dashboard Overview | partial | `/admin` | `library`, `jobs`, `tracks` 聚合查询 | 还不是独立定义的首页模块 |
| Playback Modes | implemented | 全局播放器 | `playback-store`, `PlaybackRuntime`, `playback.resolve` | 已支持顺序、随机、单曲循环和 localStorage 恢复 |
| Plan Workflow | partial | `/admin/plans` `/admin/plans/[planId]` | `Plan` / `PlanItem`, `plans` router, `plan_execute` job | 当前支持 `rename` 与基础 `tag_write` 的 preview / confirm / execute，其他类型未落地 |
| Playlist | implemented | `/playlists` `/playlists/[playlistId]` | `Playlist` / `PlaylistItem`, `playlists` router | 已支持个人歌单 CRUD、加歌、移歌与顺序点播 |
| Ignored Tracks | implemented | `/ignored-tracks` `/admin/ignored-tracks` | `UserIgnoredTrack` / `GlobalIgnoredTrack`, `ignoredTracks` router | 已支持双层忽略、默认过滤与歌单忽略标记 |

## 当前事实源与未来目标的分界

以下内容在当前代码中是事实：

- Web 端以 tRPC 为业务控制面
- `/api/stream/[trackId]` 作为流媒体例外接口
- worker 通过 SQLite jobs 队列表领取任务
- 曲库编辑目前只修改数据库 override 字段
- 已登录用户默认进入用户区
- 歌单已拥有独立数据模型与页面入口
- 忽略曲目已拥有独立数据模型、用户页、管理页与过滤规则
- 播放模式已拥有独立 store、runtime、底部控制入口与浏览器内恢复能力
- Plan 模块已具备 `rename` / `tag_write` 的 preview / confirm / execute 闭环

以下内容不能被当作当前事实：

- 封面、歌词、move、delete 等更高阶 Plan 执行能力
- 多设备播放会话同步

## 后续 PRD 编写要求

任何新模块 PRD 至少要引用：

- 本文
- `docs/baseline/product-baseline.md`
- 对应相关代码文件

并在正文中明确回答：

- 它替换或扩展的是哪个现有模块
- 是否会影响现有 tRPC router、Prisma model、worker job contract
- 是否会改变现有页面入口或权限边界
