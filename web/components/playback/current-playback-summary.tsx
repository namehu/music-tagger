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
import { usePlaybackStore } from "@/store/playback-store";

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
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const currentProfile = usePlaybackStore((state) => state.currentProfile);
  const currentSourceKind = usePlaybackStore((state) => state.currentSourceKind);
  const preparingJobId = usePlaybackStore((state) => state.preparingJobId);
  const isPreparing = usePlaybackStore((state) => state.isPreparing);
  const isAudioPlaying = usePlaybackStore((state) => state.isAudioPlaying);
  const playbackError = usePlaybackStore((state) => state.playbackError);
  const activeTrackId = usePlaybackStore((state) => state.activeTrackId);
  const toggleTrack = usePlaybackStore((state) => state.toggleTrack);
  const playbackMode = usePlaybackStore((state) => state.playbackMode);
  const resumeTimeSec = usePlaybackStore((state) => state.resumeTimeSec);

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
            <Link href="/library" className={buttonVariants({ variant: "ghost", size: "sm" })}>
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
          <Badge variant="outline">
            {playbackMode === "ordered" ? "顺序" : playbackMode === "shuffle" ? "随机" : "单曲循环"}
          </Badge>
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
            {currentTrack
              ? `当前曲目已进入全局播放器，可在任意后台页面继续播放。上次恢复进度约 ${Math.floor(resumeTimeSec)} 秒。`
              : "从音乐库点播后，这里会显示实时状态。"}
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
