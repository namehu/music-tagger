import assert from "node:assert/strict";
import test from "node:test";

import { createPlaybackStoreApi, type PlaybackQueueTrack } from "../store/playback-store.ts";

const PLAYBACK_STORAGE_KEY = "music-tagger:playback-session:v2";

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
      userSession: {
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

  store.getState().completeHydration("user");
  store.getState().replaceQueueFromUserIntent("user", {
    tracks: [first, second, third],
    sourceKey: "library",
  });

  return { store, first, second, third };
}

test("ordered mode keeps linear previous and next behavior", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", second, { autoPlay: false });
  store.getState().playPrevious("user");
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, first.id);

  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });
  store.getState().playNext("user");
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, second.id);

  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/2",
  });
  store.getState().playNext("user");
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, third.id);
});

test("shuffle mode uses history for previous track", () => {
  const { store, first, second } = createStoreWithTracks();

  store.getState().setPlaybackMode("user", "shuffle");
  store.getState().requestPlayTrack("user", first, { autoPlay: false, pushShuffleHistory: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });

  store.getState().requestPlayTrack("user", second, { autoPlay: false });
  assert.deepEqual(
    store.getState().sessions.user.shuffleHistory.map((track) => track.id),
    [first.id],
  );

  store.getState().playPrevious("user");
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, first.id);
  assert.deepEqual(store.getState().sessions.user.shuffleHistory, []);
});

test("repeat_one only affects natural track end", () => {
  const { store, first, second } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", first, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });
  store.getState().setPlaybackMode("user", "repeat_one");

  store.getState().handleTrackEnded("user");
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, first.id);
  assert.equal(store.getState().sessions.user.resolveRequest?.autoPlay, true);

  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1b",
  });
  store.getState().playNext("user");
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, second.id);
});

test("restored user sessions ignore passive queue sync until user intent replaces the queue", () => {
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

  assert.equal(store.getState().sessions.user.hydrationStatus, "resolving");
  assert.equal(store.getState().sessions.user.resumeLock, true);
  assert.equal(store.getState().sessions.user.queueSourceKey, "playlist:restored");
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, first.id);

  store.getState().setQueue("user", {
    tracks: replacementQueue,
    sourceKey: "library",
  });
  assert.equal(store.getState().sessions.user.queueSourceKey, "playlist:restored");
  assert.deepEqual(store.getState().sessions.user.queue.map((track) => track.id), [first.id]);

  store.getState().replaceQueueFromUserIntent("user", {
    tracks: replacementQueue,
    sourceKey: "library",
  });
  assert.equal(store.getState().sessions.user.resumeLock, false);
  assert.equal(store.getState().sessions.user.hydrationStatus, "ready");
  assert.equal(store.getState().sessions.user.queueSourceKey, "library");
  assert.deepEqual(store.getState().sessions.user.queue.map((track) => track.id), [second.id]);
});

test("passive queue sync still updates when the source key stays the same", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", second, { autoPlay: false });
  store.getState().setQueue("user", {
    tracks: [first, second, third, createTrack("4")],
    sourceKey: "library",
  });

  assert.equal(store.getState().sessions.user.queueSourceKey, "library");
  assert.deepEqual(
    store.getState().sessions.user.queue.map((track) => track.id),
    [first.id, second.id, third.id, "4"],
  );
});

test("replacing queue from user intent clears shuffle history", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().setPlaybackMode("user", "shuffle");
  store.getState().requestPlayTrack("user", first, { autoPlay: false, pushShuffleHistory: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });
  store.getState().requestPlayTrack("user", second, { autoPlay: false });

  assert.deepEqual(store.getState().sessions.user.shuffleHistory.map((track) => track.id), [first.id]);

  store.getState().replaceQueueFromUserIntent("user", {
    tracks: [third],
    sourceKey: "playlist:next",
  });

  assert.deepEqual(store.getState().sessions.user.shuffleHistory, []);
  assert.equal(store.getState().sessions.user.queueSourceKey, "playlist:next");
});

