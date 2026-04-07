---
doc_type: gaps-and-assumptions
product: music-tagger
module: playback-modes
version: v1
source_refs:
  - web/store/playback-store.ts
  - web/components/playback/playback-runtime.tsx
  - web/components/playback/global-player.tsx
---

# Gaps And Assumptions

## 未决问题

| 编号 | 问题 | 影响范围 | 当前状态 | 处理建议 |
| --- | --- | --- | --- | --- |
| GAP-001 | 无 | 无 | 已关闭 | 当前播放恢复范围固定为浏览器本地 localStorage |

## 冲突点

| 编号 | 冲突描述 | 来源 A | 来源 B | 影响范围 |
| --- | --- | --- | --- | --- |
| CONFLICT-001 | 无明显冲突 | 当前无 | 当前无 | 无 |

## 已采用假设

| 编号 | 假设内容 | 原因 | 影响页面 | 是否可回退 |
| --- | --- | --- | --- | --- |
| ASSUME-001 | 恢复完成后默认保持暂停，不自动续播 | 避免浏览器刷新后意外发声 | 全局播放器 | 是 |
| ASSUME-002 | `repeat_one` 只作用于自然播放结束 | 降低手动切歌的心智负担 | 全局播放器 | 是 |
| ASSUME-003 | 页面挂载时的被动 queue 同步不能覆盖恢复会话 | 保证刷新恢复有稳定事实源 | `/library` `/playlists/[playlistId]` | 否 |
| ASSUME-004 | v1 模式互斥，不做“随机 + 单曲循环”组合 | 控制复杂度 | 全局播放器 | 是 |

## 待补充材料

| 编号 | 材料名称 | 用途 | 优先级 |
| --- | --- | --- | --- |
| NEED-001 | 无 | 无 | 无 |
