# 生产部署教程

这套方案面向 NAS 生产部署：

- Web、worker 和 PostgreSQL 都跑 Docker
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
POSTGRES_USER="music_tagger"
POSTGRES_PASSWORD="replace-me-with-a-long-random-password"
POSTGRES_DB="music_tagger"
BETTER_AUTH_SECRET="replace-me-with-a-long-random-secret"
BETTER_AUTH_URL="http://nas-or-domain:3000"
BETTER_AUTH_TRUSTED_ORIGINS="http://nas-ip:3000,https://music.example.com"
NAS_MUSIC_DIR="/volume1/music"
DB_DATA_DIR="db_data"
CACHE_DIR="transcode_cache"
WORKER_ID="worker-1"
WEB_PORT="3000"
```

变量说明：

- `WEB_IMAGE`：Web 生产镜像
- `WORKER_IMAGE`：worker 生产镜像
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`：生产 PostgreSQL 连接参数，`web` 和 `worker` 会通过 compose 连接同一个数据库服务
- `BETTER_AUTH_SECRET`：必须替换成真实随机密钥
- `BETTER_AUTH_URL`：用户实际访问 Web 的地址
- `BETTER_AUTH_TRUSTED_ORIGINS`：反向代理、域名或额外访问入口
- `NAS_MUSIC_DIR`：NAS 宿主机上的音乐目录绝对路径；现在会同时挂载给 `web` 和 `worker`，且两者都需要可写。`web` 负责把管理员上传的封面直接写成音频同目录 sidecar，`worker` 负责元数据 / 歌词 / 封面异步回写
- `DB_DATA_DIR`：PostgreSQL 数据持久化位置。填 `db_data` 表示用 Docker named volume；填 `/volume1/docker/music-tagger/data` 表示直接挂到 NAS 目录
- `CACHE_DIR`：缓存持久化位置。填 `transcode_cache` 表示用 Docker named volume；填 `/volume1/docker/music-tagger/cache` 表示直接挂到 NAS 目录
- `WEB_PORT`：宿主机对外暴露端口

## 数据库初始化原则

生产环境不需要提供 `example.db` 或预置数据库文件。

正确做法是：

- 提交 Prisma schema 和 migrations
- 容器启动时执行 `pnpm prisma migrate deploy`
- 首次启动时自动初始化 PostgreSQL schema
- 数据落在 PostgreSQL 容器的数据卷中，而不是 `web` 或 `worker` 容器里

因此仓库里应该保留：

- [`web/prisma/schema.prisma`](./web/prisma/schema.prisma)
- [`web/prisma/migrations`](./web/prisma/migrations)

而不应该提交：

- 任何本地数据库快照或导出文件

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
6. 再点播一首未缓存的曲目，确认 `mp3_192` 转码任务能进入 `done`，随后播放恢复正常
7. 打开 `/admin/cache`，确认缓存记录已出现；必要时进入 `/admin/settings` 调整冷缓存天数、容量预算和单次清理上限

## 关于原始音频播放

现在 `web` 服务也会把 `NAS_MUSIC_DIR` 挂载到容器内的 `/music`：

- `worker` 用它扫描音乐目录并写入索引
- `worker` 也用它把元数据、歌词、封面异步写回源文件，因此这里必须是可写挂载
- `worker` 在没有 sidecar 时，还会把嵌入封面提取为音频同目录 sidecar
- `web` 用它直出原始音频流（`/api/stream/[trackId]`）
- `web` 也用它把管理员上传的封面直接写为音频同目录、同 basename 的 `.jpg/.png` sidecar

因此生产环境里，`web` 和 `worker` 必须指向同一份 `NAS_MUSIC_DIR`，并且都要对其具备写权限。

## 关于数据库与缓存持久化

结论先说：

- 可以持久化
- 当前生产 compose 已经支持持久化
- 只要 `DB_DATA_DIR` 和 `CACHE_DIR` 指向 named volume 或 NAS 宿主机目录，容器重建和镜像升级都不会清掉 PostgreSQL 数据或转码缓存

当前生产 compose 中：

```yaml
postgres:
  volumes:
    - ${DB_DATA_DIR:-db_data}:/var/lib/postgresql/data

web:
  volumes:
    - ${CACHE_DIR:-transcode_cache}:/cache

worker:
  volumes:
    - ${CACHE_DIR:-transcode_cache}:/cache
```

这意味着：

- `postgres` 负责持久化所有业务数据
- `worker` 负责向 `/cache` 写入转码文件
- `web` 负责从同一份 `/cache` 读取缓存并输出流
- 数据和缓存都不保存在容器镜像层里，而是保存在 Docker volume 或宿主机目录里

### 两种持久化方案

