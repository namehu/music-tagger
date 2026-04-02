# Worker（Python）

本目录提供一个**最小可运行**的 Python worker，用于从 SQLite 的 `jobs` 表领取任务并执行。

## 依赖

- Python 3.9+
- `ffprobe`（真实扫描时用于提取音频元数据）
- 已存在的 SQLite 数据库（默认使用 `web/dev.db`）

## 运行

在仓库根目录执行：

```bash
python worker/worker.py
```

可选环境变量：

- `DATABASE_URL`：数据库地址，支持 `file:` 前缀  
  - 默认：`../web/dev.db`（相对 `worker/worker.py`）
  - 示例：`DATABASE_URL=file:./web/dev.db`
- `MUSIC_ROOT`：音乐根目录（默认 `/music`）
- `WORKER_ID`：worker 标识（默认自动生成 `worker-xxxxxx`）

示例：

```bash
DATABASE_URL=file:./web/dev.db MUSIC_ROOT=/music WORKER_ID=worker-local python worker/worker.py
```

## 投递一个测试任务（scan_full）

可以直接向 `jobs` 表插入一条 `scan_full`：

```sql
INSERT INTO "jobs" (
  "id","type","status","priority","payloadJson","progress","attempts","maxAttempts","createdAt","updatedAt"
) VALUES (
  'job-1','scan_full','pending',0,'{}',0,0,3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);
```

worker 领取后会调用 `scan_full`，遍历 `MUSIC_ROOT` 下支持的音频文件，并把基础元数据与技术信息写入（或更新）`tracks` 表。

## Docker

如果通过 Docker 部署，推荐直接使用 [`worker/Dockerfile`](/Users/namehu/github/music-tagger/worker/Dockerfile)，镜像内已经安装 `ffmpeg`，因此同时具备 `ffprobe` 能力，无需在 NAS 宿主机额外手工安装。

启动方式分成两条：

- 本地开发：使用 [`docker-compose.dev.yml`](/Users/namehu/github/music-tagger/docker-compose.dev.yml)，让 worker 跑在 Docker，Web 跑在宿主机
- 生产部署：使用 [`docker-compose.prod.yml`](/Users/namehu/github/music-tagger/docker-compose.prod.yml)，让 NAS 只拉镜像并启动

完整步骤见 [`docs/local-development.md`](/Users/namehu/github/music-tagger/docs/local-development.md) 和 [`docs/production-deployment.md`](/Users/namehu/github/music-tagger/docs/production-deployment.md)。
