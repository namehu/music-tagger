# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Read this first, then `AGENTS.md` for workflow rules,
> `docs/architecture.md` for system design, and `docs/baseline/` for current capabilities.

---

## Project Overview

A self-hosted **local music library console** built with Next.js 16 (web) + Python worker.

**Monorepo layout** managed by pnpm workspaces:
- `web/` — Next.js 16 App Router, tRPC, Prisma v7 + SQLite, better-auth
- `worker/` — Python polling worker that runs background jobs (scan, transcode, tag-write)
- `docs/` — Architecture, baselines, PRDs, implementation plans

The stack is intentionally simple: **one SQLite database**, no external services required.

---

## Build System & Package Manager

- **Package manager**: pnpm 8 (`pnpm-workspace.yaml` defines `web/` and `worker/` as packages)
- **Web framework**: Next.js 16 with App Router, TypeScript strict mode
- **Linter**: ESLint 9 (`web/eslint.config.mjs`) with `eslint-config-next`
- **Worker runtime**: Python 3.11, single dependency `mutagen>=1.47`
- **Worker Docker base**: `python:3.11-slim-bookworm` with `ffmpeg` installed

### Root-level scripts (run from repo root)

```bash
pnpm install                 # install all workspace deps
pnpm dev:web                 # start Next.js dev server (web/)
pnpm build:web               # production build
pnpm start:web               # start production server
pnpm lint:web                # ESLint for web/
pnpm prisma:migrate          # prisma migrate dev (creates/applies migrations)
pnpm prisma:studio           # open Prisma Studio

# Run all web tests
pnpm test:web

# Validate Python syntax
python3 -m py_compile worker/*.py

# Install Python deps (if needed locally)
python3 -m pip install -r worker/requirements.txt
```

### Web-only scripts (run from `web/` with `pnpm -C web <script>` or inside `web/`)

```bash
pnpm -C web exec prisma generate    # regenerate Prisma client (after schema change)
```

---

## Directory Structure

```
music-tagger/
├── web/                          # Next.js 16 frontend + API
│   ├── app/                      # App Router pages & Route Handlers
│   │   ├── (app)/                # authenticated layout group
│   │   │   ├── (user)/           # user-facing pages: dashboard, library, playlists, ignored-tracks
│   │   │   └── admin/            # admin pages: jobs, library, cache, plans, settings, ignored-tracks
│   │   ├── _trpc/                # tRPC client provider (provider.tsx)
│   │   ├── api/
│   │   │   ├── stream/[trackId]/ # audio streaming Route Handler (NOT tRPC)
│   │   │   ├── admin/tracks/     # cover upload endpoint
│   │   │   ├── auth/             # better-auth handler
│   │   │   └── trpc/             # tRPC HTTP handler
│   │   ├── layout.tsx            # root layout (wraps TRPCProvider + Toaster)
│   │   └── globals.css
│   ├── server/
│   │   └── trpc/
│   │       ├── root.ts           # AppRouter — aggregates all sub-routers
│   │       ├── trpc.ts           # publicProcedure / protectedProcedure / adminProcedure
│   │       ├── context.ts        # TRPCContext (session + user + prisma)
│   │       └── routers/          # library, jobs, playback, playlists, plans,
│   │                             #   ignoredTracks, settings, setup, trackEdits, tracks
│   ├── components/
│   │   ├── playback/             # global-player.tsx, playback-runtime.tsx, lyrics-panel.tsx
│   │   ├── library/              # library-browser.tsx, track-edit-sheet.tsx
│   │   ├── shell/                # navigation chrome (admin shell)
│   │   └── ui/                   # shadcn/ui + base-ui components
│   ├── store/
│   │   ├── playback-store.ts     # zustand store (user + admin playback sessions)
│   │   └── middleware/
│   │       └── computed.ts       # zustand computed-values middleware
│   ├── lib/                      # server + shared utilities
│   │   ├── auth.ts               # better-auth instance
│   │   ├── prisma.ts             # Prisma client singleton (better-sqlite3 adapter)
│   │   ├── playback.ts           # token signing, path resolution, PLAYBACK_PROFILES
│   │   ├── track-edits.ts        # DB-first edit helpers
│   │   ├── ignored-tracks.ts     # visibility surface helpers
│   │   ├── lyrics.ts             # LRC/ELRC format detection & validation
│   │   ├── app-routes.ts         # route constants
│   │   └── *.test.mts            # Node test-runner tests (10 test files)
│   ├── prisma/
│   │   ├── schema.prisma         # canonical DB schema
│   │   └── migrations/           # Prisma migration history
│   ├── generated/prisma/         # generated Prisma client (gitignored if regenerated)
│   ├── prisma.config.ts          # Prisma v7 config (external FTS tables declared here)
│   ├── next.config.ts            # standalone output, CSP headers, allowedDevOrigins
│   ├── tsconfig.json             # strict TS, paths: @/* -> ./
│   └── .env.example              # template for web/.env
├── worker/
│   ├── worker.py                 # main poll loop + SQLite reconnect + job dispatch
│   ├── jobs.py                   # claim / heartbeat / progress / done / failed
│   ├── scanner.py                # scan_full: walk music dir, ffprobe, upsert tracks
│   ├── transcoder.py             # transcode_prepare: ffmpeg mp3_192, atomic write to /cache
│   ├── track_edit_sync.py        # track_edit_sync: async write-back of DB edits to audio files
│   ├── plan_executor.py          # plan_execute: legacy rename/move/tag_write executor
│   ├── track_edit_assets.py      # cover asset path helpers
│   ├── requirements.txt          # mutagen>=1.47,<2
│   ├── Dockerfile                # python:3.11-slim-bookworm + ffmpeg
│   └── tests/
│       ├── test_scanner.py
│       └── test_plan_executor.py
├── docs/
│   ├── architecture.md           # CURRENT system architecture (authoritative)
│   ├── architecture/             # playback-runtime-and-modes.md
│   ├── baseline/
│   │   ├── product-baseline.md              # what is actually implemented
│   │   └── module-baseline-current-capabilities.md
│   ├── prd/                      # per-module PRDs (playlist, playback-modes, etc.)
│   ├── implementation-plans/     # engineering plans
│   ├── adr/                      # architecture decision records
│   ├── archive/                  # historical raw requirements (NOT current facts)
│   ├── local-development.md
│   └── production-deployment.md
├── docker-compose.dev.yml        # dev: only worker in Docker, web on host
├── docker-compose.prod.yml       # prod: both web + worker in Docker
├── .env.dev.example              # template for worker env in dev
├── .env.prod.example             # template for production deployment
├── schema.sql                    # raw SQL draft (reference only; Prisma migrations are authoritative)
├── package.json                  # root pnpm workspace scripts
├── pnpm-workspace.yaml           # packages: [web, worker]
├── AGENTS.md                     # agent workflow rules (READ THIS)
└── CLAUDE.md                     # ← this file
```

