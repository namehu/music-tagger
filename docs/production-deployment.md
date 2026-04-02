# 生产部署教程

这套方案面向 NAS 生产部署：

- Web 和 worker 都跑 Docker
- NAS 只负责拉取镜像和启动容器
- NAS 不执行构建

对应启动文件是 [`docker-compose.prod.yml`](/Users/namehu/github/music-tagger/docker-compose.prod.yml)。

## 总体流程

1. 在你的开发机或 CI 上构建镜像
2. 把镜像推送到远程镜像仓库
3. 在 NAS 上填写生产环境变量
4. 让 NAS 只执行 `pull` 和 `up`

## 一次性准备

1. 确认 NAS 已安装 Docker / Container Manager。
2. 确认 NAS 宿主机已经能访问音乐目录，例如 `/volume1/music`。
3. 准备一个远程镜像仓库，例如 Docker Hub、GHCR 或私有 registry。

## 第一步：在开发机或 CI 构建并推送镜像

以下命令在你的开发机执行，不在 NAS 执行。

### 单平台构建

如果你已经确认 NAS 架构，例如 `linux/amd64` 或 `linux/arm64`，可以直接构建对应平台：

```bash
docker buildx build --platform linux/amd64 -f web/Dockerfile -t registry.example.com/music-tagger/web:2026-04-02 --push .
docker buildx build --platform linux/amd64 -f worker/Dockerfile -t registry.example.com/music-tagger/worker:2026-04-02 --push .
```

如果 NAS 是 ARM，请把 `linux/amd64` 改成 `linux/arm64`。

### 多平台构建

如果你希望以后兼容不同 NAS，可以直接推送 multi-arch 镜像：

```bash
docker buildx build --platform linux/amd64,linux/arm64 -f web/Dockerfile -t registry.example.com/music-tagger/web:2026-04-02 --push .
docker buildx build --platform linux/amd64,linux/arm64 -f worker/Dockerfile -t registry.example.com/music-tagger/worker:2026-04-02 --push .
```

## 第二步：在 NAS 准备环境文件

在 NAS 上进入项目目录：

```bash
cp .env.prod.example .env.prod
```

然后参考 [`.env.prod.example`](/Users/namehu/github/music-tagger/.env.prod.example) 修改 `.env.prod`：

```dotenv
WEB_IMAGE="registry.example.com/music-tagger/web:2026-04-02"
WORKER_IMAGE="registry.example.com/music-tagger/worker:2026-04-02"
BETTER_AUTH_SECRET="replace-me-with-a-long-random-secret"
BETTER_AUTH_URL="http://nas-or-domain:3000"
BETTER_AUTH_TRUSTED_ORIGINS="http://nas-ip:3000,https://music.example.com"
NAS_MUSIC_DIR="/volume1/music"
WORKER_ID="worker-1"
WEB_PORT="3000"
```

变量说明：

- `WEB_IMAGE`：Web 生产镜像
- `WORKER_IMAGE`：worker 生产镜像
- `BETTER_AUTH_SECRET`：必须替换成真实随机密钥
- `BETTER_AUTH_URL`：用户实际访问 Web 的地址
- `BETTER_AUTH_TRUSTED_ORIGINS`：反向代理、域名或额外访问入口
- `NAS_MUSIC_DIR`：NAS 宿主机上的音乐目录绝对路径
- `WEB_PORT`：宿主机对外暴露端口

## 第三步：在 NAS 登录镜像仓库

如果你的镜像仓库需要认证，先登录：

```bash
docker login registry.example.com
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
5. 到 `/admin/library` 确认扫描结果

## 后续更新流程

你的更新流程应该始终保持下面这条线：

1. 在开发机或 CI 构建新 tag 镜像并推送
2. 在 NAS 修改 `.env.prod` 中的镜像 tag
3. 在 NAS 执行：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

这条流程不会在 NAS 本地执行构建。

## 持久化与备份

- SQLite 数据库存放在 compose 的 `data` volume 中，对应容器内路径 `/data/app.db`
- `transcode_cache` volume 已预留，后续做播放/转码时可继续沿用

如果你需要备份，优先备份：

- `data` volume
- `.env.prod`
