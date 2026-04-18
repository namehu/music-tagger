import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { TRACK_VISIBILITY_SURFACES } from "@/lib/ignored-tracks";

import { protectedProcedure, router } from "../trpc";

const listTracksInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  pageIndex: z.number().int().min(0).optional(),
  order: z.enum(["recent", "title", "artist"]).default("recent"),
  q: z.string().trim().max(200).optional(),
  edited: z.enum(["all", "edited", "unedited"]).default("all"),
  surface: z.enum(TRACK_VISIBILITY_SURFACES).default("user"),
});

const queueWindowInputSchema = z.object({
  context: z.object({
    source: z.literal("library"),
    surface: z.enum(TRACK_VISIBILITY_SURFACES),
    order: z.enum(["recent", "title", "artist"]),
    q: z.string().trim().max(200).optional(),
    edited: z.enum(["all", "edited", "unedited"]).default("all"),
  }),
  trackId: z.string().min(1),
  before: z.number().int().min(0).max(50).default(12),
  after: z.number().int().min(1).max(50).default(24),
});

type TrackListInput = z.infer<typeof listTracksInputSchema>;

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

type TrackCursor =
  | { order: "recent"; updatedAt: string; id: string }
  | { order: "title"; title: string; filename: string; id: string }
  | { order: "artist"; artist: string; album: string; id: string };

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

function serializePlaybackTrack(item: TrackListItem) {
  const serialized = serializeTrackListItem(item);
  return {
    id: serialized.id,
    title: serialized.title?.trim() || serialized.filename,
    artist: serialized.artist?.trim() || "未知艺人",
  };
}

function encodeCursor(cursor: TrackCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined, order: TrackListInput["order"]) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TrackCursor;
    return parsed.order === order ? parsed : null;
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "分页 cursor 无效" });
  }
}

function getCursorForItem(item: TrackListItem, order: TrackListInput["order"]): TrackCursor {
  if (order === "title") {
    return {
      order,
      title: item.title ?? item.filename,
      filename: item.filename,
      id: item.id,
    };
  }

  if (order === "artist") {
    return {
      order,
      artist: item.artist ?? "",
      album: item.album ?? "",
      id: item.id,
    };
  }

  return {
    order,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : new Date(item.updatedAt).toISOString(),
    id: item.id,
  };
}

function displayTitleSql() {
  return Prisma.sql`COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."title" ELSE t."title" END, t."filename")`;
}

function displayArtistSql() {
  return Prisma.sql`COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."artist" ELSE t."artist" END, '')`;
}

function displayAlbumSql() {
  return Prisma.sql`COALESCE(CASE WHEN tme."id" IS NOT NULL THEN tme."album" ELSE t."album" END, '')`;
}

function getTrackOrder(input: z.infer<typeof listTracksInputSchema>["order"]) {
  if (input === "title") {
    return Prisma.sql`
      ${displayTitleSql()} ASC,
      t."filename" ASC,
      t."id" ASC
    `;
  }

  if (input === "artist") {
    return Prisma.sql`
      ${displayArtistSql()} ASC,
      ${displayAlbumSql()} ASC,
      t."id" ASC
    `;
  }

  return Prisma.sql`
    t."updatedAt" DESC,
    t."id" DESC
  `;
}

function getCursorFilter(cursor: TrackCursor | null) {
  if (!cursor) {
    return Prisma.empty;
  }

  if (cursor.order === "title") {
    return Prisma.sql`
      AND (
        ${displayTitleSql()} > ${cursor.title}
        OR (${displayTitleSql()} = ${cursor.title} AND t."filename" > ${cursor.filename})
        OR (${displayTitleSql()} = ${cursor.title} AND t."filename" = ${cursor.filename} AND t."id" > ${cursor.id})
      )
    `;
  }

  if (cursor.order === "artist") {
    return Prisma.sql`
      AND (
        ${displayArtistSql()} > ${cursor.artist}
        OR (${displayArtistSql()} = ${cursor.artist} AND ${displayAlbumSql()} > ${cursor.album})
        OR (${displayArtistSql()} = ${cursor.artist} AND ${displayAlbumSql()} = ${cursor.album} AND t."id" > ${cursor.id})
      )
    `;
  }

  return Prisma.sql`
    AND (
      t."updatedAt" < ${new Date(cursor.updatedAt)}
      OR (t."updatedAt" = ${new Date(cursor.updatedAt)} AND t."id" < ${cursor.id})
    )
  `;
}

