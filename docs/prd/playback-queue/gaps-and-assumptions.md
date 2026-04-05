---
doc_type: gaps-and-assumptions
product: music-tagger
module: playback-queue
version: v1
source_refs:
  - web/store/playback-store.ts
  - web/components/playback/global-player.tsx
  - web/components/playback/playback-runtime.tsx
---

# Gaps And Assumptions

## 未决问题

| 编号 | 问题 | 影响范围 | 当前状态 | 处理建议 |
| --- | --- | --- | --- | --- |
| GAP-001 | v1 是否允许“移除当前正在播放的歌曲”后无缝切下一首 | user 队列抽屉、store 动作 | 待确认 | 当前建议允许，并明确按当前模式计算下一首 |
| GAP-002 | 是否要在 v1 同时支持“加入队列尾部 / 下一首播放” | 曲库、歌单、播放器菜单 | 待确认 | 推迟到 v2，先把可见队列、移除和清空做稳 |

## 冲突点

| 编号 | 冲突描述 | 来源 A | 来源 B | 影响范围 |
| --- | --- | --- | --- | --- |
| CONFLICT-001 | admin 试听条此前也能显示详情，但本模块只为 user 正式队列服务 | 播放拆分现状 | 队列产品化目标 | admin 播放器、共享组件 |

## 已采用假设

| 编号 | 假设内容 | 原因 | 影响页面 | 是否可回退 |
| --- | --- | --- | --- | --- |
| ASSUME-001 | 队列抽屉只属于 user 正式会话，不属于 admin 试听 | 降低心智负担，避免混淆两套播放目标 | `/dashboard` `/library` `/playlists/[playlistId]` | 否 |
| ASSUME-002 | v1 不做拖拽排序 | 控制实现复杂度，先做可靠可见队列 | 用户侧底部播放器 | 是 |
| ASSUME-003 | 清空队列会停止当前正式播放 | 避免出现“无队列但仍在播”的语义冲突 | 用户侧底部播放器 | 否 |
| ASSUME-004 | 队列编辑后仍然要写回 localStorage | 保持刷新恢复的一致性 | 用户侧正式会话 | 否 |

## 待补充材料

| 编号 | 材料名称 | 用途 | 优先级 |
| --- | --- | --- | --- |
| NEED-001 | 队列拖拽排序与“下一首播放”方案 | 作为 v2 阶段扩展设计 | 中 |
| NEED-002 | Media Session 与系统控制联动设计 | 判断队列编辑后如何同步锁屏和耳机事件 | 中 |
