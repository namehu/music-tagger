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

export type PlaybackSessionKind = "user" | "admin";
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

type PersistedPlaybackSessionState = {
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

type PersistedPlaybackStoreState = {
  userSession: PersistedPlaybackSessionState;
};

type PlaybackSessionState = PersistedPlaybackSessionState & {
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
  currentTimeSec: number;
  durationSec: number;
  bufferedUntilSec: number;
  isSeeking: boolean;
  seekingPreviewTimeSec: number | null;
};

type PlaybackSessionComputed = {
  currentTrack: PlaybackQueueTrack | null;
  activeTrackId: string | null;
  activeTrackIndex: number;
  queueSize: number;
  queueItems: PlaybackQueueTrack[];
  upNextItems: PlaybackQueueTrack[];
  previousTrack: PlaybackQueueTrack | null;
  nextTrack: PlaybackQueueTrack | null;
  canPlayPrevious: boolean;
  canPlayNext: boolean;
  isPreparing: boolean;
  isCurrentTrackInQueue: boolean;
  displayTimeSec: number;
};

type PlaybackStoreState = {
  sessions: Record<PlaybackSessionKind, PlaybackSessionState>;
  bindAudioElement: (sessionKind: PlaybackSessionKind, audio: HTMLAudioElement | null) => void;
  completeHydration: (sessionKind: PlaybackSessionKind) => void;
  restoreFromPersistedSession: (sessionKind: PlaybackSessionKind) => void;
  setQueue: (
    sessionKind: PlaybackSessionKind,
    input: { tracks: PlaybackQueueTrack[]; sourceKey: string },
  ) => void;
  replaceQueueFromUserIntent: (
    sessionKind: PlaybackSessionKind,
    input: { tracks: PlaybackQueueTrack[]; sourceKey: string },
  ) => void;
  removeQueueTrack: (sessionKind: PlaybackSessionKind, trackId: string) => void;
  clearQueue: (sessionKind: PlaybackSessionKind) => void;
  setPlaybackMode: (sessionKind: PlaybackSessionKind, mode: PlaybackMode) => void;
  requestPlayTrack: (
    sessionKind: PlaybackSessionKind,
    track: PlaybackQueueTrack,
    options?: {
      profile?: PlaybackProfile;
      autoPlay?: boolean;
      resumeTimeSec?: number | null;
      pushShuffleHistory?: boolean;
    },
  ) => void;
  writeResolvePreparing: (
    sessionKind: PlaybackSessionKind,
    input: { seq: number; jobId: string },
  ) => void;
  writeResolvedPlayback: (
    sessionKind: PlaybackSessionKind,
    input: { seq: number; url: string },
  ) => void;
  handleResolveFailure: (
    sessionKind: PlaybackSessionKind,
    input: { seq: number; message: string; clearSession?: boolean },
  ) => void;
  retryPreparingRequest: (sessionKind: PlaybackSessionKind) => void;
  handlePreparingFailure: (sessionKind: PlaybackSessionKind, message: string) => void;
  toggleTrack: (sessionKind: PlaybackSessionKind, track: PlaybackQueueTrack) => void;
  playPrevious: (sessionKind: PlaybackSessionKind) => void;
  playNext: (sessionKind: PlaybackSessionKind) => void;
  handleTrackEnded: (sessionKind: PlaybackSessionKind) => void;
  stopSession: (sessionKind: PlaybackSessionKind) => void;
  pauseSession: (sessionKind: PlaybackSessionKind) => void;
  pauseOtherSessionOnStart: (sessionKind: PlaybackSessionKind) => void;
  setPlaybackError: (sessionKind: PlaybackSessionKind, message: string | null) => void;
  setIsAudioPlaying: (sessionKind: PlaybackSessionKind, value: boolean) => void;
  setPlaybackPosition: (
    sessionKind: PlaybackSessionKind,
    currentTimeSec: number,
    forceSnapshot?: boolean,
  ) => void;
  syncProgressSnapshot: (
    sessionKind: PlaybackSessionKind,
    currentTimeSec: number,
    force?: boolean,
  ) => void;
  beginSeek: (sessionKind: PlaybackSessionKind, previewTimeSec: number) => void;
  updateSeekPreview: (sessionKind: PlaybackSessionKind, previewTimeSec: number) => void;
  commitSeek: (sessionKind: PlaybackSessionKind, nextTimeSec: number) => void;
  cancelSeek: (sessionKind: PlaybackSessionKind) => void;
  setBufferedUntilSec: (sessionKind: PlaybackSessionKind, seconds: number) => void;
  setDurationSec: (sessionKind: PlaybackSessionKind, value: number) => void;
  setVolume: (sessionKind: PlaybackSessionKind, value: number) => void;
  setMuted: (sessionKind: PlaybackSessionKind, value: boolean) => void;
  clearPendingResumeTime: (sessionKind: PlaybackSessionKind) => void;
};

type PlaybackStoreComputed = {
  sessionComputed: Record<PlaybackSessionKind, PlaybackSessionComputed>;
};

export type PlaybackSessionSnapshot = PlaybackSessionState & PlaybackSessionComputed;
export type PlaybackStore = PlaybackStoreState & PlaybackStoreComputed;

const PLAYBACK_STORAGE_KEY = "music-tagger:playback-session:v2";
const PROGRESS_PERSIST_INTERVAL_SEC = 2;
const SESSION_KINDS: PlaybackSessionKind[] = ["user", "admin"];

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

function normalizeDuration(value: number | null | undefined) {
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

function createInitialSessionState(sessionKind: PlaybackSessionKind): PlaybackSessionState {
  return {
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
    hydrationStatus: sessionKind === "user" ? "rehydrating" : "ready",
    resumeLock: false,
    resolveRequest: null,
    pendingResumeTimeSec: null,
    autoPlayOnReady: false,
    audioElement: null,
    requestSeq: 0,
    currentTimeSec: 0,
    durationSec: 0,
    bufferedUntilSec: 0,
    isSeeking: false,
    seekingPreviewTimeSec: null,
  };
}

function getCurrentTrackFromSession(session: PlaybackSessionState) {
  return session.displayTrack ?? (session.activePlayback ? session.activePlayback : null);
}

function getActiveTrackIdFromSession(session: PlaybackSessionState) {
  return getCurrentTrackFromSession(session)?.id ?? null;
}

function isCurrentTrackInQueueFromSession(session: PlaybackSessionState) {
  return getQueueTrackIndex(session.queue, getActiveTrackIdFromSession(session)) >= 0;
}

function computeSessionState(
  session: PlaybackSessionState,
  sessionKind: PlaybackSessionKind,
): PlaybackSessionComputed {
  const currentTrack = getCurrentTrackFromSession(session);
  const activeTrackId = currentTrack?.id ?? null;
  const activeTrackIndex = getQueueTrackIndex(session.queue, activeTrackId);
  const orderedPreviousTrack = getOrderedPreviousTrack(session.queue, activeTrackId);
  const orderedNextTrack = getOrderedNextTrack(session.queue, activeTrackId);
  const isCurrentTrackInQueue = activeTrackIndex >= 0;
  const usesShuffle = sessionKind === "user" && session.playbackMode === "shuffle";
  const upNextItems =
    activeTrackIndex >= 0 ? session.queue.slice(activeTrackIndex + 1) : session.queue.slice();

  return {
    currentTrack,
    activeTrackId,
    activeTrackIndex,
    queueSize: session.queue.length,
    queueItems: session.queue,
    upNextItems,
    previousTrack: usesShuffle ? getShufflePreviousTrack(session.shuffleHistory) : orderedPreviousTrack,
    nextTrack: usesShuffle ? null : orderedNextTrack,
    canPlayPrevious: usesShuffle ? session.shuffleHistory.length > 0 : Boolean(orderedPreviousTrack),
    canPlayNext:
      !isCurrentTrackInQueue
        ? false
        : usesShuffle
          ? session.queue.length > 1
          : Boolean(orderedNextTrack),
    isPreparing: Boolean(session.preparingJobId),
    isCurrentTrackInQueue,
    displayTimeSec:
      session.isSeeking && session.seekingPreviewTimeSec != null
        ? session.seekingPreviewTimeSec
        : session.currentTimeSec,
  };
}

function computePlaybackState(state: PlaybackStoreState): PlaybackStoreComputed {
  return {
    sessionComputed: {
      user: computeSessionState(state.sessions.user, "user"),
      admin: computeSessionState(state.sessions.admin, "admin"),
    },
  };
}

function getBrowserStorage() {
  return typeof window !== "undefined" ? window.localStorage : noopStorage;
}

function buildPersistedSessionState(session: PlaybackSessionState): PersistedPlaybackSessionState {
  return {
    queue: session.queue,
    queueSourceKey: session.queueSourceKey,
    displayTrack: session.displayTrack,
    currentProfile: session.currentProfile,
    playbackMode: session.playbackMode,
    shuffleHistory: session.shuffleHistory,
    resumeTimeSec: session.resumeTimeSec,
    volume: session.volume,
    muted: session.muted,
  };
}

function buildSessionUpdate(
  current: PlaybackStoreState,
  sessionKind: PlaybackSessionKind,
  partial: Partial<PlaybackSessionState>,
) {
  return {
    sessions: {
      ...current.sessions,
      [sessionKind]: {
        ...current.sessions[sessionKind],
        ...partial,
      },
    },
  };
}

function buildClearedQueueSessionState(session: PlaybackSessionState): Partial<PlaybackSessionState> {
  return {
    queue: [],
    queueSourceKey: null,
    displayTrack: null,
    activePlayback: null,
    pendingTrackId: null,
    preparingJobId: null,
    preparingRequest: null,
    currentProfile: null,
    currentSourceKind: null,
    shuffleHistory: [],
    resolveRequest: null,
    pendingResumeTimeSec: null,
    autoPlayOnReady: false,
    currentTimeSec: 0,
    resumeTimeSec: 0,
    playbackError: null,
    hydrationStatus: "ready",
    resumeLock: false,
    isAudioPlaying: false,
    durationSec: session.audioElement ? normalizeDuration(session.audioElement.duration) : 0,
    bufferedUntilSec: 0,
    isSeeking: false,
    seekingPreviewTimeSec: null,
  };
}

function getOtherSessionKind(sessionKind: PlaybackSessionKind): PlaybackSessionKind {
  return sessionKind === "user" ? "admin" : "user";
}

function getPlaybackSessionSnapshot(
  state: PlaybackStore,
  sessionKind: PlaybackSessionKind,
): PlaybackSessionSnapshot {
  return {
    ...state.sessions[sessionKind],
    ...state.sessionComputed[sessionKind],
  };
}

export function createPlaybackStoreApi(storage?: StateStorage, random = Math.random) {
  const baseCreator = ((set, get) => ({
    sessions: {
      user: createInitialSessionState("user"),
      admin: createInitialSessionState("admin"),
    },
    bindAudioElement: (sessionKind, audio) => {
      const session = get().sessions[sessionKind];
      const previousAudio = session.audioElement;
      if (!audio) {
        // keyed audio 切换时，旧节点的 ref(null) 可能晚于新节点挂载触发；
        // 此时会话已经拿到了新的 activePlayback，不能再让旧节点把新引用和新进度冲掉。
        if (session.activePlayback) {
          return;
        }

        const currentTime = previousAudio
          ? normalizeResumeTime(previousAudio.currentTime)
          : session.resumeTimeSec;
        if (previousAudio && !previousAudio.paused) {
          previousAudio.pause();
        }

        set((current) =>
          buildSessionUpdate(current, sessionKind, {
            audioElement: null,
            isAudioPlaying: false,
            currentTimeSec: currentTime > 0 ? currentTime : current.sessions[sessionKind].currentTimeSec,
            resumeTimeSec: currentTime > 0 ? currentTime : current.sessions[sessionKind].resumeTimeSec,
          }),
        );
        return;
      }

      if (previousAudio && previousAudio !== audio) {
        previousAudio.pause();
        set((current) =>
          buildSessionUpdate(current, sessionKind, {
            audioElement: audio,
            isAudioPlaying: false,
          }),
        );
      } else {
        set((current) => buildSessionUpdate(current, sessionKind, { audioElement: audio }));
      }

      if (audio) {
        const session = get().sessions[sessionKind];
        audio.volume = clampVolume(session.volume);
        audio.muted = session.muted;
      }
    },
    completeHydration: (sessionKind) => {
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          hydrationStatus: "ready",
          resumeLock: false,
        }),
      );
    },
    restoreFromPersistedSession: (sessionKind) => {
      if (sessionKind !== "user") {
        get().completeHydration(sessionKind);
        return;
      }

      const session = get().sessions.user;
      const currentTrack = getCurrentTrackFromSession(session);
      if (!currentTrack || !session.currentProfile) {
        get().completeHydration("user");
        return;
      }

      // 恢复链路需要先锁住被动 queue 同步，避免页面挂载时把 localStorage 里的会话上下文冲掉。
      set((current) =>
        buildSessionUpdate(current, "user", {
          hydrationStatus: "resolving",
          resumeLock: true,
          pendingTrackId: currentTrack.id,
          preparingJobId: null,
          preparingRequest: null,
          activePlayback: null,
          isAudioPlaying: false,
          playbackError: null,
          currentSourceKind: toSourceKind(session.currentProfile!),
          currentTimeSec: session.resumeTimeSec,
          resolveRequest: {
            seq: current.sessions.user.requestSeq + 1,
            track: currentTrack,
            profile: session.currentProfile!,
            autoPlay: false,
            resumeTimeSec: session.resumeTimeSec > 0 ? session.resumeTimeSec : null,
          },
          requestSeq: current.sessions.user.requestSeq + 1,
        }),
      );
    },
    setQueue: (sessionKind, { tracks, sourceKey }) => {
      const session = get().sessions[sessionKind];
      if (
        !shouldAcceptPassiveQueueUpdate({
          hydrationStatus: session.hydrationStatus,
          resumeLock: session.resumeLock,
          currentTrackId: getActiveTrackIdFromSession(session),
          currentQueueSourceKey: session.queueSourceKey,
          nextQueueSourceKey: sourceKey,
        })
      ) {
        return;
      }

      if (session.queueSourceKey === sourceKey && tracksEqual(session.queue, tracks)) {
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          queue: tracks,
          queueSourceKey: sourceKey,
        }),
      );
    },
    replaceQueueFromUserIntent: (sessionKind, { tracks, sourceKey }) => {
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          queue: tracks,
          queueSourceKey: sourceKey,
          shuffleHistory: [],
          resumeLock: false,
          hydrationStatus: "ready",
        }),
      );
    },
    removeQueueTrack: (sessionKind, trackId) => {
      const state = get();
      const session = state.sessions[sessionKind];
      const removedIndex = getQueueTrackIndex(session.queue, trackId);
      if (removedIndex < 0) {
        return;
      }

      const currentTrack = getCurrentTrackFromSession(session);
      const isRemovingCurrent = currentTrack?.id === trackId;
      const nextQueue = session.queue.filter((track) => track.id !== trackId);
      const nextShuffleHistory = session.shuffleHistory.filter((track) => track.id !== trackId);

      if (!isRemovingCurrent) {
        set((current) =>
          buildSessionUpdate(current, sessionKind, {
            queue: nextQueue,
            queueSourceKey: nextQueue.length > 0 ? session.queueSourceKey : null,
            shuffleHistory: nextShuffleHistory,
          }),
        );
        return;
      }

      const nextTrack =
        sessionKind === "user" && session.playbackMode === "shuffle"
          ? pickShuffleNextTrack({
              queue: nextQueue,
              trackId: null,
              random,
            })
          : nextQueue[removedIndex] ?? null;

      if (!nextTrack) {
        if (session.audioElement) {
          session.audioElement.pause();
          session.audioElement.currentTime = 0;
        }

        set((current) =>
          buildSessionUpdate(current, sessionKind, buildClearedQueueSessionState(current.sessions[sessionKind])),
        );
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          queue: nextQueue,
          queueSourceKey: session.queueSourceKey,
          shuffleHistory: nextShuffleHistory,
        }),
      );
      get().requestPlayTrack(sessionKind, nextTrack, {
        profile: session.currentProfile ?? "mp3_192",
        autoPlay: session.isAudioPlaying || session.autoPlayOnReady,
        pushShuffleHistory: false,
      });
    },
    clearQueue: (sessionKind) => {
      const session = get().sessions[sessionKind];
      if (session.audioElement) {
        session.audioElement.pause();
        session.audioElement.currentTime = 0;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, buildClearedQueueSessionState(current.sessions[sessionKind])),
      );
    },
    setPlaybackMode: (sessionKind, mode) => {
      if (sessionKind !== "user") {
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          playbackMode: mode,
        }),
      );
    },
    pauseOtherSessionOnStart: (sessionKind) => {
      const otherSessionKind = getOtherSessionKind(sessionKind);
      const otherSession = get().sessions[otherSessionKind];
      const audio = otherSession.audioElement;
      const nextProgress =
        audio != null ? normalizeResumeTime(audio.currentTime) : otherSession.resumeTimeSec;

      if (audio && !audio.paused) {
        audio.pause();
      }

      set((current) =>
        buildSessionUpdate(current, otherSessionKind, {
          isAudioPlaying: false,
          currentTimeSec: nextProgress,
          resumeTimeSec: nextProgress,
        }),
      );
    },
    requestPlayTrack: (sessionKind, track, options) => {
      const state = get();
      const session = state.sessions[sessionKind];
      const profile = options?.profile ?? "mp3_192";
      const nextResumeTime = normalizeResumeTime(options?.resumeTimeSec);
      const currentTrack = getCurrentTrackFromSession(session);
      const activeTrackId = currentTrack?.id ?? null;
      const usesShuffle = sessionKind === "user" && session.playbackMode === "shuffle";
      const pushShuffleHistory =
        options?.pushShuffleHistory ?? (usesShuffle && activeTrackId !== track.id);
      const nextHistory =
        pushShuffleHistory && currentTrack && currentTrack.id !== track.id
          ? [...session.shuffleHistory, currentTrack]
          : session.shuffleHistory;

      state.pauseOtherSessionOnStart(sessionKind);
      session.audioElement?.pause();

      // 手动点播和切歌都会走同一条 resolve 请求链；区分 sessionKind 后，admin 试听也不会再覆盖用户会话。
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
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
            seq: current.sessions[sessionKind].requestSeq + 1,
            track,
            profile,
            autoPlay: options?.autoPlay ?? true,
            resumeTimeSec: nextResumeTime > 0 ? nextResumeTime : null,
          },
          requestSeq: current.sessions[sessionKind].requestSeq + 1,
          pendingResumeTimeSec: null,
          autoPlayOnReady: options?.autoPlay ?? true,
          shuffleHistory: sessionKind === "user" ? nextHistory : [],
          resumeLock: false,
          hydrationStatus: "ready",
          currentTimeSec: nextResumeTime,
          resumeTimeSec: nextResumeTime,
          durationSec: 0,
          bufferedUntilSec: 0,
          isSeeking: false,
          seekingPreviewTimeSec: null,
        }),
      );
    },
    writeResolvePreparing: (sessionKind, { seq, jobId }) => {
      const session = get().sessions[sessionKind];
      const request = session.resolveRequest;
      if (!request || request.seq !== seq) {
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          preparingJobId: jobId,
          preparingRequest: request,
          resolveRequest: null,
        }),
      );
    },
    writeResolvedPlayback: (sessionKind, { seq, url }) => {
      const session = get().sessions[sessionKind];
      const request = session.resolveRequest;
      if (!request || request.seq !== seq) {
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
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
          currentTimeSec: normalizeResumeTime(request.resumeTimeSec),
          resumeTimeSec: normalizeResumeTime(request.resumeTimeSec),
          playbackError: null,
          hydrationStatus: "ready",
          bufferedUntilSec: 0,
          isSeeking: false,
          seekingPreviewTimeSec: null,
        }),
      );
    },
    handleResolveFailure: (sessionKind, { seq, message, clearSession = false }) => {
      const session = get().sessions[sessionKind];
      const activeRequest = session.resolveRequest;
      if (activeRequest && activeRequest.seq !== seq) {
        return;
      }

      if (clearSession) {
        set((current) =>
          buildSessionUpdate(current, sessionKind, {
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
            currentTimeSec: 0,
            resumeTimeSec: 0,
            playbackError: message,
            hydrationStatus: "ready",
            resumeLock: false,
            isAudioPlaying: false,
            durationSec: 0,
            bufferedUntilSec: 0,
            isSeeking: false,
            seekingPreviewTimeSec: null,
          }),
        );
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          pendingTrackId: null,
          preparingJobId: null,
          preparingRequest: null,
          currentProfile: null,
          currentSourceKind: null,
          resolveRequest: null,
          pendingResumeTimeSec: null,
          autoPlayOnReady: false,
          currentTimeSec: 0,
          playbackError: message,
          hydrationStatus: "ready",
          bufferedUntilSec: 0,
          isSeeking: false,
          seekingPreviewTimeSec: null,
        }),
      );
    },
    retryPreparingRequest: (sessionKind) => {
      const session = get().sessions[sessionKind];
      const request = session.preparingRequest;
      if (!request) {
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          preparingJobId: null,
          preparingRequest: null,
          resolveRequest: {
            ...request,
            seq: current.sessions[sessionKind].requestSeq + 1,
          },
          requestSeq: current.sessions[sessionKind].requestSeq + 1,
        }),
      );
    },
    handlePreparingFailure: (sessionKind, message) => {
      const session = get().sessions[sessionKind];
      if (session.resumeLock) {
        get().handleResolveFailure(sessionKind, {
          seq: session.preparingRequest?.seq ?? session.requestSeq,
          message,
          clearSession: true,
        });
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          pendingTrackId: null,
          preparingJobId: null,
          preparingRequest: null,
          currentProfile: null,
          currentSourceKind: null,
          currentTimeSec: 0,
          playbackError: message,
          hydrationStatus: "ready",
          bufferedUntilSec: 0,
          isSeeking: false,
          seekingPreviewTimeSec: null,
        }),
      );
    },
    toggleTrack: (sessionKind, track) => {
      const state = get();
      const session = state.sessions[sessionKind];
      const audio = session.audioElement;
      const activeTrackId = getActiveTrackIdFromSession(session);

      if (activeTrackId !== track.id) {
        state.requestPlayTrack(sessionKind, track, { pushShuffleHistory: true });
        return;
      }

      if (session.pendingTrackId === track.id || !audio || !session.activePlayback) {
        return;
      }

      if (audio.paused) {
        state.pauseOtherSessionOnStart(sessionKind);
        void audio.play().catch(() => {
          state.setPlaybackError(sessionKind, getAudioErrorMessage(audio));
        });
        return;
      }

      audio.pause();
    },
    playPrevious: (sessionKind) => {
      const state = get();
      const session = state.sessions[sessionKind];
      const activeTrackId = getActiveTrackIdFromSession(session);

      if (sessionKind === "user" && session.playbackMode === "shuffle") {
        const previousTrack = getShufflePreviousTrack(session.shuffleHistory);
        if (!previousTrack) {
          return;
        }

        // shuffle 的上一首依赖真实播放历史，所以回退时要同步弹出历史栈，而不是重新推入当前曲目。
        set((current) =>
          buildSessionUpdate(current, sessionKind, {
            shuffleHistory: session.shuffleHistory.slice(0, -1),
          }),
        );
        state.requestPlayTrack(sessionKind, previousTrack, {
          pushShuffleHistory: false,
        });
        return;
      }

      const previousTrack = getOrderedPreviousTrack(session.queue, activeTrackId);
      if (previousTrack) {
        state.requestPlayTrack(sessionKind, previousTrack, {
          pushShuffleHistory: false,
        });
      }
    },
    playNext: (sessionKind) => {
      const state = get();
      const session = state.sessions[sessionKind];
      const activeTrackId = getActiveTrackIdFromSession(session);
      if (!isCurrentTrackInQueueFromSession(session)) {
        return;
      }

      if (sessionKind === "user" && session.playbackMode === "shuffle") {
        const nextTrack = pickShuffleNextTrack({
          queue: session.queue,
          trackId: activeTrackId,
          random,
        });
        if (nextTrack) {
          state.requestPlayTrack(sessionKind, nextTrack, {
            pushShuffleHistory: true,
          });
        }
        return;
      }

      const nextTrack = getOrderedNextTrack(session.queue, activeTrackId);
      if (nextTrack) {
        state.requestPlayTrack(sessionKind, nextTrack, {
          pushShuffleHistory: false,
        });
      }
    },
    handleTrackEnded: (sessionKind) => {
      const state = get();
      const session = state.sessions[sessionKind];
      const currentTrack = getCurrentTrackFromSession(session);
      if (!currentTrack) {
        return;
      }

      if (sessionKind === "user" && session.playbackMode === "repeat_one") {
        // 单曲循环只影响自然播放结束；admin 试听保持线性，不参与用户侧模式语义。
        state.requestPlayTrack(sessionKind, currentTrack, {
          autoPlay: true,
          resumeTimeSec: 0,
          pushShuffleHistory: false,
        });
        return;
      }

      state.playNext(sessionKind);
    },
    stopSession: (sessionKind) => {
      const session = get().sessions[sessionKind];
      const audio = session.audioElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          isAudioPlaying: false,
          currentTimeSec: 0,
          resumeTimeSec: 0,
          pendingResumeTimeSec: null,
          autoPlayOnReady: false,
          durationSec: normalizeDuration(audio?.duration),
          bufferedUntilSec: 0,
          isSeeking: false,
          seekingPreviewTimeSec: null,
        }),
      );
    },
    pauseSession: (sessionKind) => {
      const session = get().sessions[sessionKind];
      const audio = session.audioElement;
      const nextProgress =
        audio != null ? normalizeResumeTime(audio.currentTime) : session.resumeTimeSec;
      if (audio && !audio.paused) {
        audio.pause();
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          isAudioPlaying: false,
          currentTimeSec: nextProgress,
          resumeTimeSec: nextProgress,
        }),
      );
    },
    setPlaybackError: (sessionKind, message) => {
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          playbackError: message,
        }),
      );
    },
    setIsAudioPlaying: (sessionKind, value) => {
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          isAudioPlaying: value,
        }),
      );
    },
    setPlaybackPosition: (sessionKind, currentTimeSec, forceSnapshot = false) => {
      const normalized = normalizeResumeTime(currentTimeSec);
      const session = get().sessions[sessionKind];
      const shouldUpdateSnapshot =
        forceSnapshot || Math.abs(session.resumeTimeSec - normalized) >= PROGRESS_PERSIST_INTERVAL_SEC;

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          currentTimeSec: normalized,
          resumeTimeSec: shouldUpdateSnapshot ? normalized : current.sessions[sessionKind].resumeTimeSec,
        }),
      );
    },
    syncProgressSnapshot: (sessionKind, currentTimeSec, force = false) => {
      const normalized = normalizeResumeTime(currentTimeSec);
      const session = get().sessions[sessionKind];
      if (!force && Math.abs(session.resumeTimeSec - normalized) < PROGRESS_PERSIST_INTERVAL_SEC) {
        return;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          resumeTimeSec: normalized,
        }),
      );
    },
    beginSeek: (sessionKind, previewTimeSec) => {
      const normalized = normalizeResumeTime(previewTimeSec);
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          isSeeking: true,
          seekingPreviewTimeSec: normalized,
        }),
      );
    },
    updateSeekPreview: (sessionKind, previewTimeSec) => {
      const normalized = normalizeResumeTime(previewTimeSec);
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          isSeeking: true,
          seekingPreviewTimeSec: normalized,
        }),
      );
    },
    commitSeek: (sessionKind, nextTimeSec) => {
      const normalized = normalizeResumeTime(nextTimeSec);
      const audio = get().sessions[sessionKind].audioElement;
      if (audio) {
        audio.currentTime = normalized;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          currentTimeSec: normalized,
          resumeTimeSec: normalized,
          isSeeking: false,
          seekingPreviewTimeSec: null,
        }),
      );
    },
    cancelSeek: (sessionKind) => {
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          isSeeking: false,
          seekingPreviewTimeSec: null,
        }),
      );
    },
    setBufferedUntilSec: (sessionKind, seconds) => {
      const normalized = normalizeResumeTime(seconds);
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          bufferedUntilSec: normalized,
        }),
      );
    },
    setDurationSec: (sessionKind, value) => {
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          durationSec: normalizeDuration(value),
        }),
      );
    },
    setVolume: (sessionKind, value) => {
      const nextVolume = clampVolume(value);
      const audio = get().sessions[sessionKind].audioElement;
      if (audio) {
        audio.volume = nextVolume;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          volume: nextVolume,
        }),
      );
    },
    setMuted: (sessionKind, value) => {
      const audio = get().sessions[sessionKind].audioElement;
      if (audio) {
        audio.muted = value;
      }

      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          muted: value,
        }),
      );
    },
    clearPendingResumeTime: (sessionKind) => {
      set((current) =>
        buildSessionUpdate(current, sessionKind, {
          pendingResumeTimeSec: null,
          autoPlayOnReady: true,
        }),
      );
    },
  })) as StateCreator<
    PlaybackStoreState,
    [["zustand/persist", PersistedPlaybackStoreState]],
    [],
    PlaybackStoreState
  >;

  const computedCreator = createComputed<PlaybackStoreState, PlaybackStoreComputed>(computePlaybackState, {
    keys: ["sessions"],
  })(baseCreator as never) as unknown as StateCreator<PlaybackStore, [], [], PlaybackStore>;

  return createStore<PlaybackStore>()(
    persist(computedCreator, {
      name: PLAYBACK_STORAGE_KEY,
      storage: createJSONStorage(() => storage ?? getBrowserStorage()),
      partialize: (state) => ({
        userSession: buildPersistedSessionState(state.sessions.user),
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedPlaybackStoreState>;
        if (!persisted.userSession) {
          return currentState;
        }

        return {
          ...currentState,
          sessions: {
            ...currentState.sessions,
            user: {
              ...currentState.sessions.user,
              ...persisted.userSession,
              currentTimeSec: persisted.userSession.resumeTimeSec,
            },
          },
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        SESSION_KINDS.forEach((sessionKind) => {
          state.bindAudioElement(sessionKind, null);
        });
        state.restoreFromPersistedSession("user");
        state.completeHydration("admin");
      },
    }),
  );
}

export const playbackStore = createPlaybackStoreApi();

export function usePlaybackStore<T>(selector: (state: PlaybackStore) => T) {
  return useStore(playbackStore, selector);
}

export function usePlaybackSession<T>(
  sessionKind: PlaybackSessionKind,
  selector: (state: PlaybackSessionSnapshot) => T,
) {
  return useStore(playbackStore, (state) => selector(getPlaybackSessionSnapshot(state, sessionKind)));
}

export function getPlaybackStoreState() {
  return playbackStore.getState();
}

export function getPlaybackSessionState(sessionKind: PlaybackSessionKind) {
  return getPlaybackSessionSnapshot(playbackStore.getState(), sessionKind);
}

export function getPlaybackAudioErrorMessage(audio: HTMLAudioElement | null) {
  return getAudioErrorMessage(audio);
}

export function getGlobalPlaybackErrorMessage(audio: HTMLAudioElement | null) {
  return getAudioErrorMessage(audio);
}

export type { PlaybackQueueTrack };
