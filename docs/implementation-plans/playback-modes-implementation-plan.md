# Playback Modes Implementation Plan

## 背景与目标

- 把前端播放状态从旧的 provider 内局部 state 迁到 `zustand`。
- 为全局播放器补齐 `ordered / shuffle / repeat_one` 三种模式。
- 让当前浏览器在刷新后恢复到“可继续播放但默认暂停”的状态。

## 影响范围

- 页面：`/dashboard`、`/library`、`/playlists/[playlistId]`
- 组件：`GlobalPlayer`、`CurrentPlaybackSummary`
- 状态层：新增 `web/store/playback-store.ts`
- 运行时：新增 `web/components/playback/playback-runtime.tsx`
- 持久化：浏览器 `localStorage`

## 任务拆分顺序

1. 抽离播放纯函数与模式决策 helper。
2. 新建 `zustand` 播放 store，并接入 computed middleware。
3. 新建 `PlaybackRuntime`，承接 resolve、轮询和 `audio` 事件。
4. 移除 `GlobalPlaybackProvider`，改造全局播放器和当前播放摘要。
5. 改造 `/library` 与 `/playlists/[playlistId]` 的 queue 注入和点播逻辑。
6. 补测试、PRD、架构文档和 baseline / README 回写。

## 数据与接口变更

- 不新增 Prisma model
- 不新增 tRPC router
- 继续复用：
  - `playback.resolve`
  - `playback.getPreparationStatus`
  - `/api/stream/[trackId]`
- 新增前端公共类型：
  - `PlaybackMode`
  - `PlaybackHydrationStatus`
  - `QueueReplaceReason`

## 测试计划

- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`
- 最小自动化测试：
  - 顺序模式切歌
  - 随机模式历史回退
  - 单曲循环自然结束重播
  - 恢复锁阻止被动 queue 覆盖
- 人工验证：
  - `/library` 点播后切模式
  - `/playlists/[playlistId]` 点播后切模式
  - 刷新后恢复队列、模式与进度

## 回写与验收

- 新增 `docs/prd/playback-modes/*`
- 新增 `docs/architecture/playback-runtime-and-modes.md`
- 更新 `docs/architecture.md`
- 更新 `docs/baseline/*`
- 更新 `README.md`
