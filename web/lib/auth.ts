import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/prisma";

function parseTrustedOrigins() {
  const defaultOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
  ];
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const fromBaseUrl = (() => {
    try {
      return [new URL(process.env.BETTER_AUTH_URL!).origin];
    } catch {
      return [];
    }
  })();

  return [...new Set([...defaultOrigins, ...fromBaseUrl, ...configuredOrigins])];
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: parseTrustedOrigins(),
});
