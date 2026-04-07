---
doc_type: normalized-brief
product: music-tagger
module: playback-modes
version: v1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/store/playback-store.ts
  - web/components/playback/playback-runtime.tsx
---

# 标准化需求摘要

- 模块目标：把全局播放器状态从组件内局部 state 迁到 `zustand`，并补齐顺序、随机、单曲循环三种播放模式。
- 目标用户：所有已登录用户；管理员与普通用户共用同一套全局播放器规则。
- v1 范围：
  - `ordered / shuffle / repeat_one`
  - `zustand` 播放 store
  - `PlaybackRuntime`
  - `localStorage` 恢复当前浏览器内的队列、曲目、模式、进度和音量
  - `/library`
  - `/playlists/[playlistId]`
  - `/dashboard` 当前播放摘要
- v1 不包含：
  - 数据库持久化
  - 自动续播
  - 组合模式
  - 歌单拖拽排序
