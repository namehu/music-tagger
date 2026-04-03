"use client";

import React from "react";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";

export type PlaybackQueueTrack = {
  id: string;
  title: string;
  artist: string;
};

type ActivePlayback = PlaybackQueueTrack & {
  url: string;
  profile: "original" | "mp3_192";
  sourceKind: "original" | "transcode_cache";
};

type GlobalPlaybackContextValue = {
  activePlayback: ActivePlayback | null;
  currentTrack: PlaybackQueueTrack | null;
  activeTrackId: string | null;
  pendingTrackId: string | null;
  currentProfile: "original" | "mp3_192" | null;
  currentSourceKind: "original" | "transcode_cache" | null;
  preparingJobId: string | null;
  isPreparing: boolean;
  isAudioPlaying: boolean;
  playbackError: string | null;
  queue: PlaybackQueueTrack[];
  setQueue: (tracks: PlaybackQueueTrack[]) => void;
  toggleTrack: (track: PlaybackQueueTrack) => void;
  playTrack: (track: PlaybackQueueTrack) => void;
  playPrevious: () => void;
  playNext: () => void;
  setIsAudioPlaying: (value: boolean) => void;
  setPlaybackError: (value: string | null) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
};

const GlobalPlaybackContext = React.createContext<GlobalPlaybackContextValue | null>(null);
const PREPARING_POLL_INTERVAL_MS = 1500;

