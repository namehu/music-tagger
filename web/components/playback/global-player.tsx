"use client";

import React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  LoaderCircleIcon,
  Music4Icon,
  PauseCircleIcon,
  PlayCircleIcon,
  Repeat1Icon,
  ShuffleIcon,
  SquareIcon,
} from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { LyricsPanel } from "@/components/playback/lyrics-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider";
import {
  formatPlaybackTime,
  getPlaybackModeLabel,
  getPlaybackQueueLabel,
  getPlaybackRestoreMessage,
} from "@/lib/playback-ui";
import type { TrackLyricsFormat } from "@/lib/lyrics";
import { cn } from "@/lib/utils";
import {
  getPlaybackAudioErrorMessage,
  usePlaybackSession,
  usePlaybackStore,
  type PlaybackSessionKind,
} from "@/store/playback-store";

function getBufferedUntilSec(audio: HTMLAudioElement) {
  if (audio.buffered.length === 0) {
    return 0;
  }

  return audio.buffered.end(audio.buffered.length - 1);
}

function CoverThumb({
  coverUrl,
  title,
  compact = false,
  className,
}: {
  coverUrl: string | null | undefined;
  title: string;
  compact?: boolean;
  className?: string;
}) {
  const sizeClass = compact ? "size-12" : "size-14";

  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={`${title} 封面`}
        className={cn(sizeClass, "rounded-xl border object-cover shadow-sm", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "flex items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground shadow-sm",
        className,
      )}
    >
      <Music4Icon className="size-5" />
    </div>
  );
}

function PlaybackProgress(props: {
  currentTimeSec: number;
  durationSec: number;
  bufferedUntilSec: number;
  compact?: boolean;
  disabled?: boolean;
  isSeeking: boolean;
  onBeginSeek: (nextTimeSec: number) => void;
  onUpdateSeekPreview: (nextTimeSec: number) => void;
  onCommitSeek: (nextTimeSec: number) => void;
}) {
  const maxValue = props.durationSec > 0 ? props.durationSec : 0;
  const safeValue = Math.min(maxValue, Math.max(0, props.currentTimeSec));
  const bufferedPercent =
    maxValue > 0 ? Math.min(100, Math.max(0, (props.bufferedUntilSec / maxValue) * 100)) : 0;

  return (
    <div className="space-y-1.5">
      <Slider
        min={0}
        max={maxValue > 0 ? maxValue : 1}
        step={0.1}
        value={safeValue}
        disabled={props.disabled || maxValue <= 0}
        onValueChange={(value) => {
          if (!props.isSeeking) {
            props.onBeginSeek(value);
            return;
          }

          props.onUpdateSeekPreview(value);
        }}
        onValueCommitted={(value) => {
          props.onCommitSeek(value);
        }}
        className="w-full"
      >
        <SliderControl>
          <SliderTrack className={cn("h-2.5 bg-muted/90", props.compact && "h-2")}>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/20"
              style={{ width: `${bufferedPercent}%` }}
            />
            <SliderIndicator className="bg-foreground" />
          </SliderTrack>
          <SliderThumb />
        </SliderControl>
      </Slider>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{formatPlaybackTime(safeValue)}</span>
        <span>{maxValue > 0 ? formatPlaybackTime(maxValue) : "--:--"}</span>
      </div>
    </div>
  );
}