#### 方案 A：Docker named volume

```dotenv
DB_DATA_DIR="db_data"
CACHE_DIR="transcode_cache"
```

特点：

- 配置简单
- 容器删除后 PostgreSQL 数据仍保留
- 容器删除后缓存仍保留
- 镜像升级后数据仍保留
- 镜像升级后缓存仍保留
- 但备份和直接查看文件不如宿主机目录直观

适合：

- 先快速上线
- 单机 NAS、运维要求较轻

#### 方案 B：NAS 宿主机目录

```dotenv
DB_DATA_DIR="/volume1/docker/music-tagger/data"
CACHE_DIR="/volume1/docker/music-tagger/cache"
```

特点：

- 最直观
- 最容易做备份
- 最容易观察实际数据库与缓存文件占用
- 更适合生产长期运行

适合：

- 你明确重视缓存持久化
- 需要把缓存纳入日常运维和备份策略

### 推荐生产配置

生产环境更推荐：

```dotenv
DB_DATA_DIR="/volume1/docker/music-tagger/data"
CACHE_DIR="/volume1/docker/music-tagger/cache"
```

这样：

- 数据库与缓存都不依赖 Docker 项目名
- NAS 迁移、备份、排查更方便
- 即使完全重建容器，只要路径不变，数据和缓存就都还在

### 当前后台可做的缓存运维

当前版本不依赖额外 cron 或外部调度，缓存运维主要由后台页面人工触发：

- `/admin`
  - 看缓存健康、ready 总量、转码命中率
- `/admin/cache`
  - 清理 stale / failed / orphan
  - 清理冷缓存
  - 按预算裁剪缓存
  - 按单曲清理缓存
- `/admin/settings`
  - 配置冷缓存天数
  - 配置容量预算
  - 配置单次批量清理上限

这套方式的优点是：

- 不引入额外调度系统
- 运维动作可见、可控
- 更适合当前单机 NAS 阶段

### 推荐的日常运维节奏

建议在生产里按这个频率使用后台：

1. 每次大批量导入后，到 `/admin` 看最近扫描和缓存健康。
2. 发现转码失败或 pending 异常时，到 `/admin/jobs` 看失败原因。
3. 每周或空间告警时，到 `/admin/cache` 处理 stale / failed / orphan，并按冷缓存或预算裁剪。
4. 当存储压力或使用习惯变化时，到 `/admin/settings` 调整阈值，而不是直接改代码或手工删目录。

### 什么情况下缓存会丢

下面这些情况，缓存通常不会丢：

- `docker compose pull`
- `docker compose up -d`
- 更新镜像 tag
- 重建容器
- 重启 NAS

下面这些情况，缓存可能会丢：

- 你手工删除了 `transcode_cache` named volume
- 你把 `CACHE_DIR` 改到了另一个新路径
- 宿主机目录被清空
- 整个 Docker 数据目录被清理

### 当前缓存命中规则

当前缓存是按下面的键定位的：

- `trackId`
- `profile`
- `sourceMtimeMs`

对应的缓存文件路径形如：

```text
/cache/tracks/<trackId>/<sourceMtimeMs>/mp3_192.mp3
```

这意味着：

- 源文件没有变化时，可以重复命中已有缓存
- 源文件一旦更新时间变化，就会生成新版本缓存
- 旧缓存不会被误播到新文件版本上

### 生产验证方法

部署完成后，可以这样确认缓存确实在持久化：

1. 播放一首此前没播过的曲目，等待首次转码完成。
2. 确认 `/admin/jobs` 里出现并完成一条 `transcode_prepare`。
3. 在 NAS 上检查 `CACHE_DIR` 下是否生成了 `mp3_192.mp3` 文件。
4. 执行一次镜像升级或 `docker compose up -d`。
5. 再次播放同一首歌，应该直接命中缓存，而不是重新转码。

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

- PostgreSQL 数据库存放在 `/var/lib/postgresql/data`
- 默认情况下，compose 会使用 `db_data` named volume 持久化数据库
- 如果你希望在 NAS 文件系统里直接看到数据库文件，可以把 `DB_DATA_DIR` 改成宿主机绝对路径，例如 `/volume1/docker/music-tagger/data`
- `CACHE_DIR` 也支持同样的写法，而且当前已经真实用于 `mp3_192` 转码缓存
- 如果你重视持久化与备份，建议把 `DB_DATA_DIR` 和 `CACHE_DIR` 都改成宿主机绝对路径

如果你需要备份，优先备份：

- `DB_DATA_DIR` 指向的数据目录，或者 `data` named volume
- `CACHE_DIR` 指向的缓存目录，或者 `transcode_cache` named volume
- `.env.prod`
