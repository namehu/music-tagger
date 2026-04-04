# 本地音乐管理工具

一个基于 Next.js、tRPC、Prisma(SQLite) 和 Python worker 的本地音乐库控制台。当前版本已经支持：

- 首次初始化管理员账号
- 触发与查看 `scan_full` 后台任务
- 扫描本地音乐目录并写入 SQLite 索引
- 在 Web 控制台浏览最小音乐库统计、曲目列表与全文搜索
- 原始音频直出播放与 `mp3_192` 转码缓存播放
- 转码缓存观测、容量治理与策略配置
- `rename` / `tag_write` 类型的 Plan 预览、确认与后台执行

暂未支持：

- Dashboard / Jobs 当前播放摘要
- 播放模式：顺序 / 随机 / 单曲循环
- 封面、歌词、move、delete 等其他类型的 Plan 执行链路

## 项目结构

- [`web/`](./web): Next.js 16 控制台，包含认证、tRPC、Prisma 与管理页面
- [`worker/`](./worker): Python worker，负责领取 jobs 并执行扫描
- [`docs/`](./docs): 设计稿与使用文档

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

- 系统架构说明：[`docs/architecture.md`](./docs/architecture.md)
- 当前系统基线：[`docs/baseline/product-baseline.md`](./docs/baseline/product-baseline.md)
- 当前能力矩阵：[`docs/baseline/module-baseline-current-capabilities.md`](./docs/baseline/module-baseline-current-capabilities.md)
- PRD 驱动开发约定：[`docs/prd/README.md`](./docs/prd/README.md)
- 首个模块 PRD（Plan Workflow）：[`docs/prd/plan-workflow/summary.md`](./docs/prd/plan-workflow/summary.md)
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
3. 进入 `/admin/library` 验证扫描结果与播放链路。
4. 进入 `/admin/plans` 创建 `rename` Plan，生成 preview 并执行。
5. 进入 `/admin/cache` 查看异常缓存、冷缓存与清理动作。
6. 进入 `/admin/settings` 调整冷缓存天数、容量预算和单次清理上限。

更多细节见 [`web/README.md`](./web/README.md) 和 [`worker/README.md`](./worker/README.md)。
