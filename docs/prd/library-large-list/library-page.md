---
doc_type: page
product: music-tagger
module: library-large-list
version: v1
source_refs:
  - web/components/library/library-browser.tsx
  - web/server/trpc/routers/tracks.ts
---

# Library Page

## 页面目标
- `/library`：面向普通听歌流程，使用无限加载和虚拟滚动，搜索/排序结果可连续播放。
- `/admin/library`：面向管理流程，使用分页表格，保留单曲编辑、全局忽略和 admin 临时试听。

## 用户区行为
- 每次加载最多 100 条曲目，滚动到底部后按 cursor 获取下一页。
- 搜索或排序变化时重置已加载列表与滚动位置。
- 列表显示已加载数量和筛选总数。
- 点播曲目时保存 `queueContext`，队列语义为当前筛选全集；前端只保留当前曲目前后的窗口。

## 管理区行为
- 默认每页 50 条，可切换 50 / 100 / 200。
- 搜索、排序、编辑过滤变化时回到第一页。
- 管理试听队列只代表当前页，不扩展为全曲库队列。
- 单曲编辑和全局忽略后刷新当前页、统计和相关列表缓存。

## 接口影响
- `tracks.list` 支持 `cursor`、`pageIndex`、`limit`、`totalCount` 和 `nextCursor`。
- `tracks.queueWindow` 按曲库上下文和当前曲目返回邻近播放窗口。
- `playback-store` 新增 `queueContext` 和 `queueTotalCount`，持久化轻量上下文而非全量曲库。
