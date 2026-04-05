"use client";

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { StateCreator } from "zustand";

import { createComputed } from "./middleware/computed.ts";
import {
  getOrderedNextTrack,
  getOrderedPreviousTrack,
  getQueueTrackIndex,
  getShufflePreviousTrack,
  pickShuffleNextTrack,
  shouldAcceptPassiveQueueUpdate,
  tracksEqual,
  type PlaybackHydrationStatus,
  type PlaybackMode,
  type PlaybackQueueTrack,
} from "../lib/playback-state.ts";

export type PlaybackProfile = "original" | "mp3_192";
export type PlaybackSourceKind = "original" | "transcode_cache";
export type QueueReplaceReason = "initial_page_sync" | "user_intent";

export type ActivePlayback = PlaybackQueueTrack & {
  url: string;
  profile: PlaybackProfile;
  sourceKind: PlaybackSourceKind;
};

type ResolveRequest = {
  seq: number;
  track: PlaybackQueueTrack;
  profile: PlaybackProfile;
  autoPlay: boolean;
  resumeTimeSec: number | null;
};

type PersistedPlaybackState = {
  queue: PlaybackQueueTrack[];
  queueSourceKey: string | null;
  displayTrack: PlaybackQueueTrack | null;
  currentProfile: PlaybackProfile | null;
  playbackMode: PlaybackMode;
  shuffleHistory: PlaybackQueueTrack[];
  resumeTimeSec: number;
  volume: number;
  muted: boolean;
};

type PlaybackStoreState = PersistedPlaybackState & {
  activePlayback: ActivePlayback | null;
  pendingTrackId: string | null;
  preparingJobId: string | null;
  preparingRequest: ResolveRequest | null;
  currentSourceKind: PlaybackSourceKind | null;
  isAudioPlaying: boolean;
  playbackError: string | null;
  hydrationStatus: PlaybackHydrationStatus;
  resumeLock: boolean;
  resolveRequest: ResolveRequest | null;
  pendingResumeTimeSec: number | null;
  autoPlayOnReady: boolean;
  audioElement: HTMLAudioElement | null;
  requestSeq: number;
  bindAudioElement: (audio: HTMLAudioElement | null) => void;
  completeHydration: () => void;
  restoreFromPersistedSession: () => void;
  setQueue: (input: { tracks: PlaybackQueueTrack[]; sourceKey: string }) => void;
  replaceQueueFromUserIntent: (input: { tracks: PlaybackQueueTrack[]; sourceKey: string }) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  requestPlayTrack: (
    track: PlaybackQueueTrack,
    options?: {
      profile?: PlaybackProfile;
      autoPlay?: boolean;
      resumeTimeSec?: number | null;
      pushShuffleHistory?: boolean;
    },
  ) => void;
  writeResolvePreparing: (input: { seq: number; jobId: string }) => void;
  writeResolvedPlayback: (input: { seq: number; url: string }) => void;
  handleResolveFailure: (input: { seq: number; message: string; clearSession?: boolean }) => void;
  retryPreparingRequest: () => void;
  handlePreparingFailure: (message: string) => void;
  toggleTrack: (track: PlaybackQueueTrack) => void;
  playPrevious: () => void;
  playNext: () => void;
  handleTrackEnded: () => void;
  setPlaybackError: (message: string | null) => void;
  setIsAudioPlaying: (value: boolean) => void;
  syncProgressSnapshot: (currentTimeSec: number, force?: boolean) => void;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  clearPendingResumeTime: () => void;
};

type PlaybackStoreComputed = {
  currentTrack: PlaybackQueueTrack | null;
  activeTrackId: string | null;
  activeTrackIndex: number;
  previousTrack: PlaybackQueueTrack | null;
  nextTrack: PlaybackQueueTrack | null;
  canPlayPrevious: boolean;
  canPlayNext: boolean;
  isPreparing: boolean;
  isCurrentTrackInQueue: boolean;
};

export type PlaybackStore = PlaybackStoreState & PlaybackStoreComputed;

