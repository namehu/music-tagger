# 本地音乐管理工具

一个基于 Next.js、tRPC、Prisma(SQLite) 和 Python worker 的本地音乐库控制台。当前版本已经支持：

- 首次初始化管理员账号
- 登录后进入用户音乐区：`/dashboard`、`/library`、`/playlists`、`/ignored-tracks`
- 用户首页支持继续收听、最近播放、最近更新歌单和最近更新曲目
- 触发与查看 `scan_full` 后台任务
- 扫描本地音乐目录并写入 SQLite 索引，同时提取已有嵌入歌词与封面观察值
- 在 Web 控制台浏览最小音乐库统计、曲目列表与全文搜索
- 原始音频直出播放与 `mp3_192` 转码缓存播放
- 顺序 / 随机 / 单曲循环三种全局播放模式
- 浏览器本地播放会话恢复：刷新后恢复队列、曲目、模式、进度和音量，并默认暂停
- 个人歌单的创建、重命名、删除、加歌、移歌与顺序点播
- 双层忽略曲目：用户“我的忽略”与管理员“全局忽略”
- 管理员单曲编辑：元数据、歌词、封面先写数据库，再异步回写源文件
  - 如果 worker 跑在 Docker 里，挂载给 worker 的音乐目录必须可写，否则 `track_edit_sync` 会失败
- 转码缓存观测、容量治理与策略配置

暂未支持：

- 多设备播放会话同步或数据库级播放状态持久化
- 更高阶的文件整理动作主流程

## 项目结构

- [`web/`](./web): Next.js 16 控制台，包含认证、tRPC、Prisma 与管理页面
- [`worker/`](./worker): Python worker，负责领取 jobs 并执行扫描
- [`docs/`](./docs): 架构、基线、PRD 与使用文档

## 两套启动方案

### 1. 本地快速开发

- Web 跑在宿主机：`pnpm dev:web`
- worker 跑在 Docker：[`docker-compose.dev.yml`](./docker-compose.dev.yml)
- 适合日常开发与调试页面

完整教程见 [`docs/local-development.md`](./docs/local-development.md)。

### 2. NAS 生产部署

- Web 和 worker 都跑 Docker
- NAS 只拉取镜像并启动，不在 NAS 上构建
- 使用 [`docker-compose.prod.yml`](./docker-compose.prod.yml)
- 数据库通过 migrations 自动初始化，不需要提交 `example.db`

完整教程见 [`docs/production-deployment.md`](./docs/production-deployment.md)。

### 3. 自动镜像发布

- 打 `v*.*.*` tag 后，GitHub Actions 会自动构建并推送 `web` / `worker` 镜像到 GHCR 和 Docker Hub
- workflow 文件在 [`.github/workflows/release-images.yml`](./.github/workflows/release-images.yml)

## 环境文件模板

- 本地开发 worker 环境：[`.env.dev.example`](./.env.dev.example)
- 生产部署环境：[`.env.prod.example`](./.env.prod.example)
- Web 本地开发环境：[`web/.env.example`](./web/.env.example)

## 关键文档

- Agent 快速切入指南：[`AGENT.md`](./AGENT.md)
- 系统架构说明：[`docs/architecture.md`](./docs/architecture.md)
- 播放器状态架构：[`docs/architecture/playback-runtime-and-modes.md`](./docs/architecture/playback-runtime-and-modes.md)
- 当前系统基线：[`docs/baseline/product-baseline.md`](./docs/baseline/product-baseline.md)
- 当前能力矩阵：[`docs/baseline/module-baseline-current-capabilities.md`](./docs/baseline/module-baseline-current-capabilities.md)
- PRD 驱动开发约定：[`docs/prd/README.md`](./docs/prd/README.md)
- 历史需求输入归档：[`docs/archive/README.md`](./docs/archive/README.md)
- 本地开发：[`docs/local-development.md`](./docs/local-development.md)
- 生产部署与缓存持久化：[`docs/production-deployment.md`](./docs/production-deployment.md)

## 常用命令

```bash
pnpm install
pnpm dev:web
pnpm lint:web
pnpm build:web
pnpm prisma:migrate
pnpm prisma:studio
```

## 当前使用方式

1. 打开 `/setup` 创建首个管理员。
2. 进入 `/admin` 或 `/admin/jobs` 触发 `scan_full`。
3. 进入 `/dashboard` 查看继续收听、最近播放和最近更新歌单。
4. 进入 `/library` 验证普通用户侧的浏览、播放与“我的忽略”链路。
5. 进入 `/playlists` 创建个人歌单，并在歌单详情页加入曲目。
6. 在用户侧底部播放器切换顺序 / 随机 / 单曲循环，刷新页面会尽量恢复到暂停状态；管理台只保留临时试听条。
7. 进入 `/ignored-tracks` 查看和解除自己的忽略曲目。
8. 如需管理任务与策略，管理员可从右上角菜单进入 `/admin`。
9. 在 `/admin/library` 打开单曲编辑面板，验证元数据、歌词、封面“立即生效 + 后台同步”链路。
10. 如需回看历史文件整理记录，再进入 `/admin/plans`。
11. 在 `/admin/ignored-tracks`、`/admin/cache`、`/admin/settings` 完成其他管理操作。

更多细节见 [`web/README.md`](./web/README.md) 和 [`worker/README.md`](./worker/README.md)。
