import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import type { TrackEditDomain } from "@/lib/track-edits";

type PrismaLike = Pick<PrismaClient, "job">;

export function serializeTrackEditSyncPayload(trackId: string, domain: TrackEditDomain) {
  return JSON.stringify({
    jobKey: `track_edit_sync:${trackId}:${domain}`,
    trackId,
    domain,
  });
}

export async function ensureTrackEditSyncJob(
  prisma: PrismaLike,
  input: {
    trackId: string;
    domain: TrackEditDomain;
  },
) {
  const payloadJson = serializeTrackEditSyncPayload(input.trackId, input.domain);
  const existingJob = await prisma.job.findFirst({
    where: {
      type: "track_edit_sync",
      status: {
        in: ["pending", "running"],
      },
      payloadJson,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingJob) {
    return {
      jobId: existingJob.id,
      status: existingJob.status,
      deduped: true as const,
    };
  }

  const jobId = `job_${randomUUID()}`;
  await prisma.job.create({
    data: {
      id: jobId,
      type: "track_edit_sync",
      status: "pending",
      maxAttempts: 1,
      payloadJson,
    },
    select: { id: true },
  });

  return {
    jobId,
    status: "pending" as const,
    deduped: false as const,
  };
}
