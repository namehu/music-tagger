---
doc_type: implementation-handoff
product: music-tagger
module: library-large-list
version: v1
source_refs:
  - web/server/trpc/routers/tracks.ts
  - web/components/library/library-browser.tsx
  - web/store/playback-store.ts
  - web/components/playback/playback-runtime.tsx
---

# Implementation Handoff

## 已实现变更
- `tracks.list` 支持 cursor 无限加载、pageIndex 分页和 totalCount。
- `tracks.queueWindow` 支持按曲库上下文解析邻近播放窗口。
- `/library` 使用 `react-virtuoso` 无限虚拟滚动。
- `/admin/library` 使用分页表格和页大小切换。
- 播放 store 增加 `queueContext` 与 `queueTotalCount`，曲库播放不再持久化全量队列。

## 回归重点
- 搜索/排序变化后的重置行为。
- 管理端编辑过滤与分页组合。
- 曲库上下文切歌与刷新恢复。
