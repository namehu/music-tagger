import { router, protectedProcedure } from "../trpc";
import { z } from "zod";

export const playlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.playlist.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        songs: {
          include: { song: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.playlist.create({
        data: {
          name: input.name,
          userId: ctx.session.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.playlist.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.playlist.delete({ where: { id: input } });
    }),

  addSong: protectedProcedure
    .input(z.object({ playlistId: z.string(), songId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lastSong = await ctx.db.playlistSong.findFirst({
        where: { playlistId: input.playlistId },
        orderBy: { position: "desc" },
      });
      const position = (lastSong?.position ?? -1) + 1;

      return ctx.db.playlistSong.create({
        data: {
          playlistId: input.playlistId,
          songId: input.songId,
          position,
        },
      });
    }),

  removeSong: protectedProcedure
    .input(z.object({ playlistId: z.string(), songId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.playlistSong.deleteMany({
        where: {
          playlistId: input.playlistId,
          songId: input.songId,
        },
      });
    }),
});
