import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { TRACK_VISIBILITY_SURFACES } from "@/lib/ignored-tracks";

import { protectedProcedure, router } from "../trpc";

const listTracksInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  order: z.enum(["recent", "title", "artist"]).default("recent"),
  q: z.string().trim().max(200).optional(),
  edited: z.enum(["all", "edited", "unedited"]).default("all"),
  surface: z.enum(TRACK_VISIBILITY_SURFACES).default("user"),
});

type TrackListItem = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  trackNo: number | bigint | null;
  discNo: number | bigint | null;
  year: number | bigint | null;
  genre: string | null;
  filename: string;
  path: string;
  updatedAt: Date | string;
  metadataSyncStatus: string | null;
  lyricsSyncStatus: string | null;
  coverSyncStatus: string | null;
  hasMetadataEdit: number | bigint;
  hasLyricsEdit: number | bigint;
  hasCoverEdit: number | bigint;
};

function toNullableNumber(value: number | bigint | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBooleanNumber(value: number | bigint | null | undefined) {
  return toNullableNumber(value) === 1;
}

function serializeTrackListItem(item: TrackListItem) {
  return {
    ...item,
    trackNo: toNullableNumber(item.trackNo),
    discNo: toNullableNumber(item.discNo),
    year: toNullableNumber(item.year),
    hasMetadataEdit: toBooleanNumber(item.hasMetadataEdit),
    hasLyricsEdit: toBooleanNumber(item.hasLyricsEdit),
    hasCoverEdit: toBooleanNumber(item.hasCoverEdit),
  };
}

function getTrackOrder(input: z.infer<typeof listTracksInputSchema>["order"]) {
  if (input === "title") {
    return Prisma.sql`
      COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."title" ELSE t."title" END, t."filename") ASC,
      t."filename" ASC,
      t."id" ASC
    `;
  }

  if (input === "artist") {
    return Prisma.sql`
      COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."artist" ELSE t."artist" END, '') ASC,
      COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."album" ELSE t."album" END, '') ASC,
      t."id" ASC
    `;
  }

  return Prisma.sql`
    t."updatedAt" DESC,
    t."id" DESC
  `;
}

export const tracksRouter = router({
  list: protectedProcedure.input(listTracksInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const q = input.q?.trim();
    const editedFilter =
      input.edited === "edited"
        ? Prisma.sql`AND (tme."id" IS NOT NULL OR tle."id" IS NOT NULL OR tce."id" IS NOT NULL)`
        : input.edited === "unedited"
          ? Prisma.sql`AND tme."id" IS NULL AND tle."id" IS NULL AND tce."id" IS NULL`
          : Prisma.empty;
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
             AND uit."userId" = ${userId}
          `;
    const visibilityFilter =
      input.surface === "admin"
        ? Prisma.sql`AND git."id" IS NULL`
        : Prisma.sql`AND git."id" IS NULL AND uit."id" IS NULL`;
    const searchLike = q ? `%${q}%` : null;
    const whereClause = searchLike
      ? Prisma.sql`
          WHERE
            (
              LOWER(COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."title" ELSE t."title" END, '')) LIKE LOWER(${searchLike})
              OR LOWER(COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."artist" ELSE t."artist" END, '')) LIKE LOWER(${searchLike})
              OR LOWER(COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."album" ELSE t."album" END, '')) LIKE LOWER(${searchLike})
              OR LOWER(COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."albumArtist" ELSE t."albumArtist" END, '')) LIKE LOWER(${searchLike})
              OR LOWER(COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."genre" ELSE t."genre" END, '')) LIKE LOWER(${searchLike})
              OR LOWER(COALESCE(t."filename", '')) LIKE LOWER(${searchLike})
              OR LOWER(COALESCE(t."path", '')) LIKE LOWER(${searchLike})
            )
            ${editedFilter}
        `
      : Prisma.sql`
          WHERE 1 = 1
          ${editedFilter}
        `;

    const items = await ctx.prisma.$queryRaw<TrackListItem[]>(Prisma.sql`
      SELECT
        t."id",
        CASE WHEN tme."id" IS NOT NULL THEN tme."title" ELSE t."title" END AS "title",
        CASE WHEN tme."id" IS NOT NULL THEN tme."artist" ELSE t."artist" END AS "artist",
        CASE WHEN tme."id" IS NOT NULL THEN tme."album" ELSE t."album" END AS "album",
        CASE WHEN tme."id" IS NOT NULL THEN tme."albumArtist" ELSE t."albumArtist" END AS "albumArtist",
        CASE WHEN tme."id" IS NOT NULL THEN tme."trackNo" ELSE t."trackNo" END AS "trackNo",
        CASE WHEN tme."id" IS NOT NULL THEN tme."discNo" ELSE t."discNo" END AS "discNo",
        CASE WHEN tme."id" IS NOT NULL THEN tme."year" ELSE t."year" END AS "year",
        CASE WHEN tme."id" IS NOT NULL THEN tme."genre" ELSE t."genre" END AS "genre",
        t."filename",
        t."path",
        t."updatedAt",
        tme."syncStatus" AS "metadataSyncStatus",
        tle."syncStatus" AS "lyricsSyncStatus",
        tce."syncStatus" AS "coverSyncStatus",
        CASE WHEN tme."id" IS NOT NULL THEN 1 ELSE 0 END AS "hasMetadataEdit",
        CASE WHEN tle."id" IS NOT NULL THEN 1 ELSE 0 END AS "hasLyricsEdit",
        CASE WHEN tce."id" IS NOT NULL THEN 1 ELSE 0 END AS "hasCoverEdit"
      FROM "tracks" AS t
      LEFT JOIN "track_metadata_edits" AS tme
        ON tme."trackId" = t."id"
      LEFT JOIN "track_lyrics_edits" AS tle
        ON tle."trackId" = t."id"
      LEFT JOIN "track_cover_edits" AS tce
        ON tce."trackId" = t."id"
      ${ignoreJoinClause}
      ${whereClause}
      ${visibilityFilter}
      ORDER BY ${getTrackOrder(input.order)}
      LIMIT ${input.limit}
    `);

    return {
      items: items.map(serializeTrackListItem),
      nextCursor: null,
    };
  }),
});
