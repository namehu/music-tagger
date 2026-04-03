"use client";

import React from "react";
import { toast } from "sonner";
import {
  LoaderCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
} from "lucide-react";

import { useGlobalPlayback, type PlaybackQueueTrack } from "@/components/playback/global-playback-provider";
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

export default function AdminLibraryPage() {
  const [search, setSearch] = React.useState("");
  const [order, setOrder] = React.useState<TrackOrder>("recent");
  const deferredSearch = React.useDeferredValue(search);
  const query = deferredSearch.trim();
  const { activeTrackId, pendingTrackId, isAudioPlaying, isPreparing, setQueue, toggleTrack } = useGlobalPlayback();

  const statsQuery = trpc.library.stats.useQuery();
  const tracksQuery = trpc.tracks.list.useQuery({
    limit: 50,
    order,
    q: query.length > 0 ? query : undefined,
  });
  const currentTracks = React.useMemo(() => tracksQuery.data?.items ?? [], [tracksQuery.data?.items]);

  React.useEffect(() => {
    const queueTracks: PlaybackQueueTrack[] = currentTracks.map((track) => ({
      id: track.id,
      title: renderCell(track.title, track.filename),
      artist: renderCell(track.artist, "未知艺人"),
    }));
    setQueue(queueTracks);
  }, [currentTracks, setQueue]);

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
            <Badge variant="outline">全局播放器</Badge>
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
                const isActiveTrack = activeTrackId === track.id;
                const isPendingTrack = pendingTrackId === track.id;
                const canTogglePlayback = isActiveTrack && !isPendingTrack;

                return (
                  <TableRow key={track.id} className={cn(isActiveTrack && "bg-muted/30")}>
                    <TableCell className="w-16">
                      <Button
                        type="button"
                        variant={isActiveTrack ? "secondary" : "ghost"}
                        size="icon-sm"
                        onClick={() =>
                          toggleTrack({
                            id: track.id,
                            title: renderCell(track.title, track.filename),
                            artist: renderCell(track.artist, "未知艺人"),
                          })
                        }
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
                        {isPendingTrack ? (
                          <Badge variant="outline">准备中</Badge>
                        ) : isActiveTrack ? (
                          <Badge variant="secondary">
                            {isAudioPlaying && !isPreparing ? "当前播放" : "当前已暂停"}
                          </Badge>
                        ) : null}
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
