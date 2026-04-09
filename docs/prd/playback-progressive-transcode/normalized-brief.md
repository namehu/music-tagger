---
doc_type: prd
product: music-tagger
module: playback-progressive-transcode
status: implemented
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/server/trpc/routers/playback.ts
  - web/app/api/stream/[trackId]/route.ts
  - worker/transcoder.py
---

# 背景归一

当前系统原本只支持两种播放路径：

- `original` 原始音频直出
- `mp3_192` 等 worker 整首转码完成后再播放

这会导致冷缓存命中 `mp3_192` 时，用户必须等待整首转码完成后才能开始播放。现在把这条链路升级为：

- worker 持续写共享 `.partial` 缓存
- web 在 partial 达到起播阈值后直接边读边播
- 转码完成后自动切回完整可 seek 状态

本次迭代仍保持：

- worker 是唯一 ffmpeg 执行者
- web 只负责读 `/cache` 出流
- `original` 与完整缓存的 `Range` 行为不变

