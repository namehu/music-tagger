---
doc_type: summary
product: music-tagger
module: ignored-tracks
version: v1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - docs/architecture.md
  - web/prisma/schema.prisma
  - web/server/trpc/routers/ignoredTracks.ts
---

# 产品白皮书与索引

## 产品愿景与目标

- 一句话价值：让用户和管理员都能把“不想默认看到的曲目”稳定移出日常浏览流。
- 业务目标：
  - 为普通用户提供“我的忽略”，减少曲库噪音
  - 为管理员提供“全局忽略”，统一隐藏不适合默认展示的曲目
  - 让曲库、搜索和歌单加歌候选自动遵循忽略规则
- 成功标准：
  - 用户可在 `/library` 把曲目加入“我的忽略”
  - 管理员可在 `/admin/library` 把曲目设为“全局忽略”，并支持批量处理
  - `/ignored-tracks` 和 `/admin/ignored-tracks` 可分别查看并解除对应层级的忽略
  - 歌单中已存在的忽略曲目不会被自动删除，只会显示来源标记

## 全局角色与权限

| 角色 | 全局权限 | 受限能力 | 说明 |
| --- | --- | --- | --- |
| 普通用户 | 浏览曲库、设置和解除自己的忽略、在歌单内查看忽略标记 | 不可查看或解除全局忽略 | “我的忽略”只影响当前用户 |
| 管理员 | 同普通用户 + 设置/解除全局忽略、批量全局忽略 | 无 | “全局忽略”对所有用户生效 |

## 核心业务流程图

```mermaid
flowchart TD
  A[用户进入曲库] --> B{当前身份}
  B -->|普通用户| C[查看 /library]
  B -->|管理员| D[查看 /admin/library]
  C --> E[加入我的忽略]
  D --> F[设置全局忽略]
  E --> G[/ignored-tracks 查看与解除]
  F --> H[/admin/ignored-tracks 查看与批量解除]
  G --> I[曲目重新回到默认曲库]
  H --> I
  I --> J[歌单加歌候选重新可见]
```

## 全局业务字典

| 业务名词 | 标准定义 | 英文标识 | 备注 |
| --- | --- | --- | --- |
| 我的忽略 | 某个用户自己的默认隐藏曲目集合 | My Ignored Tracks | 只对当前 `userId` 生效 |
| 全局忽略 | 管理员对所有用户生效的默认隐藏曲目集合 | Global Ignored Tracks | 对所有用户区与管理区默认曲库生效 |
| 忽略来源 | 某首曲目当前命中的忽略层级 | Ignore Source | 取值 `none / mine / global` |
| 默认可见性 | 曲目是否出现在默认曲库、搜索和加歌候选中 | Default Visibility | 优先级 `global > mine > visible` |

## 页面路由索引

- `[用户曲库页]`: `/library` -> `对应文档: library-page.md`
- `[我的忽略页]`: `/ignored-tracks` -> `对应文档: ignored-tracks-page.md`
- `[管理曲库页]`: `/admin/library` -> `对应文档: admin-library-page.md`
- `[全局忽略页]`: `/admin/ignored-tracks` -> `对应文档: admin-ignored-tracks-page.md`
- `[歌单详情页]`: `/playlists/[playlistId]` -> `对应文档: playlist-detail-page.md`

## 外部依赖登记

| 依赖对象 | 类型 | 触发页面/流程 | 现状 | 处理方式 |
| --- | --- | --- | --- | --- |
| PostgreSQL | 数据库 | 忽略关系查询与写入 | 已落地 | 新增 `user_ignored_tracks` / `global_ignored_tracks` |
| `tracks.list` | tRPC | 用户曲库、管理曲库、歌单加歌候选 | 已扩展 | 增加 `surface`，按当前身份自动过滤 |
| `library.stats` | tRPC | 用户首页、管理首页、曲库统计卡片 | 已扩展 | 统计结果遵循默认可见性 |
| `playlists.get` | tRPC | 歌单详情页 | 已扩展 | 补充 `ignoreSource` 与 `canUnignoreTrack` |
