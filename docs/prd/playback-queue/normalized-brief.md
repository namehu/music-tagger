---
doc_type: normalized-brief
product: music-tagger
module: playback-queue
version: v1
source_refs:
  - README.md
  - docs/architecture.md
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/store/playback-store.ts
  - web/components/playback/global-player.tsx
  - web/components/playback/playback-runtime.tsx
---

# Normalized Brief

## 1. 产品与模块
- 产品名称：Music Tagger
- 模块名称：playback-queue
- 业务目标：把当前“只能隐式切歌”的播放器补齐为可见、可理解、可直接编辑的用户播放队列体验。

## 2. 角色与权限线索
| 角色 | 当前事实 | 待确认项 | 来源 |
| --- | --- | --- | --- |
| 普通用户 | 可在用户区播放、切换模式、恢复浏览器内播放会话 | 无 | `docs/baseline/product-baseline.md` |
| 管理员 | `/admin` 播放已拆成试听会话，不应接管用户正式队列 | 无 | `docs/architecture.md` |

## 3. 页面与从属交互清单
| 名称 | 类型 | 页面职责 | 归属页面/上游入口 | 下游去向 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 用户首页 | 独立页面 | 从最近播放进入用户正式队列 | `/dashboard` | 底部播放器 / 队列抽屉 | `web/app/(app)/(user)/dashboard/page.tsx` |
| 用户曲库页 | 独立页面 | 从曲库替换当前正式队列 | `/library` | 底部播放器 / 队列抽屉 | `web/components/library/library-browser.tsx` |
| 歌单详情页 | 独立页面 | 从歌单顺序进入正式队列 | `/playlists/[playlistId]` | 底部播放器 / 队列抽屉 | `web/app/(app)/(user)/playlists/[playlistId]/page.tsx` |
| 队列抽屉 | 页面内抽屉 | 展示当前队列、当前曲目、Up Next 与基础编辑动作 | 用户侧底部播放器详情入口 | 直接播放 / 移除 / 清空 | `web/components/playback/global-player.tsx` |

## 4. 外部系统与依赖
| 依赖对象 | 依赖类型 | 影响范围 | 已知规则 | 待确认项 |
| --- | --- | --- | --- | --- |
| playback store | 前端状态 | 队列事实源、当前曲目、模式与进度 | 现有 `user/admin` 双会话已落地 | 需补用户会话队列抽屉与队列编辑动作 |
| playback.resolve | API | 点击队列项直接播放 | 继续作为实际播放 URL 唯一入口 | 无 |
| localStorage | 浏览器存储 | 恢复当前用户队列 | 仅 `user` 会话持久化 | 队列编辑后的持久化策略需写清楚 |

## 5. 状态与动作
| 实体 | 状态/动作 | 说明 | 来源 |
| --- | --- | --- | --- |
| 用户正式队列 | 查看 / 直接播放 / 移除单首 / 清空 | v1 只做最小编辑，不做拖拽排序 | 本轮新增 PRD |
| 当前曲目 | 高亮 / 跳转播放 | 队列面板必须清楚标记当前曲目和下一首 | 本轮新增 PRD |
| 队列来源 | user-library / playlist:\<id> / dashboard:recent-plays | 只读展示，不在主条堆叠 | `web/store/playback-store.ts` |

## 6. 字段与约束
| 字段 | 约束 | 默认值 | 适用页面 | 来源 |
| --- | --- | --- | --- | --- |
| queueItems | 当前用户会话完整队列，顺序即真实播放顺序 | `[]` | 用户侧底部播放器抽屉 | `web/store/playback-store.ts` |
| activeTrackId | 当前正式播放曲目 | `null` | 用户侧底部播放器抽屉 | `web/store/playback-store.ts` |
| nextTrackId | 若存在则展示在 Up Next 顶部 | `null` | 用户侧底部播放器抽屉 | 本轮新增 PRD |
| queueSourceKey | 只读展示来源，不可编辑 | `null` | 用户侧底部播放器抽屉 | `web/store/playback-store.ts` |

## 7. 冲突与缺口
| 类型 | 描述 | 影响范围 | 建议处理 |
| --- | --- | --- | --- |
| 待确认 | v1 是否允许“从队列中移除当前正在播放的歌曲” | 用户侧队列抽屉 | 先允许移除，但若移除当前曲目则立即按当前模式切到下一首或停止 |
| 待确认 | 拖拽排序、播放下一首、加入队列尾部是否进入 v1 | 播放器和曲库操作菜单 | 明确放入 v2，不在本轮实现 |
