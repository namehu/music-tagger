import { router } from '../trpc'
import { songRouter } from './song'
import { scanRouter } from './scan'
import { settingsRouter } from './settings'
import { playlistRouter } from './playlist'

export const appRouter = router({
  song: songRouter,
  scan: scanRouter,
  settings: settingsRouter,
  playlist: playlistRouter,
})

export type AppRouter = typeof appRouter
