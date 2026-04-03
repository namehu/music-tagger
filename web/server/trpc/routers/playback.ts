import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createPlaybackToken,
  getAudioContentType,
  PLAYBACK_PROFILES,
  resolveTrackSourcePath,
} from "@/lib/playback";

import { protectedProcedure, router } from "../trpc";

const resolvePlaybackInputSchema = z.object({
  trackId: z.string().min(1),
  profile: z.enum(PLAYBACK_PROFILES).default("original"),
});

export const playbackRouter = router({
  resolve: protectedProcedure.input(resolvePlaybackInputSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "需要登录后播放" });
    }

    const track = await ctx.prisma.track.findUnique({
      where: { id: input.trackId },
      select: {
        id: true,
        path: true,
        filename: true,
      },
    });

    if (!track) {
      throw new TRPCError({ code: "NOT_FOUND", message: "曲目不存在" });
    }

    const sourcePath = await resolveTrackSourcePath(track.path);
    if (!sourcePath) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "音频文件不存在或当前 Web 进程无法读取",
      });
    }

    const token = createPlaybackToken({
      trackId: track.id,
      userId,
      profile: input.profile,
    });

    return {
      status: "ready" as const,
      url: `/api/stream/${track.id}?profile=${input.profile}&token=${encodeURIComponent(token)}`,
      contentType: getAudioContentType(track.filename),
      filename: track.filename,
    };
  }),
});
