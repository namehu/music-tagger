# 本地开发教程

这套方案面向日常开发：

- Web 跑在宿主机，直接用浏览器访问 `http://localhost:3000`
- worker 跑在 Docker 里，容器内自带 `ffmpeg/ffprobe`
- Web 和 worker 共用同一个 SQLite 文件：`web/dev.db`

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
DATABASE_URL="file:./dev.db"
BETTER_AUTH_SECRET="replace-me"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_TRUSTED_ORIGINS=""
```

4. 准备 Docker worker 的环境文件：

```bash
cp .env.dev.example .env.dev
```

5. 参考 [`.env.dev.example`](./.env.dev.example) 修改 `.env.dev`：

```dotenv
LOCAL_MUSIC_DIR="/absolute/path/to/your/music"
WORKER_ID="worker-dev"
```

`LOCAL_MUSIC_DIR` 必须填宿主机上的绝对路径。

6. 初始化数据库迁移：

```bash
pnpm prisma:migrate
```

这里不需要额外准备 `example.db`。首次迁移会自动创建本地开发数据库，`web/dev.db` 属于本机运行产物，不应该提交到仓库。

7. 启动本地 Web：

```bash
pnpm dev:web
```

8. 新开一个终端，启动 Docker worker：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build -d
```

## 开发时如何使用

1. 打开 `http://localhost:3000/setup`，创建首个管理员。
2. 登录后进入 `/admin/jobs`，触发一次 `scan_full`。
3. 打开 `/admin/library`，确认曲目已经被扫出来。

## 常用命令

启动 worker：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build -d
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
- 数据仍然落在本地 `web/dev.db`，排查方便
