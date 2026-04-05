import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import { canCurrentUserUnignoreTrack, resolveTrackIgnoreSource } from "@/lib/ignored-tracks";
import { getTrackDisplaySummary } from "@/lib/track-edits";

import { adminProcedure, protectedProcedure, router } from "../trpc";

const trackIdInputSchema = z.object({
  trackId: z.string().min(1),
});

const listIgnoredTracksInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
});

const ignoreGlobalInputSchema = z.object({
  trackId: z.string().min(1),
  reason: z.string().trim().max(300).optional(),
});

const batchIgnoreGlobalInputSchema = z.object({
  trackIds: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().trim().max(300).optional(),
});

const batchUnignoreGlobalInputSchema = z.object({
  trackIds: z.array(z.string().min(1)).min(1).max(100),
});

const ignoredTrackSelect = {
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
  path: true,
} as const;

function toTrackSummary(track: {
  id: string;
  filename: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  trackNo: number | null;
  discNo: number | null;
  year: number | null;
  genre: string | null;
  metadataEdit: {
    title: string | null;
    artist: string | null;
    album: string | null;
    albumArtist: string | null;
    trackNo: number | null;
    discNo: number | null;
    year: number | null;
    genre: string | null;
  } | null;
  path: string;
}) {
  const display = getTrackDisplaySummary(track);
  return {
    id: track.id,
    title: display.title,
    artist: display.artist,
    album: display.album,
    path: track.path,
    fallbackTitle: track.filename,
  };
}

async function assertTrackExists(
  ctx: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"],
  trackId: string,
) {
  const track = await ctx.prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true },
  });

  if (!track) {
    throw new TRPCError({ code: "NOT_FOUND", message: "曲目不存在" });
  }

  return track;
}

export const ignoredTracksRouter = router({
  listMine: protectedProcedure.input(listIgnoredTracksInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const entries = await ctx.prisma.userIgnoredTrack.findMany({
      where: { userId },
      take: input.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        trackId: true,
        createdAt: true,
        track: {
          select: ignoredTrackSelect,
        },
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      trackId: entry.trackId,
      createdAt: entry.createdAt,
      source: "mine" as const,
      track: toTrackSummary(entry.track),
    }));
  }),

  ignoreMine: protectedProcedure.input(trackIdInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    await assertTrackExists(ctx, input.trackId);

    const entry = await ctx.prisma.userIgnoredTrack.upsert({
      where: {
        userId_trackId: {
          userId,
          trackId: input.trackId,
        },
      },
      update: {},
      create: {
        id: `user_ignored_track_${randomUUID()}`,
        userId,
        trackId: input.trackId,
      },
      select: {
        id: true,
        trackId: true,
      },
    });

    return entry;
  }),

  unignoreMine: protectedProcedure.input(trackIdInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    await ctx.prisma.userIgnoredTrack.deleteMany({
      where: {
        userId,
        trackId: input.trackId,
      },
    });

    return {
      trackId: input.trackId,
      removed: true as const,
    };
  }),

  listGlobal: adminProcedure.input(listIgnoredTracksInputSchema).query(async ({ ctx, input }) => {
    const entries = await ctx.prisma.globalIgnoredTrack.findMany({
      take: input.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        trackId: true,
        reason: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        track: {
          select: ignoredTrackSelect,
        },
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      trackId: entry.trackId,
      reason: entry.reason,
      createdAt: entry.createdAt,
      createdBy: entry.createdBy,
      source: "global" as const,
      track: toTrackSummary(entry.track),
    }));
  }),

  ignoreGlobal: adminProcedure.input(ignoreGlobalInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    await assertTrackExists(ctx, input.trackId);

    const entry = await ctx.prisma.globalIgnoredTrack.upsert({
      where: { trackId: input.trackId },
      update: {},
      create: {
        id: `global_ignored_track_${randomUUID()}`,
        trackId: input.trackId,
        createdById: userId,
        reason: input.reason?.trim() || null,
      },
      select: {
        id: true,
        trackId: true,
      },
    });

    return entry;
  }),

  unignoreGlobal: adminProcedure.input(trackIdInputSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.globalIgnoredTrack.deleteMany({
      where: { trackId: input.trackId },
    });

    return {
      trackId: input.trackId,
      removed: true as const,
    };
  }),

  batchIgnoreGlobal: adminProcedure.input(batchIgnoreGlobalInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const tracks = await ctx.prisma.track.findMany({
      where: {
        id: {
          in: input.trackIds,
        },
      },
      select: { id: true },
    });

    if (tracks.length !== input.trackIds.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "部分曲目不存在" });
    }

    await ctx.prisma.$transaction(
      input.trackIds.map((trackId) =>
        ctx.prisma.globalIgnoredTrack.upsert({
          where: { trackId },
          update: {},
          create: {
            id: `global_ignored_track_${randomUUID()}`,
            trackId,
            createdById: userId,
            reason: input.reason?.trim() || null,
          },
          select: { id: true },
        }),
      ),
    );

    return {
      trackIds: input.trackIds,
      affectedCount: input.trackIds.length,
    };
  }),

  batchUnignoreGlobal: adminProcedure.input(batchUnignoreGlobalInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.prisma.globalIgnoredTrack.deleteMany({
      where: {
        trackId: {
          in: input.trackIds,
        },
      },
    });

    return {
      trackIds: input.trackIds,
      affectedCount: result.count,
    };
  }),

  getTrackState: protectedProcedure.input(trackIdInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const [globalIgnore, myIgnore] = await Promise.all([
      ctx.prisma.globalIgnoredTrack.findUnique({
        where: { trackId: input.trackId },
        select: { id: true },
      }),
      ctx.prisma.userIgnoredTrack.findUnique({
        where: {
          userId_trackId: {
            userId,
            trackId: input.trackId,
          },
        },
        select: { id: true },
      }),
    ]);

    const source = resolveTrackIgnoreSource({
      hasGlobalIgnore: Boolean(globalIgnore),
      hasMineIgnore: Boolean(myIgnore),
    });

    return {
      trackId: input.trackId,
      source,
      canUnignore: canCurrentUserUnignoreTrack(source),
    };
  }),
});
