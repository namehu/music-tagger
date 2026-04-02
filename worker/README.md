# Worker（Python）

本目录提供一个**最小可运行**的 Python worker，用于从 SQLite 的 `jobs` 表领取任务并执行。

## 依赖

- Python 3.9+（标准库即可）
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

worker 领取后会调用 `scan_full`，并在 `tracks` 表写入（或更新）一条占位记录。

