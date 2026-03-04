import { router, publicProcedure, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const settingsRouter = router({
  get: protectedProcedure
    .input(z.string().optional())
    .query(async ({ ctx, input }) => {
      const key = input || 'musicPath'
      const setting = await ctx.db.setting.findUnique({ where: { id: key } })
      return setting?.value || ''
    }),

  update: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { key, value } = input
      return ctx.db.setting.upsert({
        where: { id: key },
        update: { value },
        create: { id: key, value },
      })
    }),
})
