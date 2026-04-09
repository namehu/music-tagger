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
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { LyricsPanel } from "@/components/playback/lyrics-panel";
import { Badge } from "@/components/ui/badge";
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
  resolveDisplayedPlaybackTimeSec,
  resolvePlaybackDurationSec,
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
        className={cn(
          sizeClass,
          "rounded-[1.25rem] border border-white/70 object-cover shadow-[0_20px_45px_-26px_rgba(25,28,30,0.32)]",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "flex items-center justify-center rounded-[1.25rem] border border-white/70 bg-[color:var(--surface-container-low)] text-muted-foreground shadow-[0_16px_36px_-28px_rgba(25,28,30,0.28)]",
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
  const displayedCurrentTimeSec = resolveDisplayedPlaybackTimeSec({
    currentTimeSec: props.currentTimeSec,
    durationSec: props.durationSec,
  });
  const safeValue =
    maxValue > 0 ? Math.min(maxValue, Math.max(0, displayedCurrentTimeSec)) : 0;
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
          <SliderTrack className={cn("h-1 bg-[color:var(--surface-container-highest)]", props.compact && "h-1")}>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/20"
              style={{ width: `${bufferedPercent}%` }}
            />
            <SliderIndicator />
          </SliderTrack>
          <SliderThumb />
        </SliderControl>
      </Slider>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{formatPlaybackTime(displayedCurrentTimeSec)}</span>
        <span>{maxValue > 0 ? formatPlaybackTime(maxValue) : "--:--"}</span>
      </div>
    </div>
  );
}

