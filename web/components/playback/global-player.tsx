"use client";

import React from "react";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  Music4Icon,
  PauseCircleIcon,
  PlayCircleIcon,
  Repeat1Icon,
  ShuffleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGlobalPlaybackErrorMessage, usePlaybackStore } from "@/store/playback-store";

function formatProgressSeconds(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function GlobalPlayer() {
  const activePlayback = usePlaybackStore((state) => state.activePlayback);
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const currentProfile = usePlaybackStore((state) => state.currentProfile);
  const currentSourceKind = usePlaybackStore((state) => state.currentSourceKind);
  const playbackMode = usePlaybackStore((state) => state.playbackMode);
  const isPreparing = usePlaybackStore((state) => state.isPreparing);
  const isAudioPlaying = usePlaybackStore((state) => state.isAudioPlaying);
  const playbackError = usePlaybackStore((state) => state.playbackError);
  const canPlayPrevious = usePlaybackStore((state) => state.canPlayPrevious);
  const canPlayNext = usePlaybackStore((state) => state.canPlayNext);
  const pendingResumeTimeSec = usePlaybackStore((state) => state.pendingResumeTimeSec);
  const autoPlayOnReady = usePlaybackStore((state) => state.autoPlayOnReady);
  const resumeTimeSec = usePlaybackStore((state) => state.resumeTimeSec);
  const volume = usePlaybackStore((state) => state.volume);
  const muted = usePlaybackStore((state) => state.muted);
  const bindAudioElement = usePlaybackStore((state) => state.bindAudioElement);
  const toggleTrack = usePlaybackStore((state) => state.toggleTrack);
  const playPrevious = usePlaybackStore((state) => state.playPrevious);
  const playNext = usePlaybackStore((state) => state.playNext);
  const handleTrackEnded = usePlaybackStore((state) => state.handleTrackEnded);
  const setIsAudioPlaying = usePlaybackStore((state) => state.setIsAudioPlaying);
  const setPlaybackError = usePlaybackStore((state) => state.setPlaybackError);
  const syncProgressSnapshot = usePlaybackStore((state) => state.syncProgressSnapshot);
  const setVolume = usePlaybackStore((state) => state.setVolume);
  const setMuted = usePlaybackStore((state) => state.setMuted);
  const clearPendingResumeTime = usePlaybackStore((state) => state.clearPendingResumeTime);
  const setPlaybackMode = usePlaybackStore((state) => state.setPlaybackMode);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    bindAudioElement(audioRef.current);
    return () => bindAudioElement(null);
  }, [bindAudioElement]);

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isPreparing ? "secondary" : isAudioPlaying ? "default" : "outline"}>
                {isPreparing ? "全局准备中" : isAudioPlaying ? "全局播放中" : "全局已暂停"}
              </Badge>
              <Badge variant="secondary">跨页面保持</Badge>
              {currentProfile ? <Badge variant="outline">{currentProfile}</Badge> : null}
              {currentSourceKind ? (
                <Badge variant="outline">{currentSourceKind === "transcode_cache" ? "转码缓存" : "原始直出"}</Badge>
              ) : null}
              <Badge variant="secondary">
                {playbackMode === "ordered" ? "顺序" : playbackMode === "shuffle" ? "随机" : "单曲循环"}
              </Badge>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-muted/50 p-2 text-muted-foreground">
                <Music4Icon />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium md:text-base">{currentTrack.title}</div>
                <div className="truncate text-sm text-muted-foreground">{currentTrack.artist}</div>
              </div>
            </div>
            {!isPreparing ? (
              <div className="text-xs text-muted-foreground">
                上次恢复进度 {formatProgressSeconds(resumeTimeSec)}
                {!isAudioPlaying && activePlayback && !autoPlayOnReady ? "，刷新后恢复为暂停状态" : ""}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={playbackMode === "ordered" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPlaybackMode("ordered")}
              >
                顺序
              </Button>
              <Button
                type="button"
                variant={playbackMode === "shuffle" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPlaybackMode("shuffle")}
              >
                <ShuffleIcon data-icon="inline-start" />
                随机
              </Button>
              <Button
                type="button"
                variant={playbackMode === "repeat_one" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPlaybackMode("repeat_one")}
              >
                <Repeat1Icon data-icon="inline-start" />
                单曲循环
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPlayPrevious}
                onClick={playPrevious}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                上一首
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPreparing || !activePlayback}
                onClick={() => toggleTrack(currentTrack)}
              >
                {isAudioPlaying ? <PauseCircleIcon data-icon="inline-start" /> : <PlayCircleIcon data-icon="inline-start" />}
                {isAudioPlaying ? "暂停" : "继续"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPlayNext}
                onClick={playNext}
              >
                下一首
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </div>

        {activePlayback ? (
          <audio
            key={activePlayback.url}
            ref={audioRef}
            src={activePlayback.url}
            controls
            autoPlay={autoPlayOnReady}
            preload="metadata"
            className={cn("w-full", playbackError && "border-destructive/30")}
            onPlay={() => setIsAudioPlaying(true)}
            onPause={(event) => {
              setIsAudioPlaying(false);
              syncProgressSnapshot(event.currentTarget.currentTime, true);
            }}
            onLoadedMetadata={(event) => {
              const audio = event.currentTarget;
              audio.volume = volume;
              audio.muted = muted;

              if (typeof pendingResumeTimeSec === "number" && pendingResumeTimeSec > 0) {
                const maxSeek = Number.isFinite(audio.duration) ? audio.duration : pendingResumeTimeSec;
                audio.currentTime = Math.min(pendingResumeTimeSec, maxSeek);
              }

              if (!autoPlayOnReady) {
                audio.pause();
              }

              clearPendingResumeTime();
            }}
            onTimeUpdate={(event) => {
              syncProgressSnapshot(event.currentTarget.currentTime);
            }}
            onVolumeChange={(event) => {
              setVolume(event.currentTarget.volume);
              setMuted(event.currentTarget.muted);
            }}
            onEnded={() => {
              setIsAudioPlaying(false);
              syncProgressSnapshot(0, true);
              handleTrackEnded();
            }}
            onError={(event) => {
              const audio = event.currentTarget;
              const message = getGlobalPlaybackErrorMessage(audio);
              setIsAudioPlaying(false);
              setPlaybackError(message);
            }}
          />
        ) : (
          <div className="flex min-h-14 items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 text-sm text-muted-foreground">
            <LoaderCircleIcon className={cn("size-4", isPreparing && "animate-spin")} />
            <span>
              {isPreparing
                ? "正在准备转码播放，完成后会自动开始。"
                : "当前没有可用的音频流，恢复会在拿到新播放地址后继续。"}
            </span>
          </div>
        )}

        {playbackError ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircleIcon className="mt-0.5" />
            <div>{playbackError}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