---

## Testing Setup

### Web tests — Node built-in test runner (no Jest/Vitest)

Tests live alongside source files in `web/lib/` as `*.test.mts` files.

```bash
# Run all web tests (from repo root)
pnpm test:web

# Run a single test file
node --test web/lib/lyrics.test.mts
node --test web/lib/playback-store.test.mts
```

All 10 test files are listed explicitly in the root `package.json` `test:web` script.

### Python tests — unittest

```bash
# From repo root
python3 -m unittest discover -s worker/tests

# Single test file
python3 -m unittest worker/tests/test_scanner.py
python3 -m unittest worker/tests/test_plan_executor.py
```

Tests set up an in-memory SQLite schema manually and mock `ffprobe`.

### Type-checking (no separate tsc run; Next.js build covers it)

```bash
pnpm build:web     # full type check + lint happens implicitly during build
pnpm lint:web      # ESLint only
```

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `web/prisma/schema.prisma` | Database schema — source of truth for all models |
| `web/prisma.config.ts` | Prisma v7 config; declares FTS5 virtual tables as external |
| `web/next.config.ts` | `standalone` output, CSP header, `allowedDevOrigins` |
| `web/tsconfig.json` | `@/*` path alias maps to `web/*` |
| `web/eslint.config.mjs` | ESLint 9 flat config (next/core-web-vitals + next/typescript) |
| `web/.env.example` | Env var template for local web development |
| `.env.dev.example` | Env var template for dev Docker worker |
| `.env.prod.example` | Env var template for production deployment |
| `docker-compose.dev.yml` | Dev compose: worker only (web runs on host) |
| `docker-compose.prod.yml` | Prod compose: both web + worker |
| `pnpm-workspace.yaml` | Declares `web` and `worker` as pnpm workspace packages |

### Required environment variables

**`web/.env`** (copy from `web/.env.example`):
```
DATABASE_URL=file:./dev.db
BETTER_AUTH_SECRET=<random secret>
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=          # comma-separated extra origins
MUSIC_ROOT_HOST_PATH=                  # maps /music/... → host path (dev only)
CACHE_ROOT_HOST_PATH=../.cache/transcode_cache
```

