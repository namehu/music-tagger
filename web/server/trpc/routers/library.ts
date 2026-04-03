import { z } from "zod";

import {
  classifyTranscodeFailure,
  getTranscodeFailureCategoryLabel,
} from "@/lib/transcode-failure";
import { doesCacheFileExist, removeCacheFile } from "@/lib/transcode-cache";

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
        id: true,
        trackId: true,
        sourceMtimeMs: true,
        cachePath: true,
        status: true,
        fileSize: true,
        errorJson: true,
        updatedAt: true,
        track: {
          select: {
            id: true,
            mtimeMs: true,
          },
        },
      },
    });

    let readyEntries = 0;
    let pendingEntries = 0;
    let failedEntries = 0;
    let staleEntries = 0;
    let orphanEntries = 0;
    let totalBytes = 0;
    let latestUpdatedAt: Date | null = null;
    const failedByCategory = new Map<string, number>();

    for (const entry of entries) {
      if (entry.status === "ready") {
        readyEntries += 1;
        totalBytes += entry.fileSize;
      } else if (entry.status === "pending") {
        pendingEntries += 1;
      } else if (entry.status === "failed") {
        failedEntries += 1;
        const category = classifyTranscodeFailure(entry.errorJson);
        failedByCategory.set(category, (failedByCategory.get(category) ?? 0) + 1);
      }

      if (!entry.track) {
        orphanEntries += 1;
      } else if (entry.track.mtimeMs !== entry.sourceMtimeMs) {
        staleEntries += 1;
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
      staleEntries,
      orphanEntries,
      totalBytes,
      latestUpdatedAt,
      failedByCategory: Array.from(failedByCategory.entries()).map(([category, count]) => ({
        category,
        label: getTranscodeFailureCategoryLabel(category as Parameters<typeof getTranscodeFailureCategoryLabel>[0]),
        count,
      })),
    };
  }),

  cacheEntries: adminProcedure
    .input(
      z.object({
        issue: z.enum(["all", "attention", "failed", "stale", "orphan"]).default("attention"),
        q: z.string().trim().max(200).optional(),
        limit: z.number().int().min(20).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.q?.trim().toLowerCase() ?? "";
      const scanLimit = Math.min(input.limit * 4, 800);
      const entries = await ctx.prisma.transcodeCache.findMany({
        take: scanLimit,
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          trackId: true,
          profile: true,
          sourceMtimeMs: true,
          cachePath: true,
          contentType: true,
          fileSize: true,
          status: true,
          errorJson: true,
          createdAt: true,
          updatedAt: true,
          track: {
            select: {
              id: true,
              path: true,
              filename: true,
              title: true,
              artist: true,
              album: true,
              mtimeMs: true,
            },
          },
        },
      });

      const detailedEntries = await Promise.all(
        entries.map(async (entry) => {
          const isOrphan = !entry.track;
          const isStale = !!entry.track && entry.track.mtimeMs !== entry.sourceMtimeMs;
          const isMissingReadyFile =
            entry.status === "ready" ? !(await doesCacheFileExist(entry.cachePath)) : false;
          const failureCategory =
            entry.status === "failed" ? classifyTranscodeFailure(entry.errorJson) : null;
          const issues = [
            ...(isOrphan ? (["orphan"] as const) : []),
            ...(isStale || isMissingReadyFile ? (["stale"] as const) : []),
            ...(entry.status === "failed" ? (["failed"] as const) : []),
          ];
          const searchText = [
            entry.trackId,
            entry.profile,
            entry.cachePath,
            entry.track?.title,
            entry.track?.artist,
            entry.track?.album,
            entry.track?.filename,
            entry.track?.path,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return {
            matchesSearch: search.length === 0 ? true : searchText.includes(search),
            entry: {
              id: entry.id,
              trackId: entry.trackId,
              profile: entry.profile,
              sourceMtimeMs: entry.sourceMtimeMs.toString(),
              cachePath: entry.cachePath,
              contentType: entry.contentType,
              fileSize: entry.fileSize,
              status: entry.status,
              errorJson: entry.errorJson,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
              track: entry.track
                ? {
                    id: entry.track.id,
                    path: entry.track.path,
                    filename: entry.track.filename,
                    title: entry.track.title,
                    artist: entry.track.artist,
                    album: entry.track.album,
                  }
                : null,
              isOrphan,
              isStale,
              isMissingReadyFile,
              issues,
              failureCategory,
              failureLabel: failureCategory ? getTranscodeFailureCategoryLabel(failureCategory) : null,
            },
          };
        }),
      );

      const filteredEntries = detailedEntries.filter(({ entry, matchesSearch }) => {
        if (input.issue === "attention" && entry.issues.length === 0) {
          return false;
        }

        if (input.issue !== "all" && input.issue !== "attention" && !entry.issues.includes(input.issue)) {
          return false;
        }

        if (!matchesSearch) {
          return false;
        }

        return true;
      });

      return filteredEntries.slice(0, input.limit).map(({ entry }) => entry);
    }),

  maintainCache: adminProcedure
    .input(
      z.object({
        mode: z.enum(["stale", "failed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const entries = await ctx.prisma.transcodeCache.findMany({
        select: {
          id: true,
          trackId: true,
          profile: true,
          sourceMtimeMs: true,
          cachePath: true,
          status: true,
          track: {
            select: {
              id: true,
              mtimeMs: true,
            },
          },
        },
      });

      const targetEntries = [];
      for (const entry of entries) {
        if (input.mode === "failed") {
          if (entry.status === "failed") {
            targetEntries.push(entry);
          }
          continue;
        }

        const isStale = !entry.track || entry.track.mtimeMs !== entry.sourceMtimeMs;
        const isMissingReadyFile =
          entry.status === "ready" ? !(await doesCacheFileExist(entry.cachePath)) : false;

        if (isStale || isMissingReadyFile) {
          targetEntries.push(entry);
        }
      }

      let removedFiles = 0;
      for (const entry of targetEntries) {
        removedFiles += await removeCacheFile(entry.cachePath);
      }

      if (targetEntries.length > 0) {
        await ctx.prisma.transcodeCache.deleteMany({
          where: {
            id: {
              in: targetEntries.map((entry) => entry.id),
            },
          },
        });
      }

      return {
        mode: input.mode,
        removedEntries: targetEntries.length,
        removedFiles,
      };
    }),
});
