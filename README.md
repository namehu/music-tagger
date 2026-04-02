# 本地音乐管理工具

一个基于 Next.js、tRPC、Prisma(SQLite) 和 Python worker 的本地音乐库控制台。当前版本已经支持：

- 首次初始化管理员账号
- 触发与查看 `scan_full` 后台任务
- 扫描本地音乐目录并写入 SQLite 索引
- 在 Web 控制台浏览最小音乐库统计与曲目列表

暂未支持：

- 音频播放与转码缓存
- 设置页
- Plan 执行链路
- FTS 搜索

## 项目结构

- [`web/`](/Users/namehu/github/music-tagger/web): Next.js 16 控制台，包含认证、tRPC、Prisma 与管理页面
- [`worker/`](/Users/namehu/github/music-tagger/worker): Python worker，负责领取 jobs 并执行扫描
- [`docs/`](/Users/namehu/github/music-tagger/docs): 设计稿与阶段性实现计划

## 快速开始

1. 安装依赖：

```bash
pnpm install
```

2. 准备环境变量：

```bash
cp web/.env.example web/.env
```

3. 启动 Web：

```bash
pnpm dev:web
```

4. 在浏览器打开 `http://localhost:3000/setup`，创建首个管理员。

5. 启动 worker：

```bash
python3 worker/worker.py
```

可选环境变量：

- `DATABASE_URL`: 默认读取 `web/dev.db`
- `MUSIC_ROOT`: 默认 `/music`
- `WORKER_ID`: worker 实例标识
- `BETTER_AUTH_TRUSTED_ORIGINS`: 额外可信来源，多个值用英文逗号分隔

## 常用命令

```bash
pnpm dev:web
pnpm lint:web
pnpm build:web
pnpm prisma:migrate
pnpm prisma:studio
```

## 当前使用方式

1. 登录后进入 [`/admin/library`](/Users/namehu/github/music-tagger/web/app/(app)/admin/library/page.tsx) 查看库统计与曲目列表。
2. 进入 [`/admin/jobs`](/Users/namehu/github/music-tagger/web/app/(app)/admin/jobs/page.tsx) 触发 `scan_full`，页面会自动轮询任务状态。
3. worker 扫描 `MUSIC_ROOT` 下的音频文件，并把基础元数据和技术信息写入 `tracks` 表。

更多 worker 细节见 [`worker/README.md`](/Users/namehu/github/music-tagger/worker/README.md)。
