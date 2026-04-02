import { jobsRouter } from "./routers/jobs";
import { setupRouter } from "./routers/setup";
import { router } from "./trpc";

export const appRouter = router({
  jobs: jobsRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;

