---
doc_type: page-spec
product: music-tagger
module: ignored-tracks
page_id: playlist_detail_ignored_tracks
page_name: 歌单详情页
route: /playlists/[playlistId]
permissions:
  - user
  - admin
page: playlist-detail
version: v1
source_refs:
  - web/app/(app)/(user)/playlists/[playlistId]/page.tsx
  - web/server/trpc/routers/playlists.ts
  - web/server/trpc/routers/tracks.ts
---

# 歌单详情页

## 模块 A：页面元数据

- **页面名称**：歌单详情页
- **访问路由**：`/playlists/[playlistId]`
- **权限要求**：歌单所有者可访问；管理员只有在自己也是歌单所有者时才按普通用户身份使用。

## 模块 B：UI/布局结构

- **页面布局模式**：左侧歌单曲目表 + 右侧曲库搜索加歌区。
- **核心区块划分**：
  - [歌单曲目区]：展示顺序、标题、艺人、专辑和忽略来源标记。
  - [加歌候选区]：展示默认可见曲目，不包含当前用户 `mine` 和所有 `global` 忽略曲目。
- **页面内从属交互**：
  - [忽略标记展示]：行内徽标，标识 `我的忽略` 或 `全局忽略`。
  - [解除我的忽略]：当曲目命中 `mine` 时显示行内按钮。

## 模块 C：数据展示与字段定义

### 字段分组 1：歌单曲目列
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 标题 `track.title` | string | 必显 | 始终展示，即使该曲目已被忽略 | 无 |
| 忽略来源 `ignoreSource` | enum | 选显 | `none / mine / global`；仅 `mine` 和 `global` 显示徽标 | `none` |
| 可解除标记 `canUnignoreTrack` | boolean | 必显 | 仅 `mine` 为 `true` | `false` |
| 移除按钮 `removeTrack` | action | 必显 | 从歌单中删除条目 | 无 |
| 解除我的忽略 `unignoreMine` | action | 选显 | 仅 `canUnignoreTrack=true` 时显示 | 无 |

### 字段分组 2：加歌候选字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 搜索关键字 `q` | string | 选填 | 匹配标题、艺人、专辑、文件名 | 空 |
| 可见面 `surface` | enum | 必填 | 固定传 `user`，始终过滤 `global + mine` | `user` |
| 加入按钮 `addTrack` | action | 必显 | 仅对默认可见曲目开放 | 无 |

## 模块 D：交互与状态流转

### 操作 1：查看歌单中的忽略标记
- **触发事件**：进入歌单详情页。
- **前置校验**：歌单归属当前用户。
- **流转结果**：调用 `playlists.get`，并为每个歌单项附带 `ignoreSource` 和 `canUnignoreTrack`。
- **成功结果**：已在歌单中的曲目即使被忽略也继续展示，并返回 `ignoreSource`。
- **失败结果**：显示歌单加载失败提示。

### 操作 2：解除我的忽略
- **触发事件**：点击歌单项上的“解除忽略”。
- **前置校验**：当前条目的 `ignoreSource` 为 `mine`。
- **流转结果**：调用 `ignoredTracks.unignoreMine`，随后刷新歌单详情、加歌候选与我的忽略列表。
- **成功结果**：删除当前用户的忽略记录，刷新歌单和右侧加歌候选。
- **失败结果**：显示“解除忽略失败”提示。

### 操作 3：从曲库加入歌单
- **触发事件**：搜索后点击“加入”。
- **前置校验**：歌单存在，曲目在当前用户默认可见范围内。
- **流转结果**：调用 `tracks.list(surface=user)` 获取候选，再调用 `playlists.addTrack`。
- **成功结果**：把曲目追加到歌单末尾。
- **失败结果**：显示“加入歌单失败”提示。

### 页面状态与异常
- **加载中**：歌单区和加歌候选区显示 loading。
- **无数据**：歌单为空时提示从右侧继续加入。
- **网络错误**：显示错误提示，允许重试。
- **无权限**：非歌单所有者不可读写该歌单。
- **重复提交**：加歌、移歌和解除忽略按钮在提交中 disabled。
- **分页逻辑**：v1 不做分页。
- **搜索逻辑**：右侧候选始终受 `global + mine` 过滤。
- **排序逻辑**：歌单区按保存顺序展示，加歌候选按标题排序。

## 模块 E：复杂业务逻辑图

无复杂状态流转。