export function GlobalPlayer({
  sessionKind,
}: {
  sessionKind: PlaybackSessionKind;
}) {
  const isAdminSession = sessionKind === "admin";
  const currentTrack = usePlaybackSession(sessionKind, (state) => state.currentTrack);
  const currentProfile = usePlaybackSession(sessionKind, (state) => state.currentProfile);
  const currentSourceKind = usePlaybackSession(sessionKind, (state) => state.currentSourceKind);
  const playbackMode = usePlaybackSession(sessionKind, (state) => state.playbackMode);
  const queueSourceKey = usePlaybackSession(sessionKind, (state) => state.queueSourceKey);
  const hydrationStatus = usePlaybackSession(sessionKind, (state) => state.hydrationStatus);
  const isPreparing = usePlaybackSession(sessionKind, (state) => state.isPreparing);
  const isAudioPlaying = usePlaybackSession(sessionKind, (state) => state.isAudioPlaying);
  const playbackError = usePlaybackSession(sessionKind, (state) => state.playbackError);
  const canPlayPrevious = usePlaybackSession(sessionKind, (state) => state.canPlayPrevious);
  const canPlayNext = usePlaybackSession(sessionKind, (state) => state.canPlayNext);
  const pendingResumeTimeSec = usePlaybackSession(sessionKind, (state) => state.pendingResumeTimeSec);
  const autoPlayOnReady = usePlaybackSession(sessionKind, (state) => state.autoPlayOnReady);
  const resumeTimeSec = usePlaybackSession(sessionKind, (state) => state.resumeTimeSec);
  const displayTimeSec = usePlaybackSession(sessionKind, (state) => state.displayTimeSec);
  const durationSec = usePlaybackSession(sessionKind, (state) => state.durationSec);
  const bufferedUntilSec = usePlaybackSession(sessionKind, (state) => state.bufferedUntilSec);
  const isSeeking = usePlaybackSession(sessionKind, (state) => state.isSeeking);
  const volume = usePlaybackSession(sessionKind, (state) => state.volume);
  const muted = usePlaybackSession(sessionKind, (state) => state.muted);
  const activePlayback = usePlaybackSession(sessionKind, (state) => state.activePlayback);
  const bindAudioElement = usePlaybackStore((state) => state.bindAudioElement);
  const requestPlayTrack = usePlaybackStore((state) => state.requestPlayTrack);
  const toggleTrack = usePlaybackStore((state) => state.toggleTrack);
  const playPrevious = usePlaybackStore((state) => state.playPrevious);
  const playNext = usePlaybackStore((state) => state.playNext);
  const handleTrackEnded = usePlaybackStore((state) => state.handleTrackEnded);
  const stopSession = usePlaybackStore((state) => state.stopSession);
  const setIsAudioPlaying = usePlaybackStore((state) => state.setIsAudioPlaying);
  const setPlaybackError = usePlaybackStore((state) => state.setPlaybackError);
  const setPlaybackPosition = usePlaybackStore((state) => state.setPlaybackPosition);
  const syncProgressSnapshot = usePlaybackStore((state) => state.syncProgressSnapshot);
  const beginSeek = usePlaybackStore((state) => state.beginSeek);
  const updateSeekPreview = usePlaybackStore((state) => state.updateSeekPreview);
  const commitSeek = usePlaybackStore((state) => state.commitSeek);
  const setBufferedUntilSec = usePlaybackStore((state) => state.setBufferedUntilSec);
  const setDurationSec = usePlaybackStore((state) => state.setDurationSec);
  const setVolume = usePlaybackStore((state) => state.setVolume);
  const setMuted = usePlaybackStore((state) => state.setMuted);
  const clearPendingResumeTime = usePlaybackStore((state) => state.clearPendingResumeTime);
  const setPlaybackMode = usePlaybackStore((state) => state.setPlaybackMode);
  const [showDetails, setShowDetails] = React.useState(false);

  const mediaQuery = trpc.playback.getTrackMedia.useQuery(
    {
      trackId: currentTrack?.id ?? "",
    },
    {
      enabled: Boolean(currentTrack?.id),
      staleTime: 60_000,
    },
  );

  const attachAudioElement = React.useCallback(
    (audio: HTMLAudioElement | null) => {
      bindAudioElement(sessionKind, audio);
    },
    [bindAudioElement, sessionKind],
  );

  const restoreMessage = getPlaybackRestoreMessage({
    hydrationStatus,
    isPreparing,
    isAudioPlaying,
    activePlayback: Boolean(activePlayback),
    autoPlayOnReady,
    pendingResumeTimeSec,
    resumeTimeSec,
  });
  const detailStatusText = isAdminSession
    ? playbackError
      ? playbackError
      : isPreparing
        ? "正在准备试听资源，完成后会进入可试听状态。"
        : isAudioPlaying
          ? "当前正在管理台试听，这不会改写用户侧歌单与进度。"
          : "试听已暂停；回到用户区后仍可手动继续原来的用户播放会话。"
    : playbackError
      ? playbackError
      : isPreparing
        ? "正在准备播放资源，完成后会按当前操作进入可播放状态。"
        : restoreMessage;

  React.useEffect(() => {
    if (!currentTrack) {
      setShowDetails(false);
    }
  }, [currentTrack]);

  if (!currentTrack) {
    return null;
  }

  const detailTrack = mediaQuery.data?.display ?? {
    title: currentTrack.title,
    artist: currentTrack.artist,
    album: null,
    albumArtist: null,
  };
  const showCompactButtons = isAdminSession;

  return (
    <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className={cn("mx-auto w-full px-4 py-3 md:px-6", isAdminSession ? "max-w-6xl" : "max-w-7xl")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <CoverThumb coverUrl={mediaQuery.data?.coverUrl} title={detailTrack.title} compact={isAdminSession} />
              <div className="min-w-0 space-y-1">
                <div className="truncate text-sm font-medium md:text-base">{detailTrack.title}</div>
                <div className="truncate text-sm text-muted-foreground">{detailTrack.artist}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size={showCompactButtons ? "icon-sm" : "sm"}
                disabled={!canPlayPrevious}
                onClick={() => playPrevious(sessionKind)}
                aria-label="上一首"
              >
                <ChevronLeftIcon />
                {showCompactButtons ? null : <span className="sr-only">上一首</span>}
              </Button>
              <Button
                type="button"
                variant={isAudioPlaying ? "secondary" : "default"}
                size={showCompactButtons ? "icon-sm" : "sm"}
                disabled={isPreparing}
                onClick={() => {
                  if (!activePlayback) {
                    requestPlayTrack(sessionKind, currentTrack, {
                      profile: currentProfile ?? "mp3_192",
                      autoPlay: true,
                    });
                    return;
                  }

                  toggleTrack(sessionKind, currentTrack);
                }}
                aria-label={isAudioPlaying ? "暂停" : "播放"}
              >
                {isAudioPlaying ? <PauseCircleIcon /> : <PlayCircleIcon />}
                {showCompactButtons ? null : <span>{isAudioPlaying ? "暂停" : "播放"}</span>}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size={showCompactButtons ? "icon-sm" : "sm"}
                disabled={!canPlayNext}
                onClick={() => playNext(sessionKind)}
                aria-label="下一首"
              >
                <ChevronRightIcon />
                {showCompactButtons ? null : <span className="sr-only">下一首</span>}
              </Button>
              {isAdminSession ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => stopSession(sessionKind)}
                  aria-label="停止试听"
                >
                  <SquareIcon />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(true)}
                aria-label="打开播放详情"
              >
                <InfoIcon />
                {showCompactButtons ? null : "详情"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <PlaybackProgress
              currentTimeSec={displayTimeSec}
              durationSec={durationSec}
              bufferedUntilSec={bufferedUntilSec}
              compact={isAdminSession}
              disabled={isPreparing}
              isSeeking={isSeeking}
              onBeginSeek={(nextTimeSec) => beginSeek(sessionKind, nextTimeSec)}
              onUpdateSeekPreview={(nextTimeSec) => updateSeekPreview(sessionKind, nextTimeSec)}
              onCommitSeek={(nextTimeSec) => commitSeek(sessionKind, nextTimeSec)}
            />

            {!isAdminSession ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={playbackMode === "ordered" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setPlaybackMode(sessionKind, "ordered")}
                >
                  顺序
                </Button>
                <Button
                  type="button"
                  variant={playbackMode === "shuffle" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setPlaybackMode(sessionKind, "shuffle")}
                >
                  <ShuffleIcon data-icon="inline-start" />
                  随机
                </Button>
                <Button
                  type="button"
                  variant={playbackMode === "repeat_one" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setPlaybackMode(sessionKind, "repeat_one")}
                >
                  <Repeat1Icon data-icon="inline-start" />
                  单曲循环
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">试听态不保留用户歌单与播放模式</div>
            )}
          </div>
        </div>

        <Sheet open={showDetails} onOpenChange={setShowDetails}>
          <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl px-0">
            <SheetHeader className="px-6">
              <SheetTitle>{isAdminSession ? "试听详情" : "播放详情"}</SheetTitle>
              <SheetDescription>{detailStatusText}</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-6 pb-6">
              <div className="grid gap-4 md:grid-cols-[200px_1fr] md:items-start">
                <CoverThumb
                  coverUrl={mediaQuery.data?.coverUrl}
                  title={detailTrack.title}
                  className="size-40 justify-self-center md:size-48"
                />
                <div className="space-y-2">
                  <div className="text-2xl font-semibold">{detailTrack.title}</div>
                  <div className="text-base text-muted-foreground">{detailTrack.artist}</div>
                  {detailTrack.album ? (
                    <div className="text-sm text-muted-foreground">
                      专辑：<span className="text-foreground">{detailTrack.album}</span>
                    </div>
                  ) : null}
                  {detailTrack.albumArtist ? (
                    <div className="text-sm text-muted-foreground">
                      专辑艺人：<span className="text-foreground">{detailTrack.albumArtist}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {isAdminSession ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium">歌词预览</div>
                  <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border bg-muted/15 px-4 py-4 text-sm leading-7 text-foreground/90">
                    {mediaQuery.data?.lyricsText?.trim()
                      ? mediaQuery.data.lyricsText
                      : "当前曲目还没有可显示的歌词。"}
                  </div>
                </div>
              ) : (
                <LyricsPanel
                  lyricsText={mediaQuery.data?.lyricsText}
                  lyricsFormat={(mediaQuery.data?.lyricsFormat as TrackLyricsFormat | undefined) ?? "plain"}
                  currentTimeSec={displayTimeSec}
                  isPlaying={isAudioPlaying}
                  onSeekTo={(nextTimeSec) => commitSeek(sessionKind, nextTimeSec)}
                />
              )}

              <div className="rounded-2xl border bg-muted/15 p-4">
                <div className="mb-3 text-sm font-medium">播放信息</div>
                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <div>当前上下文：{getPlaybackQueueLabel(queueSourceKey)}</div>
                  <div>
                    资料来源：
                    {mediaQuery.data?.mediaSourceSummary.cover === "edit"
                      ? "编辑封面"
                      : mediaQuery.data?.mediaSourceSummary.cover === "scan"
                        ? "扫描封面"
                        : "无封面"}
                  </div>
                  <div>
                    歌词来源：
                    {mediaQuery.data?.mediaSourceSummary.lyrics === "edit"
                      ? "编辑歌词"
                      : mediaQuery.data?.mediaSourceSummary.lyrics === "scan"
                        ? "扫描歌词"
                        : "无歌词"}
                  </div>
                  {currentProfile ? <div>播放规格：{currentProfile}</div> : null}
                  {currentSourceKind ? (
                    <div>当前流：{currentSourceKind === "transcode_cache" ? "转码缓存" : "原始直出"}</div>
                  ) : null}
                  {!isAdminSession ? <div>播放模式：{getPlaybackModeLabel(playbackMode)}</div> : null}
                  {!isAdminSession ? <div>恢复位置：{formatPlaybackTime(resumeTimeSec)}</div> : null}
                  {playbackError ? <div className="text-destructive md:col-span-2">错误：{playbackError}</div> : null}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {activePlayback ? (
          <audio
            key={`${sessionKind}:${activePlayback.url}`}
            ref={attachAudioElement}
            src={activePlayback.url}
            autoPlay={autoPlayOnReady}
            preload="metadata"
            className="hidden"
            onPlay={() => setIsAudioPlaying(sessionKind, true)}
            onPause={(event) => {
              setIsAudioPlaying(sessionKind, false);
              setPlaybackPosition(sessionKind, event.currentTarget.currentTime, true);
              syncProgressSnapshot(sessionKind, event.currentTarget.currentTime, true);
            }}
            onLoadedMetadata={(event) => {
              const audio = event.currentTarget;
              audio.volume = volume;
              audio.muted = muted;
              setDurationSec(sessionKind, audio.duration);

              if (typeof pendingResumeTimeSec === "number" && pendingResumeTimeSec > 0) {
                const maxSeek = Number.isFinite(audio.duration) ? audio.duration : pendingResumeTimeSec;
                audio.currentTime = Math.min(pendingResumeTimeSec, maxSeek);
              }

              setPlaybackPosition(sessionKind, audio.currentTime, true);
              setBufferedUntilSec(sessionKind, getBufferedUntilSec(audio));

              if (!autoPlayOnReady) {
                audio.pause();
              }

              clearPendingResumeTime(sessionKind);
            }}
            onProgress={(event) => {
              setBufferedUntilSec(sessionKind, getBufferedUntilSec(event.currentTarget));
            }}
            onTimeUpdate={(event) => {
              setPlaybackPosition(sessionKind, event.currentTarget.currentTime);
            }}
            onVolumeChange={(event) => {
              setVolume(sessionKind, event.currentTarget.volume);
              setMuted(sessionKind, event.currentTarget.muted);
            }}
            onEnded={() => {
              setIsAudioPlaying(sessionKind, false);
              setPlaybackPosition(sessionKind, 0, true);
              syncProgressSnapshot(sessionKind, 0, true);
              handleTrackEnded(sessionKind);
            }}
            onError={(event) => {
              const audio = event.currentTarget;
              const message = getPlaybackAudioErrorMessage(audio);
              setIsAudioPlaying(sessionKind, false);
              setPlaybackError(sessionKind, message);
            }}
          />
        ) : isPreparing ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            <span>正在准备播放资源…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
