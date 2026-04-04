---
doc_type: gaps-and-assumptions
product: music-tagger
module: ignored-tracks
version: v1
source_refs:
  - web/prisma/schema.prisma
  - web/server/trpc/routers/ignoredTracks.ts
  - web/server/trpc/routers/tracks.ts
---

# Gaps And Assumptions

## 未决问题

| 编号 | 问题 | 影响范围 | 当前状态 | 处理建议 |
| --- | --- | --- | --- | --- |
| GAP-001 | 管理员侧是否需要记录和展示忽略原因输入框 | `/admin/library` `/admin/ignored-tracks` | 待确认 | v1 已保留 `reason` 字段，但 UI 先不暴露编辑入口 |

## 冲突点

| 编号 | 冲突描述 | 来源 A | 来源 B | 影响范围 |
| --- | --- | --- | --- | --- |
| CONFLICT-001 | 无明显冲突 | 当前无 | 当前无 | 无 |

## 已采用假设

| 编号 | 假设内容 | 原因 | 影响页面 | 是否可回退 |
| --- | --- | --- | --- | --- |
| ASSUME-001 | v1 只做 track 级忽略，不做目录规则和扫描期规则 | 当前最小闭环已覆盖主要使用场景 | `/library` `/admin/library` | 是 |
| ASSUME-002 | 默认曲库不提供“显示已忽略曲目”切换器 | 先把查看入口集中到 ignored 专页，降低主列表复杂度 | `/library` `/admin/library` | 是 |
| ASSUME-003 | 歌单中已存在的忽略曲目继续保留，不自动删除 | 避免用户歌单被隐式修改 | `/playlists/[playlistId]` | 否 |

## 待补充材料

| 编号 | 材料名称 | 用途 | 优先级 |
| --- | --- | --- | --- |
| NEED-001 | 忽略原因的产品文案与展示策略 | 决定是否在管理端补录入表单和详情展示 | 中 |
