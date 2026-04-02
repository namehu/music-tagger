import { TRPCError } from "@trpc/server";

import {
  AdminInitializationError,
  createAdminInputSchema,
  getAdminInitializationStatus,
  initializeAdmin,
} from "@/lib/admin-init";

import { publicProcedure, router } from "../trpc";

function toTrpcError(error: unknown) {
  if (error instanceof AdminInitializationError) {
    if (error.code === "ALREADY_INITIALIZED" || error.code === "INITIALIZING") {
      return new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
    }

    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "初始化失败",
    cause: error,
  });
}

export const setupRouter = router({
  status: publicProcedure.query(async () => getAdminInitializationStatus()),

  createAdmin: publicProcedure
    .input(createAdminInputSchema)
    .mutation(async ({ input }) => {
      try {
        return await initializeAdmin(input);
      } catch (err) {
        throw toTrpcError(err);
      }
    }),
});
