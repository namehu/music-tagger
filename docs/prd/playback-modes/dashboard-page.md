---
doc_type: page-spec
product: music-tagger
module: playback-modes
page_id: user_dashboard_playback
page_name: 用户首页
route: /dashboard
permissions:
  - user
  - admin
page: dashboard
version: v1
source_refs:
  - web/app/(app)/(user)/dashboard/page.tsx
  - web/components/playback/current-playback-summary.tsx
  - web/components/playback/global-player.tsx
---

# 用户首页

## 模块 A：页面元数据

- **页面名称**：用户首页
- **访问路由**：`/dashboard`
- **权限要求**：所有已登录用户可访问。

## 模块 B：UI/布局结构

- **页面布局模式**：轻量入口页，当前播放摘要展示全局播放器状态。
- **核心区块划分**：
  - [当前播放摘要区]：展示播放状态、当前模式、当前曲目和恢复进度。
  - [全局播放器区]：底部常驻，提供播放模式切换和上一首/下一首控制。
- **页面内从属交互**：
  - [模式查看]：摘要卡显示当前模式 badge。
  - [继续播放/暂停]：摘要卡按钮复用全局播放器状态。

## 模块 C：数据展示与字段定义

### 字段分组 1：当前播放摘要字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 当前曲目 `currentTrack` | object | 选显 | 无曲目时显示空状态 | `null` |
| 播放模式 `playbackMode` | enum | 必显 | `ordered / shuffle / repeat_one` | `ordered` |
| 恢复进度 `resumeTimeSec` | number | 选显 | 用于显示最近一次持久化进度 | `0` |
| 播放状态 `status` | enum | 必显 | `未播放 / 已暂停 / 播放中 / 准备中 / 播放异常` | `未播放` |

## 模块 D：交互与状态流转

### 操作 1：查看当前播放摘要
- **触发事件**：进入 `/dashboard`。
- **前置校验**：用户已登录。
- **流转结果**：直接读取全局 playback store。
- **成功结果**：摘要区域实时反映底部全局播放器状态。
- **失败结果**：显示空状态或当前错误提示。

### 操作 2：查看或切换播放模式
- **触发事件**：观察摘要 badge，或在底部全局播放器点击模式按钮。
- **前置校验**：当前已有全局播放器可见。
- **流转结果**：调用 `setPlaybackMode`。
- **成功结果**：摘要 badge 与底部模式按钮同步刷新。
- **失败结果**：保留旧模式并展示错误提示。

### 页面状态与异常
- **加载中**：摘要卡不单独 loading，直接消费当前全局状态。
- **无数据**：显示“当前还没有选中的播放曲目”。
- **网络错误**：若播放解析失败，通过全局错误区展示。
- **无权限**：未登录时跳转 `/sign-in`。
- **重复提交**：当前页面本身不直接发起新的网络请求。
- **分页逻辑**：无。
- **搜索逻辑**：无。
- **排序逻辑**：无。

## 模块 E：复杂业务逻辑图

无复杂状态流转。
