import { PrismaPg } from "@prisma/adapter-pg";

// Prisma ORM v7: import PrismaClient from the generated output (NOT from @prisma/client).
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPostgresConnectionString() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error("DATABASE_URL is required for PostgreSQL");
  }

  if (configuredUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must point to PostgreSQL, not SQLite");
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection string");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the postgresql:// protocol");
  }

  if (!parsed.username || !parsed.password) {
    throw new Error("DATABASE_URL must include both username and password");
  }

  return configuredUrl;
}

const postgresConnectionString = getPostgresConnectionString();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: postgresConnectionString,
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
