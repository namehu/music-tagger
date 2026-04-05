# Worker（Python）

本目录提供一个**最小可运行**的 Python worker，用于从 SQLite 的 `jobs` 表领取任务并执行。

## 依赖

- Python 3.9+
- `ffprobe`（真实扫描时用于提取音频元数据）
- `ffmpeg`（转码缓存时用于生成 `mp3_192`）
- `mutagen`（`tag_write` 类型 Plan 写回媒体标签时使用）
- 已存在的 SQLite 数据库（默认使用 `web/dev.db`）

## 运行

在仓库根目录执行：

```bash
python3 -m pip install -r worker/requirements.txt
python worker/worker.py
```

可选环境变量：

- `DATABASE_URL`：数据库地址，支持 `file:` 前缀  
  - 默认：`../web/dev.db`（相对 `worker/worker.py`）
  - 示例：`DATABASE_URL=file:./web/dev.db`
- `MUSIC_ROOT`：音乐根目录（默认 `/music`）
- `CACHE_ROOT`：转码缓存根目录（默认 `/cache`）
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

worker 领取后会调用 `scan_full`，遍历 `MUSIC_ROOT` 下支持的音频文件，并把基础元数据、已有嵌入歌词与封面观察值写入（或更新）`tracks` 表。

当前 worker 已支持两类任务：

- `scan_full`
- `transcode_prepare`
- `plan_execute`（当前支持 `rename`、`move` 与 `tag_write` 类型 Plan）

## SQLite 自动重连

worker 现在会在两类情况下自动重连 SQLite：

- 数据库文件被 migration / 重建后，检测到文件指纹变化
- 轮询或写回过程中遇到 `sqlite3.Error`

这意味着在本地开发时，执行 `pnpm prisma:migrate` 之后通常不再需要手工重启 worker，它会在下一轮轮询时自动切换到新的数据库连接。

注意：

- 如果你在 worker 正在执行长任务时直接替换数据库文件，当前任务仍可能受影响
- 更稳妥的开发习惯仍然是：避免在任务运行中做破坏性 schema 变更

## Docker

如果通过 Docker 部署，推荐直接使用 [`worker/Dockerfile`](/Users/namehu/github/music-tagger/worker/Dockerfile)，镜像内已经安装 `ffmpeg` 和 `mutagen` 依赖，因此同时具备 `ffprobe` 能力与标签写回能力，无需在 NAS 宿主机额外手工安装。

启动方式分成两条：

- 本地开发：使用 [`docker-compose.dev.yml`](/Users/namehu/github/music-tagger/docker-compose.dev.yml)，让 worker 跑在 Docker，Web 跑在宿主机
- 生产部署：使用 [`docker-compose.prod.yml`](/Users/namehu/github/music-tagger/docker-compose.prod.yml)，让 NAS 只拉镜像并启动

完整步骤见 [`docs/local-development.md`](/Users/namehu/github/music-tagger/docs/local-development.md) 和 [`docs/production-deployment.md`](/Users/namehu/github/music-tagger/docs/production-deployment.md)。
