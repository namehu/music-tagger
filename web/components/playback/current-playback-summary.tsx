"use client";

import Link from "next/link";

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

import { useGlobalPlayback } from "./global-playback-provider";

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
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const {
    currentTrack,
    currentProfile,
    currentSourceKind,
    preparingJobId,
    isPreparing,
    isAudioPlaying,
    playbackError,
    activeTrackId,
    toggleTrack,
  } = useGlobalPlayback();

  const status = getPlaybackStatusText({
    isPreparing,
    isAudioPlaying,
    currentTrackId: activeTrackId,
    playbackError,
  });

  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <div className="space-y-1">
          <CardTitle>当前播放</CardTitle>
          <CardDescription>跨页面共享的全局播放器状态摘要。</CardDescription>
        </div>
        {!compact ? (
          <CardAction>
            <Link href="/admin/library" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              前往音乐库
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {currentProfile ? <Badge variant="outline">{currentProfile}</Badge> : null}
          {currentSourceKind ? (
            <Badge variant="secondary">
              {currentSourceKind === "transcode_cache" ? "转码缓存" : "原始直出"}
            </Badge>
          ) : null}
          {preparingJobId ? <Badge variant="outline">job: {preparingJobId}</Badge> : null}
        </div>

        {currentTrack ? (
          <div className="space-y-1">
            <div className="text-sm font-medium">{currentTrack.title}</div>
            <div className="text-sm text-muted-foreground">{currentTrack.artist}</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">当前还没有选中的播放曲目。</div>
        )}

        {playbackError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {playbackError}
          </div>
        ) : isPreparing ? (
          <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
            正在等待 `transcode_prepare` 完成，完成后会自动开始播放。
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
            {currentTrack ? "当前曲目已进入全局播放器，可在任意后台页面继续播放。" : "从音乐库点播后，这里会显示实时状态。"}
          </div>
        )}

        {!compact && currentTrack ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPreparing}
              onClick={() => toggleTrack(currentTrack)}
            >
              {isAudioPlaying ? "暂停" : "播放 / 继续"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