test("removing a non-current queue item keeps the current track playing", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", second, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/2",
  });

  store.getState().removeQueueTrack("user", first.id);

  assert.deepEqual(store.getState().sessions.user.queue.map((track) => track.id), [second.id, third.id]);
  assert.equal(store.getState().sessions.user.displayTrack?.id, second.id);
  assert.equal(store.getState().sessionComputed.user.currentTrack?.id, second.id);
});

test("removing the current track advances to the next ordered track", () => {
  const { store, first, second, third } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", second, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/2",
  });

  store.getState().removeQueueTrack("user", second.id);

  assert.deepEqual(store.getState().sessions.user.queue.map((track) => track.id), [first.id, third.id]);
  assert.equal(store.getState().sessions.user.resolveRequest?.track.id, third.id);
  assert.equal(store.getState().sessions.user.resolveRequest?.autoPlay, false);
});

test("clearing the queue resets the user session to an empty state", () => {
  const { store, first } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", first, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });

  store.getState().clearQueue("user");

  assert.equal(store.getState().sessions.user.queue.length, 0);
  assert.equal(store.getState().sessions.user.queueSourceKey, null);
  assert.equal(store.getState().sessions.user.displayTrack, null);
  assert.equal(store.getState().sessions.user.activePlayback, null);
  assert.equal(store.getState().sessionComputed.user.currentTrack, null);
});

test("admin playback pauses user audio but preserves user queue and progress", () => {
  const { store, first, second } = createStoreWithTracks();
  let pauseCount = 0;
  const userAudio = {
    paused: false,
    currentTime: 96,
    pause() {
      pauseCount += 1;
      this.paused = true;
    },
  } as unknown as HTMLAudioElement;

  store.getState().bindAudioElement("user", userAudio);
  store.getState().setIsAudioPlaying("user", true);
  store.getState().requestPlayTrack("user", first, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/user",
  });

  store.getState().replaceQueueFromUserIntent("admin", {
    tracks: [second],
    sourceKey: "admin:library",
  });
  store.getState().requestPlayTrack("admin", second, { autoPlay: false });

  assert.equal(pauseCount, 1);
  assert.equal(store.getState().sessions.user.isAudioPlaying, false);
  assert.equal(store.getState().sessions.user.resumeTimeSec, 96);
  assert.equal(store.getState().sessions.user.queueSourceKey, "library");
  assert.equal(store.getState().sessions.admin.queueSourceKey, "admin:library");
  assert.equal(store.getState().sessions.admin.resolveRequest?.track.id, second.id);
});

test("admin session does not participate in restore locks or persisted session rehydrate", () => {
  const first = createTrack("1");
  const storage = createMemoryStorage({
    [PLAYBACK_STORAGE_KEY]: createPersistedSession({
      queue: [first],
      queueSourceKey: "playlist:restored",
      displayTrack: first,
    }),
  });
  const store = createPlaybackStoreApi(storage, () => 0);

  assert.equal(store.getState().sessions.admin.hydrationStatus, "ready");
  assert.equal(store.getState().sessions.admin.resumeLock, false);
  assert.equal(store.getState().sessions.admin.queue.length, 0);
});

test("requesting a different track resets visible progress before the next audio is ready", () => {
  const { store, first, second } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", first, { autoPlay: false, resumeTimeSec: 87 });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });
  assert.equal(store.getState().sessions.user.resumeTimeSec, 87);

  store.getState().requestPlayTrack("user", second, { autoPlay: true });
  assert.equal(store.getState().sessions.user.displayTrack?.id, second.id);
  assert.equal(store.getState().sessions.user.resumeTimeSec, 0);
  assert.equal(store.getState().sessions.user.pendingTrackId, second.id);
});

