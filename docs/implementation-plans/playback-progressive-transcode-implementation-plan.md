---
doc_type: implementation-plan
product: music-tagger
module: playback-progressive-transcode
status: implemented
source_refs:
  - docs/prd/playback-progressive-transcode/summary.md
  - web/server/trpc/routers/playback.ts
  - web/app/api/stream/[trackId]/route.ts
  - web/components/playback/playback-runtime.tsx
  - worker/transcoder.py
---

# Playback Progressive Transcode Streaming 实施计划

## 目标

把冷缓存 `mp3_192` 升级为边转边播，同时尽量不打破现有原始流和完整缓存流的语义。

## 已实施拆分

1. worker 改为持续写 `.partial`，并把 `transcode_cache.status` 扩展为 `pending -> streaming -> ready`
2. `playback.resolve` 与 `getPreparationStatus` 暴露 live transcode 元数据
3. `/api/stream/[trackId]` 增加 live partial chunked 分支
4. 播放器 runtime/store 支持 live ready、完成后切回 seekable、首次失败自动回退 `original`
5. `/admin/cache` 与缓存维护逻辑识别 `streaming`

## 验证

- `python3 -m py_compile worker/*.py`
- `pnpm -C web exec node --test lib/playback-store.test.mts`
- `pnpm -C web build`
