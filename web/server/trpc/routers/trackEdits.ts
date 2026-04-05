import { TRPCError } from "@trpc/server";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getJobErrorSummary, parseJobPayload } from "@/lib/jobs";
import { resolveTrackEditAssetPath } from "@/lib/track-edit-assets";
import { ensureTrackEditSyncJob } from "@/lib/track-edit-jobs";
import {
  getEffectiveTrackMetadata,
  getTrackDisplaySummary,
  normalizeOptionalText,
  parseTrackEditError,
  TRACK_EDIT_DOMAINS,
} from "@/lib/track-edits";

import { adminProcedure, router } from "../trpc";

const trackIdSchema = z.object({
  trackId: z.string().min(1),
});

const saveMetadataInputSchema = z.object({
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

const saveLyricsInputSchema = z.object({
  trackId: z.string().min(1),
  lyricsText: z.string().max(100_000).nullable(),
  format: z.enum(["plain"]).default("plain"),
});

const retrySyncInputSchema = z.object({
  trackId: z.string().min(1),
  domain: z.enum(TRACK_EDIT_DOMAINS),
});

const trackEditSelect = {
  id: true,
  path: true,
  filename: true,
  title: true,
  artist: true,
  album: true,
  albumArtist: true,
  trackNo: true,
  discNo: true,
  year: true,
  genre: true,
  artworkKind: true,
  artworkMime: true,
  artworkHash: true,
  observedArtworkAssetPath: true,
  lyricsKind: true,
  lyricsHash: true,
  observedLyricsText: true,
  updatedAt: true,
  metadataEdit: {
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
      syncStatus: true,
      syncErrorJson: true,
      syncRequestedAt: true,
      syncStartedAt: true,
      syncFinishedAt: true,
      updatedAt: true,
    },
  },
  lyricsEdit: {
    select: {
      id: true,
      lyricsText: true,
      format: true,
      syncStatus: true,
      syncErrorJson: true,
      syncRequestedAt: true,
      syncStartedAt: true,
      syncFinishedAt: true,
      updatedAt: true,
    },
  },
  coverEdit: {
    select: {
      id: true,
      assetPath: true,
      mimeType: true,
      fileSize: true,
      hash: true,
      syncStatus: true,
      syncErrorJson: true,
      syncRequestedAt: true,
      syncStartedAt: true,
      syncFinishedAt: true,
      updatedAt: true,
    },
  },
} as const;

type TrackEditLatestJob = {
  jobId: string;
  status: string;
  progress: number;
  attempts: number;
  maxAttempts: number;
  updatedAt: Date;
  errorSummary: string | null;
  errorJson: string | null;
};

async function getTrackOrThrow(
  ctx: Parameters<Parameters<typeof adminProcedure.query>[0]>[0]["ctx"],
  trackId: string,
) {
  const track = await ctx.prisma.track.findUnique({
    where: { id: trackId },
    select: trackEditSelect,
  });

  if (!track) {
    throw new TRPCError({ code: "NOT_FOUND", message: "曲目不存在" });
  }

  return track;
}

async function getLatestTrackEditJobs(
  ctx: Parameters<Parameters<typeof adminProcedure.query>[0]>[0]["ctx"],
  trackId: string,
) {
  const jobs = await ctx.prisma.job.findMany({
    where: {
      type: "track_edit_sync",
      payloadJson: {
        contains: `"trackId":"${trackId}"`,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 12,
    select: {
      id: true,
      status: true,
      progress: true,
      attempts: true,
      maxAttempts: true,
      payloadJson: true,
      errorJson: true,
      updatedAt: true,
    },
  });

  const latestByDomain: Partial<Record<(typeof TRACK_EDIT_DOMAINS)[number], TrackEditLatestJob>> = {};
  for (const job of jobs) {
    const payload = parseJobPayload(job.payloadJson);
    const domain = payload?.domain;
    if (!domain || latestByDomain[domain]) {
      continue;
    }

    latestByDomain[domain] = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      updatedAt: job.updatedAt,
      errorSummary: getJobErrorSummary(job.errorJson),
      errorJson: job.errorJson,
    };
  }

  return latestByDomain;
}

function serializeTrackEditResponse(
  track: Awaited<ReturnType<typeof getTrackOrThrow>>,
  latestJobs: Partial<Record<(typeof TRACK_EDIT_DOMAINS)[number], TrackEditLatestJob>>,
) {
  const effectiveMetadata = getEffectiveTrackMetadata({
    filename: track.filename,
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist,
    trackNo: track.trackNo,
    discNo: track.discNo,
    year: track.year,
    genre: track.genre,
    metadataEdit: track.metadataEdit
      ? {
          title: track.metadataEdit.title,
          artist: track.metadataEdit.artist,
          album: track.metadataEdit.album,
          albumArtist: track.metadataEdit.albumArtist,
          trackNo: track.metadataEdit.trackNo,
          discNo: track.metadataEdit.discNo,
          year: track.metadataEdit.year,
          genre: track.metadataEdit.genre,
        }
      : null,
  });

  const display = getTrackDisplaySummary({
    filename: track.filename,
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist,
    trackNo: track.trackNo,
    discNo: track.discNo,
    year: track.year,
    genre: track.genre,
    metadataEdit: track.metadataEdit
      ? {
          title: track.metadataEdit.title,
          artist: track.metadataEdit.artist,
          album: track.metadataEdit.album,
          albumArtist: track.metadataEdit.albumArtist,
          trackNo: track.metadataEdit.trackNo,
          discNo: track.metadataEdit.discNo,
          year: track.metadataEdit.year,
          genre: track.metadataEdit.genre,
        }
      : null,
  });

  const lyricsSource =
    track.lyricsEdit != null ? "edit" : track.observedLyricsText ? "scan" : "none";
  const coverSource =
    track.coverEdit != null ? "edit" : track.observedArtworkAssetPath ? "scan" : "none";

  return {
    track: {
      id: track.id,
      path: track.path,
      filename: track.filename,
      observedMetadata: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        albumArtist: track.albumArtist,
        trackNo: track.trackNo,
        discNo: track.discNo,
        year: track.year,
        genre: track.genre,
      },
      display,
      effectiveMetadata,
      artworkObservation: {
        kind: track.artworkKind,
        mimeType: track.artworkMime,
        hash: track.artworkHash,
      },
      lyricsObservation: {
        kind: track.lyricsKind,
        hash: track.lyricsHash,
      },
    },
    metadata: {
      values: effectiveMetadata,
      syncStatus: track.metadataEdit?.syncStatus ?? "synced",
      syncError: parseTrackEditError(track.metadataEdit?.syncErrorJson),
      syncRequestedAt: track.metadataEdit?.syncRequestedAt ?? null,
      syncStartedAt: track.metadataEdit?.syncStartedAt ?? null,
      syncFinishedAt: track.metadataEdit?.syncFinishedAt ?? null,
      updatedAt: track.metadataEdit?.updatedAt ?? null,
      hasEdit: track.metadataEdit != null,
      latestJob: latestJobs.metadata ?? null,
    },
    lyrics: {
      text: track.lyricsEdit != null ? track.lyricsEdit.lyricsText : track.observedLyricsText,
      format: track.lyricsEdit?.format ?? "plain",
      syncStatus: track.lyricsEdit?.syncStatus ?? "synced",
      syncError: parseTrackEditError(track.lyricsEdit?.syncErrorJson),
      syncRequestedAt: track.lyricsEdit?.syncRequestedAt ?? null,
      syncStartedAt: track.lyricsEdit?.syncStartedAt ?? null,
      syncFinishedAt: track.lyricsEdit?.syncFinishedAt ?? null,
      updatedAt: track.lyricsEdit?.updatedAt ?? null,
      hasEdit: track.lyricsEdit != null,
      source: lyricsSource,
      latestJob: latestJobs.lyrics ?? null,
    },
    cover: {
      hasCover:
        track.coverEdit != null
          ? Boolean(track.coverEdit.assetPath)
          : Boolean(track.observedArtworkAssetPath),
      assetUrl:
        (track.coverEdit != null ? track.coverEdit.assetPath : track.observedArtworkAssetPath)
          ? `/api/admin/tracks/${track.id}/cover?ts=${track.coverEdit?.updatedAt.getTime() ?? track.updatedAt.getTime()}`
          : null,
      mimeType: track.coverEdit?.mimeType ?? track.artworkMime ?? null,
      fileSize: track.coverEdit?.fileSize ?? null,
      hash: track.coverEdit?.hash ?? track.artworkHash ?? null,
      syncStatus: track.coverEdit?.syncStatus ?? "synced",
      syncError: parseTrackEditError(track.coverEdit?.syncErrorJson),
      syncRequestedAt: track.coverEdit?.syncRequestedAt ?? null,
      syncStartedAt: track.coverEdit?.syncStartedAt ?? null,
      syncFinishedAt: track.coverEdit?.syncFinishedAt ?? null,
      updatedAt: track.coverEdit?.updatedAt ?? null,
      hasEdit: track.coverEdit != null,
      source: coverSource,
      latestJob: latestJobs.cover ?? null,
    },
  };
}

async function touchTrackEditJob(
  ctx: Parameters<Parameters<typeof adminProcedure.query>[0]>[0]["ctx"],
  input: {
    trackId: string;
    domain: (typeof TRACK_EDIT_DOMAINS)[number];
  },
) {
  return ensureTrackEditSyncJob(ctx.prisma, input);
}

export const trackEditsRouter = router({
  get: adminProcedure.input(trackIdSchema).query(async ({ ctx, input }) => {
    const track = await getTrackOrThrow(ctx, input.trackId);
    const latestJobs = await getLatestTrackEditJobs(ctx, input.trackId);
    return serializeTrackEditResponse(track, latestJobs);
  }),

  saveMetadata: adminProcedure.input(saveMetadataInputSchema).mutation(async ({ ctx, input }) => {
    await getTrackOrThrow(ctx, input.trackId);
    const now = new Date();

    await ctx.prisma.trackMetadataEdit.upsert({
      where: { trackId: input.trackId },
      update: {
        title: normalizeOptionalText(input.title),
        artist: normalizeOptionalText(input.artist),
        album: normalizeOptionalText(input.album),
        albumArtist: normalizeOptionalText(input.albumArtist),
        trackNo: input.trackNo,
        discNo: input.discNo,
        year: input.year,
        genre: normalizeOptionalText(input.genre),
        syncStatus: "pending",
        syncErrorJson: null,
        syncRequestedAt: now,
        syncStartedAt: null,
        syncFinishedAt: null,
      },
      create: {
        id: `track_metadata_edit_${randomUUID()}`,
        trackId: input.trackId,
        title: normalizeOptionalText(input.title),
        artist: normalizeOptionalText(input.artist),
        album: normalizeOptionalText(input.album),
        albumArtist: normalizeOptionalText(input.albumArtist),
        trackNo: input.trackNo,
        discNo: input.discNo,
        year: input.year,
        genre: normalizeOptionalText(input.genre),
        syncStatus: "pending",
        syncRequestedAt: now,
      },
      select: { id: true },
    });

    const job = await touchTrackEditJob(ctx, {
      trackId: input.trackId,
      domain: "metadata",
    });
    const track = await getTrackOrThrow(ctx, input.trackId);
    const latestJobs = await getLatestTrackEditJobs(ctx, input.trackId);

    return {
      ...serializeTrackEditResponse(track, latestJobs),
      job,
    };
  }),

  resetMetadata: adminProcedure.input(trackIdSchema).mutation(async ({ ctx, input }) => {
    await getTrackOrThrow(ctx, input.trackId);
    await ctx.prisma.trackMetadataEdit.deleteMany({
      where: { trackId: input.trackId },
    });
    const job = await touchTrackEditJob(ctx, {
      trackId: input.trackId,
      domain: "metadata",
    });
    const track = await getTrackOrThrow(ctx, input.trackId);
    const latestJobs = await getLatestTrackEditJobs(ctx, input.trackId);

    return {
      ...serializeTrackEditResponse(track, latestJobs),
      job,
    };
  }),

  saveLyrics: adminProcedure.input(saveLyricsInputSchema).mutation(async ({ ctx, input }) => {
    await getTrackOrThrow(ctx, input.trackId);
    const now = new Date();

    await ctx.prisma.trackLyricsEdit.upsert({
      where: { trackId: input.trackId },
      update: {
        lyricsText: normalizeOptionalText(input.lyricsText),
        format: input.format,
        syncStatus: "pending",
        syncErrorJson: null,
        syncRequestedAt: now,
        syncStartedAt: null,
        syncFinishedAt: null,
      },
      create: {
        id: `track_lyrics_edit_${randomUUID()}`,
        trackId: input.trackId,
        lyricsText: normalizeOptionalText(input.lyricsText),
        format: input.format,
        syncStatus: "pending",
        syncRequestedAt: now,
      },
      select: { id: true },
    });

    const job = await touchTrackEditJob(ctx, {
      trackId: input.trackId,
      domain: "lyrics",
    });
    const track = await getTrackOrThrow(ctx, input.trackId);
    const latestJobs = await getLatestTrackEditJobs(ctx, input.trackId);

    return {
      ...serializeTrackEditResponse(track, latestJobs),
      job,
    };
  }),

  clearLyrics: adminProcedure.input(trackIdSchema).mutation(async ({ ctx, input }) => {
    await getTrackOrThrow(ctx, input.trackId);
    const now = new Date();

    await ctx.prisma.trackLyricsEdit.upsert({
      where: { trackId: input.trackId },
      update: {
        lyricsText: null,
        format: "plain",
        syncStatus: "pending",
        syncErrorJson: null,
        syncRequestedAt: now,
        syncStartedAt: null,
        syncFinishedAt: null,
      },
      create: {
        id: `track_lyrics_edit_${randomUUID()}`,
        trackId: input.trackId,
        lyricsText: null,
        format: "plain",
        syncStatus: "pending",
        syncRequestedAt: now,
      },
      select: { id: true },
    });

    const job = await touchTrackEditJob(ctx, {
      trackId: input.trackId,
      domain: "lyrics",
    });
    const track = await getTrackOrThrow(ctx, input.trackId);
    const latestJobs = await getLatestTrackEditJobs(ctx, input.trackId);

    return {
      ...serializeTrackEditResponse(track, latestJobs),
      job,
    };
  }),

  removeCover: adminProcedure.input(trackIdSchema).mutation(async ({ ctx, input }) => {
    const track = await getTrackOrThrow(ctx, input.trackId);
    const now = new Date();

    await ctx.prisma.trackCoverEdit.upsert({
      where: { trackId: input.trackId },
      update: {
        assetPath: null,
        mimeType: null,
        fileSize: null,
        hash: null,
        syncStatus: "pending",
        syncErrorJson: null,
        syncRequestedAt: now,
        syncStartedAt: null,
        syncFinishedAt: null,
      },
      create: {
        id: `track_cover_edit_${randomUUID()}`,
        trackId: input.trackId,
        assetPath: null,
        mimeType: null,
        fileSize: null,
        hash: null,
        syncStatus: "pending",
        syncRequestedAt: now,
      },
      select: { id: true },
    });
    if (track.coverEdit?.assetPath) {
      void unlink(resolveTrackEditAssetPath(track.coverEdit.assetPath)).catch(() => undefined);
    }

    const job = await touchTrackEditJob(ctx, {
      trackId: input.trackId,
      domain: "cover",
    });
    const nextTrack = await getTrackOrThrow(ctx, input.trackId);
    const latestJobs = await getLatestTrackEditJobs(ctx, input.trackId);

    return {
      ...serializeTrackEditResponse(nextTrack, latestJobs),
      job,
    };
  }),

  retrySync: adminProcedure.input(retrySyncInputSchema).mutation(async ({ ctx, input }) => {
    await getTrackOrThrow(ctx, input.trackId);
    const now = new Date();

    if (input.domain === "metadata") {
      const edit = await ctx.prisma.trackMetadataEdit.findUnique({
        where: { trackId: input.trackId },
        select: { id: true },
      });
      if (!edit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前没有待同步的元数据修改" });
      }

      await ctx.prisma.trackMetadataEdit.update({
        where: { trackId: input.trackId },
        data: {
          syncStatus: "pending",
          syncErrorJson: null,
          syncRequestedAt: now,
          syncStartedAt: null,
          syncFinishedAt: null,
        },
        select: { id: true },
      });
    } else if (input.domain === "lyrics") {
      const edit = await ctx.prisma.trackLyricsEdit.findUnique({
        where: { trackId: input.trackId },
        select: { id: true },
      });
      if (!edit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前没有待同步的歌词修改" });
      }

      await ctx.prisma.trackLyricsEdit.update({
        where: { trackId: input.trackId },
        data: {
          syncStatus: "pending",
          syncErrorJson: null,
          syncRequestedAt: now,
          syncStartedAt: null,
          syncFinishedAt: null,
        },
        select: { id: true },
      });
    } else {
      const edit = await ctx.prisma.trackCoverEdit.findUnique({
        where: { trackId: input.trackId },
        select: { id: true },
      });
      if (!edit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前没有待同步的封面修改" });
      }

      await ctx.prisma.trackCoverEdit.update({
        where: { trackId: input.trackId },
        data: {
          syncStatus: "pending",
          syncErrorJson: null,
          syncRequestedAt: now,
          syncStartedAt: null,
          syncFinishedAt: null,
        },
        select: { id: true },
      });
    }

    const job = await touchTrackEditJob(ctx, input);
    const track = await getTrackOrThrow(ctx, input.trackId);
    const latestJobs = await getLatestTrackEditJobs(ctx, input.trackId);

    return {
      ...serializeTrackEditResponse(track, latestJobs),
      job,
    };
  }),
});
