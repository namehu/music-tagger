import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildTrackCoverSidecarPath,
  findReadableTrackCoverSidecar,
  getTrackCoverSidecarFileCandidates,
  resolveTrackCoverSidecarWritePath,
} from "./track-cover-sidecar.ts";

test("buildTrackCoverSidecarPath keeps the track basename and extension", () => {
  assert.equal(
    buildTrackCoverSidecarPath("/music/Artist/Album/song.flac", ".png"),
    "/music/Artist/Album/song.png",
  );
});

test("resolveTrackCoverSidecarWritePath maps mounted music paths back to host paths", async () => {
  const hostRoot = await mkdtemp(path.join(os.tmpdir(), "track-cover-sidecar-"));
  process.env.MUSIC_ROOT_HOST_PATH = hostRoot;

  assert.equal(
    resolveTrackCoverSidecarWritePath("/music/Artist/Album/song.jpg"),
    path.join(hostRoot, "Artist", "Album", "song.jpg"),
  );

  delete process.env.MUSIC_ROOT_HOST_PATH;
});

test("findReadableTrackCoverSidecar prefers the discovered sidecar on the host path", async () => {
  const hostRoot = await mkdtemp(path.join(os.tmpdir(), "track-cover-sidecar-"));
  process.env.MUSIC_ROOT_HOST_PATH = hostRoot;

  const sidecarPath = path.join(hostRoot, "Artist", "Album", "song.png");
  await mkdir(path.dirname(sidecarPath), { recursive: true });
  await writeFile(sidecarPath, Buffer.from("cover"));

  const result = await findReadableTrackCoverSidecar("/music/Artist/Album/song.flac");
  assert.deepEqual(result, {
    mountedPath: "/music/Artist/Album/song.png",
    readablePath: sidecarPath,
    mimeType: "image/png",
  });
  assert.deepEqual(getTrackCoverSidecarFileCandidates("/music/Artist/Album/song.flac"), [
    "/music/Artist/Album/song.jpg",
    path.join(hostRoot, "Artist", "Album", "song.jpg"),
    "/music/Artist/Album/song.png",
    sidecarPath,
  ]);

  delete process.env.MUSIC_ROOT_HOST_PATH;
});