function getTrackSelectSql() {
  return Prisma.sql`
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
  `;
}

function getTrackFromSql() {
  return Prisma.sql`
    FROM "tracks" AS t
    LEFT JOIN "track_metadata_edits" AS tme
      ON tme."trackId" = t."id"
    LEFT JOIN "track_lyrics_edits" AS tle
      ON tle."trackId" = t."id"
    LEFT JOIN "track_cover_edits" AS tce
      ON tce."trackId" = t."id"
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
    const cursor = decodeCursor(input.cursor, input.order);
    const cursorFilter = input.pageIndex == null ? getCursorFilter(cursor) : Prisma.empty;
    const baseWhereClause = searchLike
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

    const whereClause = Prisma.sql`
      ${baseWhereClause}
      ${cursorFilter}
    `;

    const offsetClause =
      input.pageIndex == null ? Prisma.empty : Prisma.sql`OFFSET ${input.pageIndex * input.limit}`;
    const scanLimit = input.pageIndex == null ? input.limit + 1 : input.limit;
    const [items, totalRows] = await Promise.all([
      ctx.prisma.$queryRaw<TrackListItem[]>(Prisma.sql`
      ${getTrackSelectSql()}
      ${getTrackFromSql()}
      ${ignoreJoinClause}
      ${whereClause}
      ${visibilityFilter}
      ORDER BY ${getTrackOrder(input.order)}
      LIMIT ${scanLimit}
      ${offsetClause}
    `),
      ctx.prisma.$queryRaw<Array<{ count: number | bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS "count"
        ${getTrackFromSql()}
        ${ignoreJoinClause}
        ${baseWhereClause}
        ${visibilityFilter}
      `),
    ]);

    const hasNextCursor = input.pageIndex == null && items.length > input.limit;
    const pageItems = hasNextCursor ? items.slice(0, input.limit) : items;
    const nextCursor =
      hasNextCursor && pageItems.length > 0
        ? encodeCursor(getCursorForItem(pageItems[pageItems.length - 1]!, input.order))
        : null;

    return {
      items: pageItems.map(serializeTrackListItem),
      nextCursor,
      totalCount: toNullableNumber(totalRows[0]?.count) ?? 0,
    };
  }),

  queueWindow: protectedProcedure.input(queueWindowInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录" });
    }

    const q = input.context.q?.trim();
    const editedFilter =
      input.context.edited === "edited"
        ? Prisma.sql`AND (tme."id" IS NOT NULL OR tle."id" IS NOT NULL OR tce."id" IS NOT NULL)`
        : input.context.edited === "unedited"
          ? Prisma.sql`AND tme."id" IS NULL AND tle."id" IS NULL AND tce."id" IS NULL`
          : Prisma.empty;
    const ignoreJoinClause =
      input.context.surface === "admin"
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
      input.context.surface === "admin"
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

    const rows = await ctx.prisma.$queryRaw<(TrackListItem & { rn: number | bigint; totalCount: number | bigint })[]>(Prisma.sql`
      WITH ordered_tracks AS (
        ${getTrackSelectSql()},
        ROW_NUMBER() OVER (ORDER BY ${getTrackOrder(input.context.order)}) AS "rn",
        COUNT(*) OVER () AS "totalCount"
        ${getTrackFromSql()}
        ${ignoreJoinClause}
        ${whereClause}
        ${visibilityFilter}
      ),
      active_track AS (
        SELECT "rn"
        FROM ordered_tracks
        WHERE "id" = ${input.trackId}
        LIMIT 1
      )
      SELECT ordered_tracks.*
      FROM ordered_tracks, active_track
      WHERE ordered_tracks."rn" BETWEEN active_track."rn" - ${input.before} AND active_track."rn" + ${input.after}
      ORDER BY ordered_tracks."rn" ASC
    `);

    const activeIndex = rows.findIndex((row) => row.id === input.trackId);
    return {
      items: rows.map(serializePlaybackTrack),
      activeIndex,
      totalCount: toNullableNumber(rows[0]?.totalCount) ?? 0,
    };
  }),
});