function QueueListItem(props: {
  index: number;
  title: string;
  artist: string;
  isActive: boolean;
  isNext: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[1.4rem] border border-[color:var(--ghost-border)] px-3.5 py-3",
        props.isActive
          ? "bg-[color:color-mix(in_srgb,var(--primary-container)_72%,white)] shadow-[0_22px_48px_-34px_rgba(0,150,250,0.55)]"
          : "bg-white/60",
      )}
    >
      <button
        type="button"
        onClick={props.onPlay}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-current={props.isActive ? "true" : undefined}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-container-low)] text-xs text-muted-foreground">
          {props.index + 1}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="truncate text-sm font-medium">{props.title}</div>
          <div className="truncate text-xs text-muted-foreground">{props.artist}</div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {props.isActive ? <Badge variant="secondary">当前</Badge> : null}
        {props.isNext ? <Badge variant="outline">下一首</Badge> : null}
        <Button type="button" variant="ghost" size="icon-sm" onClick={props.onRemove} aria-label={`移除 ${props.title}`}>
          <XIcon />
        </Button>
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
  const activeTrackId = usePlaybackSession(sessionKind, (state) => state.activeTrackId);
  const nextTrack = usePlaybackSession(sessionKind, (state) => state.nextTrack);
  const queueItems = usePlaybackSession(sessionKind, (state) => state.queueItems);
  const queueSize = usePlaybackSession(sessionKind, (state) => state.queueSize);
  const upNextItems = usePlaybackSession(sessionKind, (state) => state.upNextItems);
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
  const isSeekable = usePlaybackSession(sessionKind, (state) => state.activePlayback?.seekable ?? true);
  const isLiveTranscode = usePlaybackSession(
    sessionKind,
    (state) => state.activePlayback?.liveTranscode ?? false,
  );
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
  const removeQueueTrack = usePlaybackStore((state) => state.removeQueueTrack);
  const clearQueue = usePlaybackStore((state) => state.clearQueue);
  const [showDetails, setShowDetails] = React.useState(false);
  const liveFallbackAttemptRef = React.useRef<string | null>(null);

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
  const resolvedDurationSec = resolvePlaybackDurationSec({
    elementDurationSec: durationSec,
    mediaDurationSec: mediaQuery.data?.durationSec,
  });

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
      : isLiveTranscode && !isSeekable
        ? "当前正在边转边播，转码完成后会自动恢复完整拖动能力。"
        : isPreparing
          ? "正在准备试听资源，完成后会进入可试听状态。"
          : isAudioPlaying
            ? "当前正在管理台试听，这不会改写用户侧歌单与进度。"
            : "试听已暂停；回到用户区后仍可手动继续原来的用户播放会话。"
      : playbackError
        ? playbackError
        : isLiveTranscode && !isSeekable
          ? "当前正在边转边播，暂不支持跳到尚未转码的位置。"
        : isPreparing
          ? "正在准备播放资源，完成后会按当前操作进入可播放状态。"
          : restoreMessage;
  const queueLabel = getPlaybackQueueLabel(queueSourceKey);
  const seekDisabled = isPreparing || !isSeekable;
  const handleCommitSeek = React.useCallback(
    (nextTimeSec: number) => {
      if (!isSeekable) {
        return;
      }

      commitSeek(sessionKind, nextTimeSec);
    },
    [commitSeek, isSeekable, sessionKind],
  );

  React.useEffect(() => {
    if (!activePlayback?.liveTranscode) {
      liveFallbackAttemptRef.current = null;
    }
  }, [activePlayback?.id, activePlayback?.jobId, activePlayback?.liveTranscode, activePlayback?.url]);

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
    <div className="sticky bottom-0 z-20 px-4 pb-4 md:px-6 md:pb-6">
      <div className={cn("mx-auto w-full px-4 py-3 md:px-6", isAdminSession ? "max-w-6xl" : "max-w-7xl")}>
        <div className="azure-glass flex flex-col gap-4 rounded-[2rem] px-4 py-4 md:px-5 md:py-5">
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
                className="bg-white/72"
                onClick={() => setShowDetails(true)}
                aria-label={isAdminSession ? "打开播放详情" : "打开播放详情与队列"}
              >
                <InfoIcon />
                {showCompactButtons ? null : isAdminSession ? "详情" : "详情 / 队列"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <PlaybackProgress
              currentTimeSec={displayTimeSec}
              durationSec={resolvedDurationSec}
              bufferedUntilSec={bufferedUntilSec}
              compact={isAdminSession}
              disabled={seekDisabled}
              isSeeking={isSeeking}
              onBeginSeek={(nextTimeSec) => beginSeek(sessionKind, nextTimeSec)}
              onUpdateSeekPreview={(nextTimeSec) => updateSeekPreview(sessionKind, nextTimeSec)}
              onCommitSeek={handleCommitSeek}
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
              <SheetTitle>{isAdminSession ? "试听详情" : "播放详情与队列"}</SheetTitle>
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

              {!isAdminSession ? (
                <div className="azure-panel-soft p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">当前队列</div>
                      <div className="text-sm text-muted-foreground">
                        {queueLabel}，共 {queueSize} 首
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{getPlaybackModeLabel(playbackMode)}</Badge>
                      <Badge variant="outline">Up Next {upNextItems.length}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={queueSize === 0}
                        onClick={() => clearQueue(sessionKind)}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        清空队列
                      </Button>
                    </div>
                  </div>

                  {queueSize === 0 ? (
                    <div className="mt-4 rounded-[1.4rem] border border-dashed border-[color:var(--ghost-border)] bg-white/72 px-4 py-6 text-sm text-muted-foreground">
                      当前还没有可展示的播放队列。
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-[color:var(--ghost-border)] bg-white/72 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            当前曲目
                          </div>
                          <div className="mt-2 text-sm font-medium">{detailTrack.title}</div>
                          <div className="text-sm text-muted-foreground">{detailTrack.artist}</div>
                        </div>
                        <div className="rounded-[1.4rem] border border-[color:var(--ghost-border)] bg-white/72 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Up Next
                          </div>
                          {nextTrack ? (
                            <div className="mt-2 space-y-1">
                              <div className="text-sm font-medium">{nextTrack.title}</div>
                              <div className="text-sm text-muted-foreground">{nextTrack.artist}</div>
                            </div>
                          ) : playbackMode === "shuffle" && queueSize > 1 ? (
                            <div className="mt-2 text-sm text-muted-foreground">
                              随机模式下将从剩余队列里随机挑选下一首。
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-muted-foreground">当前已经是队列末尾。</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {queueItems.map((track, index) => (
                          <QueueListItem
                            key={`${track.id}:${index}`}
                            index={index}
                            title={track.title}
                            artist={track.artist}
                            isActive={track.id === activeTrackId}
                            isNext={track.id === nextTrack?.id && track.id !== activeTrackId}
                            onPlay={() =>
                              requestPlayTrack(sessionKind, track, {
                                profile: currentProfile ?? "mp3_192",
                                autoPlay: true,
                              })
                            }
                            onRemove={() => removeQueueTrack(sessionKind, track.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {isAdminSession ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium">歌词预览</div>
                  <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-[1.4rem] border border-[color:var(--ghost-border)] bg-white/72 px-4 py-4 text-sm leading-7 text-foreground/90">
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
                  onSeekTo={handleCommitSeek}
                />
              )}

              <div className="azure-panel-soft p-4">
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
                    <div>
                      当前流：
                      {currentSourceKind === "transcode_cache"
                        ? isLiveTranscode
                          ? "转码缓存（边转边播）"
                          : "转码缓存"
                        : "原始直出"}
                    </div>
                  ) : null}
                  {isLiveTranscode && !isSeekable ? (
                    <div className="md:col-span-2">边转边播中，暂不支持跳到未转码的位置。</div>
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

              if (isSeekable && typeof pendingResumeTimeSec === "number" && pendingResumeTimeSec > 0) {
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
              const fallbackKey =
                activePlayback?.liveTranscode && currentTrack
                  ? `${currentTrack.id}:${activePlayback.jobId ?? activePlayback.url}`
                  : null;
              if (
                fallbackKey &&
                liveFallbackAttemptRef.current !== fallbackKey &&
                currentProfile === "mp3_192"
              ) {
                liveFallbackAttemptRef.current = fallbackKey;
                requestPlayTrack(sessionKind, currentTrack, {
                  profile: "original",
                  autoPlay: true,
                  resumeTimeSec: audio.currentTime,
                });
                return;
              }
              const message = getPlaybackAudioErrorMessage(audio);
              setIsAudioPlaying(sessionKind, false);
              setPlaybackError(sessionKind, message);
            }}
          />
        ) : isPreparing ? (
          <div className="mt-1 flex items-center gap-2 rounded-[1.2rem] border border-dashed border-[color:var(--ghost-border)] bg-white/60 px-3 py-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            <span>正在准备播放资源…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
