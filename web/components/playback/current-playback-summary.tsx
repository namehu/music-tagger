"use client";

import Link from "next/link";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPlaybackTime, getPlaybackRestoreMessage } from "@/lib/playback-ui";
import { cn } from "@/lib/utils";
import { usePlaybackSession, usePlaybackStore, type PlaybackSessionKind } from "@/store/playback-store";

function CoverThumb({
  coverUrl,
  title,
}: {
  coverUrl: string | null | undefined;
  title: string;
}) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={`${title} 封面`}
        className="size-14 rounded-xl border object-cover shadow-sm"
      />
    );
  }

  return (
    <div className="size-14 rounded-xl border bg-muted/40" />
  );
}

function getPlaybackStatusText(input: {
  isPreparing: boolean;
  isAudioPlaying: boolean;
  currentTrackId: string | null;
  playbackError: string | null;
}) {
  if (input.playbackError) {
    return { label: "播放异常", variant: "destructive" as const };
  }

  if (input.isPreparing) {
    return { label: "准备中", variant: "outline" as const };
  }

  if (input.isAudioPlaying) {
    return { label: "播放中", variant: "default" as const };
  }

  if (input.currentTrackId) {
    return { label: "已暂停", variant: "secondary" as const };
  }

  return { label: "未播放", variant: "secondary" as const };
}

export function CurrentPlaybackSummary({
  sessionKind,
  compact = false,
  className,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  sessionKind: PlaybackSessionKind;
  compact?: boolean;
  className?: string;
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const isAdminSession = sessionKind === "admin";
  const currentTrack = usePlaybackSession(sessionKind, (state) => state.currentTrack);
  const hydrationStatus = usePlaybackSession(sessionKind, (state) => state.hydrationStatus);
  const isPreparing = usePlaybackSession(sessionKind, (state) => state.isPreparing);
  const isAudioPlaying = usePlaybackSession(sessionKind, (state) => state.isAudioPlaying);
  const playbackError = usePlaybackSession(sessionKind, (state) => state.playbackError);
  const activeTrackId = usePlaybackSession(sessionKind, (state) => state.activeTrackId);
  const currentProfile = usePlaybackSession(sessionKind, (state) => state.currentProfile);
  const resumeTimeSec = usePlaybackSession(sessionKind, (state) => state.resumeTimeSec);
  const pendingResumeTimeSec = usePlaybackSession(sessionKind, (state) => state.pendingResumeTimeSec);
  const autoPlayOnReady = usePlaybackSession(sessionKind, (state) => state.autoPlayOnReady);
  const activePlayback = usePlaybackSession(sessionKind, (state) => state.activePlayback);
  const toggleTrack = usePlaybackStore((state) => state.toggleTrack);
  const requestPlayTrack = usePlaybackStore((state) => state.requestPlayTrack);

  const mediaQuery = trpc.playback.getTrackMedia.useQuery(
    {
      trackId: currentTrack?.id ?? "",
    },
    {
      enabled: Boolean(currentTrack?.id),
      staleTime: 60_000,
    },
  );

  const status = getPlaybackStatusText({
    isPreparing,
    isAudioPlaying,
    currentTrackId: activeTrackId,
    playbackError,
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
  const summaryMessage = isAdminSession
    ? playbackError
      ? playbackError
      : currentTrack
        ? isPreparing
          ? "正在准备试听资源，完成后会进入可试听状态。"
          : "管理台试听只在当前会话内生效，会暂停用户侧实际发声，但不会清空用户歌单和进度。"
        : "从管理曲库点一下试听后，这里会显示当前试听状态。"
    : playbackError
      ? playbackError
      : currentTrack
        ? restoreMessage
        : "从用户音乐库、歌单或最近播放点播后，这里会显示继续收听入口。";

  const resolvedTitle =
    title ?? (isAdminSession ? "当前试听" : "继续收听");
  const resolvedDescription =
    description ??
    (isAdminSession
      ? "管理台只保留临时试听，会暂停用户侧实际发声，但不会清空用户歌单和进度。"
      : "用户侧播放会跨页面保留，回到这里可以继续当前歌单和进度。");
  const resolvedActionHref = actionHref ?? (isAdminSession ? "/admin/library" : "/library");
  const resolvedActionLabel = actionLabel ?? (isAdminSession ? "去管理曲库" : "去音乐库");

  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <div className="space-y-1">
          <CardTitle>{resolvedTitle}</CardTitle>
          <CardDescription>{resolvedDescription}</CardDescription>
        </div>
        {!compact ? (
          <CardAction>
            <Link href={resolvedActionHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {resolvedActionLabel}
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {!isAdminSession ? <Badge variant="outline">停在 {formatPlaybackTime(resumeTimeSec)}</Badge> : null}
        </div>

        {currentTrack ? (
          <div className="flex items-center gap-3">
            <CoverThumb coverUrl={mediaQuery.data?.coverUrl} title={currentTrack.title} />
            <div className="min-w-0 space-y-1">
              <div className="truncate text-sm font-medium">{mediaQuery.data?.display.title ?? currentTrack.title}</div>
              <div className="truncate text-sm text-muted-foreground">
                {mediaQuery.data?.display.artist ?? currentTrack.artist}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">当前还没有选中的播放曲目。</div>
        )}

        <div
          className={cn(
            "rounded-xl border p-3 text-sm",
            playbackError
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "bg-muted/20 text-muted-foreground",
          )}
        >
          {summaryMessage}
        </div>

        {!compact && currentTrack ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
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
            >
              {isAudioPlaying ? "暂停" : "播放 / 继续"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
