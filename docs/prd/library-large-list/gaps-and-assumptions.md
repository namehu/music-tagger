---
doc_type: gaps-and-assumptions
product: music-tagger
module: library-large-list
version: v1
source_refs:
  - web/components/library/library-browser.tsx
  - web/store/playback-store.ts
---

# Gaps and Assumptions

## Assumptions
- 用户区优先听歌体验，采用无限加载和虚拟滚动。
- 管理区优先稳定定位和编辑，采用分页表格。
- 曲库播放队列覆盖当前筛选全集，但前端只保存邻近窗口。
- v1 不新增跨页批量编辑、拖拽排序或“下一首播放”。

## Known Gaps
- 随机播放在曲库上下文下仍基于当前邻近窗口选择候选项，不保证覆盖全筛选全集随机。
- 队列抽屉当前展示邻近窗口，不展示完整 5000+ 曲目全集。
