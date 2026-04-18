---
doc_type: normalized-brief
product: music-tagger
module: library-large-list
version: v1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/components/library/library-browser.tsx
  - web/server/trpc/routers/tracks.ts
---

# Normalized Brief

## 1. 产品与模块
- 产品名称：music-tagger
- 模块名称：library-large-list
- 业务目标：让 5000+ 曲目曲库在用户区和管理区都能稳定浏览、搜索、排序、播放和编辑，不再依赖一次性渲染或持久化全量队列。

## 2. 角色与权限线索
| 角色 | 当前事实 | 待确认项 | 来源 |
| --- | --- | --- | --- |
| 登录用户 | 可访问 `/library`，默认过滤全局忽略和自己的忽略曲目 | 无 | baseline |
| 管理员 | 可访问 `/admin/library`，默认过滤全局忽略曲目，可单曲编辑和全局忽略 | 无 | baseline |

## 3. 页面与从属交互清单
| 名称 | 类型 | 页面职责 | 归属页面/上游入口 | 下游去向 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 用户曲库 | 独立页面 | 无限加载、虚拟滚动、搜索、排序、播放、我的忽略 | `/library` | 全局播放器 | library-browser |
| 管理曲库 | 独立页面 | 分页表格、搜索、排序、编辑过滤、单曲编辑、全局忽略、临时试听 | `/admin/library` | 编辑抽屉 / admin 试听 | library-browser |
| 曲库队列窗口 | 运行时能力 | 根据曲库筛选上下文和当前曲目解析邻近播放窗口 | 播放运行时 | `tracks.queueWindow` | tracks router |

## 4. 外部系统与依赖
| 依赖对象 | 依赖类型 | 影响范围 | 已知规则 | 待确认项 |
| --- | --- | --- | --- | --- |
| PostgreSQL | 数据库 | `tracks.list` / `tracks.queueWindow` | 使用稳定排序键分页，展示值优先 edit 真值 | 无 |
| react-virtuoso | 前端库 | 用户曲库列表 | 只渲染可见窗口 | 无 |
| localStorage | 浏览器存储 | 播放会话恢复 | 不持久化曲库全集队列，只保存轻量上下文和窗口 | 无 |

## 5. 状态与动作
| 实体 | 状态/动作 | 说明 | 来源 |
| --- | --- | --- | --- |
| 曲库列表 | cursor 加载 | 用户区按筛选条件向下加载更多 | plan |
| 管理表格 | pageIndex/pageSize | 管理区按页取数并返回总数 | plan |
| 播放队列 | queueContext | 曲库播放保存筛选上下文，由服务端解析邻近曲目 | plan |

## 6. 字段与约束
| 字段 | 约束 | 默认值 | 适用页面 | 来源 |
| --- | --- | --- | --- | --- |
| `limit` | 1-200 | 50 | `tracks.list` | tracks router |
| `cursor` | opaque string | 无 | 用户曲库 | tracks router |
| `pageIndex` | >= 0 | 无 | 管理曲库 | tracks router |
| `queueContext` | source/order/q/surface/edited | 无 | 用户曲库播放 | playback-store |

## 7. 冲突与缺口
| 类型 | 描述 | 影响范围 | 建议处理 |
| --- | --- | --- | --- |
| 已处理 | 大曲库不能一次性渲染或写入完整播放队列 | `/library`、播放器 | 无限加载、虚拟滚动、队列窗口 |