**`.env.dev`** (copy from `.env.dev.example`, used by docker-compose.dev.yml):
```
LOCAL_MUSIC_DIR=/absolute/path/to/music
LOCAL_CACHE_DIR=/absolute/path/to/repo/.cache/transcode_cache
WORKER_ID=worker-dev
```

---

## Architecture Pattern

### Layers

```
Browser
  └─ tRPC (React Query) → /api/trpc
  └─ audio streaming    → /api/stream/[trackId]  (Range-aware, NOT tRPC)

Next.js Web (App Router)
  ├─ better-auth  — session cookies, email+password
  ├─ tRPC server  — 10 routers, 3 procedure types (public / protected / admin)
  └─ Prisma v7    — better-sqlite3 adapter, SQLite WAL mode

SQLite (single file: web/dev.db in dev, /data/app.db in prod)
  — ALL business data: auth, jobs, tracks, edits, playlists, cache index

Python Worker (polls jobs table every 2s)
  ├─ scanner.py      — scan_full (ffprobe + upsert tracks)
  ├─ transcoder.py   — transcode_prepare (ffmpeg mp3_192, atomic rename)
  ├─ track_edit_sync.py — track_edit_sync (write metadata/lyrics/cover back to file)
  └─ plan_executor.py  — plan_execute (legacy: rename/move/tag_write)
```

### tRPC router map (`web/server/trpc/root.ts`)

| Router key | Purpose |
|-----------|---------|
| `library` | Stats, track listing/search (FTS5), cache prune |
| `jobs` | List, get, trigger scan_full |
| `playback` | resolve URL, getPreparationStatus, getTrackMedia |
| `playlists` | CRUD, add/remove tracks, reorder |
| `ignoredTracks` | User-level and global ignore management |
| `plans` | List and get plan history (legacy execution compat) |
| `settings` | Read/update transcode policy (`admin_settings`) |
| `setup` | First-run admin initialization |
| `trackEdits` | DB-first metadata/lyrics/cover edit + retry sync |
| `tracks` | Individual track lookup |

### Auth middleware pattern

```ts
// web/server/trpc/trpc.ts
publicProcedure   // no auth required
protectedProcedure // requires session (any logged-in user)
adminProcedure    // requires session + role === "admin"
```

Context (`TRPCContext`) always includes `session`, `user`, and `prisma`.

---

## Data Model Key Points

### DB-first Track Editing

Track metadata/lyrics/cover edits use a **3-table overlay pattern**:
- `tracks` — scan-observed values (written by `scan_full`)
- `track_metadata_edits` / `track_lyrics_edits` / `track_cover_edits` — admin edit true values
- `syncStatus`: `pending → running → synced | failed`
- Web writes edit table first → UI shows edit value immediately → worker runs `track_edit_sync` to write back to file
- `scan_full` never overwrites edit true values

### Jobs Queue (`jobs` table)

Worker atomically claims jobs with `BEGIN IMMEDIATE`. Fields:
- `type`: `scan_full | transcode_prepare | track_edit_sync | plan_execute`
- `status`: `pending | running | done | failed`
- `lockedBy`, `lockedAt`, `heartbeatAt` — used for stale job recovery
- `payloadJson`, `errorJson` — JSON blobs

### Transcode Cache (`transcode_cache` table)

Unique key: `(trackId, profile, sourceMtimeMs)`. When source file changes (`mtimeMs`), old cache becomes stale automatically. Cache files are stored at `/cache/` (Docker volume).

### Playback Token

`/api/stream/[trackId]` is a special Route Handler (not tRPC) that handles HTTP `Range` requests. It uses HMAC-SHA256 signed tokens (TTL: 1 hour) generated by `playback.resolve` tRPC call.

---

## State Management (Frontend)

### Zustand playback store (`web/store/playback-store.ts`)

Two sessions in one store: `user` (persistent, survives page nav) and `admin` (temporary preview):

```ts
sessions.user  — queue, displayTrack, activePlayback, playbackMode, shuffleHistory,
                 resumeTimeSec, volume, muted, hydrationStatus ...
sessions.admin — same shape but no persistence
```

- `localStorage` persists only the user session (queue, track, mode, progress, volume)
- After refresh: state is restored but **playback URLs are NOT persisted** — `playback.resolve` is re-called
- Default on restore: **paused** (no auto-play)
- Computed values (`currentTrack`, `nextTrack`, `canPlayNext`, `isPreparing`, ...) derived via custom `computed` middleware

### Playback modes

`ordered | shuffle | repeat_one` — only the `user` session participates; `admin` session always linear.

---

