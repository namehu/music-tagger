# 本地开发教程

这套方案面向日常开发：

- Web 跑在宿主机，直接用浏览器访问 `http://localhost:3000`
- PostgreSQL 跑在 Docker 里，负责统一承载业务数据和 jobs 队列
- worker 跑在 Docker 里，容器内自带 `ffmpeg/ffprobe`
- Web 通过本机 `localhost:5432` 连接 PostgreSQL

对应启动文件是 [`docker-compose.dev.yml`](./docker-compose.dev.yml)。

## 前置条件

- Node.js 20+
- pnpm 8
- Docker Desktop 或等价 Docker 环境
- 一份本机可访问的音乐目录

## 第一次启动

1. 安装依赖：

```bash
pnpm install
```

2. 准备 Web 环境变量：

```bash
cp web/.env.example web/.env
```

3. 按需修改 `web/.env`：

```dotenv
DATABASE_URL="postgresql://music_tagger:music_tagger@localhost:5432/music_tagger?schema=public"
BETTER_AUTH_SECRET="replace-me"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_TRUSTED_ORIGINS=""
MUSIC_ROOT_HOST_PATH="/absolute/path/to/your/music"
CACHE_ROOT_HOST_PATH="/absolute/path/to/your/repo/.cache/transcode_cache"
```

`MUSIC_ROOT_HOST_PATH` 用于把数据库里的容器路径 `/music/...` 映射回宿主机真实路径；现在既用于原始音频播放，也用于封面 sidecar 的读取与写入；建议与 `.env.dev` 里的 `LOCAL_MUSIC_DIR` 保持一致，并确保该目录可写。
`CACHE_ROOT_HOST_PATH` 用于播放转码缓存时把数据库里的容器路径 `/cache/...` 映射回宿主机真实路径；建议与 `.env.dev` 里的 `LOCAL_CACHE_DIR` 保持一致。

4. 准备 Docker worker 的环境文件：

```bash
cp .env.dev.example .env.dev
```

5. 参考 [`.env.dev.example`](./.env.dev.example) 修改 `.env.dev`：

```dotenv
POSTGRES_USER="music_tagger"
POSTGRES_PASSWORD="music_tagger"
POSTGRES_DB="music_tagger"
POSTGRES_PORT="5432"
LOCAL_MUSIC_DIR="/absolute/path/to/your/music"
LOCAL_CACHE_DIR="/absolute/path/to/your/repo/.cache/transcode_cache"
WORKER_ID="worker-dev"
```

`LOCAL_MUSIC_DIR` 必须填宿主机上的绝对路径。
`LOCAL_CACHE_DIR` 建议填一个可持久化的宿主机目录，开发环境下 worker 会把 `mp3_192` 转码缓存写到这里。
`POSTGRES_PORT` 默认映射到宿主机 `5432`，如果你本机已经占用该端口，可以改成别的值并同步更新 `web/.env` 里的 `DATABASE_URL`。

6. 启动 PostgreSQL：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d postgres
```

7. 初始化数据库迁移：

```bash
pnpm prisma:migrate
```

数据库第一次创建后会写入 PostgreSQL named volume，不再需要本地数据库文件。

8. 启动本地 Web：

```bash
pnpm dev:web
```

9. 新开一个终端，启动 Docker worker：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build -d worker
```

## 开发时如何使用

1. 打开 `http://localhost:3000/setup`，创建首个管理员。
2. 登录后进入 `/admin/jobs`，触发一次 `scan_full`。
3. 打开 `/admin/library`，确认曲目已经被扫出来。

## 常用命令

启动 postgres + worker：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build -d postgres worker
```

查看日志：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml logs -f worker
```

重启 worker：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml restart worker
```

停止 worker：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml down
```

## 这套方案的特点

- 不需要在宿主机安装 `ffmpeg` 或 `ffprobe`
- Web 改代码后直接走 Next.js 本地开发体验
- worker 改代码后重启容器即可生效
- 数据落在 PostgreSQL named volume 里，Web 和 worker 会看到同一份真实状态
- 开发数据可以通过 `docker compose --env-file .env.dev -f docker-compose.dev.yml down -v` 一次性重置
- 封面 sidecar 直接落在宿主机音乐目录，同目录持久化，不再依赖项目内资产目录
- 转码缓存也会落在宿主机目录里，本地 Web 可直接读取并验证完整播放链路
