---
doc_type: gaps-and-assumptions
product: music-tagger
module: playlist
version: v1
source_refs:
  - web/prisma/schema.prisma
  - web/server/trpc/routers/playlists.ts
---

# 差距与假设

- 假设：管理员也是普通用户，但默认先进用户区。
- 假设：歌单只归属单个用户，不做共享。
- 假设：歌单项允许重复加入，同一曲目可出现多次。
- 差距：v1 没有拖拽排序，顺序只由加入先后决定。
- 差距：v1 没有忽略曲目与播放模式。
