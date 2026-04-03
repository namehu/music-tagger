# 本地音乐管理工具

一个基于 Next.js、tRPC、Prisma(SQLite) 和 Python worker 的本地音乐库控制台。当前版本已经支持：

- 首次初始化管理员账号
- 触发与查看 `scan_full` 后台任务
- 扫描本地音乐目录并写入 SQLite 索引
- 在 Web 控制台浏览最小音乐库统计与曲目列表

暂未支持：

- 音频播放与转码缓存
- 设置页
- Plan 执行链路
- FTS 搜索

## 项目结构

- [`web/`](/Users/namehu/github/music-tagger/web): Next.js 16 控制台，包含认证、tRPC、Prisma 与管理页面
- [`worker/`](/Users/namehu/github/music-tagger/worker): Python worker，负责领取 jobs 并执行扫描
- [`docs/`](/Users/namehu/github/music-tagger/docs): 设计稿与使用文档

## 两套启动方案

### 1. 本地快速开发

- Web 跑在宿主机：`pnpm dev:web`
- worker 跑在 Docker：[`docker-compose.dev.yml`](/Users/namehu/github/music-tagger/docker-compose.dev.yml)
- 适合日常开发与调试页面

完整教程见 [`docs/local-development.md`](/Users/namehu/github/music-tagger/docs/local-development.md)。

### 2. NAS 生产部署

- Web 和 worker 都跑 Docker
- NAS 只拉取镜像并启动，不在 NAS 上构建
- 使用 [`docker-compose.prod.yml`](/Users/namehu/github/music-tagger/docker-compose.prod.yml)

完整教程见 [`docs/production-deployment.md`](/Users/namehu/github/music-tagger/docs/production-deployment.md)。

### 3. 自动镜像发布

- 打 `v*.*.*` tag 后，GitHub Actions 会自动构建并推送 `web` / `worker` 镜像到 GHCR 和 Docker Hub
- workflow 文件在 [`.github/workflows/release-images.yml`](/Users/namehu/github/music-tagger/.github/workflows/release-images.yml)

## 环境文件模板

- 本地开发 worker 环境：[`.env.dev.example`](/Users/namehu/github/music-tagger/.env.dev.example)
- 生产部署环境：[`.env.prod.example`](/Users/namehu/github/music-tagger/.env.prod.example)
- Web 本地开发环境：[`web/.env.example`](/Users/namehu/github/music-tagger/web/.env.example)

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
2. 进入 `/admin/jobs` 触发 `scan_full`。
3. 进入 `/admin/library` 验证扫描结果。

更多细节见 [`web/README.md`](/Users/namehu/github/music-tagger/web/README.md) 和 [`worker/README.md`](/Users/namehu/github/music-tagger/worker/README.md)。
