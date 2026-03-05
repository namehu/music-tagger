import { router, publicProcedure, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const songRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
      artist: z.string().optional(),
      album: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, artist, album } = input
      const skip = (page - 1) * limit

      const where: any = {}
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { artist: { contains: search } },
          { album: { contains: search } },
        ]
      }
      if (artist) where.artist = artist
      if (album) where.album = album

      const [songs, total] = await Promise.all([
        ctx.db.song.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        ctx.db.song.count({ where }),
      ])

      return { songs, total, page, limit }
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.db.song.findUnique({ where: { id: input } })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      artist: z.string().optional(),
      album: z.string().optional(),
      genre: z.string().optional(),
      year: z.number().nullable().optional(),
      coverPath: z.string().nullable().optional(),
      lyrics: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.db.song.update({ where: { id }, data })
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.song.delete({ where: { id: input } })
    }),

  batchUpdate: protectedProcedure
    .input(z.object({
      ids: z.array(z.string()),
      data: z.object({
        artist: z.string().optional(),
        album: z.string().optional(),
        genre: z.string().optional(),
        year: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { ids, data } = input
      return ctx.db.song.updateMany({
        where: { id: { in: ids } },
        data,
      })
    }),

  getFilters: protectedProcedure.query(async ({ ctx }) => {
    const [artists, albums] = await Promise.all([
      ctx.db.song.findMany({
        where: { artist: { not: '' } },
        select: { artist: true },
        distinct: ['artist'],
        orderBy: { artist: 'asc' },
      }),
      ctx.db.song.findMany({
        where: { album: { not: '' } },
        select: { album: true },
        distinct: ['album'],
        orderBy: { album: 'asc' },
      }),
    ])
    return {
      artists: artists.map(a => a.artist).filter(Boolean),
      albums: albums.map(a => a.album).filter(Boolean),
    }
  }),
})
