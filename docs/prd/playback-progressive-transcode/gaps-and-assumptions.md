---
doc_type: prd-gaps
product: music-tagger
module: playback-progressive-transcode
status: implemented
source_refs:
  - web/app/api/stream/[trackId]/route.ts
  - worker/transcoder.py
---

# 缺口与假设

## 默认假设

- 浏览器可以消费 `audio/mpeg` 的 chunked 响应
- live 阶段主要目标是尽快开播，不是保持完整 seek 体验
- `.partial` 只作为转码进行中的共享缓存，不作为长期可回收资产

## 当前缺口

- live 阶段仍不支持跳到未来位置
- 如果转码在播放中途失败，当前只提供错误提示，不会在中途二次切流