test("stale audio unbind does not clear the newly attached audio element during track switches", () => {
  const { store, first, second } = createStoreWithTracks();
  const oldAudio = {
    paused: false,
    currentTime: 41,
    pause() {
      this.paused = true;
    },
  } as unknown as HTMLAudioElement;
  const newAudio = {
    paused: true,
    currentTime: 0,
    pause() {
      this.paused = true;
    },
  } as unknown as HTMLAudioElement;

  store.getState().bindAudioElement("user", oldAudio);
  store.getState().requestPlayTrack("user", first, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });

  store.getState().requestPlayTrack("user", second, { autoPlay: true });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/2",
  });
  store.getState().bindAudioElement("user", newAudio);
  store.getState().bindAudioElement("user", null);

  assert.equal(store.getState().sessions.user.audioElement, newAudio);
  assert.equal(store.getState().sessions.user.displayTrack?.id, second.id);
  assert.equal(store.getState().sessions.user.resumeTimeSec, 0);
});

test("setPlaybackPosition updates live progress without forcing every snapshot write", () => {
  const { store, first } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", first, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });

  store.getState().setPlaybackPosition("user", 1.2);
  assert.equal(store.getState().sessions.user.currentTimeSec, 1.2);
  assert.equal(store.getState().sessions.user.resumeTimeSec, 0);

  store.getState().setPlaybackPosition("user", 3.4);
  assert.equal(store.getState().sessions.user.currentTimeSec, 3.4);
  assert.equal(store.getState().sessions.user.resumeTimeSec, 3.4);
});

test("seek preview and commit update displayed playback position", () => {
  const { store, first } = createStoreWithTracks();
  const audio = {
    currentTime: 12,
    pause() {
      return;
    },
  } as HTMLAudioElement;

  store.getState().bindAudioElement("user", audio);
  store.getState().requestPlayTrack("user", first, { autoPlay: false });
  store.getState().writeResolvedPlayback("user", {
    seq: store.getState().sessions.user.resolveRequest!.seq,
    url: "/stream/1",
  });

  store.getState().beginSeek("user", 33);
  assert.equal(store.getState().sessionComputed.user.displayTimeSec, 33);

  store.getState().updateSeekPreview("user", 48);
  assert.equal(store.getState().sessionComputed.user.displayTimeSec, 48);

  store.getState().commitSeek("user", 48);
  assert.equal(audio.currentTime, 48);
  assert.equal(store.getState().sessions.user.currentTimeSec, 48);
  assert.equal(store.getState().sessions.user.resumeTimeSec, 48);
  assert.equal(store.getState().sessions.user.isSeeking, false);
});

test("buffered progress can be tracked independently from playback position", () => {
  const { store } = createStoreWithTracks();

  store.getState().setBufferedUntilSec("user", 64);
  assert.equal(store.getState().sessions.user.bufferedUntilSec, 64);
});

test("live transcode playback can be promoted to seekable without replacing the active URL", () => {
  const { store, first } = createStoreWithTracks();

  store.getState().requestPlayTrack("user", first, { autoPlay: true });
  const seq = store.getState().sessions.user.resolveRequest!.seq;
  store.getState().writeResolvedPlayback("user", {
    seq,
    url: "/stream/live",
    seekable: false,
    liveTranscode: true,
    jobId: "job_live_1",
  });

  assert.equal(store.getState().sessions.user.activePlayback?.liveTranscode, true);
  assert.equal(store.getState().sessions.user.activePlayback?.seekable, false);
  assert.equal(store.getState().sessions.user.activePlayback?.jobId, "job_live_1");
  assert.equal(store.getState().sessions.user.activePlayback?.url, "/stream/live");

  store.getState().markActivePlaybackReady("user", { jobId: "job_live_1" });

  assert.equal(store.getState().sessions.user.activePlayback?.liveTranscode, false);
  assert.equal(store.getState().sessions.user.activePlayback?.seekable, true);
  assert.equal(store.getState().sessions.user.activePlayback?.jobId, null);
  assert.equal(store.getState().sessions.user.activePlayback?.url, "/stream/live");
});