function tracksEqual(left: PlaybackQueueTrack[], right: PlaybackQueueTrack[]) {
  if (left.length != right.length) {
    return false;
  }

  return left.every((track, index) => {
    const other = right[index];
    return (
      track.id === other?.id &&
      track.title === other.title &&
      track.artist === other.artist
    );
  });
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

function getJobErrorMessage(errorJson: string | null | undefined) {
  if (!errorJson) {
    return "转码任务失败，请稍后重试";
  }

  try {
    const parsed = JSON.parse(errorJson) as { message?: string };
    if (parsed.message?.trim()) {
      return `转码任务失败：${parsed.message}`;
    }
  } catch {
    return "转码任务失败，请稍后重试";
  }

  return "转码任务失败，请稍后重试";
}

export function GlobalPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueueState] = React.useState<PlaybackQueueTrack[]>([]);
  const [displayTrack, setDisplayTrack] = React.useState<PlaybackQueueTrack | null>(null);
  const [activePlayback, setActivePlayback] = React.useState<ActivePlayback | null>(null);
  const [pendingTrackId, setPendingTrackId] = React.useState<string | null>(null);
  const [preparingJobId, setPreparingJobId] = React.useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = React.useState<"original" | "mp3_192" | null>(null);
  const [currentSourceKind, setCurrentSourceKind] = React.useState<"original" | "transcode_cache" | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const queueRef = React.useRef<PlaybackQueueTrack[]>([]);
  const displayTrackRef = React.useRef<PlaybackQueueTrack | null>(null);
  const activePlaybackRef = React.useRef<ActivePlayback | null>(null);
  const requestIdRef = React.useRef(0);

  const resolvePlayback = trpc.playback.resolve.useMutation({
    onMutate: (variables) => {
      const playbackProfile = variables.profile ?? "original";
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const activeTrackSnapshot =
        activePlaybackRef.current &&
        activePlaybackRef.current.id === variables.trackId
          ? {
              id: activePlaybackRef.current.id,
              title: activePlaybackRef.current.title,
              artist: activePlaybackRef.current.artist,
            }
          : null;
      const track =
        queueRef.current.find((item) => item.id === variables.trackId) ??
        (displayTrackRef.current?.id === variables.trackId ? displayTrackRef.current : null) ??
        activeTrackSnapshot;

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }

      setDisplayTrack(track);
      setPendingTrackId(variables.trackId);
      setPreparingJobId(null);
      setCurrentProfile(playbackProfile);
      setCurrentSourceKind(playbackProfile === "original" ? "original" : "transcode_cache");
      setActivePlayback(null);
      setIsAudioPlaying(false);
      setPlaybackError(null);
      return {
        requestId,
        track,
      };
    },
    onSuccess: (result, variables, context) => {
      const playbackProfile = variables.profile ?? "original";
      if (context && context.requestId !== requestIdRef.current) {
        return;
      }

      const track =
        context?.track ??
        queueRef.current.find((item) => item.id === variables.trackId) ??
        (displayTrackRef.current?.id === variables.trackId ? displayTrackRef.current : null);

      if (!track) {
        setPendingTrackId(null);
        setPreparingJobId(null);
        setCurrentProfile(null);
        setCurrentSourceKind(null);
        return;
      }

      setDisplayTrack(track);
      if (result.status === "preparing") {
        setPreparingJobId(result.jobId);
        return;
      }

      setActivePlayback({
        id: track.id,
        title: track.title,
        artist: track.artist,
        url: result.url,
        profile: playbackProfile,
        sourceKind: playbackProfile === "original" ? "original" : "transcode_cache",
      });
      setPreparingJobId(null);
      setPendingTrackId(null);
    },
    onError: (error, _variables, context) => {
      if (context && context.requestId !== requestIdRef.current) {
        return;
      }

      setPendingTrackId(null);
      setPreparingJobId(null);
      setCurrentProfile(null);
      setCurrentSourceKind(null);
      const message = error.message ?? "播放地址解析失败";
      setPlaybackError(message);
      toast.error(message);
    },
  });

  const preparingJobQuery = trpc.jobs.get.useQuery(
    {
      jobId: preparingJobId ?? "",
    },
    {
      enabled: Boolean(preparingJobId),
      refetchOnWindowFocus: false,
      retry: false,
      refetchInterval: (query) => {
        if (!preparingJobId) {
          return false;
        }

        const status = query.state.data?.status;
        if (status === "done" || status === "failed" || status === "cancelled") {
          return false;
        }

        return PREPARING_POLL_INTERVAL_MS;
      },
    },
  );

  const activeTrackId = displayTrack?.id ?? activePlayback?.id ?? null;
  const activeTrackIndex = queue.findIndex((track) => track.id === activeTrackId);
  const previousTrack = activeTrackIndex > 0 ? queue[activeTrackIndex - 1] : null;
  const nextTrack =
    activeTrackIndex >= 0 && activeTrackIndex < queue.length - 1 ? queue[activeTrackIndex + 1] : null;

  const setQueue = React.useCallback((tracks: PlaybackQueueTrack[]) => {
    setQueueState((current) => (tracksEqual(current, tracks) ? current : tracks));
  }, []);

  React.useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  React.useEffect(() => {
    displayTrackRef.current = displayTrack;
  }, [displayTrack]);

  React.useEffect(() => {
    activePlaybackRef.current = activePlayback;
  }, [activePlayback]);

  React.useEffect(() => {
    if (!preparingJobId || !displayTrack) {
      return;
    }

    const currentJob = preparingJobQuery.data;
    if (!currentJob || currentJob.id !== preparingJobId) {
      return;
    }

    if (currentJob.status === "done") {
      setPreparingJobId(null);
      resolvePlayback.mutate({
        trackId: displayTrack.id,
        profile: "mp3_192",
      });
      return;
    }

    if (currentJob.status === "failed" || currentJob.status === "cancelled") {
      setPendingTrackId(null);
      setPreparingJobId(null);
      setCurrentProfile(null);
      setCurrentSourceKind(null);
      const message = getJobErrorMessage(currentJob.errorJson);
      setPlaybackError(message);
      toast.error(message);
    }
  }, [displayTrack, preparingJobId, preparingJobQuery.data, resolvePlayback]);

  React.useEffect(() => {
    if (!preparingJobId || !preparingJobQuery.error) {
      return;
    }

    setPendingTrackId(null);
    setPreparingJobId(null);
    setCurrentProfile(null);
    setCurrentSourceKind(null);
    const message = preparingJobQuery.error.message ?? "转码任务状态查询失败";
    setPlaybackError(message);
    toast.error(message);
  }, [preparingJobId, preparingJobQuery.error]);

  const playTrack = React.useCallback(
    (track: PlaybackQueueTrack) => {
      setPlaybackError(null);
      resolvePlayback.mutate({
        trackId: track.id,
        profile: "mp3_192",
      });
    },
    [resolvePlayback],
  );

  const toggleTrack = React.useCallback(
    (track: PlaybackQueueTrack) => {
      const isCurrentTrack = activeTrackId === track.id;
      const audio = audioRef.current;

      if (!isCurrentTrack) {
        playTrack(track);
        return;
      }

      if (pendingTrackId === track.id || !audio || !activePlaybackRef.current) {
        return;
      }

      if (audio.paused) {
        void audio.play().catch(() => {
          const message = getAudioErrorMessage(audio);
          setPlaybackError(message);
          toast.error(message);
        });
        return;
      }

      audio.pause();
    },
    [activeTrackId, pendingTrackId, playTrack],
  );

  const playPrevious = React.useCallback(() => {
    if (previousTrack) {
      playTrack(previousTrack);
    }
  }, [playTrack, previousTrack]);

  const playNext = React.useCallback(() => {
    if (nextTrack) {
      playTrack(nextTrack);
    }
  }, [nextTrack, playTrack]);

  const value = React.useMemo<GlobalPlaybackContextValue>(
    () => ({
      activePlayback,
      currentTrack: displayTrack ?? (activePlayback ? activePlayback : null),
      activeTrackId,
      pendingTrackId,
      currentProfile,
      currentSourceKind,
      preparingJobId,
      isPreparing: Boolean(preparingJobId),
      isAudioPlaying,
      playbackError,
      queue,
      setQueue,
      toggleTrack,
      playTrack,
      playPrevious,
      playNext,
      setIsAudioPlaying,
      setPlaybackError,
      audioRef,
    }),
    [
      activePlayback,
      displayTrack,
      activeTrackId,
      pendingTrackId,
      currentProfile,
      currentSourceKind,
      preparingJobId,
      isAudioPlaying,
      playbackError,
      queue,
      setQueue,
      toggleTrack,
      playTrack,
      playPrevious,
      playNext,
    ],
  );

  return <GlobalPlaybackContext.Provider value={value}>{children}</GlobalPlaybackContext.Provider>;
}

export function useGlobalPlayback() {
  const value = React.useContext(GlobalPlaybackContext);
  if (!value) {
    throw new Error("useGlobalPlayback must be used within GlobalPlaybackProvider");
  }

  return value;
}

export function getGlobalPlaybackErrorMessage(audio: HTMLAudioElement | null) {
  return getAudioErrorMessage(audio);
}
