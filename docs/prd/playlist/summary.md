---
doc_type: summary
product: music-tagger
module: playlist
version: v1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - docs/architecture.md
  - web/prisma/schema.prisma
---

# 产品白皮书与索引

## 产品愿景与目标

- 一句话价值：让普通用户在独立音乐区里维护自己的歌单，并直接按保存顺序开始播放。
- 业务目标：
  - 把登录后的默认入口从管理台切到用户区
  - 为后续播放模式提供稳定的“歌单顺序队列”基础
  - 不把普通用户暴露给 `admin` 管理操作
- 成功标准：
  - 登录后默认进入 `/dashboard`
  - 用户能进入 `/library` 与 `/playlists`
  - 用户能创建、改名、删除个人歌单
  - 用户能在歌单详情页加入曲目、移除曲目并开始顺序点播

## 全局角色与权限

| 角色 | 全局权限 | 受限能力 | 说明 |
| --- | --- | --- | --- |
| 普通用户 | 进入用户区、浏览曲库、管理自己的歌单、播放 | 不可进入 `/admin` | `playlist` v1 面向普通用户开放 |
| 管理员 | 同普通用户 + 可进入 `/admin` | 无 | 默认也先进用户区 |

## 核心业务流程图

```mermaid
flowchart TD
  A[用户登录] --> B[/dashboard]
  B --> C[/library 浏览与点播]
  B --> D[/playlists 管理歌单]
  D --> E[创建歌单]
  D --> F[进入歌单详情]
  F --> G[搜索曲库并加入曲目]
  F --> H[移除歌单项]
  F --> I[按保存顺序点播]
  I --> J[全局播放器切歌]
```

## 全局业务字典

| 业务名词 | 标准定义 | 英文标识 | 备注 |
| --- | --- | --- | --- |
| 用户区 | 登录后默认进入的普通用户音乐入口 | User Area | 包含 `/dashboard`、`/library`、`/playlists` |
| 歌单 | 某个用户自己的曲目集合 | Playlist | 只归属单个 `userId` |
| 歌单项 | 歌单中的单条曲目引用与顺序位 | PlaylistItem | `position` 代表当前播放顺序 |
| 顺序点播 | 以歌单项顺序驱动上一首/下一首 | Ordered Playback | v1 不含随机与循环 |

## 页面路由索引

- `[用户首页]`: `/dashboard` -> `对应文档: dashboard-page.md`
- `[用户曲库页]`: `/library` -> `对应文档: library-page.md`
- `[歌单列表页]`: `/playlists` -> `对应文档: playlists-page.md`
- `[歌单详情页]`: `/playlists/[playlistId]` -> `对应文档: playlist-detail-page.md`

## 外部依赖登记

| 依赖对象 | 类型 | 触发页面/流程 | 现状 | 处理方式 |
| --- | --- | --- | --- | --- |
| PostgreSQL | 数据库 | 歌单 CRUD 与歌单项管理 | 已落地 | 新增 `playlists` / `playlist_items` |
| `/api/stream/[trackId]` | Route Handler | 歌单点播 | 已落地 | 继续复用 |
| `transcode_prepare` | 后台 job | 外网档位播放准备 | 已落地 | 通过 `playback.getPreparationStatus` 供用户区轮询 |
