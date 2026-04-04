# Ignored Tracks Implementation Plan

## 背景与目标

- 建立双层忽略系统，区分用户“我的忽略”和管理员“全局忽略”。
- 让默认曲库、搜索结果和歌单加歌候选自动遵循忽略规则。
- 保持歌单内已存在曲目不被自动删除，只补充忽略来源标记与解除入口。

## 影响范围

- 页面：`/library`、`/ignored-tracks`、`/admin/library`、`/admin/ignored-tracks`、`/playlists/[playlistId]`
- tRPC：新增 `ignoredTracks` router；扩展 `tracks.list` 与 `library.stats`
- Prisma：新增 `UserIgnoredTrack`、`GlobalIgnoredTrack`
- 共享逻辑：新增忽略优先级与默认可见性 helper

## 任务拆分顺序

1. 新增忽略关系模型与 Prisma migration。
2. 抽离忽略优先级和默认可见性 helper。
3. 新增 `ignoredTracks` router，区分用户与管理员权限边界。
4. 扩展 `tracks.list` 与 `library.stats` 的默认过滤语义。
5. 在用户曲库、管理曲库、用户 ignored 列表、管理 ignored 列表接入交互。
6. 在歌单详情页补忽略来源标记和“解除我的忽略”入口。
7. 回写 PRD、baseline、architecture 与 README。

## 数据与接口变更

- 新增表：
  - `user_ignored_tracks`
  - `global_ignored_tracks`
- 新增 router：
  - `ignoredTracks`
- 扩展现有接口：
  - `tracks.list` 增加 `surface`
  - `library.stats` 增加 `surface`
  - `playlists.get` 返回 `ignoreSource` 与 `canUnignoreTrack`

## 测试计划

- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`
- PRD 校验：
  - `python3 /Users/namehu/mm_code/mm-agents/codex-skills/prd-structuring-agent/references/prd-agent-kit/scripts/validate_prd_package.py docs/prd/ignored-tracks`
- 人工验证：
  - 用户区 `/library` 默认过滤 `global + mine`
  - 管理区 `/admin/library` 默认过滤 `global`
  - `/ignored-tracks` 可查看和解除“我的忽略”
  - `/admin/ignored-tracks` 可查看、单曲解除、批量解除“全局忽略”
  - 歌单内被忽略曲目保留，并展示正确的忽略来源标记

## 回写与验收

- 更新 `README.md`
- 更新 `docs/architecture.md`
- 更新 `docs/baseline/*`
- 新增 `docs/prd/ignored-tracks/*`
