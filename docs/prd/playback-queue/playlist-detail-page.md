---
doc_type: page-spec
product: music-tagger
module: playback-queue
page_id: user_playlist_detail_queue
page_name: 歌单详情页
route: /playlists/[playlistId]
permissions:
  - user
  - admin
page: playlist-detail
version: v1
source_refs:
  - web/app/(app)/(user)/playlists/[playlistId]/page.tsx
  - web/components/playback/global-player.tsx
  - web/store/playback-store.ts
---

# 歌单详情页

## 模块 A：页面元数据

- **页面名称**：歌单详情页
- **访问路由**：`/playlists/[playlistId]`
- **权限要求**：歌单所有者可访问自己的歌单并进入正式队列。

## 模块 B：UI/布局结构

- **页面布局模式**：歌单详情页 + 用户正式播放器底栏。
- **核心区块划分**：
  - [歌单曲目区]：维持按歌单顺序点播。
  - [底部播放器区]：展示当前 user 会话。
  - [队列抽屉]：展示当前歌单队列中的当前项和 Up Next。
- **页面内从属交互**：
  - [歌单点播替换]：从歌单内点播时，当前歌单顺序成为正式队列。
  - [队列跳播与移除]：在抽屉中直接切歌或移除，不反向修改歌单结构。

## 模块 C：数据展示与字段定义

### 字段分组 1：歌单队列字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 队列来源 `queueSourceKey` | string | 必显 | 形如 `playlist:<playlistId>` | 无 |
| 当前曲目 `activeTrackId` | string | 选显 | 与歌单列表高亮联动 | `null` |
| 队列总数 `queueSize` | number | 必显 | 当前 user 会话长度 | `0` |

### 字段分组 2：队列抽屉字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 当前歌单播放项 `currentQueueItem` | object | 选显 | 当前曲目详情 | `null` |
| Up Next 列表 `upNextItems` | array | 必显 | 当前曲目后续项 | `[]` |
| 清空队列 `clearQueue` | action | 必显 | 仅清空当前播放队列，不删除歌单内容 | 无 |

## 模块 D：交互与状态流转

### 操作 1：从歌单点播并建立正式队列
- **触发事件**：点击歌单某一首歌的播放按钮。
- **前置校验**：歌单存在且属于当前用户。
- **流转结果**：若当前 queue 来源不是该歌单，则调用 `replaceQueueFromUserIntent`，再播放目标项。
- **成功结果**：当前歌单顺序成为正式队列。
- **失败结果**：显示播放错误提示。

### 操作 2：在队列抽屉中移除某首歌
- **触发事件**：点击队列项右侧移除。
- **前置校验**：队列中存在该曲目。
- **流转结果**：仅更新播放 queue，不修改歌单数据库内容。
- **成功结果**：抽屉与底部播放器更新。
- **失败结果**：保留原队列并提示错误。

### 操作 3：清空当前播放队列但保留歌单
- **触发事件**：点击“清空队列”。
- **前置校验**：当前歌单队列已进入 user 正式会话。
- **流转结果**：停止 user 会话并清空当前播放 queue。
- **成功结果**：歌单页面数据仍在，但底部播放器回到空队列状态。
- **失败结果**：保持原播放队列。

### 页面状态与异常
- **加载中**：歌单查询和播放器状态独立加载。
- **无数据**：歌单为空时无可播放队列。
- **网络错误**：歌单查询失败时展示错误页，不修改已有 user 队列。
- **无权限**：非所有者跳转或显示无权限。
- **重复提交**：同一移除动作提交中不可重复点。
- **分页逻辑**：v1 不做分页。
- **搜索逻辑**：v1 不在歌单详情内加局部搜索。
- **排序逻辑**：歌单顺序决定正式队列初始顺序；v1 不支持拖拽改队列顺序。

## 模块 E：复杂业务逻辑图

```mermaid
flowchart TD
  A[歌单点播] --> B[replaceQueueFromUserIntent(playlist:id)]
  B --> C[requestPlayTrack]
  C --> D[队列抽屉显示当前项与 Up Next]
  D --> E{用户编辑当前播放队列}
  E -->|移除队列项| F[仅更新播放 queue]
  E -->|清空 queue| G[停止 user 会话]
  F --> H[歌单数据库内容保持不变]
  G --> H
```
