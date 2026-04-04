# Playlist Implementation Plan

## 背景与目标

- 建立普通用户默认入口与用户区壳层。
- 为个人歌单提供最小可用能力：CRUD、加歌、移歌、顺序点播。

## 影响范围

- 页面：`/dashboard`、`/library`、`/playlists`、`/playlists/[playlistId]`
- tRPC：新增 `playlists` router；`playback` 增补用户区轮询接口
- Prisma：新增 `Playlist`、`PlaylistItem`
- 壳层：用户壳与管理壳拆分

## 任务拆分顺序

1. 重构登录后入口与壳层。
2. 抽离用户区与管理区共享的曲库浏览组件。
3. 新增 Playlist 数据模型与迁移。
4. 新增 `playlists` router。
5. 实现歌单列表页与详情页。
6. 回写 baseline / PRD / README。

## 数据与接口变更

- 新增表：
  - `playlists`
  - `playlist_items`
- 新增 router：
  - `playlists`
- 调整默认登录入口：
  - `/sign-in` 默认 callback 改到 `/dashboard`

## 测试计划

- `pnpm lint:web`
- `pnpm build:web`
- 最小自动化测试：登录后默认入口相关 helper
- 人工验证：
  - 普通用户不能进入 `/admin`
  - 管理员可从用户区进入 `/admin`
  - 歌单 CRUD / 加歌 / 移歌 / 点播可用

## 回写与验收

- 更新 `README.md`
- 更新 `docs/architecture.md`
- 更新 `docs/baseline/*`
- 新增 `docs/prd/playlist/*`
