# 生产部署教程

这套方案面向 NAS 生产部署：

- Web 和 worker 都跑 Docker
- NAS 只负责拉取镜像和启动容器
- NAS 不执行构建

对应启动文件是 [`docker-compose.prod.yml`](./docker-compose.prod.yml)。

## 总体流程

1. 在 GitHub 上打一个 `v*.*.*` tag
2. GitHub Actions 自动构建并推送镜像到 GHCR 和 Docker Hub
3. 在 NAS 上填写生产环境变量
4. 让 NAS 只执行 `pull` 和 `up`

## 一次性准备

1. 确认 NAS 已安装 Docker / Container Manager。
2. 确认 NAS 宿主机已经能访问音乐目录，例如 `/volume1/music`。
3. 使用本仓库自带的 GitHub Actions，把镜像发布到 GHCR 和 Docker Hub。

## 第一步：启用 GitHub Actions 自动发布

仓库已经包含自动发布 workflow：

- [`.github/workflows/release-images.yml`](./.github/workflows/release-images.yml)

这个 workflow 会在你推送 `v*.*.*` tag 时自动：

- 构建 `web` 镜像
- 构建 `worker` 镜像
- 同时发布 `linux/amd64` 和 `linux/arm64`
- 推送到 `ghcr.io`

默认镜像名：

- `ghcr.io/<github-owner>/music-tagger-web:<tag>`
- `ghcr.io/<github-owner>/music-tagger-worker:<tag>`
- `docker.io/<dockerhub-username>/music-tagger-web:<tag>`
- `docker.io/<dockerhub-username>/music-tagger-worker:<tag>`

例如这个仓库会发布成：

- `ghcr.io/namehu/music-tagger-web:v0.1.0`
- `ghcr.io/namehu/music-tagger-worker:v0.1.0`

### 如何触发一次发布

在本地执行：

```bash
git tag v0.1.0
git push origin v0.1.0
```

推送后，GitHub Actions 会自动开始构建并发布镜像。

### 第一次使用时需要确认

1. 仓库的 GitHub Actions 已启用。
2. 仓库允许 `GITHUB_TOKEN` 写入 packages。
3. 在仓库 Secrets 中配置 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN`。
4. 如果 GHCR 包默认是私有的，NAS 拉取时要先 `docker login ghcr.io`。

## 第二步：在 NAS 准备环境文件

在 NAS 上进入项目目录：

```bash
cp .env.prod.example .env.prod
```

然后参考 [`.env.prod.example`](./.env.prod.example) 修改 `.env.prod`：

```dotenv
WEB_IMAGE="ghcr.io/namehu/music-tagger-web:v0.1.0"
WORKER_IMAGE="ghcr.io/namehu/music-tagger-worker:v0.1.0"
BETTER_AUTH_SECRET="replace-me-with-a-long-random-secret"
BETTER_AUTH_URL="http://nas-or-domain:3000"
BETTER_AUTH_TRUSTED_ORIGINS="http://nas-ip:3000,https://music.example.com"
NAS_MUSIC_DIR="/volume1/music"
DB_DATA_DIR="data"
CACHE_DIR="transcode_cache"
WORKER_ID="worker-1"
WEB_PORT="3000"
```

变量说明：

- `WEB_IMAGE`：Web 生产镜像
- `WORKER_IMAGE`：worker 生产镜像
- `BETTER_AUTH_SECRET`：必须替换成真实随机密钥
- `BETTER_AUTH_URL`：用户实际访问 Web 的地址
- `BETTER_AUTH_TRUSTED_ORIGINS`：反向代理、域名或额外访问入口
- `NAS_MUSIC_DIR`：NAS 宿主机上的音乐目录绝对路径；现在会同时挂载给 `web` 和 `worker`
- `DB_DATA_DIR`：数据库持久化位置。填 `data` 表示用 Docker named volume；填 `/volume1/docker/music-tagger/data` 表示直接挂到 NAS 目录
- `CACHE_DIR`：缓存持久化位置。填 `transcode_cache` 表示用 Docker named volume；填 `/volume1/docker/music-tagger/cache` 表示直接挂到 NAS 目录
- `WEB_PORT`：宿主机对外暴露端口

## 数据库初始化原则

生产环境不需要提供 `example.db` 或预置 SQLite 文件。

正确做法是：

- 提交 Prisma schema 和 migrations
- 容器启动时执行 `pnpm prisma migrate deploy`
- 首次启动时自动创建 `/data/app.db`

因此仓库里应该保留：

- [`web/prisma/schema.prisma`](./web/prisma/schema.prisma)
- [`web/prisma/migrations`](./web/prisma/migrations)

而不应该提交：

- `web/dev.db`
- `app.db`
- `*.db-wal`
- `*.db-shm`

## 第三步：在 NAS 登录 GHCR

如果镜像是私有包，先在 NAS 上登录 GHCR：

```bash
docker login ghcr.io
```

## 第四步：在 NAS 拉取并启动

拉取镜像：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
```

启动容器：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

查看状态：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

查看日志：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
```

## 第一次上线后的初始化

1. 打开 `BETTER_AUTH_URL/setup`
2. 创建首个管理员
3. 登录后进入 `/admin/jobs`
4. 触发一次 `scan_full`
5. 到 `/admin/library` 确认扫描结果，并测试原始音频播放

## 关于原始音频播放

现在 `web` 服务也会把 `NAS_MUSIC_DIR` 挂载到容器内的 `/music`：

- `worker` 用它扫描音乐目录并写入索引
- `web` 用它直出原始音频流（`/api/stream/[trackId]`）

因此生产环境里，`web` 和 `worker` 必须指向同一份 `NAS_MUSIC_DIR`。

## 后续更新流程

你的更新流程应该始终保持下面这条线：

1. 在本地创建并推送新的 `v*.*.*` tag
2. 在 NAS 修改 `.env.prod` 中的镜像 tag
3. 在 NAS 执行：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

这条流程不会在 NAS 本地执行构建；构建发生在 GitHub Actions。

## 持久化与备份

- SQLite 数据库存放在 `/data/app.db`
- 默认情况下，compose 会使用 `data` named volume 持久化数据库
- 如果你希望在 NAS 文件系统里直接看到数据库文件，可以把 `DB_DATA_DIR` 改成宿主机绝对路径，例如 `/volume1/docker/music-tagger/data`
- `CACHE_DIR` 也支持同样的写法
- `transcode_cache` 目录已预留，后续做播放/转码时可继续沿用

如果你需要备份，优先备份：

- `DB_DATA_DIR` 指向的数据目录，或者 `data` named volume
- `.env.prod`
