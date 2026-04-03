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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

function formatNumberField(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export default function AdminLibraryPage() {
  const [search, setSearch] = React.useState("");
  const [order, setOrder] = React.useState<TrackOrder>("recent");
  const [editingTrackId, setEditingTrackId] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState({
    title: "",
    artist: "",
    album: "",
    albumArtist: "",
    trackNo: "",
    discNo: "",
    year: "",
    genre: "",
  });
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
  const editingTrack = React.useMemo(
    () => currentTracks.find((track) => track.id === editingTrackId) ?? null,
    [currentTracks, editingTrackId],
  );
  const updateMetadata = trpc.tracks.updateMetadata.useMutation({
    onSuccess: async (track) => {
      toast.success(`已保存 ${renderCell(track.title, track.fallbackTitle)} 的元数据`);
      setEditingTrackId(null);
      await Promise.all([tracksQuery.refetch(), statsQuery.refetch()]);
    },
    onError: (error) => {
      toast.error(error.message ?? "元数据保存失败");
    },
  });

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

  React.useEffect(() => {
    if (!editingTrack) {
      return;
    }

    setFormValues({
      title: editingTrack.title ?? "",
      artist: editingTrack.artist ?? "",
      album: editingTrack.album ?? "",
      albumArtist: editingTrack.albumArtist ?? "",
      trackNo: formatNumberField(editingTrack.trackNo),
      discNo: formatNumberField(editingTrack.discNo),
      year: formatNumberField(editingTrack.year),
      genre: editingTrack.genre ?? "",
    });
  }, [editingTrack]);

  const statCards = [
    { title: "曲目", value: statsQuery.data?.tracks ?? 0 },
    { title: "专辑", value: statsQuery.data?.albums ?? 0 },
    { title: "艺人", value: statsQuery.data?.artists ?? 0 },
  ];

  function parseNullableInt(value: string) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function buildMetadataPayload() {
    if (!editingTrack) {
      return null;
    }

    return {
      trackId: editingTrack.id,
      title: formValues.title.trim() || null,
      artist: formValues.artist.trim() || null,
      album: formValues.album.trim() || null,
      albumArtist: formValues.albumArtist.trim() || null,
      trackNo: parseNullableInt(formValues.trackNo),
      discNo: parseNullableInt(formValues.discNo),
      year: parseNullableInt(formValues.year),
      genre: formValues.genre.trim() || null,
    };
  }

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
                <TableHead>编辑</TableHead>
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
                    <TableCell className="w-20">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTrackId(track.id)}
                      >
                        编辑
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
                        ) : track.metadataEditedAt ? (
                          <Badge variant="outline">已手动修改</Badge>
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
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    暂无曲目，请先触发一次 scan_full。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={editingTrack !== null} onOpenChange={(open) => !open && setEditingTrackId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>编辑元数据</SheetTitle>
            <SheetDescription>
              当前只修改 SQLite 里的人工覆盖值，不会回写音频文件标签；后续 `scan_full` 也不会覆盖这里的人工修改。
            </SheetDescription>
          </SheetHeader>

          {editingTrack ? (
            <div className="space-y-6 py-4">
              <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                <div className="font-medium">{renderCell(editingTrack.title, editingTrack.filename)}</div>
                <div className="mt-1 text-muted-foreground">{renderCell(editingTrack.artist, "未知艺人")}</div>
                <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{editingTrack.path}</div>
                {editingTrack.metadataEditedAt ? (
                  <div className="mt-3">
                    <Badge variant="outline">上次人工修改: {formatDateTime(editingTrack.metadataEditedAt)}</Badge>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="track-title">标题</Label>
                  <Input
                    id="track-title"
                    value={formValues.title}
                    onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-artist">艺人</Label>
                  <Input
                    id="track-artist"
                    value={formValues.artist}
                    onChange={(event) => setFormValues((current) => ({ ...current, artist: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-album">专辑</Label>
                  <Input
                    id="track-album"
                    value={formValues.album}
                    onChange={(event) => setFormValues((current) => ({ ...current, album: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-album-artist">专辑艺人</Label>
                  <Input
                    id="track-album-artist"
                    value={formValues.albumArtist}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, albumArtist: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="track-track-no">Track No</Label>
                    <Input
                      id="track-track-no"
                      inputMode="numeric"
                      value={formValues.trackNo}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, trackNo: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="track-disc-no">Disc No</Label>
                    <Input
                      id="track-disc-no"
                      inputMode="numeric"
                      value={formValues.discNo}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, discNo: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="track-year">年份</Label>
                    <Input
                      id="track-year"
                      inputMode="numeric"
                      value={formValues.year}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, year: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-genre">流派</Label>
                  <Input
                    id="track-genre"
                    value={formValues.genre}
                    onChange={(event) => setFormValues((current) => ({ ...current, genre: event.target.value }))}
                  />
                </div>
              </div>

              <SheetFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateMetadata.isPending}
                  onClick={() =>
                    setFormValues({
                      title: "",
                      artist: "",
                      album: "",
                      albumArtist: "",
                      trackNo: "",
                      discNo: "",
                      year: "",
                      genre: "",
                    })
                  }
                >
                  恢复扫描值
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={updateMetadata.isPending}
                    onClick={() => setEditingTrackId(null)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    disabled={updateMetadata.isPending}
                    onClick={() => {
                      const payload = buildMetadataPayload();
                      if (!payload) {
                        return;
                      }
                      updateMetadata.mutate(payload);
                    }}
                  >
                    {updateMetadata.isPending ? "保存中..." : "保存修改"}
                  </Button>
                </div>
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
