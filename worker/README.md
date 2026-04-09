# Worker（Python）

本目录提供一个**最小可运行**的 Python worker，用于从 PostgreSQL 的 `jobs` 表领取任务并执行。

## 依赖

- Python 3.9+
- `ffprobe`（真实扫描时用于提取音频元数据）
- `ffmpeg`（转码缓存时用于生成 `mp3_192`）
- `mutagen`（`tag_write` 类型 Plan 写回媒体标签时使用）
- 可访问的 PostgreSQL 数据库（本地开发默认由 `docker-compose.dev.yml` 提供）

## 运行

在仓库根目录执行：

```bash
python3 -m pip install -r worker/requirements.txt
python worker/worker.py
```

可选环境变量：

- `DATABASE_URL`：PostgreSQL 连接串
  - 示例：`DATABASE_URL=postgresql://music_tagger:music_tagger@localhost:5432/music_tagger?schema=public`
- `MUSIC_ROOT`：音乐根目录（默认 `/music`）
- `CACHE_ROOT`：转码缓存根目录（默认 `/cache`）
- `WORKER_ID`：worker 标识（默认自动生成 `worker-xxxxxx`）

示例：

```bash
DATABASE_URL=postgresql://music_tagger:music_tagger@localhost:5432/music_tagger?schema=public MUSIC_ROOT=/music WORKER_ID=worker-local python worker/worker.py
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

worker 领取后会调用 `scan_full`，遍历 `MUSIC_ROOT` 下支持的音频文件，并把基础元数据、已有嵌入歌词与封面观察值写入（或更新）`tracks` 表。

封面观察值当前规则：

- 优先读取音频同目录、同 basename 的 `.jpg/.png` sidecar
- 没有 sidecar 时，才会从音频内嵌封面提取并落地为同名 sidecar
- `track_edit_sync` 会继续把 sidecar 异步嵌回音频文件

当前 worker 已支持两类任务：

- `scan_full`
- `transcode_prepare`
- `plan_execute`（当前支持 `rename`、`move` 与 `tag_write` 类型 Plan）

## PostgreSQL 连接说明

worker 现在直接连接 PostgreSQL，不再依赖文件级数据库句柄、WAL 共享视图或本地数据库文件轮询。

注意：

- 本地开发时，请先把 PostgreSQL 和 migrations 准备好，再启动 worker
- 如果你重建了数据库 schema，建议重启 worker 让它重新建立连接

## Docker

如果通过 Docker 部署，推荐直接使用 [`worker/Dockerfile`](/Users/namehu/github/music-tagger/worker/Dockerfile)，镜像内已经安装 `ffmpeg` 和 `mutagen` 依赖，因此同时具备 `ffprobe` 能力与标签写回能力，无需在 NAS 宿主机额外手工安装。

启动方式分成两条：

- 本地开发：使用 [`docker-compose.dev.yml`](/Users/namehu/github/music-tagger/docker-compose.dev.yml)，让 PostgreSQL 和 worker 跑在 Docker，Web 跑在宿主机
- 生产部署：使用 [`docker-compose.prod.yml`](/Users/namehu/github/music-tagger/docker-compose.prod.yml)，让 PostgreSQL、Web 和 worker 都跑在 Docker

完整步骤见 [`docs/local-development.md`](/Users/namehu/github/music-tagger/docs/local-development.md) 和 [`docs/production-deployment.md`](/Users/namehu/github/music-tagger/docs/production-deployment.md)。
