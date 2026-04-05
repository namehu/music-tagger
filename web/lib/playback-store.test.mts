import assert from "node:assert/strict";
import test from "node:test";

import { createPlaybackStoreApi, type PlaybackQueueTrack } from "../store/playback-store.ts";

const PLAYBACK_STORAGE_KEY = "music-tagger:playback-session:v1";

function createTrack(id: string): PlaybackQueueTrack {
  return {
    id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
  };
}

function createMemoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

function createPersistedSession(input: {
  queue: PlaybackQueueTrack[];
  queueSourceKey: string;
  displayTrack: PlaybackQueueTrack;
  currentProfile?: "original" | "mp3_192";
  playbackMode?: "ordered" | "shuffle" | "repeat_one";
  shuffleHistory?: PlaybackQueueTrack[];
  resumeTimeSec?: number;
  volume?: number;
  muted?: boolean;
}) {
  return JSON.stringify({
    state: {
      queue: input.queue,
      queueSourceKey: input.queueSourceKey,
      displayTrack: input.displayTrack,
      currentProfile: input.currentProfile ?? "mp3_192",
      playbackMode: input.playbackMode ?? "ordered",
      shuffleHistory: input.shuffleHistory ?? [],
      resumeTimeSec: input.resumeTimeSec ?? 42,
      volume: input.volume ?? 1,
      muted: input.muted ?? false,
    },
    version: 0,
  });
}

function createStoreWithTracks() {
  const storage = createMemoryStorage();
  const store = createPlaybackStoreApi(storage, () => 0);
  const first = createTrack("1");
  const second = createTrack("2");
  const third = createTrack("3");

  store.getState().completeHydration();
  store.getState().replaceQueueFromUserIntent({
    tracks: [first, second, third],
    sourceKey: "library",
  });

  return { store, first, second, third };
}

test("ordered mode keeps linear previous and next behavior", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().requestPlayTrack(second, { autoPlay: false });
  store.getState().playPrevious();
  assert.equal(store.getState().resolveRequest?.track.id, first.id);

  store.getState().writeResolvedPlayback({
    seq: store.getState().resolveRequest!.seq,
    url: "/stream/1",
  });
  store.getState().playNext();
  assert.equal(store.getState().resolveRequest?.track.id, second.id);

  store.getState().writeResolvedPlayback({
    seq: store.getState().resolveRequest!.seq,
    url: "/stream/2",
  });
  store.getState().playNext();
  assert.equal(store.getState().resolveRequest?.track.id, third.id);
});

test("shuffle mode uses history for previous track", () => {
  const { store, first, second } = createStoreWithTracks();

  store.getState().setPlaybackMode("shuffle");
  store.getState().requestPlayTrack(first, { autoPlay: false, pushShuffleHistory: false });
  store.getState().writeResolvedPlayback({
    seq: store.getState().resolveRequest!.seq,
    url: "/stream/1",
  });

  store.getState().requestPlayTrack(second, { autoPlay: false });
  assert.deepEqual(
    store.getState().shuffleHistory.map((track) => track.id),
    [first.id],
  );

  store.getState().playPrevious();
  assert.equal(store.getState().resolveRequest?.track.id, first.id);
  assert.deepEqual(store.getState().shuffleHistory, []);
});

test("repeat_one only affects natural track end", () => {
  const { store, first, second } = createStoreWithTracks();

  store.getState().requestPlayTrack(first, { autoPlay: false });
  store.getState().writeResolvedPlayback({
    seq: store.getState().resolveRequest!.seq,
    url: "/stream/1",
  });
  store.getState().setPlaybackMode("repeat_one");

  store.getState().handleTrackEnded();
  assert.equal(store.getState().resolveRequest?.track.id, first.id);
  assert.equal(store.getState().resolveRequest?.autoPlay, true);

  store.getState().writeResolvedPlayback({
    seq: store.getState().resolveRequest!.seq,
    url: "/stream/1b",
  });
  store.getState().playNext();
  assert.equal(store.getState().resolveRequest?.track.id, second.id);
});

test("restored sessions ignore passive queue sync until user intent replaces the queue", () => {
  const first = createTrack("1");
  const second = createTrack("2");
  const restoredQueue = [first];
  const replacementQueue = [second];
  const storage = createMemoryStorage({
    [PLAYBACK_STORAGE_KEY]: createPersistedSession({
      queue: restoredQueue,
      queueSourceKey: "playlist:restored",
      displayTrack: first,
    }),
  });
  const store = createPlaybackStoreApi(storage, () => 0);

  assert.equal(store.getState().hydrationStatus, "resolving");
  assert.equal(store.getState().resumeLock, true);
  assert.equal(store.getState().queueSourceKey, "playlist:restored");
  assert.equal(store.getState().resolveRequest?.track.id, first.id);

  store.getState().setQueue({
    tracks: replacementQueue,
    sourceKey: "library",
  });
  assert.equal(store.getState().queueSourceKey, "playlist:restored");
  assert.deepEqual(store.getState().queue.map((track) => track.id), [first.id]);

  store.getState().replaceQueueFromUserIntent({
    tracks: replacementQueue,
    sourceKey: "library",
  });
  assert.equal(store.getState().resumeLock, false);
  assert.equal(store.getState().hydrationStatus, "ready");
  assert.equal(store.getState().queueSourceKey, "library");
  assert.deepEqual(store.getState().queue.map((track) => track.id), [second.id]);
});

test("passive queue sync still updates when the source key stays the same", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().requestPlayTrack(second, { autoPlay: false });
  store.getState().setQueue({
    tracks: [first, second, third, createTrack("4")],
    sourceKey: "library",
  });

  assert.equal(store.getState().queueSourceKey, "library");
  assert.deepEqual(
    store.getState().queue.map((track) => track.id),
    [first.id, second.id, third.id, "4"],
  );
});

test("replacing queue from user intent clears shuffle history", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().setPlaybackMode("shuffle");
  store.getState().requestPlayTrack(first, { autoPlay: false, pushShuffleHistory: false });
  store.getState().writeResolvedPlayback({
    seq: store.getState().resolveRequest!.seq,
    url: "/stream/1",
  });
  store.getState().requestPlayTrack(second, { autoPlay: false });

  assert.deepEqual(store.getState().shuffleHistory.map((track) => track.id), [first.id]);

  store.getState().replaceQueueFromUserIntent({
    tracks: [third],
    sourceKey: "playlist:next",
  });

  assert.deepEqual(store.getState().shuffleHistory, []);
  assert.equal(store.getState().queueSourceKey, "playlist:next");
});
