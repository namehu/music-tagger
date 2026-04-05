---
doc_type: normalized-brief
product: music-tagger
module: library-dashboard
version: v1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - web/server/trpc/routers/library.ts
  - web/app/(app)/(user)/dashboard/page.tsx
---

# 标准化需求摘要

- 模块目标：把用户区 `/dashboard` 从轻量入口页升级为“继续收听 + 最近使用”的真实首页。
- 目标用户：所有已登录用户；管理员在用户区内也复用同一套首页。
- v1 范围：
  - `/dashboard`
  - `library.dashboard`
  - 最近播放
  - 最近更新的歌单
  - 最近更新的曲目
- v1 不包含：
  - 真实最近打开歌单历史
  - 趋势图和统计图
  - 推荐系统
  - 新 Prisma model
