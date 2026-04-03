# Web 控制台

`web/` 是本项目的 Next.js 16 控制台，负责：

- better-auth 登录与管理员初始化
- tRPC 控制面接口
- Prisma + SQLite 数据访问
- Jobs 管理页与音乐库浏览页

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

当前需要的变量：

- `DATABASE_URL`: 默认 `file:./dev.db`
- `BETTER_AUTH_SECRET`: better-auth 密钥
- `BETTER_AUTH_URL`: Web 控制台访问地址
- `BETTER_AUTH_TRUSTED_ORIGINS`: 额外可信来源，多个值用英文逗号分隔

## 开发命令

```bash
pnpm dev
pnpm lint
pnpm build
pnpm prisma:migrate
pnpm prisma:studio
```

## 当前页面

- `/setup`: 初始化首个管理员
- `/sign-in`: 管理员登录
- `/admin`: 概览页
- `/admin/jobs`: 最近任务与 `scan_full` 触发入口
- `/admin/library`: 音乐库统计、搜索和曲目列表

## 当前边界

已支持：

- 首次管理员初始化
- 管理员登录
- `scan_full` 入队、去重、轮询查看
- 音乐目录真实扫描、基础索引浏览、全文搜索与原始音频播放

暂未支持：

- 设置页
- 转码缓存与多档位流媒体播放
- Plan/预览/执行工作流

## Docker 运行

`web/Dockerfile` 会在镜像构建阶段完成 `next build`，并在容器启动时自动执行：

```bash
pnpm prisma migrate deploy && pnpm start
```

生产环境请至少提供：

- `DATABASE_URL=file:/data/app.db`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`（可选）

如果你需要完整启动说明：

- 本地开发看 [`docs/local-development.md`](/Users/namehu/github/music-tagger/docs/local-development.md)
- NAS 生产部署看 [`docs/production-deployment.md`](/Users/namehu/github/music-tagger/docs/production-deployment.md)
