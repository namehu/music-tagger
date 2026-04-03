import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";

import { protectedProcedure, router } from "../trpc";

const listTracksInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  order: z.enum(["recent", "title", "artist"]).default("recent"),
  q: z.string().trim().max(200).optional(),
});

type TrackListItem = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  filename: string;
  path: string;
  updatedAt: Date | string;
};

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
    return [{ title: "asc" as const }, { filename: "asc" as const }, { id: "asc" as const }];
  }

  if (input === "artist") {
    return [{ artist: "asc" as const }, { album: "asc" as const }, { id: "asc" as const }];
  }

  return [{ updatedAt: "desc" as const }, { id: "desc" as const }];
}

function getFtsSecondaryOrder(input: z.infer<typeof listTracksInputSchema>["order"]) {
  if (input === "title") {
    return Prisma.sql`
      COALESCE(t."title", t."filename") ASC,
      t."filename" ASC,
      t."id" ASC
    `;
  }

  if (input === "artist") {
    return Prisma.sql`
      COALESCE(t."artist", '') ASC,
      COALESCE(t."album", '') ASC,
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

export const tracksRouter = router({
  list: protectedProcedure.input(listTracksInputSchema).query(async ({ ctx, input }) => {
    const q = input.q?.trim();
    const orderBy = getTrackOrder(input.order);

    if (q) {
      const ftsQuery = buildFtsQuery(q);

      if (ftsQuery.length > 0) {
        try {
          const items = await ctx.prisma.$queryRaw<TrackListItem[]>(Prisma.sql`
            SELECT
              t."id",
              t."title",
              t."artist",
              t."album",
              t."filename",
              t."path",
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
            items,
            nextCursor: null,
          };
        } catch (error) {
          if (!isMissingFtsIndex(error)) {
            throw error;
          }
        }
      }
    }

    const where = q
      ? {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
            { album: { contains: q } },
            { filename: { contains: q } },
            { path: { contains: q } },
          ],
        }
      : undefined;

    const items = await ctx.prisma.track.findMany({
      where,
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy,
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        filename: true,
        path: true,
        updatedAt: true,
      },
    });

    const hasMore = items.length > input.limit;
    const visibleItems = hasMore ? items.slice(0, input.limit) : items;

    return {
      items: visibleItems,
      nextCursor: hasMore ? visibleItems.at(-1)?.id ?? null : null,
    };
  }),
});
