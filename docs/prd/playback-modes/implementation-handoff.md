---
doc_type: implementation-handoff
product: music-tagger
module: playback-modes
version: v1
source_refs:
  - docs/prd/playback-modes/summary.md
  - web/store/playback-store.ts
  - web/components/playback/playback-runtime.tsx
---

# 实施交接

- 状态重构：
  - 删除 `GlobalPlaybackProvider`
  - 新增 `web/store/playback-store.ts`
  - 新增 `web/components/playback/playback-runtime.tsx`
- UI 调整：
  - `GlobalPlayer` 增加模式切换
  - `CurrentPlaybackSummary` 增加模式 badge 与恢复信息
- 页面接入：
  - `/library` 改为用 store 注入 queue 与点播
  - `/playlists/[playlistId]` 改为用 store 注入 queue 与点播
- 持久化策略：
  - `localStorage` 只保留 queue、当前曲目、模式、进度、音量等可重建状态
  - 播放 URL 与 token 必须通过 `playback.resolve` 重新获取
