# Music Tagger 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 创建一个完整的音乐标签管理应用，支持扫描、编辑、播放功能

**Architecture:** Next.js 16 + tRPC + Prisma + SQLite 单体架构，Docker 部署

**Tech Stack:** Next.js 16, tRPC 11, Prisma, SQLite, React 19.2, Tailwind CSS, music-metadata

---

## Task 1: 环境配置与项目初始化

**Step 1: 安装 pnpm**

```bash
# 检查是否有 npm
npm --version || echo "npm not found"
# 如果没有，需要先安装 Node.js
```

**Step 2: 安装依赖**

```bash
cd ~/projects/music-tagger
pnpm install
```

**Step 3: 初始化 Prisma**

```bash
npx prisma generate
npx prisma db push
```

**Step 4: 验证开发服务器**

```bash
npm run dev
# 访问 http://localhost:3000 确认页面正常
```

---

## Task 2: tRPC 基础配置

**Files:**
- Create: `src/server/trpc.ts`
- Create: `src/server/routers/_app.ts`
- Create: `src/server/index.ts`
- Create: `src/lib/db.ts`
- Modify: `src/app/api/trpc/[trpc]/route.ts`

**Step 1: 创建 Prisma 客户端**

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

**Step 2: 创建 tRPC 初始化**

```typescript
// src/server/trpc.ts
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { db } from '@/lib/db'

export const createTRPCContext = async () => {
  return { db }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
```

**Step 3: 创建根路由器**

```typescript
// src/server/routers/_app.ts
import { router } from '../trpc'
import { songRouter } from './song'
import { scanRouter } from './scan'
import { settingsRouter } from './settings'

export const appRouter = router({
  song: songRouter,
  scan: scanRouter,
  settings: settingsRouter,
})

export type AppRouter = typeof appRouter
```

**Step 4: 创建 tRPC API 路由**

```typescript
// src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createTRPCContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  })

export { handler as GET, handler as POST }
```

**Step 5: 创建 tRPC 客户端 Provider**

```typescript
// src/components/TRPCProvider.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { useState } from 'react'
import superjson from 'superjson'
import type { AppRouter } from '@/server/routers/_app'

export const trpc = createTRPCReact<AppRouter>()

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
```

**Step 6: 修改 layout 引入 Provider**

```typescript
// src/app/layout.tsx
import { TRPCProvider } from '@/components/TRPCProvider'

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}
```

---

## Task 3: 歌曲 API (Song Router)

**Files:**
- Create: `src/server/routers/song.ts`
- Create: `src/types/song.ts`

**Step 1: 创建歌曲路由器**

```typescript
// src/server/routers/song.ts
import { router, publicProcedure } from '../trpc'
import { z } from 'zod'

export const songRouter = router({
  list: publicProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
      artist: z.string().optional(),
      album: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, artist, album } = input
      const skip = (page - 1) * limit

      const where: any = {}
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { artist: { contains: search } },
          { album: { contains: search } },
        ]
      }
      if (artist) where.artist = artist
      if (album) where.album = album

      const [songs, total] = await Promise.all([
        ctx.db.song.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        ctx.db.song.count({ where }),
      ])

      return { songs, total, page, limit }
    }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.db.song.findUnique({ where: { id: input } })
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      artist: z.string().optional(),
      album: z.string().optional(),
      genre: z.string().optional(),
      year: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.db.song.update({ where: { id }, data })
    }),

  delete: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.song.delete({ where: { id: input } })
    }),

  batchUpdate: publicProcedure
    .input(z.object({
      ids: z.array(z.string()),
      data: z.object({
        artist: z.string().optional(),
        album: z.string().optional(),
        genre: z.string().optional(),
        year: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { ids, data } = input
      return ctx.db.song.updateMany({
        where: { id: { in: ids } },
        data,
      })
    }),
})
```

---

## Task 4: 扫描 API (Scan Router)

**Files:**
- Create: `src/server/routers/scan.ts`
- Create: `src/lib/music.ts`

**Step 1: 创建音乐解析工具**

```typescript
// src/lib/music.ts
import * as mm from 'music-metadata'

export async function parseAudioFile(filePath: string) {
  try {
    const metadata = await mm.parseFile(filePath)
    const { common, format } = metadata
    
    return {
      title: common.title || '',
      artist: common.artist || '',
      album: common.album || '',
      genre: common.genre?.[0] || '',
      year: common.year,
      duration: Math.round(format.duration || 0),
      trackNumber: common.track?.no,
    }
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error)
    return null
  }
}

export const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac']
```

