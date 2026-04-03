import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { adminProcedure, protectedProcedure, router } from "../trpc";

const listTracksInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  order: z.enum(["recent", "title", "artist"]).default("recent"),
  q: z.string().trim().max(200).optional(),
});

const updateTrackMetadataInputSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().trim().max(300).nullable(),
  artist: z.string().trim().max(300).nullable(),
  album: z.string().trim().max(300).nullable(),
  albumArtist: z.string().trim().max(300).nullable(),
  trackNo: z.number().int().min(0).max(999).nullable(),
  discNo: z.number().int().min(0).max(99).nullable(),
  year: z.number().int().min(0).max(9999).nullable(),
  genre: z.string().trim().max(200).nullable(),
});

type TrackListItem = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  trackNo: number | null;
  discNo: number | null;
  year: number | null;
  genre: string | null;
  filename: string;
  path: string;
  metadataEditedAt: Date | string | null;
  updatedAt: Date | string;
};

function toNullableNumber(value: number | bigint | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function serializeTrackListItem(item: TrackListItem) {
  return {
    ...item,
    trackNo: toNullableNumber(item.trackNo),
    discNo: toNullableNumber(item.discNo),
    year: toNullableNumber(item.year),
  };
}

function buildFtsQuery(input: string) {
  const terms = input
    .trim()
    .split(/\s+/)
    .map((term) => term.replaceAll('"', " ").trim())
    .filter(Boolean)
    .slice(0, 8);

  return terms.map((term) => `"${term}"*`).join(" AND ");
}

function getTrackOrder(input: z.infer<typeof listTracksInputSchema>["order"]) {
  if (input === "title") {
    return Prisma.sql`
      COALESCE(t."titleOverride", t."title", t."filename") ASC,
      t."filename" ASC,
      t."id" ASC
    `;
  }

  if (input === "artist") {
    return Prisma.sql`
      COALESCE(t."artistOverride", t."artist", '') ASC,
      COALESCE(t."albumOverride", t."album", '') ASC,
      t."id" ASC
    `;
  }

  return Prisma.sql`
    t."updatedAt" DESC,
    t."id" DESC
  `;
}

function getFtsSecondaryOrder(input: z.infer<typeof listTracksInputSchema>["order"]) {
  if (input === "title") {
    return Prisma.sql`
      COALESCE(t."titleOverride", t."title", t."filename") ASC,
      t."filename" ASC,
      t."id" ASC
    `;
  }

  if (input === "artist") {
    return Prisma.sql`
      COALESCE(t."artistOverride", t."artist", '') ASC,
      COALESCE(t."albumOverride", t."album", '') ASC,
      t."id" ASC
    `;
  }

  return Prisma.sql`
    t."updatedAt" DESC,
    t."id" DESC
  `;
}

function isMissingFtsIndex(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("tracks_fts") || error.message.includes("no such table");
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function getOverrideValue<T extends string | number | null>(
  nextValue: T,
  scannedValue: T,
) {
  return nextValue === scannedValue ? null : nextValue;
}

export const tracksRouter = router({
  list: protectedProcedure.input(listTracksInputSchema).query(async ({ ctx, input }) => {
    const q = input.q?.trim();

    if (q) {
      const ftsQuery = buildFtsQuery(q);

      if (ftsQuery.length > 0) {
        try {
          const items = await ctx.prisma.$queryRaw<TrackListItem[]>(Prisma.sql`
            SELECT
              t."id",
              COALESCE(t."titleOverride", t."title") AS "title",
              COALESCE(t."artistOverride", t."artist") AS "artist",
              COALESCE(t."albumOverride", t."album") AS "album",
              COALESCE(t."albumArtistOverride", t."albumArtist") AS "albumArtist",
              COALESCE(t."trackNoOverride", t."trackNo") AS "trackNo",
              COALESCE(t."discNoOverride", t."discNo") AS "discNo",
              COALESCE(t."yearOverride", t."year") AS "year",
              COALESCE(t."genreOverride", t."genre") AS "genre",
              t."filename",
              t."path",
              t."metadataEditedAt",
              t."updatedAt"
            FROM "tracks_fts"
            JOIN "tracks" AS t
              ON t."id" = "tracks_fts"."trackId"
            WHERE "tracks_fts" MATCH ${ftsQuery}
            ORDER BY
              bm25("tracks_fts", 5.0, 3.0, 2.0, 1.0, 0.5) ASC,
              ${getFtsSecondaryOrder(input.order)}
            LIMIT ${input.limit}
          `);

          return {
            items: items.map(serializeTrackListItem),
            nextCursor: null,
          };
        } catch (error) {
          if (!isMissingFtsIndex(error)) {
            throw error;
          }
        }
      }
    }

    const searchLike = q ? `%${q}%` : null;
    const items = await ctx.prisma.$queryRaw<TrackListItem[]>(Prisma.sql`
      SELECT
        t."id",
        COALESCE(t."titleOverride", t."title") AS "title",
        COALESCE(t."artistOverride", t."artist") AS "artist",
        COALESCE(t."albumOverride", t."album") AS "album",
        COALESCE(t."albumArtistOverride", t."albumArtist") AS "albumArtist",
        COALESCE(t."trackNoOverride", t."trackNo") AS "trackNo",
        COALESCE(t."discNoOverride", t."discNo") AS "discNo",
        COALESCE(t."yearOverride", t."year") AS "year",
        COALESCE(t."genreOverride", t."genre") AS "genre",
        t."filename",
        t."path",
        t."metadataEditedAt",
        t."updatedAt"
      FROM "tracks" AS t
      ${searchLike ? Prisma.sql`
        WHERE
          LOWER(COALESCE(t."titleOverride", t."title", '')) LIKE LOWER(${searchLike})
          OR LOWER(COALESCE(t."artistOverride", t."artist", '')) LIKE LOWER(${searchLike})
          OR LOWER(COALESCE(t."albumOverride", t."album", '')) LIKE LOWER(${searchLike})
          OR LOWER(COALESCE(t."albumArtistOverride", t."albumArtist", '')) LIKE LOWER(${searchLike})
          OR LOWER(COALESCE(t."genreOverride", t."genre", '')) LIKE LOWER(${searchLike})
          OR LOWER(COALESCE(t."filename", '')) LIKE LOWER(${searchLike})
          OR LOWER(COALESCE(t."path", '')) LIKE LOWER(${searchLike})
      ` : Prisma.empty}
      ORDER BY ${getTrackOrder(input.order)}
      LIMIT ${input.limit}
    `);

    return {
      items: items.map(serializeTrackListItem),
      nextCursor: null,
    };
  }),

  updateMetadata: adminProcedure.input(updateTrackMetadataInputSchema).mutation(async ({ ctx, input }) => {
    const track = await ctx.prisma.track.findUnique({
      where: { id: input.trackId },
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        albumArtist: true,
        trackNo: true,
        discNo: true,
        year: true,
        genre: true,
      },
    });

    if (!track) {
      throw new TRPCError({ code: "NOT_FOUND", message: "曲目不存在" });
    }

    const nextTitle = normalizeText(input.title);
    const nextArtist = normalizeText(input.artist);
    const nextAlbum = normalizeText(input.album);
    const nextAlbumArtist = normalizeText(input.albumArtist);
    const nextGenre = normalizeText(input.genre);

    const titleOverride = getOverrideValue(nextTitle, track.title);
    const artistOverride = getOverrideValue(nextArtist, track.artist);
    const albumOverride = getOverrideValue(nextAlbum, track.album);
    const albumArtistOverride = getOverrideValue(nextAlbumArtist, track.albumArtist);
    const trackNoOverride = getOverrideValue(input.trackNo, track.trackNo);
    const discNoOverride = getOverrideValue(input.discNo, track.discNo);
    const yearOverride = getOverrideValue(input.year, track.year);
    const genreOverride = getOverrideValue(nextGenre, track.genre);

    const hasOverrides = [
      titleOverride,
      artistOverride,
      albumOverride,
      albumArtistOverride,
      trackNoOverride,
      discNoOverride,
      yearOverride,
      genreOverride,
    ].some((value) => value !== null);

    const updated = await ctx.prisma.track.update({
      where: { id: input.trackId },
      data: {
        titleOverride,
        artistOverride,
        albumOverride,
        albumArtistOverride,
        trackNoOverride,
        discNoOverride,
        yearOverride,
        genreOverride,
        metadataEditedAt: hasOverrides ? new Date() : null,
      },
      select: {
        id: true,
        filename: true,
        title: true,
        titleOverride: true,
        artist: true,
        artistOverride: true,
        album: true,
        albumOverride: true,
        albumArtist: true,
        albumArtistOverride: true,
        trackNo: true,
        trackNoOverride: true,
        discNo: true,
        discNoOverride: true,
        year: true,
        yearOverride: true,
        genre: true,
        genreOverride: true,
        metadataEditedAt: true,
      },
    });

    return {
      id: updated.id,
      title: updated.titleOverride ?? updated.title,
      artist: updated.artistOverride ?? updated.artist,
      album: updated.albumOverride ?? updated.album,
      albumArtist: updated.albumArtistOverride ?? updated.albumArtist,
      trackNo: updated.trackNoOverride ?? updated.trackNo,
      discNo: updated.discNoOverride ?? updated.discNo,
      year: updated.yearOverride ?? updated.year,
      genre: updated.genreOverride ?? updated.genre,
      metadataEditedAt: updated.metadataEditedAt,
      hasOverrides,
      fallbackTitle: updated.filename,
    };
  }),
});
