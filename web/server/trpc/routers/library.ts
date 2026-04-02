import { protectedProcedure, router } from "../trpc";

export const libraryRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const [tracks, distinctAlbums, distinctArtists] = await Promise.all([
      ctx.prisma.track.count(),
      ctx.prisma.track.findMany({
        where: {
          NOT: [{ album: null }, { album: "" }],
        },
        distinct: ["album", "albumArtist"],
        select: {
          album: true,
          albumArtist: true,
        },
      }),
      ctx.prisma.track.findMany({
        where: {
          NOT: [{ artist: null }, { artist: "" }],
        },
        distinct: ["artist"],
        select: {
          artist: true,
        },
      }),
    ]);

    return {
      tracks,
      albums: distinctAlbums.length,
      artists: distinctArtists.length,
    };
  }),
});
