# Web 控制台

`web/` 是本项目的 Next.js 16 控制台，负责：

- better-auth 登录与管理员初始化
- tRPC 控制面接口
- Prisma + SQLite 数据访问
- 用户区、管理区、全局播放器与音乐库管理页

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
- `MUSIC_ROOT_HOST_PATH`: 本地开发时把 `/music/...` 映射回宿主机音乐目录
- `CACHE_ROOT_HOST_PATH`: 本地开发时把 `/cache/...` 映射回宿主机转码缓存目录

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
- `/sign-in`: 登录页
- `/dashboard`: 用户首页
- `/library`: 用户曲库
- `/playlists`: 个人歌单列表
- `/playlists/[playlistId]`: 歌单详情
- `/ignored-tracks`: 我的忽略
- `/admin`: 概览页
- `/admin/jobs`: 最近任务与 `scan_full` 触发入口
- `/admin/library`: 音乐库统计、搜索和曲目列表
- `/admin/ignored-tracks`: 全局忽略列表
- `/admin/plans`: Plan 列表
- `/admin/cache`: 缓存明细、容量治理、失败与失效排查
- `/admin/settings`: 转码与缓存策略配置

## 当前边界

已支持：

- 首次管理员初始化
- better-auth 登录与基础角色控制
- `scan_full` 入队、去重、轮询查看
- 音乐目录真实扫描、基础索引浏览与全文搜索
- 全局原始音频播放与 `mp3_192` 转码缓存播放
- 顺序 / 随机 / 单曲循环三种播放模式
- `zustand` 全局播放状态与浏览器本地恢复
- 个人歌单与双层忽略曲目
- `rename` / `tag_write` 类型的 Plan 工作流
- 转码缓存命中观测、失败分类、容量治理与按曲目清理
- 冷缓存阈值、容量预算、单次清理上限的后台配置

暂未支持：

- 多设备播放会话同步
- 封面、歌词、move、delete 等更高阶 Plan 类型

## 推荐使用顺序

1. 在 `/admin` 或 `/admin/jobs` 触发一次 `scan_full`，确认最近扫描状态正常。
2. 在 `/library` 验证用户曲库搜索、播放与刷新恢复链路。
3. 在 `/playlists` 创建歌单，并在歌单详情页验证歌单上下文点播。
4. 在 `/ignored-tracks` 和 `/admin/ignored-tracks` 验证双层忽略。
5. 在 `/admin/cache` 与 `/admin/settings` 查看缓存治理和策略配置。

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
