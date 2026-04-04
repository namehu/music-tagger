---
doc_type: implementation-handoff
product: music-tagger
module: playlist
version: v1
source_refs:
  - docs/prd/playlist/summary.md
  - web/prisma/schema.prisma
  - web/server/trpc/root.ts
---

# 实施交接

- 路由拆分：
  - `/(app)/(user)` 承载用户区
  - `/admin` 保持管理区
- 数据新增：
  - `Playlist`
  - `PlaylistItem`
- tRPC 新增：
  - `playlists.list`
  - `playlists.get`
  - `playlists.create`
  - `playlists.rename`
  - `playlists.remove`
  - `playlists.addTrack`
  - `playlists.removeTrack`
- 关键复用：
  - `/library` 复用共享曲库浏览组件
  - 播放仍复用 `playback.resolve` 与 `/api/stream/[trackId]`
