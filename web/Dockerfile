FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g pnpm@8.15.9

WORKDIR /app

FROM base AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm fetch --frozen-lockfile

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --offline

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .

RUN --mount=type=cache,target=/app/web/.next/cache \
  BETTER_AUTH_SECRET="build-placeholder-secret-32-chars-ok" \
  BETTER_AUTH_URL="http://localhost:3000" \
  DATABASE_URL="postgresql://music_tagger:music_tagger@127.0.0.1:5432/music_tagger?schema=public" \
  pnpm -C web build

RUN pnpm deploy --filter web --prod /app/prod-web

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/web/public ./web/public
COPY --from=builder --chown=nextjs:nodejs /app/web/prisma ./web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/web/prisma.config.ts ./web/prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prod-web/node_modules ./web/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/standalone ./

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "cd /app/web && npx prisma migrate deploy --schema=prisma/schema.prisma && node /app/web/server.js"]
