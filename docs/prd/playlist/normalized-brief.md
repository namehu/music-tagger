---
doc_type: normalized-brief
product: music-tagger
module: playlist
version: v1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/prisma/schema.prisma
  - web/server/trpc/root.ts
---

# 标准化需求摘要

- 模块目标：补齐普通用户的独立入口，并提供个人歌单的最小可用能力。
- 目标用户：所有已登录用户；管理员也先进入用户区，再从右上角进入管理台。
- v1 范围：
  - `/dashboard`
  - `/library`
  - `/playlists`
  - `/playlists/[playlistId]`
  - `Playlist` / `PlaylistItem`
  - `playlists` router
- v1 不包含：
  - 拖拽排序
  - 随机 / 单曲循环
  - 共享歌单 / 协作歌单 / 公开链接
  - 用户级忽略曲目
