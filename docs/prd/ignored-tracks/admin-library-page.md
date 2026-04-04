---
doc_type: page-spec
product: music-tagger
module: ignored-tracks
page_id: admin_library_ignored_tracks
page_name: 管理曲库页
route: /admin/library
permissions:
  - admin
page: admin-library
version: v1
source_refs:
  - web/app/(app)/admin/library/page.tsx
  - web/components/library/library-browser.tsx
  - web/server/trpc/routers/tracks.ts
---

# 管理曲库页

## 模块 A：页面元数据

- **页面名称**：管理曲库页
- **访问路由**：`/admin/library`
- **权限要求**：仅管理员可访问；框架默认控制已生效。

## 模块 B：UI/布局结构

- **页面布局模式**：列表页，沿用管理曲库既有结构，新增全局忽略相关操作。
- **核心区块划分**：
  - [统计卡片区]：展示排除全局忽略后的曲库统计。
  - [搜索排序区]：关键字、排序与编辑筛选。
  - [批量工具区]：在既有批量编辑、批量恢复基础上新增“批量全局忽略”。
  - [曲目表格区]：新增单曲“全局忽略”快捷操作。
- **页面内从属交互**：
  - [全局忽略快捷操作]：行内按钮，直接写入全局忽略。
  - [批量全局忽略操作]：基于当前勾选行直接提交，不额外弹窗。

## 模块 C：数据展示与字段定义

### 字段分组 1：搜索与筛选字段
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 关键字 `q` | string | 选填 | 匹配标题、艺人、专辑、文件名、路径 | 空 |
| 排序 `order` | enum | 必填 | `recent / title / artist` | `recent` |
| 编辑状态 `edited` | enum | 必填 | `all / edited / unedited` | `all` |
| 可见面 `surface` | enum | 必填 | 固定传 `admin`，默认过滤 `global` | `admin` |

### 字段分组 2：批量选择与表格动作
| 字段名称 (中/英) | 数据类型 | 必填/选填 | 业务规则/约束 | 默认值 |
| --- | --- | --- | --- | --- |
| 行选择 `selectedTrackIds` | string[] | 选填 | 仅保存当前可见列表的勾选结果 | 空数组 |
| 单曲全局忽略 `ignoreGlobal` | action | 必显 | 把当前曲目写入 `global_ignored_tracks` | 无 |
| 批量全局忽略 `batchIgnoreGlobal` | action | 选显 | 至少选择 1 首后可触发 | 无 |

## 模块 D：交互与状态流转

### 操作 1：浏览默认管理曲库
- **触发事件**：进入页面、搜索、切换排序、切换编辑筛选。
- **前置校验**：管理员已登录。
- **流转结果**：调用 `tracks.list(surface=admin)` 与 `library.stats(surface=admin)`。
- **成功结果**：默认过滤所有 `global` 忽略曲目，保留非全局忽略曲目。
- **失败结果**：显示列表加载失败提示。

### 操作 2：设置单曲全局忽略
- **触发事件**：点击行内“全局忽略”按钮。
- **前置校验**：当前用户为管理员，曲目存在。
- **流转结果**：调用 `ignoredTracks.ignoreGlobal`，随后刷新曲库、统计和全局忽略列表。
- **成功结果**：写入 `global_ignored_tracks`，曲目从管理曲库和用户曲库默认列表中消失。
- **失败结果**：显示“设为全局忽略失败”提示。

### 操作 3：批量设置全局忽略
- **触发事件**：勾选多行后点击“批量全局忽略”。
- **前置校验**：至少选中 1 首曲目，全部曲目都存在。
- **流转结果**：调用 `ignoredTracks.batchIgnoreGlobal`，随后清空勾选并刷新依赖查询。
- **成功结果**：批量写入 `global_ignored_tracks`，清空选择态并刷新统计。
- **失败结果**：显示“批量设为全局忽略失败”提示。

### 页面状态与异常
- **加载中**：统计卡片、表格和批量区显示 loading。
- **无数据**：显示空状态。
- **网络错误**：显示错误提示，允许重试。
- **无权限**：非管理员不可进入该页。
- **重复提交**：单曲或批量忽略按钮在提交中 disabled。
- **分页逻辑**：v1 不做完整分页。
- **搜索逻辑**：保留既有 FTS / LIKE 双路径，并始终叠加全局忽略过滤。
- **排序逻辑**：支持 `recent / title / artist`。

## 模块 E：复杂业务逻辑图

无复杂状态流转。
