import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import { canCurrentUserUnignoreTrack, resolveTrackIgnoreSource } from "@/lib/ignored-tracks";

import { protectedProcedure, router } from "../trpc";

const playlistIdSchema = z.object({
  playlistId: z.string().min(1),
});

const createPlaylistInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const renamePlaylistInputSchema = z.object({
  playlistId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
});

const deletePlaylistInputSchema = playlistIdSchema;

const addPlaylistTrackInputSchema = z.object({
  playlistId: z.string().min(1),
  trackId: z.string().min(1),
});

const removePlaylistTrackInputSchema = z.object({
  playlistId: z.string().min(1),
  itemId: z.string().min(1),
});

async function getOwnedPlaylistOrThrow(
  ctx: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"],
  playlistId: string,
) {
  const userId = ctx.session?.user?.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
  }

  const playlist = await ctx.prisma.playlist.findFirst({
    where: {
      id: playlistId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!playlist) {
    throw new TRPCError({ code: "NOT_FOUND", message: "歌单不存在" });
  }

  return playlist;
}

async function compactPlaylistPositions(
  tx: Prisma.TransactionClient,
  playlistId: string,
) {
  const items = await tx.playlistItem.findMany({
    where: { playlistId },
    orderBy: [
      { position: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: { id: true },
  });

  await Promise.all(
    items.map((item, index) =>
      tx.playlistItem.update({
        where: { id: item.id },
        data: { position: index },
        select: { id: true },
      }),
    ),
  );
}

function toPlaylistTrack(track: {
  id: string;
  filename: string;
  title: string | null;
  titleOverride: string | null;
  artist: string | null;
  artistOverride: string | null;
  album: string | null;
  albumOverride: string | null;
  path: string;
}) {
  return {
    id: track.id,
    title: track.titleOverride ?? track.title ?? track.filename,
    artist: track.artistOverride ?? track.artist ?? "未知艺人",
    album: track.albumOverride ?? track.album ?? null,
    path: track.path,
    fallbackTitle: track.filename,
  };
}

export const playlistsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const playlists = await ctx.prisma.playlist.findMany({
      where: { userId },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      itemCount: playlist._count.items,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    }));
  }),

  get: protectedProcedure.input(playlistIdSchema).query(async ({ ctx, input }) => {
    const playlist = await getOwnedPlaylistOrThrow(ctx, input.playlistId);
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const items = await ctx.prisma.playlistItem.findMany({
      where: { playlistId: playlist.id },
      orderBy: [
        { position: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        position: true,
        createdAt: true,
        track: {
          select: {
            id: true,
            filename: true,
            title: true,
            titleOverride: true,
            artist: true,
            artistOverride: true,
            album: true,
            albumOverride: true,
            path: true,
          },
        },
      },
    });
    const trackIds = items.map((item) => item.track.id);
    const [globalIgnored, mineIgnored] = await Promise.all([
      ctx.prisma.globalIgnoredTrack.findMany({
        where: {
          trackId: {
            in: trackIds,
          },
        },
        select: { trackId: true },
      }),
      ctx.prisma.userIgnoredTrack.findMany({
        where: {
          userId,
          trackId: {
            in: trackIds,
          },
        },
        select: { trackId: true },
      }),
    ]);
    const globalIgnoredSet = new Set(globalIgnored.map((entry) => entry.trackId));
    const mineIgnoredSet = new Set(mineIgnored.map((entry) => entry.trackId));

    return {
      ...playlist,
      items: items.map((item) => ({
        ignoreSource: resolveTrackIgnoreSource({
          hasGlobalIgnore: globalIgnoredSet.has(item.track.id),
          hasMineIgnore: mineIgnoredSet.has(item.track.id),
        }),
        id: item.id,
        position: item.position,
        createdAt: item.createdAt,
        canUnignoreTrack: canCurrentUserUnignoreTrack(
          resolveTrackIgnoreSource({
            hasGlobalIgnore: globalIgnoredSet.has(item.track.id),
            hasMineIgnore: mineIgnoredSet.has(item.track.id),
          }),
        ),
        track: toPlaylistTrack(item.track),
      })),
    };
  }),

  create: protectedProcedure.input(createPlaylistInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const playlist = await ctx.prisma.playlist.create({
      data: {
        id: `playlist_${randomUUID()}`,
        userId,
        name: input.name.trim(),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...playlist,
      itemCount: 0,
    };
  }),

  rename: protectedProcedure.input(renamePlaylistInputSchema).mutation(async ({ ctx, input }) => {
    const playlist = await getOwnedPlaylistOrThrow(ctx, input.playlistId);
    const updated = await ctx.prisma.playlist.update({
      where: { id: playlist.id },
      data: {
        name: input.name.trim(),
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    });

    return updated;
  }),

  remove: protectedProcedure.input(deletePlaylistInputSchema).mutation(async ({ ctx, input }) => {
    const playlist = await getOwnedPlaylistOrThrow(ctx, input.playlistId);
    await ctx.prisma.playlist.delete({
      where: { id: playlist.id },
      select: { id: true },
    });

    return {
      id: playlist.id,
      removed: true as const,
    };
  }),

  addTrack: protectedProcedure.input(addPlaylistTrackInputSchema).mutation(async ({ ctx, input }) => {
    const playlist = await getOwnedPlaylistOrThrow(ctx, input.playlistId);
    const track = await ctx.prisma.track.findUnique({
      where: { id: input.trackId },
      select: { id: true },
    });

    if (!track) {
      throw new TRPCError({ code: "NOT_FOUND", message: "曲目不存在" });
    }

    const nextPosition = await ctx.prisma.playlistItem.count({
      where: { playlistId: playlist.id },
    });

    const item = await ctx.prisma.playlistItem.create({
      data: {
        id: `playlist_item_${randomUUID()}`,
        playlistId: playlist.id,
        trackId: track.id,
        position: nextPosition,
      },
      select: {
        id: true,
        playlistId: true,
        trackId: true,
        position: true,
      },
    });

    await ctx.prisma.playlist.update({
      where: { id: playlist.id },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return item;
  }),

  removeTrack: protectedProcedure
    .input(removePlaylistTrackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const playlist = await getOwnedPlaylistOrThrow(ctx, input.playlistId);

      const item = await ctx.prisma.playlistItem.findFirst({
        where: {
          id: input.itemId,
          playlistId: playlist.id,
        },
        select: {
          id: true,
        },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "歌单曲目不存在" });
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.playlistItem.delete({
          where: { id: item.id },
          select: { id: true },
        });
        await compactPlaylistPositions(tx, playlist.id);
        await tx.playlist.update({
          where: { id: playlist.id },
          data: { updatedAt: new Date() },
          select: { id: true },
        });
      });

      return {
        id: item.id,
        removed: true as const,
      };
    }),
});
