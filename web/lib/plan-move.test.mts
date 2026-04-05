import test from "node:test";
import assert from "node:assert/strict";

import { getUnknownMoveTemplateTokens, resolveMoveTargetPath } from "./plan-move.ts";

const track = {
  path: "/music/source/song.flac",
  filename: "song.flac",
  artist: "Artist",
  albumArtist: "Album Artist",
  album: "Album",
  year: 2024,
};

test("getUnknownMoveTemplateTokens finds unsupported variables", () => {
  assert.deepEqual(getUnknownMoveTemplateTokens("{artist}/{title}"), ["title"]);
});

test("resolveMoveTargetPath builds a target path under music root", () => {
  assert.deepEqual(
    resolveMoveTargetPath({
      musicRoot: "/music",
      template: "{artist}/{album}",
      track,
    }),
    {
      changed: true,
      toPath: "/music/Artist/Album/song.flac",
      warnings: [],
    },
  );
});

test("resolveMoveTargetPath blocks paths that escape the music root", () => {
  const result = resolveMoveTargetPath({
    musicRoot: "/music",
    template: "../outside",
    track,
  });

  assert.equal(result.changed, false);
  assert.equal(result.toPath, "/outside/song.flac");
  assert.equal(result.warnings.some((warning) => warning.code === "root_escape"), true);
});

test("resolveMoveTargetPath reports unchanged paths without creating blocking warnings", () => {
  const result = resolveMoveTargetPath({
    musicRoot: "/music",
    template: "source",
    track,
  });

  assert.equal(result.changed, false);
  assert.equal(result.toPath, "/music/source/song.flac");
  assert.deepEqual(result.warnings, []);
});
