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
};

type GlobalPlaybackContextValue = {
  activePlayback: ActivePlayback | null;
  activeTrackId: string | null;
  pendingTrackId: string | null;
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

export function GlobalPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueueState] = React.useState<PlaybackQueueTrack[]>([]);
  const [activePlayback, setActivePlayback] = React.useState<ActivePlayback | null>(null);
  const [pendingTrackId, setPendingTrackId] = React.useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const queueRef = React.useRef<PlaybackQueueTrack[]>([]);

  const resolvePlayback = trpc.playback.resolve.useMutation({
    onMutate: (variables) => {
      setPendingTrackId(variables.trackId);
      setPlaybackError(null);
    },
    onSuccess: (result, variables) => {
      const track =
        queueRef.current.find((item) => item.id === variables.trackId) ??
        (activePlayback?.id === variables.trackId
          ? {
              id: activePlayback.id,
              title: activePlayback.title,
              artist: activePlayback.artist,
            }
          : null);

      if (!track) {
        setPendingTrackId(null);
        return;
      }

      setActivePlayback({
        id: track.id,
        title: track.title,
        artist: track.artist,
        url: result.url,
      });
      setPendingTrackId(null);
    },
    onError: (error) => {
      setPendingTrackId(null);
      const message = error.message ?? "播放地址解析失败";
      setPlaybackError(message);
      toast.error(message);
    },
  });

  const activeTrackId = activePlayback?.id ?? null;
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

  const playTrack = React.useCallback(
    (track: PlaybackQueueTrack) => {
      setPlaybackError(null);
      resolvePlayback.mutate({
        trackId: track.id,
        profile: "original",
      });
    },
    [resolvePlayback],
  );

  const toggleTrack = React.useCallback(
    (track: PlaybackQueueTrack) => {
      const isCurrentTrack = activeTrackId === track.id;
      const audio = audioRef.current;

      if (!isCurrentTrack || !audio) {
        playTrack(track);
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
    [activeTrackId, playTrack],
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
      activeTrackId,
      pendingTrackId,
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
      activeTrackId,
      pendingTrackId,
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
