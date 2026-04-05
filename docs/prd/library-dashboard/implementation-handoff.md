---
doc_type: implementation-handoff
product: music-tagger
module: library-dashboard
version: v1
source_refs:
  - docs/prd/library-dashboard/summary.md
  - web/server/trpc/routers/library.ts
  - web/app/(app)/(user)/dashboard/page.tsx
---

# 实施交接

- 页面：
  - `/dashboard`
- tRPC：
  - 新增 `library.dashboard`
- Prisma：
  - 复用 `PlaybackResolveEvent`、`Playlist`、`Track`
- Worker / Jobs：
  - 无变更

- 关键实现点：
  - 最近播放基于 `PlaybackResolveEvent` 去重聚合
  - 最近更新歌单复用 `playlists.updatedAt`
  - 最近更新曲目复用 `tracks.updatedAt`
  - 最近播放点击后接入全局 playback store，source key 固定为 `dashboard:recent-plays`
