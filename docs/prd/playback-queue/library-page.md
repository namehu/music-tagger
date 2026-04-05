---
doc_type: page-spec
product: music-tagger
module: playback-queue
page_id: user_library_queue
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

- **页面布局模式**：列表页 + 用户正式播放器底栏。
- **核心区块划分**：
  - [曲库表格区]：继续承担从曲库替换正式队列的入口。
  - [底部播放器区]：展示当前正式播放与队列入口。
  - [队列抽屉]：展示当前曲目、Up Next、移除和清空动作。
- **页面内从属交互**：
  - [曲库点播替换]：从曲库重新点播时替换 user 正式队列。
  - [队列项跳播]：从抽屉点击任意队列项立即播放该项。

## 模块 C：数据展示与字段定义

### 字段分组 1：曲库点播相关字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 队列来源 `queueSourceKey` | string | 必显 | 用户曲库固定为 `user-library` | 无 |
| 当前活动曲目 `activeTrackId` | string | 选显 | 当前 user 会话曲目用于高亮表格行 | `null` |
| 当前队列长度 `queueSize` | number | 选显 | 读取 user 会话 | `0` |

### 字段分组 2：队列抽屉字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 队列列表 `queueItems` | array | 必显 | 顺序即真实播放顺序 | `[]` |
| 当前曲目标记 `isActive` | boolean | 必显 | 当前播放项必须高亮 | `false` |
| 移除动作 `removeQueueItem` | action | 必显 | v1 允许移除任意一首 | 无 |
| 清空动作 `clearQueue` | action | 必显 | 清空整个 user 会话队列 | 无 |

## 模块 D：交互与状态流转

### 操作 1：从曲库点播并替换正式队列
- **触发事件**：点击曲库表格行内播放按钮。
- **前置校验**：曲目存在，用户已登录。
- **流转结果**：若当前 queue 来源不同，则调用 `replaceQueueFromUserIntent` 写入 `user-library`，再播放当前曲目。
- **成功结果**：曲库结果成为当前正式队列。
- **失败结果**：展示播放或转码失败提示。

### 操作 2：从队列抽屉点击任意队列项立即播放
- **触发事件**：点击抽屉中的某一首歌。
- **前置校验**：该项仍在当前 user 队列中。
- **流转结果**：直接 `requestPlayTrack` 当前队列项，不重建新的 queue。
- **成功结果**：当前曲目切换并更新高亮。
- **失败结果**：显示播放错误，保留当前队列。

### 操作 3：从当前队列移除单首
- **触发事件**：点击队列项上的移除按钮。
- **前置校验**：当前队列非空。
- **流转结果**：更新 user 会话 queue，并同步 localStorage。
- **成功结果**：若移除的不是当前曲目，则仅更新列表；若移除的是当前曲目，则立即按当前模式切到下一首或停止。
- **失败结果**：恢复原队列并提示错误。

### 页面状态与异常
- **加载中**：曲库查询和播放器状态分别展示。
- **无数据**：曲库无结果或队列为空分别显示独立空状态。
- **网络错误**：曲库查询失败不影响已存在的底部正式队列。
- **无权限**：未登录时跳转 `/sign-in`。
- **重复提交**：移除动作提交中禁止重复点击。
- **分页逻辑**：沿用现有曲库分页/加载策略。
- **搜索逻辑**：沿用现有 FTS / LIKE 双路径。
- **排序逻辑**：曲库排序与队列顺序独立；队列顺序不允许拖拽。

## 模块 E：复杂业务逻辑图

```mermaid
flowchart TD
  A[曲库点播] --> B[replaceQueueFromUserIntent(user-library)]
  B --> C[requestPlayTrack]
  C --> D[打开队列抽屉]
  D --> E{用户操作}
  E -->|点击队列项| F[播放该项]
  E -->|移除非当前项| G[更新 queue]
  E -->|移除当前项| H[按当前模式切下一首或停止]
  E -->|清空| I[停止并清空 queue]
```
