import { adminProcedure, protectedProcedure, router } from "../trpc";

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

  cacheOverview: adminProcedure.query(async ({ ctx }) => {
    const entries = await ctx.prisma.transcodeCache.findMany({
      select: {
        status: true,
        fileSize: true,
        updatedAt: true,
      },
    });

    let readyEntries = 0;
    let pendingEntries = 0;
    let failedEntries = 0;
    let totalBytes = 0;
    let latestUpdatedAt: Date | null = null;

    for (const entry of entries) {
      if (entry.status === "ready") {
        readyEntries += 1;
        totalBytes += entry.fileSize;
      } else if (entry.status === "pending") {
        pendingEntries += 1;
      } else if (entry.status === "failed") {
        failedEntries += 1;
      }

      if (!latestUpdatedAt || entry.updatedAt > latestUpdatedAt) {
        latestUpdatedAt = entry.updatedAt;
      }
    }

    return {
      cacheRoot: "/cache",
      hostCacheOverride: process.env.CACHE_ROOT_HOST_PATH?.trim() || null,
      totalEntries: entries.length,
      readyEntries,
      pendingEntries,
      failedEntries,
      totalBytes,
      latestUpdatedAt,
    };
  }),
});
