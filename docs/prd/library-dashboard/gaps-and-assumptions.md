---
doc_type: gaps-and-assumptions
product: music-tagger
module: library-dashboard
version: v1
source_refs:
  - web/prisma/schema.prisma
  - web/server/trpc/routers/library.ts
---

# Gaps And Assumptions

## 未决问题
| 编号 | 问题 | 影响范围 | 当前状态 | 处理建议 |
| --- | --- | --- | --- | --- |
| GAP-001 | 是否要为“最近打开歌单”补专门事件模型 | `/dashboard` | 待确认 | v1 先用 `playlists.updatedAt` 表示最近维护过的歌单 |

## 冲突点
| 编号 | 冲突描述 | 来源 A | 来源 B | 影响范围 |
| --- | --- | --- | --- | --- |
| CONFLICT-001 | 无明显冲突 | 当前无 | 当前无 | 无 |

## 已采用假设
| 编号 | 假设内容 | 原因 | 影响页面 | 是否可回退 |
| --- | --- | --- | --- | --- |
| ASSUME-001 | 最近播放基于 `PlaybackResolveEvent` 聚合，不额外记录完整播放结束 | 现有事实已足够支撑 v1 | `/dashboard` | 是 |
| ASSUME-002 | 最近更新歌单按 `updatedAt` 排序，不宣称为最近打开 | 避免新增模型和访问事件 | `/dashboard` | 是 |
| ASSUME-003 | 用户首页不做复杂趋势图，只做入口聚合 | 优先把首页变成真实可用入口 | `/dashboard` | 是 |

## 待补充材料
| 编号 | 材料名称 | 用途 | 优先级 |
| --- | --- | --- | --- |
| NEED-001 | 未来“最近打开歌单 / 最近访问历史”规格 | 决定是否扩展首页为更严格的最近使用中心 | 中 |
