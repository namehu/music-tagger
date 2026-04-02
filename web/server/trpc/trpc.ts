import { initTRPC, TRPCError } from "@trpc/server";

import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const protectedMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});

const adminMiddleware = t.middleware(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export const protectedProcedure = publicProcedure.use(protectedMiddleware);
export const adminProcedure = protectedProcedure.use(adminMiddleware);

