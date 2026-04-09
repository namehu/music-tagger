---
doc_type: prd
product: music-tagger
module: playback-progressive-transcode
status: implemented
source_refs:
  - web/server/trpc/routers/playback.ts
  - web/components/playback/playback-runtime.tsx
  - web/components/playback/global-player.tsx
  - worker/transcoder.py
---

# 模块摘要

## 目标

把冷缓存 `mp3_192` 从“整首转完再播”改成“达到最小可播阈值后立即开播”。

## 范围

- `playback.resolve` 支持返回 live transcode ready
- `playback.getPreparationStatus` 返回流式缓存状态与 `bytesReady`
- `/api/stream/[trackId]` 支持 live partial chunked 输出
- 播放器在 live 阶段禁用 seek
- live 首播失败时自动回退到 `original`

## 不做

- 不支持 live 阶段任意跳到未来位置
- 不让 web 直接拉起 ffmpeg
- 不新增新的 Prisma model

