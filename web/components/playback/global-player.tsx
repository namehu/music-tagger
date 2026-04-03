"use client";

import React from "react";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Music4Icon,
  PauseCircleIcon,
  PlayCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getGlobalPlaybackErrorMessage, useGlobalPlayback } from "./global-playback-provider";

export function GlobalPlayer() {
  const {
    activePlayback,
    isAudioPlaying,
    playbackError,
    audioRef,
    playPrevious,
    playNext,
    setIsAudioPlaying,
    setPlaybackError,
    queue,
  } = useGlobalPlayback();

  if (!activePlayback) {
    return null;
  }

  const activeTrackIndex = queue.findIndex((track) => track.id === activePlayback.id);
  const previousDisabled = activeTrackIndex <= 0;
  const nextDisabled = activeTrackIndex < 0 || activeTrackIndex >= queue.length - 1;

  return (
    <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isAudioPlaying ? "default" : "outline"}>
                {isAudioPlaying ? "全局播放中" : "全局已暂停"}
              </Badge>
              <Badge variant="secondary">跨页面保持</Badge>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-muted/50 p-2 text-muted-foreground">
                <Music4Icon />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium md:text-base">{activePlayback.title}</div>
                <div className="truncate text-sm text-muted-foreground">{activePlayback.artist}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={previousDisabled}
              onClick={playPrevious}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              上一首
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) {
                  return;
                }

                if (audio.paused) {
                  void audio.play().catch(() => {
                    const message = getGlobalPlaybackErrorMessage(audio);
                    setPlaybackError(message);
                    toast.error(message);
                  });
                  return;
                }

                audio.pause();
              }}
            >
              {isAudioPlaying ? <PauseCircleIcon data-icon="inline-start" /> : <PlayCircleIcon data-icon="inline-start" />}
              {isAudioPlaying ? "暂停" : "继续"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={nextDisabled}
              onClick={playNext}
            >
              下一首
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>

        <audio
          key={activePlayback.url}
          ref={audioRef}
          src={activePlayback.url}
          controls
          autoPlay
          preload="metadata"
          className={cn("w-full", playbackError && "border-destructive/30")}
          onPlay={() => setIsAudioPlaying(true)}
          onPause={() => setIsAudioPlaying(false)}
          onEnded={() => {
            setIsAudioPlaying(false);
            playNext();
          }}
          onError={(event) => {
            const audio = event.currentTarget;
            const message = getGlobalPlaybackErrorMessage(audio);
            setIsAudioPlaying(false);
            setPlaybackError(message);
            toast.error(message);
          }}
        />

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
