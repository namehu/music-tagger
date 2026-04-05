import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { auth } from "@/lib/auth";
import { buildTrackCoverAssetKey, resolveTrackEditAssetPath, sha256Hex } from "@/lib/track-edit-assets";
import { ensureTrackEditSyncJob } from "@/lib/track-edit-jobs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

async function requireAdminSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ trackId: string }> },
) {
  const user = await requireAdminSession(request);
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

export async function POST(
  request: Request,
  context: { params: Promise<{ trackId: string }> },
) {
  const user = await requireAdminSession(request);
  if (!user) {
    return jsonError("无权上传封面", 403);
  }

  const { trackId } = await context.params;
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true },
  });

  if (!track) {
    return jsonError("曲目不存在", 404);
  }

  const formData = await request.formData();
  const coverFile = formData.get("file");
  if (!(coverFile instanceof File)) {
    return jsonError("请上传封面文件", 400);
  }

  if (!ALLOWED_MIME_TYPES.has(coverFile.type)) {
    return jsonError("仅支持 JPG、PNG 封面", 400);
  }

  const bytes = new Uint8Array(await coverFile.arrayBuffer());
  if (bytes.byteLength === 0) {
    return jsonError("封面文件不能为空", 400);
  }

  const extension = EXTENSION_BY_MIME_TYPE[coverFile.type];
  const assetKey = buildTrackCoverAssetKey(trackId, extension);
  const assetPath = resolveTrackEditAssetPath(assetKey);
  await mkdir(path.dirname(assetPath), { recursive: true });
  await writeFile(assetPath, bytes);
  const fileStat = await stat(assetPath);
  const hash = sha256Hex(bytes);
  const previousCover = await prisma.trackCoverEdit.findUnique({
    where: { trackId },
    select: {
      assetPath: true,
    },
  });

  const now = new Date();
  await prisma.trackCoverEdit.upsert({
    where: { trackId },
    update: {
      assetPath: assetKey,
      mimeType: coverFile.type,
      fileSize: Number(fileStat.size),
      hash,
      syncStatus: "pending",
      syncErrorJson: null,
      syncRequestedAt: now,
      syncStartedAt: null,
      syncFinishedAt: null,
    },
      create: {
        id: `track_cover_edit_${trackId}`,
        trackId,
        assetPath: assetKey,
        mimeType: coverFile.type,
        fileSize: Number(fileStat.size),
        hash,
      syncStatus: "pending",
      syncRequestedAt: now,
    },
    select: { id: true },
  });

  const previousAssetPath = previousCover?.assetPath ? resolveTrackEditAssetPath(previousCover.assetPath) : null;
  if (previousAssetPath && previousAssetPath !== assetPath) {
    void unlink(previousAssetPath).catch(() => undefined);
  }

  const job = await ensureTrackEditSyncJob(prisma, {
    trackId,
    domain: "cover",
  });

  return Response.json({
    trackId,
    job,
    assetUrl: `/api/admin/tracks/${trackId}/cover?ts=${Date.now()}`,
    mimeType: coverFile.type,
    fileSize: Number(fileStat.size),
    hash,
  });
}
