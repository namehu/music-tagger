import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

// Prisma ORM v7: import PrismaClient from the generated output (NOT from @prisma/client).
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getSqliteConnectionString(): string {
  // Requirement: PrismaBetterSqlite3({ url: <absolute file path> })
  // For SQLite connection strings Prisma expects `file:` protocol.
  // When running `pnpm -C web dev`, process.cwd() should be `<repo>/web`.
  const absoluteDbPath = path.resolve(process.cwd(), "dev.db");
  return `file:${absoluteDbPath}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: getSqliteConnectionString() }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

