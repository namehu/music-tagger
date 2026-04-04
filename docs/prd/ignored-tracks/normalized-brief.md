---
doc_type: normalized-brief
product: music-tagger
module: ignored-tracks
version: v1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/prisma/schema.prisma
  - web/server/trpc/root.ts
---

# 标准化需求摘要

- 模块目标：建立双层忽略系统，让默认曲库和歌单加歌候选按当前用户身份自动隐藏不需要的曲目。
- 目标用户：
  - 所有已登录用户可管理自己的“我的忽略”
  - 管理员可管理“全局忽略”
- v1 范围：
  - `/library`
  - `/ignored-tracks`
  - `/admin/library`
  - `/admin/ignored-tracks`
  - `/playlists/[playlistId]` 的忽略标记
  - `UserIgnoredTrack` / `GlobalIgnoredTrack`
  - `ignoredTracks` router
- v1 不包含：
  - 目录规则、后缀规则或扫描期自动忽略
  - 普通曲库内的“显示已忽略项”切换器
  - 播放模式联动
