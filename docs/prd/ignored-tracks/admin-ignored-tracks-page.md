---
doc_type: page-spec
product: music-tagger
module: ignored-tracks
page_id: admin_ignored_tracks
page_name: 全局忽略页
route: /admin/ignored-tracks
permissions:
  - admin
page: admin-ignored-tracks
version: v1
source_refs:
  - web/app/(app)/admin/ignored-tracks/page.tsx
  - web/server/trpc/routers/ignoredTracks.ts
---

# 全局忽略页

## 模块 A：页面元数据

- **页面名称**：全局忽略页
- **访问路由**：`/admin/ignored-tracks`
- **权限要求**：仅管理员可访问；框架默认控制已生效。

## 模块 B：UI/布局结构

- **页面布局模式**：说明区 + 带批量选择的表格列表页。
- **核心区块划分**：
  - [说明区]：解释全局忽略会影响所有用户的默认曲库。
  - [忽略列表区]：展示曲目基本信息、设置人、忽略时间、路径和解除入口。
  - [批量工具区]：当存在勾选项时显示“批量解除”。
- **页面内从属交互**：
  - [单曲解除]：行内按钮。
  - [批量解除]：顶部按钮，直接对勾选项执行。

## 模块 C：数据展示与字段定义

### 字段分组 1：忽略列表列
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 选择框 `selectedTrackIds` | string[] | 选填 | 仅保存当前列表可见项 | 空数组 |
| 标题 `track.title` | string | 必显 | 优先显示 override 后标题 | 无 |
| 艺人 `track.artist` | string | 必显 | 无值时显示“未知艺人” | 无 |
| 专辑 `track.album` | string | 选显 | 无值显示 `-` | 空 |
| 设置人 `createdBy.name` | string | 必显 | 展示设置全局忽略的管理员 | 无 |
| 忽略时间 `createdAt` | datetime | 必显 | 本地时区展示 | 无 |
| 路径 `track.path` | string | 必显 | 只读展示 | 无 |
| 单曲解除 `unignoreGlobal` | action | 必显 | 解除单首全局忽略 | 无 |
| 批量解除 `batchUnignoreGlobal` | action | 选显 | 至少勾选 1 项才显示 | 无 |

## 模块 D：交互与状态流转

### 操作 1：查看全局忽略列表
- **触发事件**：进入页面。
- **前置校验**：管理员已登录。
- **流转结果**：调用 `ignoredTracks.listGlobal`。
- **成功结果**：按忽略时间倒序返回。
- **失败结果**：显示列表加载失败提示。

### 操作 2：解除单曲全局忽略
- **触发事件**：点击“解除”。
- **前置校验**：当前用户为管理员。
- **流转结果**：调用 `ignoredTracks.unignoreGlobal`，随后刷新曲库、统计和当前列表。
- **成功结果**：删除对应 `global_ignored_tracks` 记录，并刷新曲库、统计和当前列表。
- **失败结果**：显示“解除全局忽略失败”提示。

### 操作 3：批量解除全局忽略
- **触发事件**：勾选多项后点击“批量解除”。
- **前置校验**：至少勾选 1 项。
- **流转结果**：调用 `ignoredTracks.batchUnignoreGlobal`，随后清空勾选并刷新依赖查询。
- **成功结果**：批量删除对应记录，清空勾选态并刷新依赖查询。
- **失败结果**：显示“批量解除失败”提示。

### 页面状态与异常
- **加载中**：表格区域显示 loading。
- **无数据**：显示“当前没有全局忽略曲目”。
- **网络错误**：显示错误提示，允许重试。
- **无权限**：非管理员不可进入该页。
- **重复提交**：单曲解除和批量解除按钮在提交中 disabled。
- **分页逻辑**：v1 固定最多 200 条，不做翻页。
- **搜索逻辑**：v1 不提供搜索。
- **排序逻辑**：固定按 `createdAt desc`。

## 模块 E：复杂业务逻辑图

无复杂状态流转。
