import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "node:path";

// Prisma ORM v7: import PrismaClient from the generated output (NOT from @prisma/client).
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getSqliteConnectionPath() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl) {
    if (configuredUrl.startsWith("file:")) {
      const rawPath = configuredUrl.slice("file:".length);
      return path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(/* turbopackIgnore: true */ process.cwd(), rawPath);
    }

    throw new Error("DATABASE_URL must use the file: SQLite protocol");
  }

  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "dev.db");
}

function shouldUseDevelopmentSqlitePragmas(dbPath: string) {
  return path.basename(dbPath) === "dev.db";
}

function initializeDevelopmentSqlitePragmas(dbPath: string) {
  if (!shouldUseDevelopmentSqlitePragmas(dbPath)) {
    return;
  }

  const bootstrapDb = new Database(dbPath);
  try {
    bootstrapDb.pragma("journal_mode = WAL");
    bootstrapDb.pragma("synchronous = NORMAL");
    bootstrapDb.pragma("wal_autocheckpoint = 1000");
  } finally {
    bootstrapDb.close();
  }
}

const sqliteDbPath = getSqliteConnectionPath();
initializeDevelopmentSqlitePragmas(sqliteDbPath);
const sqliteConnectionString = `file:${sqliteDbPath}`;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: sqliteConnectionString,
      timeout: 30_000,
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