const PLAYBACK_STORAGE_KEY = "music-tagger:playback-session:v1";
const PROGRESS_PERSIST_INTERVAL_SEC = 2;

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizeResumeTime(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function toSourceKind(profile: PlaybackProfile): PlaybackSourceKind {
  return profile === "original" ? "original" : "transcode_cache";
}

function getAudioErrorMessage(audio: HTMLAudioElement | null) {
  const code = audio?.error?.code;
  switch (code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "播放已被中断";
    case MediaError.MEDIA_ERR_NETWORK:
      return "音频流读取失败，请检查 Web 是否能访问音乐目录";
    case MediaError.MEDIA_ERR_DECODE:
      return "音频解码失败，可能是浏览器暂不支持该格式";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "当前浏览器不支持该音频格式，或播放地址无效";
    default:
      return "播放失败，请检查音频文件是否存在以及播放令牌是否有效";
  }
}

function computePlaybackState(state: PlaybackStoreState): PlaybackStoreComputed {
  const currentTrack = getCurrentTrackFromState(state);
  const activeTrackId = currentTrack?.id ?? null;
  const activeTrackIndex = getQueueTrackIndex(state.queue, activeTrackId);
  const orderedPreviousTrack = getOrderedPreviousTrack(state.queue, activeTrackId);
  const orderedNextTrack = getOrderedNextTrack(state.queue, activeTrackId);
  const isCurrentTrackInQueue = activeTrackIndex >= 0;

  return {
    currentTrack,
    activeTrackId,
    activeTrackIndex,
    previousTrack: state.playbackMode === "shuffle" ? getShufflePreviousTrack(state.shuffleHistory) : orderedPreviousTrack,
    nextTrack: state.playbackMode === "shuffle" ? null : orderedNextTrack,
    canPlayPrevious:
      state.playbackMode === "shuffle" ? state.shuffleHistory.length > 0 : Boolean(orderedPreviousTrack),
    canPlayNext:
      !isCurrentTrackInQueue
        ? false
        : state.playbackMode === "shuffle"
          ? state.queue.length > 1
          : Boolean(orderedNextTrack),
    isPreparing: Boolean(state.preparingJobId),
    isCurrentTrackInQueue,
  };
}

function getCurrentTrackFromState(state: PlaybackStoreState) {
  return state.displayTrack ?? (state.activePlayback ? state.activePlayback : null);
}

function getActiveTrackIdFromState(state: PlaybackStoreState) {
  return getCurrentTrackFromState(state)?.id ?? null;
}

function isCurrentTrackInQueueFromState(state: PlaybackStoreState) {
  return getQueueTrackIndex(state.queue, getActiveTrackIdFromState(state)) >= 0;
}

function getBrowserStorage() {
  return typeof window !== "undefined" ? window.localStorage : noopStorage;
}

function buildPersistedState(state: PlaybackStore): PersistedPlaybackState {
  return {
    queue: state.queue,
    queueSourceKey: state.queueSourceKey,
    displayTrack: state.displayTrack,
    currentProfile: state.currentProfile,
    playbackMode: state.playbackMode,
    shuffleHistory: state.shuffleHistory,
    resumeTimeSec: state.resumeTimeSec,
    volume: state.volume,
    muted: state.muted,
  };
}

export function createPlaybackStoreApi(storage?: StateStorage, random = Math.random) {
  const baseCreator = ((set, get) => ({
    queue: [],
    queueSourceKey: null,
    displayTrack: null,
    currentProfile: null,
    playbackMode: "ordered",
    shuffleHistory: [],
    resumeTimeSec: 0,
    volume: 1,
    muted: false,
    activePlayback: null,
    pendingTrackId: null,
    preparingJobId: null,
    preparingRequest: null,
    currentSourceKind: null,
    isAudioPlaying: false,
    playbackError: null,
    hydrationStatus: "rehydrating",
    resumeLock: false,
    resolveRequest: null,
    pendingResumeTimeSec: null,
    autoPlayOnReady: false,
    audioElement: null,
    requestSeq: 0,
    bindAudioElement: (audio) => {
      set({
        audioElement: audio,
      });

      if (audio) {
        audio.volume = clampVolume(get().volume);
        audio.muted = get().muted;
      }
    },
    completeHydration: () => {
      set({
        hydrationStatus: "ready",
        resumeLock: false,
      });
    },
    restoreFromPersistedSession: () => {
      const state = get();
      const currentTrack = getCurrentTrackFromState(state);
      if (!currentTrack || !state.currentProfile) {
        state.completeHydration();
        return;
      }

      // 恢复链路需要先锁住被动 queue 同步，避免页面挂载时把 localStorage 里的会话上下文冲掉。
      set((current) => ({
        hydrationStatus: "resolving",
        resumeLock: true,
        pendingTrackId: currentTrack.id,
        preparingJobId: null,
        preparingRequest: null,
        activePlayback: null,
        isAudioPlaying: false,
        playbackError: null,
        currentSourceKind: toSourceKind(state.currentProfile!),
        resolveRequest: {
          seq: current.requestSeq + 1,
          track: currentTrack,
          profile: state.currentProfile!,
          autoPlay: false,
          resumeTimeSec: state.resumeTimeSec > 0 ? state.resumeTimeSec : null,
        },
        requestSeq: current.requestSeq + 1,
      }));
    },
    setQueue: ({ tracks, sourceKey }) => {
      const state = get();
      if (
        !shouldAcceptPassiveQueueUpdate({
          hydrationStatus: state.hydrationStatus,
          resumeLock: state.resumeLock,
          currentTrackId: getActiveTrackIdFromState(state),
          currentQueueSourceKey: state.queueSourceKey,
          nextQueueSourceKey: sourceKey,
        })
      ) {
        return;
      }

      if (state.queueSourceKey === sourceKey && tracksEqual(state.queue, tracks)) {
        return;
      }

      set({
        queue: tracks,
        queueSourceKey: sourceKey,
      });
    },
    replaceQueueFromUserIntent: ({ tracks, sourceKey }) => {
      set({
        queue: tracks,
        queueSourceKey: sourceKey,
        shuffleHistory: [],
        resumeLock: false,
        hydrationStatus: "ready",
      });
    },
    setPlaybackMode: (mode) => {
      set({
        playbackMode: mode,
      });
    },
    requestPlayTrack: (track, options) => {
      const state = get();
      const profile = options?.profile ?? "mp3_192";
      const currentTrack = getCurrentTrackFromState(state);
      const activeTrackId = currentTrack?.id ?? null;
      const pushShuffleHistory =
        options?.pushShuffleHistory ?? (state.playbackMode === "shuffle" && activeTrackId !== track.id);
      const nextHistory =
        pushShuffleHistory && currentTrack && currentTrack.id !== track.id
          ? [...state.shuffleHistory, currentTrack]
          : state.shuffleHistory;

      state.audioElement?.pause();

      // 手动点播和切歌都会走同一条 resolve 请求链，runtime 只认 request seq，不依赖 React Context。
      set((current) => ({
        displayTrack: track,
        activePlayback: null,
        pendingTrackId: track.id,
        preparingJobId: null,
        preparingRequest: null,
        currentProfile: profile,
        currentSourceKind: toSourceKind(profile),
        isAudioPlaying: false,
        playbackError: null,
        resolveRequest: {
          seq: current.requestSeq + 1,
          track,
          profile,
          autoPlay: options?.autoPlay ?? true,
          resumeTimeSec: options?.resumeTimeSec ?? null,
        },
        requestSeq: current.requestSeq + 1,
        pendingResumeTimeSec: null,
        autoPlayOnReady: options?.autoPlay ?? true,
        shuffleHistory: nextHistory,
        resumeLock: false,
        hydrationStatus: "ready",
      }));
    },
    writeResolvePreparing: ({ seq, jobId }) => {
      const state = get();
      const request = state.resolveRequest;
      if (!request || request.seq !== seq) {
        return;
      }

      set({
        preparingJobId: jobId,
        preparingRequest: request,
        resolveRequest: null,
      });
    },
    writeResolvedPlayback: ({ seq, url }) => {
      const state = get();
      const request = state.resolveRequest;
      if (!request || request.seq !== seq) {
        return;
      }

      set({
        activePlayback: {
          id: request.track.id,
          title: request.track.title,
          artist: request.track.artist,
          url,
          profile: request.profile,
          sourceKind: toSourceKind(request.profile),
        },
        displayTrack: request.track,
        pendingTrackId: null,
        preparingJobId: null,
        preparingRequest: null,
        currentProfile: request.profile,
        currentSourceKind: toSourceKind(request.profile),
        resolveRequest: null,
        pendingResumeTimeSec: request.resumeTimeSec,
        autoPlayOnReady: request.autoPlay,
        playbackError: null,
        hydrationStatus: "ready",
      });
    },
    handleResolveFailure: ({ seq, message, clearSession = false }) => {
      const state = get();
      const activeRequest = state.resolveRequest;
      if (activeRequest && activeRequest.seq !== seq) {
        return;
      }

      if (clearSession) {
        set({
          displayTrack: null,
          activePlayback: null,
          pendingTrackId: null,
          preparingJobId: null,
          preparingRequest: null,
          currentProfile: null,
          currentSourceKind: null,
          resolveRequest: null,
          pendingResumeTimeSec: null,
          autoPlayOnReady: false,
          resumeTimeSec: 0,
          playbackError: message,
          hydrationStatus: "ready",
          resumeLock: false,
          isAudioPlaying: false,
        });
        return;
      }

      set({
        pendingTrackId: null,
        preparingJobId: null,
        preparingRequest: null,
        currentProfile: null,
        currentSourceKind: null,
        resolveRequest: null,
        pendingResumeTimeSec: null,
        autoPlayOnReady: false,
        playbackError: message,
        hydrationStatus: "ready",
      });
    },
    retryPreparingRequest: () => {
      const state = get();
      const request = state.preparingRequest;
      if (!request) {
        return;
      }

      set((current) => ({
        preparingJobId: null,
        preparingRequest: null,
        resolveRequest: {
          ...request,
          seq: current.requestSeq + 1,
        },
        requestSeq: current.requestSeq + 1,
      }));
    },
    handlePreparingFailure: (message) => {
      const state = get();
      if (state.resumeLock) {
        state.handleResolveFailure({
          seq: state.preparingRequest?.seq ?? state.requestSeq,
          message,
          clearSession: true,
        });
        return;
      }

      set({
        pendingTrackId: null,
        preparingJobId: null,
        preparingRequest: null,
        currentProfile: null,
        currentSourceKind: null,
        playbackError: message,
        hydrationStatus: "ready",
      });
    },
    toggleTrack: (track) => {
      const state = get();
      const audio = state.audioElement;
      const activeTrackId = getActiveTrackIdFromState(state);

      if (activeTrackId !== track.id) {
        state.requestPlayTrack(track, { pushShuffleHistory: true });
        return;
      }

      if (state.pendingTrackId === track.id || !audio || !state.activePlayback) {
        return;
      }

      if (audio.paused) {
        void audio.play().catch(() => {
          state.setPlaybackError(getAudioErrorMessage(audio));
        });
        return;
      }

      audio.pause();
    },
    playPrevious: () => {
      const state = get();
      const activeTrackId = getActiveTrackIdFromState(state);

      if (state.playbackMode === "shuffle") {
        const previousTrack = getShufflePreviousTrack(state.shuffleHistory);
        if (!previousTrack) {
          return;
        }

        // shuffle 的上一首依赖真实播放历史，所以回退时要同步弹出历史栈，而不是重新推入当前曲目。
        set({
          shuffleHistory: state.shuffleHistory.slice(0, -1),
        });
        state.requestPlayTrack(previousTrack, {
          pushShuffleHistory: false,
        });
        return;
      }

      const previousTrack = getOrderedPreviousTrack(state.queue, activeTrackId);
      if (previousTrack) {
        state.requestPlayTrack(previousTrack, {
          pushShuffleHistory: false,
        });
      }
    },
    playNext: () => {
      const state = get();
      const activeTrackId = getActiveTrackIdFromState(state);
      if (!isCurrentTrackInQueueFromState(state)) {
        return;
      }

      if (state.playbackMode === "shuffle") {
        const nextTrack = pickShuffleNextTrack({
          queue: state.queue,
          trackId: activeTrackId,
          random,
        });
        if (nextTrack) {
          state.requestPlayTrack(nextTrack, {
            pushShuffleHistory: true,
          });
        }
        return;
      }

      const nextTrack = getOrderedNextTrack(state.queue, activeTrackId);
      if (nextTrack) {
        state.requestPlayTrack(nextTrack, {
          pushShuffleHistory: false,
        });
      }
    },
    handleTrackEnded: () => {
      const state = get();
      const currentTrack = getCurrentTrackFromState(state);
      if (!currentTrack) {
        return;
      }

      if (state.playbackMode === "repeat_one") {
        // 单曲循环只影响自然播放结束；手动上一首/下一首仍然走普通切歌逻辑。
        state.requestPlayTrack(currentTrack, {
          autoPlay: true,
          resumeTimeSec: 0,
          pushShuffleHistory: false,
        });
        return;
      }

      state.playNext();
    },
    setPlaybackError: (message) => {
      set({
        playbackError: message,
      });
    },
    setIsAudioPlaying: (value) => {
      set({
        isAudioPlaying: value,
      });
    },
    syncProgressSnapshot: (currentTimeSec, force = false) => {
      const normalized = normalizeResumeTime(currentTimeSec);
      const state = get();
      if (!force && Math.abs(state.resumeTimeSec - normalized) < PROGRESS_PERSIST_INTERVAL_SEC) {
        return;
      }

      set({
        resumeTimeSec: normalized,
      });
    },
    setVolume: (value) => {
      const nextVolume = clampVolume(value);
      const audio = get().audioElement;
      if (audio) {
        audio.volume = nextVolume;
      }

      set({
        volume: nextVolume,
      });
    },
    setMuted: (value) => {
      const audio = get().audioElement;
      if (audio) {
        audio.muted = value;
      }

      set({
        muted: value,
      });
    },
    clearPendingResumeTime: () => {
      set({
        pendingResumeTimeSec: null,
        autoPlayOnReady: true,
      });
    },
  })) as StateCreator<PlaybackStoreState, [["zustand/persist", PersistedPlaybackState]], [], PlaybackStoreState>;

  const computedCreator = createComputed<PlaybackStoreState, PlaybackStoreComputed>(computePlaybackState, {
        keys: [
          "queue",
          "displayTrack",
          "activePlayback",
          "playbackMode",
          "shuffleHistory",
          "preparingJobId",
          "currentProfile",
        ],
      })(baseCreator as never) as unknown as StateCreator<PlaybackStore, [], [], PlaybackStore>;

  return createStore<PlaybackStore>()(
    persist(
      computedCreator,
      {
        name: PLAYBACK_STORAGE_KEY,
        storage: createJSONStorage(() => storage ?? getBrowserStorage()),
        partialize: buildPersistedState,
        onRehydrateStorage: () => (state) => {
          if (!state) {
            return;
          }

          state.bindAudioElement(null);
          state.restoreFromPersistedSession();
        },
      },
    ),
  );
}

export const playbackStore = createPlaybackStoreApi();

export function usePlaybackStore<T>(selector: (state: PlaybackStore) => T) {
  return useStore(playbackStore, selector);
}

export function getPlaybackStoreState() {
  return playbackStore.getState();
}

export function getGlobalPlaybackErrorMessage(audio: HTMLAudioElement | null) {
  return getAudioErrorMessage(audio);
}

export type { PlaybackQueueTrack };
