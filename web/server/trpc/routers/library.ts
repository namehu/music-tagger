import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import {
  classifyTranscodeCancellation,
  classifyTranscodeFailure,
  getTranscodeCancellationCategoryLabel,
  getTranscodeFailureCategoryLabel,
} from "@/lib/transcode-failure";
import { selectRecentUniqueTrackPlays } from "@/lib/library-dashboard";
import { getTrackDisplaySummary } from "@/lib/track-edits";
import { doesCacheFileExist, removeCacheFile } from "@/lib/transcode-cache";
import { TRACK_VISIBILITY_SURFACES } from "@/lib/ignored-tracks";

import { adminProcedure, protectedProcedure, router } from "../trpc";

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index] ?? null;
}

function accessSortValue(lastAccessedAt: Date | null, updatedAt: Date) {
  return (lastAccessedAt ?? updatedAt).getTime();
}

function toSafeNumber(value: number | bigint | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const libraryStatsInputSchema = z
  .object({
    surface: z.enum(TRACK_VISIBILITY_SURFACES).default("user"),
  })
  .optional();

function buildUserVisibleTrackWhere(userId: string, extraWhere?: Prisma.TrackWhereInput): Prisma.TrackWhereInput {
  return {
    ...extraWhere,
    globalIgnoredEntry: {
      is: null,
    },
    userIgnoredEntries: {
      none: {
        userId,
      },
    },
  };
}

async function getLibraryStatsForSurface(input: {
  ctx: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"];
  userId: string;
  surface: (typeof TRACK_VISIBILITY_SURFACES)[number];
}) {
  const ignoreJoinClause =
    input.surface === "admin"
      ? Prisma.sql`
          LEFT JOIN "global_ignored_tracks" AS git
            ON git."trackId" = t."id"
        `
      : Prisma.sql`
          LEFT JOIN "global_ignored_tracks" AS git
            ON git."trackId" = t."id"
          LEFT JOIN "user_ignored_tracks" AS uit
            ON uit."trackId" = t."id"
           AND uit."userId" = ${input.userId}
        `;
  const visibilityFilter =
    input.surface === "admin"
      ? Prisma.sql`AND git."id" IS NULL`
      : Prisma.sql`AND git."id" IS NULL AND uit."id" IS NULL`;

  const [tracksRow, albumsRow, artistsRow] = await Promise.all([
    input.ctx.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*) AS "count"
      FROM "tracks" AS t
      ${ignoreJoinClause}
      WHERE 1 = 1
        ${visibilityFilter}
    `),
    input.ctx.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*) AS "count"
      FROM (
        SELECT DISTINCT
          CASE WHEN tme."id" IS NOT NULL THEN tme."album" ELSE t."album" END AS "album",
          CASE WHEN tme."id" IS NOT NULL THEN tme."albumArtist" ELSE t."albumArtist" END AS "albumArtist"
        FROM "tracks" AS t
        LEFT JOIN "track_metadata_edits" AS tme
          ON tme."trackId" = t."id"
        ${ignoreJoinClause}
        WHERE CASE WHEN tme."id" IS NOT NULL THEN tme."album" ELSE t."album" END IS NOT NULL
          AND CASE WHEN tme."id" IS NOT NULL THEN tme."album" ELSE t."album" END != ''
          ${visibilityFilter}
      )
    `),
    input.ctx.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*) AS "count"
      FROM (
        SELECT DISTINCT CASE WHEN tme."id" IS NOT NULL THEN tme."artist" ELSE t."artist" END AS "artist"
        FROM "tracks" AS t
        LEFT JOIN "track_metadata_edits" AS tme
          ON tme."trackId" = t."id"
        ${ignoreJoinClause}
        WHERE CASE WHEN tme."id" IS NOT NULL THEN tme."artist" ELSE t."artist" END IS NOT NULL
          AND CASE WHEN tme."id" IS NOT NULL THEN tme."artist" ELSE t."artist" END != ''
          ${visibilityFilter}
      )
    `),
  ]);

  return {
    tracks: toSafeNumber(tracksRow[0]?.count),
    albums: toSafeNumber(albumsRow[0]?.count),
    artists: toSafeNumber(artistsRow[0]?.count),
  };
}

export const libraryRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new Error("需要登录");
    }

    const [stats, recentEvents, recentPlaylists, recentTracks] = await Promise.all([
      getLibraryStatsForSurface({ ctx, userId, surface: "user" }),
      ctx.prisma.playbackResolveEvent.findMany({
        where: {
          trackId: {
            not: null,
          },
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 60,
        select: {
          trackId: true,
          createdAt: true,
        },
      }),
      ctx.prisma.playlist.findMany({
        where: { userId },
        orderBy: [
          { updatedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: 5,
        select: {
          id: true,
          name: true,
          updatedAt: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      ctx.prisma.track.findMany({
        where: buildUserVisibleTrackWhere(userId),
        orderBy: [
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        take: 6,
        select: {
          id: true,
          filename: true,
          title: true,
          artist: true,
          album: true,
          albumArtist: true,
          trackNo: true,
          discNo: true,
          year: true,
          genre: true,
          updatedAt: true,
          metadataEdit: {
            select: {
              title: true,
              artist: true,
              album: true,
              albumArtist: true,
              trackNo: true,
              discNo: true,
              year: true,
              genre: true,
            },
          },
        },
      }),
    ]);

    const recentUniquePlays = selectRecentUniqueTrackPlays(recentEvents, 18);
    const recentPlayTracks = await ctx.prisma.track.findMany({
      where: buildUserVisibleTrackWhere(userId, {
        id: {
          in: recentUniquePlays.map((entry) => entry.trackId),
        },
      }),
      select: {
        id: true,
        filename: true,
        title: true,
        artist: true,
        album: true,
        albumArtist: true,
        trackNo: true,
        discNo: true,
        year: true,
        genre: true,
        metadataEdit: {
          select: {
            title: true,
            artist: true,
            album: true,
            albumArtist: true,
            trackNo: true,
            discNo: true,
            year: true,
            genre: true,
          },
        },
      },
    });
    const recentPlayTrackMap = new Map(
      recentPlayTracks.map((track) => [
        track.id,
        (() => {
          const display = getTrackDisplaySummary(track);
          return {
            trackId: track.id,
            title: display.title,
            artist: display.artist,
          };
        })(),
      ]),
    );
    const recentPlays = recentUniquePlays
      .map((entry) => {
        const track = recentPlayTrackMap.get(entry.trackId);
        if (!track) {
          return null;
        }

        return {
          ...track,
          playedAt: entry.playedAt,
        };
      })
      .filter((entry) => entry !== null)
      .slice(0, 6);

    return {
      stats,
      recentPlays,
      recentPlaylists: recentPlaylists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        itemCount: playlist._count.items,
        updatedAt: playlist.updatedAt,
      })),
      recentTracks: recentTracks.map((track) => {
        const display = getTrackDisplaySummary(track);
        return {
          id: track.id,
          title: display.title,
          artist: display.artist,
          album: display.album,
          updatedAt: track.updatedAt,
        };
      }),
    };
  }),

  stats: protectedProcedure.input(libraryStatsInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new Error("需要登录");
    }

    return getLibraryStatsForSurface({
      ctx,
      userId,
      surface: input?.surface ?? "user",
    });
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
          lastAccessedAt: true,
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
              lastAccessedAt: entry.lastAccessedAt,
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

  transcodeMetrics: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const playbackSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const transcodeSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const trendStart = startOfDay(addDays(now, -6));

    const [resolveEvents, recentJobs] = await Promise.all([
      ctx.prisma.playbackResolveEvent.findMany({
        where: {
          profile: "mp3_192",
          createdAt: {
            gte: playbackSince,
          },
        },
        select: {
          outcome: true,
        },
      }),
      ctx.prisma.job.findMany({
        where: {
          type: "transcode_prepare",
          updatedAt: {
            gte: transcodeSince,
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          status: true,
          errorJson: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const cacheHits = resolveEvents.filter((event) => event.outcome === "cache_hit").length;
    const cacheMisses = resolveEvents.filter((event) => event.outcome === "cache_miss").length;
    const totalResolves = resolveEvents.length;
    const hitRate = totalResolves > 0 ? cacheHits / totalResolves : null;

    const completedJobs = recentJobs.filter((job) => job.status === "done");
    const completedDurationsMs = completedJobs
      .map((job) => job.updatedAt.getTime() - job.createdAt.getTime())
      .filter((value) => Number.isFinite(value) && value >= 0);
    const averageDurationMs =
      completedDurationsMs.length > 0
        ? Math.round(
            completedDurationsMs.reduce((sum, value) => sum + value, 0) / completedDurationsMs.length,
          )
        : null;
    const p95DurationMs = percentile(completedDurationsMs, 0.95);

    const trendDays = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(trendStart, index);
      return {
        date: formatDayKey(date),
        done: 0,
        failed: 0,
        cancelled: 0,
      };
    });
    const trendMap = new Map(trendDays.map((item) => [item.date, item]));
    const failedReasons = new Map<string, number>();
    const cancelledReasons = new Map<string, number>();

    for (const job of recentJobs) {
      if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
        const bucket = trendMap.get(formatDayKey(startOfDay(job.updatedAt)));
        if (bucket) {
          if (job.status === "done") {
            bucket.done += 1;
          } else if (job.status === "failed") {
            bucket.failed += 1;
          } else if (job.status === "cancelled") {
            bucket.cancelled += 1;
          }
        }
      }

      if (job.status === "failed") {
        const category = classifyTranscodeFailure(job.errorJson);
        failedReasons.set(category, (failedReasons.get(category) ?? 0) + 1);
      } else if (job.status === "cancelled") {
        const category = classifyTranscodeCancellation(job.errorJson);
        cancelledReasons.set(category, (cancelledReasons.get(category) ?? 0) + 1);
      }
    }

    return {
      playbackWindowHours: 24,
      transcodeWindowDays: 7,
      playback: {
        totalResolves,
        cacheHits,
        cacheMisses,
        hitRate,
      },
      transcodes: {
        completedCount: completedJobs.length,
        failedCount: recentJobs.filter((job) => job.status === "failed").length,
        cancelledCount: recentJobs.filter((job) => job.status === "cancelled").length,
        averageDurationMs,
        p95DurationMs,
      },
      trend: trendDays,
      failedReasons: Array.from(failedReasons.entries()).map(([category, count]) => ({
        category,
        label: getTranscodeFailureCategoryLabel(category as Parameters<typeof getTranscodeFailureCategoryLabel>[0]),
        count,
      })),
      cancelledReasons: Array.from(cancelledReasons.entries()).map(([category, count]) => ({
        category,
        label: getTranscodeCancellationCategoryLabel(
          category as Parameters<typeof getTranscodeCancellationCategoryLabel>[0],
        ),
        count,
      })),
    };
  }),

  cacheCapacity: adminProcedure.query(async ({ ctx }) => {
    const entries = await ctx.prisma.transcodeCache.findMany({
      where: {
        status: "ready",
      },
      select: {
        id: true,
        trackId: true,
        fileSize: true,
        lastAccessedAt: true,
        updatedAt: true,
      },
    });

    const now = new Date();
    const cold30Cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalBytes = 0;
    let neverAccessedBytes = 0;
    let cold30dBytes = 0;
    let neverAccessedEntries = 0;
    let cold30dEntries = 0;
    let oldestAccessAt: Date | null = null;

    for (const entry of entries) {
      totalBytes += entry.fileSize;

      if (!entry.lastAccessedAt) {
        neverAccessedEntries += 1;
        neverAccessedBytes += entry.fileSize;
      }

      const accessTime = entry.lastAccessedAt ?? entry.updatedAt;
      if (accessTime < cold30Cutoff) {
        cold30dEntries += 1;
        cold30dBytes += entry.fileSize;
      }

      if (!oldestAccessAt || accessTime < oldestAccessAt) {
        oldestAccessAt = accessTime;
      }
    }

    return {
      totalReadyEntries: entries.length,
      totalReadyBytes: totalBytes,
      neverAccessedEntries,
      neverAccessedBytes,
      cold30dEntries,
      cold30dBytes,
      oldestAccessAt,
    };
  }),

  pruneCache: adminProcedure
    .input(
      z.discriminatedUnion("mode", [
        z.object({
          mode: z.literal("unused"),
          olderThanDays: z.number().int().min(1).max(3650).default(30),
          limit: z.number().int().min(1).max(500).default(200),
        }),
        z.object({
          mode: z.literal("budget"),
          maxBytes: z.number().int().min(0),
        }),
        z.object({
          mode: z.literal("track"),
          trackId: z.string().min(1),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const allEntries = await ctx.prisma.transcodeCache.findMany({
        select: {
          id: true,
          trackId: true,
          fileSize: true,
          cachePath: true,
          status: true,
          lastAccessedAt: true,
          updatedAt: true,
        },
      });

      let targetEntries = allEntries.filter((entry) => entry.status === "ready");
      if (input.mode === "unused") {
        const cutoff = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000);
        targetEntries = targetEntries
          .filter((entry) => (entry.lastAccessedAt ?? entry.updatedAt) < cutoff)
          .sort(
            (left, right) =>
              accessSortValue(left.lastAccessedAt, left.updatedAt) -
              accessSortValue(right.lastAccessedAt, right.updatedAt),
          )
          .slice(0, input.limit);
      } else if (input.mode === "budget") {
        const totalBytes = targetEntries.reduce((sum, entry) => sum + entry.fileSize, 0);
        if (totalBytes <= input.maxBytes) {
          return {
            mode: input.mode,
            removedEntries: 0,
            removedFiles: 0,
            reclaimedBytes: 0,
          };
        }

        const removable = [...targetEntries].sort(
          (left, right) =>
            accessSortValue(left.lastAccessedAt, left.updatedAt) -
            accessSortValue(right.lastAccessedAt, right.updatedAt),
        );
        let bytesToTrim = totalBytes - input.maxBytes;
        targetEntries = [];
        for (const entry of removable) {
          if (bytesToTrim <= 0) {
            break;
          }
          targetEntries.push(entry);
          bytesToTrim -= entry.fileSize;
        }
      } else {
        targetEntries = allEntries.filter((entry) => entry.trackId === input.trackId);
      }

      let removedFiles = 0;
      let reclaimedBytes = 0;
      for (const entry of targetEntries) {
        removedFiles += await removeCacheFile(entry.cachePath);
        reclaimedBytes += entry.fileSize;
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
        reclaimedBytes,
      };
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
