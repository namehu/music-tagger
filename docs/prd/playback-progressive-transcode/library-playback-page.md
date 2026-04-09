---
doc_type: prd-page
product: music-tagger
module: playback-progressive-transcode
page: library-playback
status: implemented
source_refs:
  - web/components/playback/global-player.tsx
  - web/components/playback/current-playback-summary.tsx
  - web/store/playback-store.ts
---

# 用户侧播放行为

## 成功路径

1. 用户点播冷缓存 `mp3_192`
2. worker 开始写 `.partial`
3. 当 partial 达到 256 KiB 起播阈值后，前端拿到 `ready + liveTranscode=true + seekable=false`
4. 播放器立即开始播放
5. 转码完成后，当前播放不重启，只恢复可 seek 状态

## UI 规则

- live 阶段进度继续实时更新
- live 阶段拖动 seek 被禁用
- 详情面板显示“边转边播中，暂不支持跳到未转码的位置”
- 当前流文案显示为“转码缓存（边转边播）”

## 失败与回退

- live 首播失败时，播放器自动回退到 `original`
- 回退只尝试一次，避免循环重试

