import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const listTracksInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  order: z.enum(["recent", "title", "artist"]).default("recent"),
  q: z.string().trim().max(200).optional(),
});

export const tracksRouter = router({
  list: protectedProcedure.input(listTracksInputSchema).query(async ({ ctx, input }) => {
    const q = input.q?.trim();
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

    const orderBy =
      input.order === "title"
        ? [{ title: "asc" as const }, { filename: "asc" as const }, { id: "asc" as const }]
        : input.order === "artist"
          ? [{ artist: "asc" as const }, { album: "asc" as const }, { id: "asc" as const }]
          : [{ updatedAt: "desc" as const }, { id: "desc" as const }];

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
