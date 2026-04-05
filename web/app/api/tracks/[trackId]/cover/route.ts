import { readFile } from "node:fs/promises";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTrackEditAssetPath } from "@/lib/track-edit-assets";

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
  const coverEdit = await prisma.trackCoverEdit.findUnique({
    where: { trackId },
    select: {
      assetPath: true,
      mimeType: true,
    },
  });

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: {
      observedArtworkAssetPath: true,
      artworkMime: true,
    },
  });

  const assetPath =
    coverEdit != null
      ? (coverEdit.assetPath ? resolveTrackEditAssetPath(coverEdit.assetPath) : null)
      : track?.observedArtworkAssetPath
        ? resolveTrackEditAssetPath(track.observedArtworkAssetPath)
        : null;
  const mimeType = coverEdit != null ? coverEdit.mimeType : track?.artworkMime ?? null;

  if (!assetPath || !mimeType) {
    return jsonError("封面不存在", 404);
  }

  const payload = await readFile(assetPath).catch(() => null);
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