**Step 2: 创建扫描路由器**

```typescript
// src/server/routers/scan.ts
import { router, publicProcedure } from '../trpc'
import { z } from 'zod'
import { promises as fs } from 'fs'
import { parseAudioFile, SUPPORTED_EXTENSIONS } from '@/lib/music'
import { db } from '@/lib/db'

async function scanDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      if (entry.isDirectory()) {
        const subFiles = await scanDirectory(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'))
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    console.error(`Failed to scan ${dirPath}:`, error)
  }
  return files
}

export const scanRouter = router({
  start: publicProcedure
    .input(z.object({ path: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const files = await scanDirectory(input.path)
      const results = []

      for (const filePath of files) {
        const parsed = await parseAudioFile(filePath)
        if (parsed) {
          const song = await ctx.db.song.upsert({
            where: { filePath },
            update: parsed,
            create: {
              ...parsed,
              filePath,
              fileName: filePath.split('/').pop() || '',
            },
          })
          results.push(song)
        }
      }

      return { total: results.length, files: files.length }
    }),

  status: publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.song.count()
    return { total }
  }),
})
```

---

## Task 5: 设置 API (Settings Router)

**Files:**
- Create: `src/server/routers/settings.ts`

**Step 1: 构建设置路由器**

```typescript
// src/server/routers/settings.ts
import { router, publicProcedure } from '../trpc'
import { z } from 'zod'

export const settingsRouter = router({
  get: publicProcedure
    .input(z.string().optional())
    .query(async ({ ctx, input }) => {
      const key = input || 'musicPath'
      const setting = await ctx.db.setting.findUnique({ where: { id: key } })
      return setting?.value || ''
    }),

  update: publicProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { key, value } = input
      return ctx.db.setting.upsert({
        where: { id: key },
        update: { value },
        create: { id: key, value },
      })
    }),
})
```

---

## Task 6: 前端 - 歌曲列表页面

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/SongTable.tsx`
- Create: `src/hooks/usePlayer.ts`

**Step 1: 创建播放器状态管理**

```typescript
// src/hooks/usePlayer.ts
import { create } from 'zustand'

interface Song {
  id: string
  title: string
  artist: string | null
  album: string | null
  filePath: string
}

interface PlayerState {
  currentSong: Song | null
  playlist: Song[]
  isPlaying: boolean
  play: (song: Song) => void
  addToPlaylist: (song: Song) => void
  setPlaying: (playing: boolean) => void
  next: () => void
  prev: () => void
}

export const usePlayer = create<PlayerState>((set, get) => ({
  currentSong: null,
  playlist: [],
  isPlaying: false,

  play: (song) => set({ currentSong: song, isPlaying: true }),
  
  addToPlaylist: (song) => set((state) => ({
    playlist: [...state.playlist, song]
  })),
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  
  next: () => {
    const { currentSong, playlist } = get()
    if (!currentSong || playlist.length === 0) return
    const idx = playlist.findIndex(s => s.id === currentSong.id)
    const nextIdx = (idx + 1) % playlist.length
    set({ currentSong: playlist[nextIdx] })
  },
  
  prev: () => {
    const { currentSong, playlist } = get()
    if (!currentSong || playlist.length === 0) return
    const idx = playlist.findIndex(s => s.id === currentSong.id)
    const prevIdx = idx === 0 ? playlist.length - 1 : idx - 1
    set({ currentSong: playlist[prevIdx] })
  },
}))
```

**Step 2: 创建歌曲表格组件**

```typescript
// src/components/SongTable.tsx
'use client'
import { trpc } from './TRPCProvider'
import { usePlayer } from '@/hooks/usePlayer'

