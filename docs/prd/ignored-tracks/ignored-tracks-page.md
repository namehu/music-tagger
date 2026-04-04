---
doc_type: page-spec
product: music-tagger
module: ignored-tracks
page_id: user_ignored_tracks
page_name: 我的忽略页
route: /ignored-tracks
permissions:
  - user
  - admin
page: ignored-tracks
version: v1
source_refs:
  - web/app/(app)/(user)/ignored-tracks/page.tsx
  - web/server/trpc/routers/ignoredTracks.ts
---

# 我的忽略页

## 模块 A：页面元数据

- **页面名称**：我的忽略页
- **访问路由**：`/ignored-tracks`
- **权限要求**：所有已登录用户可访问，只展示当前用户自己的忽略记录。

## 模块 B：UI/布局结构

- **页面布局模式**：说明区 + 单表格列表页。
- **核心区块划分**：
  - [说明区]：解释这些曲目会从默认曲库、搜索结果和歌单加歌候选中隐藏。
  - [忽略列表区]：展示标题、艺人、专辑、路径、忽略时间和解除按钮。
- **页面内从属交互**：
  - [解除忽略]：行内按钮；不单独开弹窗。

## 模块 C：数据展示与字段定义

### 字段分组 1：忽略列表列
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 标题 `track.title` | string | 必显 | 优先显示 override 后标题 | 无 |
| 艺人 `track.artist` | string | 必显 | 无值时显示“未知艺人” | 无 |
| 专辑 `track.album` | string | 选显 | 无值显示 `-` | 空 |
| 路径 `track.path` | string | 必显 | 只读展示 | 无 |
| 忽略时间 `createdAt` | datetime | 必显 | 本地时区展示 | 无 |
| 解除按钮 `unignoreMine` | action | 必显 | 仅解除当前用户自己的忽略 | 无 |

## 模块 D：交互与状态流转

### 操作 1：查看我的忽略
- **触发事件**：进入页面。
- **前置校验**：用户已登录。
- **流转结果**：调用 `ignoredTracks.listMine`。
- **成功结果**：按忽略时间倒序返回当前用户记录。
- **失败结果**：显示列表加载失败提示。

### 操作 2：解除我的忽略
- **触发事件**：点击“解除忽略”。
- **前置校验**：当前记录属于当前用户。
- **流转结果**：调用 `ignoredTracks.unignoreMine`，随后刷新曲库、统计和当前列表。
- **成功结果**：删除 `user_ignored_tracks` 记录，并刷新曲库、统计和当前列表。
- **失败结果**：显示“解除忽略失败”提示。

### 页面状态与异常
- **加载中**：表格区域显示 loading。
- **无数据**：显示“你还没有忽略任何曲目”。
- **网络错误**：显示错误提示，允许重试。
- **无权限**：未登录时跳转 `/sign-in`。
- **重复提交**：解除按钮在提交中 disabled。
- **分页逻辑**：v1 固定最多 200 条，不做翻页。
- **搜索逻辑**：v1 不提供搜索。
- **排序逻辑**：固定按 `createdAt desc`。

## 模块 E：复杂业务逻辑图

无复杂状态流转。
