---
doc_type: page-spec
product: music-tagger
module: playback-modes
page_id: user_library_playback
page_name: 用户曲库页
route: /library
permissions:
  - user
  - admin
page: library
version: v1
source_refs:
  - web/app/(app)/(user)/library/page.tsx
  - web/components/library/library-browser.tsx
  - web/components/playback/global-player.tsx
  - web/store/playback-store.ts
---

# 用户曲库页

## 模块 A：页面元数据

- **页面名称**：用户曲库页
- **访问路由**：`/library`
- **权限要求**：所有已登录用户可访问。

## 模块 B：UI/布局结构

- **页面布局模式**：列表页 + 全局播放器底栏。
- **核心区块划分**：
  - [曲库表格区]：展示点播按钮和曲目信息。
  - [全局播放器区]：常驻在底部，提供模式切换与切歌控制。
- **页面内从属交互**：
  - [被动 queue 同步]：当前曲库结果会被注入全局 queue，但不覆盖恢复中的旧会话。
  - [明确点播替换]：当用户在新上下文点播时，用 `replaceQueueFromUserIntent` 替换当前 queue。

## 模块 C：数据展示与字段定义

### 字段分组 1：点播相关字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 队列来源 `queueSourceKey` | string | 必显 | 用户曲库固定为 `user-library` | 无 |
| 播放按钮 `play` | action | 必显 | 点播时可触发替换 queue 或沿用当前 queue | 无 |
| 当前活动曲目 `activeTrackId` | string | 选显 | 用于高亮当前行 | `null` |
| 准备中曲目 `pendingTrackId` | string | 选显 | 转码准备中时用于 loading 展示 | `null` |

### 字段分组 2：全局播放器字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 播放模式 `playbackMode` | enum | 必显 | `ordered / shuffle / repeat_one` | `ordered` |
| 上一首/下一首可用性 `canPlayPrevious / canPlayNext` | boolean | 必显 | 由 store computed 推导 | `false` |
| 恢复提示 `resumeTimeSec` | number | 选显 | 刷新恢复后显示最近持久化进度 | `0` |

## 模块 D：交互与状态流转

### 操作 1：页面挂载时同步当前曲库 queue
- **触发事件**：`/library` 加载或结果集变化。
- **前置校验**：用户已登录。
- **流转结果**：调用 `setQueue({ reason: initial_page_sync })` 的被动同步语义。
- **成功结果**：当不存在恢复锁或当前播放上下文冲突时，更新全局 queue。
- **失败结果**：若恢复锁仍在，忽略本次覆盖请求。

### 操作 2：用户从曲库点播
- **触发事件**：点击行内播放按钮。
- **前置校验**：曲目存在，用户已登录。
- **流转结果**：若当前 queue 来源不同，则先 `replaceQueueFromUserIntent`，再 `requestPlayTrack`。
- **成功结果**：写入 resolve 请求并由 `PlaybackRuntime` 接管准备与播放。
- **失败结果**：展示播放或转码失败提示。

### 操作 3：在底部播放器切换播放模式
- **触发事件**：点击底部“顺序 / 随机 / 单曲循环”。
- **前置校验**：全局播放器可见。
- **流转结果**：更新 store 中的 `playbackMode`。
- **成功结果**：当前 queue 立即按新模式决定下一首/上一首。
- **失败结果**：保留原模式并展示错误提示。

### 页面状态与异常
- **加载中**：曲库查询和当前准备中曲目分别展示 loading。
- **无数据**：显示空状态。
- **网络错误**：显示错误提示，允许重试。
- **无权限**：未登录时跳转 `/sign-in`。
- **重复提交**：当前行处于准备中时播放按钮显示 busy。
- **分页逻辑**：v1 不做完整分页。
- **搜索逻辑**：保留既有 FTS / LIKE 双路径。
- **排序逻辑**：支持 `recent / title / artist`。

## 模块 E：复杂业务逻辑图

```mermaid
flowchart TD
  A[/library 挂载] --> B[被动 setQueue]
  B --> C{恢复锁是否存在}
  C -->|是| D[忽略本次 queue 覆盖]
  C -->|否| E[更新 queue]
  F[用户点击某首歌] --> G{queueSourceKey 是否已是 user-library}
  G -->|否| H[replaceQueueFromUserIntent]
  G -->|是| I[直接 requestPlayTrack]
  H --> I
  I --> J[PlaybackRuntime resolve]
```
