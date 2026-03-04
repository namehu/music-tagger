# 音乐标签管理应用 - 设计文档

## 1. 项目概述

- **项目名称**: music-tagger
- **项目类型**: Web 全栈应用 (Next.js 16 + SQLite)
- **核心功能**: 音乐扫描、元数据编辑、在线播放
- **目标用户**: 个人音乐爱好者，需要管理本地音乐库

## 2. 技术栈

| 层级 | 技术选择 | 版本 |
|------|----------|------|
| 框架 | Next.js | 16.x |
| 全栈类型 | tRPC | 11.x |
| 数据库 | SQLite + Prisma | - |
| 前端 | React 19.2 + TypeScript | - |
| 样式 | Tailwind CSS | 3.x |
| 音频解析 | music-metadata | 10.x |
| 状态管理 | Zustand | 5.x |
| 部署 | Docker | 24.x |

## 3. Next.js 16 关键变化

### 3.1 proxy.ts 替换 middleware.ts

```ts filename="proxy.ts"
export const runtime = 'nodejs'

export async function proxy(request: Request) {
  // 请求拦截逻辑
}
```

### 3.2 Async Request APIs (强制)

```tsx filename="app/songs/[id]/page.tsx"
export default async function Page(props: PageProps<'/songs/[id]'>) {
  const { id } = await props.params  // 必须 await
  // ...
}
```

### 3.3 Turbopack 默认

```json filename="package.json"
{
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  }
}
```

## 4. 功能设计

### 4.1 音乐扫描

- 用户配置音乐目录路径 (支持本地路径、SMB、NFS)
- 后台扫描目录，递归读取所有音频文件 (mp3, flac, wav, m4a, ogg)
- 解析 ID3 标签，提取: 标题、艺术家、专辑、流派、封面、年份
- 存储到 SQLite 数据库
- 增量更新: 检测新增/删除/修改的文件

### 4.2 音乐库浏览

- 列表视图: 显示所有歌曲 (分页)
- 筛选: 按艺术家、专辑、流派筛选
- 搜索: 标题/艺术家/专辑关键词搜索
- 排序: 按标题、艺术家、添加时间排序

### 4.3 元数据编辑

- 手动编辑: 标题、艺术家、专辑、流派、年份
- 封面编辑: 上传/更换专辑封面
- 批量编辑: 选中多首歌曲，批量设置相同字段
- 保存时同步写入音频文件 ID3 标签

### 4.4 在线播放

- 播放器栏: 固定底部，支持播放/暂停/上一首/下一首
- 进度条: 显示播放进度，支持拖拽跳转
- 音量控制
- 播放列表: 当前播放列表支持添加/移除/重排序

## 5. 数据模型

```prisma
model Song {
  id          String   @id @default(cuid())
  title       String
  artist      String?
  album       String?
  genre       String?
  year        Int?
  duration    Int?
  trackNumber Int?
  filePath    String   @unique
  fileName    String
  coverPath   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Setting {
  id    String @id @default("default")
  value String
}
```

## 6. API 设计 (tRPC)

### 6.1 路由器结构

```
src/server/routers/
├── _app.ts          # 根路由器
├── song.ts          # 歌曲相关
├── scan.ts          # 扫描相关
├── settings.ts      # 设置相关
└── player.ts        # 播放状态
```

### 6.2 核心 API

**song.ts**
- `song.list` - 获取歌曲列表 (分页、筛选、搜索)
- `song.getById` - 获取单首歌曲详情
- `song.update` - 更新歌曲元数据
- `song.batchUpdate` - 批量更新
- `song.delete` - 删除歌曲记录

**scan.ts**
- `scan.start` - 开始扫描目录
- `scan.status` - 获取扫描状态/进度

**settings.ts**
- `settings.get` - 获取设置
- `settings.update` - 更新设置 (如音乐目录)

## 7. 前端页面结构

```
src/
├── app/
│   ├── page.tsx              # 首页 (歌曲列表)
│   ├── layout.tsx            # 根布局 (播放器栏)
│   ├── proxy.ts              # Next.js 16 路由代理 (原 middleware)
│   ├── scan/
│   │   └── page.tsx          # 扫描配置页
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts  # tRPC API 入口
│   └── components/
│       ├── SongTable.tsx     # 歌曲表格
│       ├── PlayerBar.tsx     # 播放器栏
│       ├── SongEditor.tsx    # 歌曲编辑弹窗
│       └── CoverUploader.tsx # 封面上传组件
├── server/
│   ├── trpc.ts               # tRPC 初始化
│   └── routers/              # API 路由
└── lib/
    ├── db.ts                 # Prisma 客户端
    └── music.ts              # 音乐解析工具
```

## 8. 部署设计

### 8.1 Dockerfile

```dockerfile
FROM node:20-alpine AS base

# 依赖安装阶段
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### 8.2 fnOS 部署

1. 在 fnOS 后台创建 Docker 容器
2. 映射端口 3000
3. 挂载音乐文件夹到容器内 `/app/music`
4. 设置数据持久化目录

## 9. 核心流程

### 9.1 扫描流程

```
用户进入扫描页 → 配置音乐目录 → 点击扫描 → 
后端遍历目录 → 解析每个音频文件 ID3 → 
写入数据库 → 返回扫描结果 → 刷新歌曲列表
```

### 9.2 编辑流程

```
点击歌曲 → 弹出编辑弹窗 → 修改字段 → 
点击保存 → tRPC 调用 update → 
Prisma 更新数据库 → 同步写入音频文件 ID3 标签 → 
关闭弹窗 → 列表刷新
```

### 9.3 播放流程

```
点击歌曲 → 添加到播放列表 → 
前端调用 tRPC 获取文件流/URL → 
HTML5 Audio 播放 → 
更新播放器状态 (Zustand) → 
显示播放进度
```

## 10. 后续功能 (可选)

- [ ] 歌词显示 (手动输入/LRC 文件)
- [ ] 播放次数统计
- [ ] 收藏/评分功能
- [ ] 歌单管理
- [ ] 随机播放/循环模式
- [ ] 移动端适配
- [ ] 暗色主题
