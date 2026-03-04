import { router } from '../trpc'
import { songRouter } from './song'
import { scanRouter } from './scan'
import { settingsRouter } from './settings'

export const appRouter = router({
  song: songRouter,
  scan: scanRouter,
  settings: settingsRouter,
})

export type AppRouter = typeof appRouter
