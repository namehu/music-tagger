import { readFile } from "node:fs/promises";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findReadableTrackCoverSidecar } from "@/lib/track-cover-sidecar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ? session.user : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ trackId: string }> },
) {
  const user = await requireSession(request);
  if (!user) {
    return jsonError("无权访问封面资源", 403);
  }

  const { trackId } = await context.params;
  const [track, coverEdit] = await Promise.all([
    prisma.track.findUnique({
      where: { id: trackId },
      select: {
        path: true,
        observedArtworkAssetPath: true,
        artworkMime: true,
      },
    }),
    prisma.trackCoverEdit.findUnique({
      where: { trackId },
      select: {
        assetPath: true,
        mimeType: true,
      },
    }),
  ]);

  if (!track) {
    return jsonError("封面不存在", 404);
  }

  if (coverEdit != null && !coverEdit.assetPath) {
    return jsonError("封面不存在", 404);
  }

  const sidecar =
    coverEdit?.assetPath != null
      ? await findReadableTrackCoverSidecar(track.path, coverEdit.assetPath)
      : await findReadableTrackCoverSidecar(track.path, track.observedArtworkAssetPath);
  const mimeType = coverEdit != null ? coverEdit.mimeType : sidecar?.mimeType ?? track.artworkMime ?? null;

  if (!sidecar?.readablePath || !mimeType) {
    return jsonError("封面不存在", 404);
  }

  const payload = await readFile(sidecar.readablePath).catch(() => null);
  if (!payload) {
    return jsonError("封面文件不存在", 404);
  }

  return new Response(payload, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(payload.byteLength),
      "Content-Type": mimeType,
    },
  });
}