export function SongTable() {
  const { data, isLoading } = trpc.song.list.useQuery({ page: 1, limit: 50 })
  const { play, addToPlaylist } = usePlayer()

  if (isLoading) return <div>加载中...</div>

  return (
    <table className="w-full">
      <thead>
        <tr className="text-left border-b">
          <th className="p-2">标题</th>
          <th className="p-2">艺术家</th>
          <th className="p-2">专辑</th>
          <th className="p-2">操作</th>
        </tr>
      </thead>
      <tbody>
        {data?.songs.map((song) => (
          <tr key={song.id} className="border-b hover:bg-gray-50">
            <td className="p-2">{song.title}</td>
            <td className="p-2">{song.artist || '-'}</td>
            <td className="p-2">{song.album || '-'}</td>
            <td className="p-2">
              <button
                onClick={() => { play(song); addToPlaylist(song) }}
                className="mr-2 text-blue-600 hover:underline"
              >
                播放
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

**Step 3: 更新首页**

```typescript
// src/app/page.tsx
import { SongTable } from '@/components/SongTable'

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">音乐库</h1>
      <SongTable />
    </main>
  )
}
```

---

## Task 7: 前端 - 播放器栏

**Files:**
- Create: `src/components/PlayerBar.tsx`

**Step 1: 创建播放器栏组件**

```typescript
// src/components/PlayerBar.tsx
'use client'
import { usePlayer } from '@/hooks/usePlayer'
import { useRef, useEffect } from 'react'

export function PlayerBar() {
  const { currentSong, isPlaying, setPlaying, next, prev } = usePlayer()
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.src = `/api/music?path=${encodeURIComponent(currentSong.filePath)}`
      if (isPlaying) audioRef.current.play()
    }
  }, [currentSong])

  useEffect(() => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.play() : audioRef.current.pause()
    }
  }, [isPlaying])

  if (!currentSong) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4">
      <audio ref={audioRef} onEnded={next} />
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">{currentSong.title}</div>
          <div className="text-sm text-gray-400">{currentSong.artist}</div>
        </div>
        <div className="flex gap-4">
          <button onClick={prev} className="hover:text-gray-300">上一首</button>
          <button onClick={() => setPlaying(!isPlaying)} className="text-2xl">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={next} className="hover:text-gray-300">下一首</button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 在 layout 中引入播放器栏**

```typescript
// src/app/layout.tsx
import { PlayerBar } from '@/components/PlayerBar'

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>
        <TRPCProvider>
          {children}
          <PlayerBar />
        </TRPCProvider>
      </body>
    </html>
  )
}
```

---

## Task 8: 音乐文件服务

**Files:**
- Create: `src/app/api/music/route.ts`

**Step 1: 创建音乐文件 API**

```typescript
// src/app/api/music/route.ts
import { promises as fs } from 'fs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'No path' }, { status: 400 })

  try {
    const file = await fs.readFile(path)
    const ext = path.split('.').pop()?.toLowerCase() || 'mp3'
    const contentType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`
    
    return new NextResponse(file, {
      headers: { 'Content-Type': contentType },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
```

---

## Task 9: 扫描页面

**Files:**
- Create: `src/app/scan/page.tsx`

**Step 1: 创建扫描页面**

```typescript
// src/app/scan/page.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/components/TRPCProvider'

export default function ScanPage() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState<{ total: number; files: number } | null>(null)
  
  const scanMutation = trpc.scan.start.useMutation({
    onSuccess: (data) => setResult(data),
  })

  const handleScan = () => {
    if (!path) return
    scanMutation.mutate({ path })
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">扫描音乐</h1>
      <div className="mb-4">
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="输入音乐目录路径"
          className="border p-2 w-full max-w-md mr-2"
        />
        <button
          onClick={handleScan}
          disabled={scanMutation.isPending}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {scanMutation.isPending ? '扫描中...' : '开始扫描'}
        </button>
      </div>
      {result && (
        <p>扫描完成: 找到 {result.files} 个文件，导入 {result.total} 首歌曲</p>
      )}
    </main>
  )
}
```

---

## Task 10: Docker 部署配置

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

**Step 2: 创建 docker-compose.yml**

```yaml
services:
  music-tagger:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./music:/app/music
      - ./data:/app/data
    environment:
      - DATABASE_URL=file:/app/data/database.db
```

**Step 3: 创建 .dockerignore**

```
node_modules
.next
.git
docs
*.md
```

---

## Task 11: 验证与测试

**Step 1: 构建项目**

```bash
npm run build
```

**Step 2: 启动开发服务器**

```bash
npm run dev
```

**Step 3: 测试功能**

1. 访问 http://localhost:3000
2. 导航到 /scan 扫描音乐目录
3. 返回首页查看歌曲列表
4. 点击播放测试播放器

---

## 执行选择

**Plan complete and saved to `docs/plans/2026-03-04-music-tagger-implementation.md`. Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
