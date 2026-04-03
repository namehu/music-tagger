import { libraryRouter } from "./routers/library";
import { jobsRouter } from "./routers/jobs";
import { playbackRouter } from "./routers/playback";
import { setupRouter } from "./routers/setup";
import { tracksRouter } from "./routers/tracks";
import { router } from "./trpc";

export const appRouter = router({
  library: libraryRouter,
  jobs: jobsRouter,
  playback: playbackRouter,
  setup: setupRouter,
  tracks: tracksRouter,
});

export type AppRouter = typeof appRouter;
