# Playback Queue Implementation Plan

## 背景与目标

- 在当前双会话播放器基础上，为 `user` 正式会话补上“可见、可编辑、可恢复”的当前队列体验。
- v1 只实现：
  - 队列抽屉
  - 当前曲目高亮
  - Up Next 展示
  - 点击任意项立即播放
  - 移除单首
  - 清空整个 user 队列
- 明确不在本轮实现：
  - 拖拽排序
  - 下一首播放
  - 加入队列尾部
  - admin 试听队列产品化

## 影响范围

- 页面：`/dashboard`、`/library`、`/playlists/[playlistId]`
- 组件：`web/components/playback/global-player.tsx`
- 状态层：`web/store/playback-store.ts`
- 运行时：`web/components/playback/playback-runtime.tsx`
- 可能影响的辅助组件：`web/components/playback/current-playback-summary.tsx`

## 任务拆分顺序

1. 为 playback store 增加 user 会话队列编辑动作与 computed selector。
2. 在底部播放器增加用户侧队列抽屉与 Up Next 布局。
3. 接通“点击队列项直接播放”与“移除单首 / 清空队列”动作。
4. 明确处理“移除当前曲目”后的切歌或停止语义。
5. 确保 localStorage 恢复仍能保留最新编辑后的用户队列。
6. 补测试、PRD 和 baseline / architecture / README 回写。

## 数据与接口变更

- 不新增 Prisma model
- 不新增 tRPC router
- 不新增 worker / job contract
- 继续复用：
  - `playback.resolve`
  - `playback.getPreparationStatus`
  - `/api/stream/[trackId]`
- 新增前端 store 动作与 selector，建议至少包含：
  - `removeQueueItem(sessionKind, trackId)`
  - `clearQueue(sessionKind)`
  - `nextTrack`
  - `upNextItems`

## 测试计划

- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`
- 最小自动化测试：
  - 点击队列项立即播放
  - 移除非当前曲目只更新队列
  - 移除当前曲目后按当前模式切到下一首或停止
  - 清空队列后停止用户正式播放
  - 队列编辑后刷新页面仍能恢复
- 人工验证：
  - `/library` 点播后打开队列抽屉
  - `/playlists/[playlistId]` 点播后查看 Up Next
  - `/dashboard` 最近播放切入后查看和清空队列

## 回写与验收

- 新增 `docs/prd/playback-queue/*`
- 更新 `docs/prd/README.md`
- 更新 `docs/architecture.md`
- 更新 `docs/baseline/*`
- 更新 `README.md`