## Code Patterns to Follow

### Adding a new tRPC procedure

1. Add to the appropriate router file in `web/server/trpc/routers/`
2. Use `protectedProcedure` or `adminProcedure` (never skip auth on sensitive ops)
3. Use Zod schemas for all inputs
4. Access DB via `ctx.prisma`
5. If adding a new router, register it in `web/server/trpc/root.ts`

### Adding a new background job type

1. Add job type string constant in both `worker/jobs.py` dispatch and `web/lib/jobs.ts`
2. Web side: create a tRPC mutation that inserts into `jobs` with dedup check
3. Worker side: add handler in `worker/worker.py` dispatch switch
4. Document payload shape in `docs/architecture.md`

### Prisma schema changes

```bash
# After editing web/prisma/schema.prisma:
pnpm prisma:migrate          # creates migration + applies it
pnpm -C web exec prisma generate   # regenerates client
```

FTS5 virtual tables (`tracks_fts*`) are declared as external in `prisma.config.ts` — Prisma ignores them in migrations.

### File path conventions

- In the DB: paths use container-rooted format (`/music/Artist/Album/track.flac`)
- In dev (web on host): `MUSIC_ROOT_HOST_PATH` env var remaps `/music/` → host path
- In prod: actual bind-mount at `/music/` inside container

---

## Development Workflow

### First-time local setup

```bash
# 1. Install deps
pnpm install

# 2. Configure web env
cp web/.env.example web/.env
# Edit web/.env: set BETTER_AUTH_SECRET, MUSIC_ROOT_HOST_PATH, CACHE_ROOT_HOST_PATH

# 3. Init database
pnpm prisma:migrate

# 4. Start web
pnpm dev:web

# 5. Configure + start worker (Docker)
cp .env.dev.example .env.dev
# Edit .env.dev: set LOCAL_MUSIC_DIR, LOCAL_CACHE_DIR
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build -d
```

### Worker Docker commands (dev)

```bash
# View logs
docker compose --env-file .env.dev -f docker-compose.dev.yml logs -f worker

# Restart worker (after Python code changes)
docker compose --env-file .env.dev -f docker-compose.dev.yml restart worker

# Stop
docker compose --env-file .env.dev -f docker-compose.dev.yml down
```

### Production deployment

Images are pushed to GHCR and Docker Hub on `v*.*.*` tags via `.github/workflows/release-images.yml`.

```bash
# On NAS / server — pull and start
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Web container auto-runs `prisma migrate deploy` on startup before starting the server.

---

## Important Invariants

- **`/api/stream/[trackId]`** is the only non-tRPC API that must stay as a Route Handler (needs HTTP Range support)
- **`/admin/library`** edit flow: always `trackEdits.*` tRPC → DB write first, then worker async → do NOT use Plan/override flow for metadata editing
- **Plan module** is in maintenance mode: read history + compat execution only; do not add new edit flows through it
- **FTS5 tables** (`tracks_fts*`) are maintained by raw SQL in migrations; never let Prisma manage them
- **`scan_full` never overwrites** `track_*_edit` true values
- **`global_ignored_tracks.trackId`** is globally unique; one track can have at most one global ignore record
- The **playback token secret** reuses `BETTER_AUTH_SECRET`; never hard-code a fallback in production

---

## Fact Source Priority (when docs and code conflict)

1. Code / Prisma migrations / worker behavior ← most authoritative
2. `docs/architecture.md`
3. `docs/baseline/*`
4. `docs/prd/<module>/*`
5. `docs/implementation-plans/*`
6. `docs/archive/raw-requirements/*` ← historical input only, NOT current facts

---

## Quick Reference: Key File Paths

| What | Where |
|------|-------|
| tRPC router root | `web/server/trpc/root.ts` |
| DB schema | `web/prisma/schema.prisma` |
| Prisma client | `web/lib/prisma.ts` |
| Auth setup | `web/lib/auth.ts` |
| Playback store | `web/store/playback-store.ts` |
| Playback runtime | `web/components/playback/playback-runtime.tsx` |
| Audio stream handler | `web/app/api/stream/[trackId]/route.ts` |
| tRPC context | `web/server/trpc/context.ts` |
| Worker main loop | `worker/worker.py` |
| Job primitives | `worker/jobs.py` |
| Scanner | `worker/scanner.py` |
| Transcoder | `worker/transcoder.py` |
| Track edit sync | `worker/track_edit_sync.py` |
| Architecture doc | `docs/architecture.md` |
| Product baseline | `docs/baseline/product-baseline.md` |
| PRD index | `docs/prd/README.md` |
