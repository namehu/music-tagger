import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

// Prisma ORM v7: import PrismaClient from the generated output (NOT from @prisma/client).
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getSqliteConnectionString(): string {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl) {
    if (configuredUrl.startsWith("file:")) {
      const rawPath = configuredUrl.slice("file:".length);
      const normalizedPath = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(/* turbopackIgnore: true */ process.cwd(), rawPath);
      return `file:${normalizedPath}`;
    }

    throw new Error("DATABASE_URL must use the file: SQLite protocol");
  }

  const absoluteDbPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), "dev.db");
  return `file:${absoluteDbPath}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: getSqliteConnectionString() }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
