# Library Dashboard Implementation Plan

## 背景与目标

- 把当前轻量 `/dashboard` 升级为真实可用的用户首页。
- 优先承载“继续收听”和“最近使用”，不做管理分析页。

## 影响范围

- 页面：`/dashboard`
- tRPC：新增 `library.dashboard`
- Prisma：复用 `PlaybackResolveEvent`、`Playlist`、`Track`
- 前端状态：复用现有 playback store

## 任务拆分顺序

1. 为最近播放去重逻辑补纯函数和最小自动化测试。
2. 在 `library` router 下新增 `dashboard` 聚合查询。
3. 重构 `/dashboard` 页面，接入继续收听、最近播放、最近更新歌单、最近更新曲目。
4. 把首页最近播放接入全局播放器。
5. 回写 PRD、baseline、README。

## 数据与接口变更

- 新增 query：
  - `library.dashboard`
- 返回：
  - `stats`
  - `recentPlays`
  - `recentPlaylists`
  - `recentTracks`
- 不新增 Prisma model
- 不新增 worker contract

## 测试计划

- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`
- 最小自动化测试：
  - 最近播放去重逻辑
  - 首页最近播放 source key 相关文案 helper
- 人工验证：
  - `/dashboard` 显示最近播放、最近更新歌单、最近更新曲目
  - 最近播放点击后可正常进入全局播放器
  - 最近更新歌单与最近更新曲目跳转正确

## 回写与验收

- 新增 `docs/prd/library-dashboard/*`
- 新增 `docs/implementation-plans/library-dashboard-implementation-plan.md`
- 更新 `docs/baseline/*`
- 更新 `README.md`
