"use client";

import React from "react";
import { toast } from "sonner";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
} from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TrackOrder = "recent" | "title" | "artist";

const ORDER_OPTIONS: Array<{ value: TrackOrder; label: string }> = [
  { value: "recent", label: "最近更新" },
  { value: "title", label: "标题" },
  { value: "artist", label: "艺人" },
];

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function renderCell(primary: string | null | undefined, fallback: string) {
  return primary && primary.trim().length > 0 ? primary : fallback;
}

type ActivePlayback = {
  trackId: string;
  title: string;
  artist: string;
  url: string;
};

type TrackListItem = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  filename: string;
  path: string;
  updatedAt: string | Date;
};

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

export default function AdminLibraryPage() {
  const [search, setSearch] = React.useState("");
  const [order, setOrder] = React.useState<TrackOrder>("recent");
  const [activePlayback, setActivePlayback] = React.useState<ActivePlayback | null>(null);
  const [pendingTrackId, setPendingTrackId] = React.useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const deferredSearch = React.useDeferredValue(search);
  const query = deferredSearch.trim();

  const statsQuery = trpc.library.stats.useQuery();
  const tracksQuery = trpc.tracks.list.useQuery({
    limit: 50,
    order,
    q: query.length > 0 ? query : undefined,
  });
  const currentTracks = tracksQuery.data?.items ?? [];
  const resolvePlayback = trpc.playback.resolve.useMutation({
    onMutate: (variables) => {
      setPendingTrackId(variables.trackId);
      setPlaybackError(null);
    },
    onSuccess: (result, variables) => {
      const track = currentTracks.find((item) => item.id === variables.trackId);
      if (!track) {
        setPendingTrackId(null);
        return;
      }

      setActivePlayback({
        trackId: track.id,
        title: renderCell(track.title, track.filename),
        artist: renderCell(track.artist, "未知艺人"),
        url: result.url,
      });
      setPendingTrackId(null);
    },
    onError: (error) => {
      setPendingTrackId(null);
      toast.error(error.message ?? "播放地址解析失败");
      setPlaybackError(error.message ?? "播放地址解析失败");
    },
  });

  const activeTrackIndex = currentTracks.findIndex((track) => track.id === activePlayback?.trackId);
  const previousTrack = activeTrackIndex > 0 ? currentTracks[activeTrackIndex - 1] : null;
  const nextTrack =
    activeTrackIndex >= 0 && activeTrackIndex < currentTracks.length - 1
      ? currentTracks[activeTrackIndex + 1]
      : null;

  const playTrack = React.useCallback(
    (track: TrackListItem) => {
      setPlaybackError(null);
      resolvePlayback.mutate({
        trackId: track.id,
        profile: "original",
      });
    },
    [resolvePlayback],
  );

  const toggleCurrentTrack = React.useCallback(
    (track: TrackListItem) => {
      const isCurrentTrack = activePlayback?.trackId === track.id;
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
    [activePlayback?.trackId, playTrack],
  );

  React.useEffect(() => {
    if (statsQuery.error) {
      toast.error(statsQuery.error.message ?? "统计信息加载失败");
    }
  }, [statsQuery.error]);

  React.useEffect(() => {
    if (tracksQuery.error) {
      toast.error(tracksQuery.error.message ?? "曲目列表加载失败");
    }
  }, [tracksQuery.error]);

  const statCards = [
    { title: "曲目", value: statsQuery.data?.tracks ?? 0 },
    { title: "专辑", value: statsQuery.data?.albums ?? 0 },
    { title: "艺人", value: statsQuery.data?.artists ?? 0 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">音乐库</h1>
        <p className="text-sm text-muted-foreground">
          展示最新扫描结果，支持全文搜索与基础排序，方便确认索引是否已成功写入。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="border-b">
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>当前已索引的 {card.title} 数量</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>播放器</CardTitle>
              <CardDescription>当前只支持原始文件直出播放，便于验证流媒体与 Range 链路。</CardDescription>
            </div>
            {activePlayback ? <Badge variant="secondary">原始音频直出</Badge> : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {activePlayback ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-medium">{activePlayback.title}</div>
                    <Badge variant={isAudioPlaying ? "default" : "outline"}>
                      {isAudioPlaying ? "播放中" : "已暂停"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{activePlayback.artist}</div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!previousTrack || resolvePlayback.isPending}
                    onClick={() => previousTrack && playTrack(previousTrack)}
                  >
                    <ChevronLeftIcon data-icon="inline-start" />
                    上一首
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!nextTrack || resolvePlayback.isPending}
                    onClick={() => nextTrack && playTrack(nextTrack)}
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
                className="w-full"
                onPlay={() => setIsAudioPlaying(true)}
                onPause={() => setIsAudioPlaying(false)}
                onEnded={() => {
                  setIsAudioPlaying(false);
                  if (nextTrack) {
                    playTrack(nextTrack);
                  }
                }}
                onError={(event) => {
                  const audio = event.currentTarget;
                  const message = getAudioErrorMessage(audio);
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
              ) : (
                <div className="text-xs text-muted-foreground">
                  如果无法播放，优先检查：`web/.env` 里的 `MUSIC_ROOT_HOST_PATH`，以及浏览器是否支持当前音频格式。
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              选择一首歌开始播放。播放器会调用 `playback.resolve` 获取带签名的流媒体地址。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>曲目列表</CardTitle>
              <CardDescription>
                {tracksQuery.isLoading
                  ? "加载中…"
                  : `当前展示 ${(tracksQuery.data?.items ?? []).length} 条结果`}
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按标题、艺人、专辑、文件名或路径全文搜索"
                className="w-full sm:w-80"
              />

              <div className="flex flex-wrap gap-2">
                {ORDER_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={order === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      React.startTransition(() => {
                        setOrder(option.value);
                      });
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{query.length > 0 ? `搜索: ${query}` : "全部曲目"}</Badge>
            {query.length > 0 ? <Badge variant="secondary">FTS 全文检索</Badge> : null}
            {query.length > 0 ? <span>相关性优先，当前排序作为次级顺序。</span> : null}
            {deferredSearch !== search ? <span>搜索中…</span> : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>播放</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>艺人</TableHead>
                <TableHead>专辑</TableHead>
                <TableHead>路径</TableHead>
                <TableHead>更新时间</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {currentTracks.map((track) => {
                const isActiveTrack = activePlayback?.trackId === track.id;
                const isPendingTrack = pendingTrackId === track.id;
                const canTogglePlayback = isActiveTrack && !isPendingTrack;

                return (
                  <TableRow key={track.id} className={cn(isActiveTrack && "bg-muted/30")}>
                    <TableCell className="w-16">
                      <Button
                        type="button"
                        variant={isActiveTrack ? "secondary" : "ghost"}
                        size="icon-sm"
                        disabled={resolvePlayback.isPending && !canTogglePlayback}
                        onClick={() => toggleCurrentTrack(track)}
                        aria-label={`播放 ${renderCell(track.title, track.filename)}`}
                      >
                        {isPendingTrack ? (
                          <LoaderCircleIcon className="animate-spin" />
                        ) : canTogglePlayback && isAudioPlaying ? (
                          <PauseCircleIcon />
                        ) : (
                          <PlayCircleIcon />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{renderCell(track.title, track.filename)}</span>
                        {isActiveTrack ? <Badge variant="secondary">当前播放</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{renderCell(track.artist, "-")}</TableCell>
                    <TableCell>{renderCell(track.album, "-")}</TableCell>
                    <TableCell className="max-w-[28rem] truncate font-mono text-xs">
                      {track.path}
                    </TableCell>
                    <TableCell>{formatDateTime(track.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}

              {!tracksQuery.isLoading && currentTracks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    暂无曲目，请先触发一次 scan_full。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
