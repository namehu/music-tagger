---
doc_type: quality-report
product: music-tagger
module: library-large-list
version: v1
source_refs:
  - web/components/library/library-browser.tsx
  - web/server/trpc/routers/tracks.ts
---

# Quality Report

## Acceptance
- 用户曲库不一次性渲染全量曲目。
- 管理曲库分页查询并显示总数。
- 搜索、排序、忽略过滤、编辑真值展示保持一致。
- 曲库播放上下文不把全量曲目写入 localStorage。

## Verification
- 需要运行 `pnpm lint:web`。
- 需要运行 `pnpm build:web`。
- 建议用 5000+ 曲目数据手动验证虚拟滚动 DOM 数量和管理分页切换。
