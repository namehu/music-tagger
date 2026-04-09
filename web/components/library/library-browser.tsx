"use client";

import React from "react";
import { toast } from "sonner";
import { EyeOffIcon, LoaderCircleIcon, PauseCircleIcon, PlayCircleIcon } from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { TrackEditSheet } from "@/components/library/track-edit-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlaybackQueueLabel } from "@/lib/playback-ui";
import { getTrackEditSummary } from "@/lib/track-edits";
import { cn } from "@/lib/utils";
import {
  usePlaybackSession,
  usePlaybackStore,
  type PlaybackQueueTrack,
  type PlaybackSessionKind,
} from "@/store/playback-store";

type TrackOrder = "recent" | "title" | "artist";
type EditedFilter = "all" | "edited" | "unedited";
type LibraryBrowserMode = "user" | "admin";

const ORDER_OPTIONS: Array<{ value: TrackOrder; label: string }> = [
  { value: "recent", label: "最近更新" },
  { value: "title", label: "标题" },
  { value: "artist", label: "艺人" },
];

const EDITED_FILTER_OPTIONS: Array<{ value: EditedFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "edited", label: "仅看已编辑" },
  { value: "unedited", label: "仅看未编辑" },
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

export function LibraryBrowser({ mode }: { mode: LibraryBrowserMode }) {
  const isAdminMode = mode === "admin";
  const sessionKind: PlaybackSessionKind = isAdminMode ? "admin" : "user";
  const utils = trpc.useUtils();
  const [search, setSearch] = React.useState("");
  const [order, setOrder] = React.useState<TrackOrder>("recent");
  const [editedFilter, setEditedFilter] = React.useState<EditedFilter>("all");
  const [editingTrackId, setEditingTrackId] = React.useState<string | null>(null);
  const deferredSearch = React.useDeferredValue(search);
  const query = deferredSearch.trim();
  const activeTrackId = usePlaybackSession(sessionKind, (state) => state.activeTrackId);
  const pendingTrackId = usePlaybackSession(sessionKind, (state) => state.pendingTrackId);
  const isAudioPlaying = usePlaybackSession(sessionKind, (state) => state.isAudioPlaying);
  const isPreparing = usePlaybackSession(sessionKind, (state) => state.isPreparing);
  const queueSourceKey = usePlaybackSession(sessionKind, (state) => state.queueSourceKey);
  const hydrationStatus = usePlaybackSession(sessionKind, (state) => state.hydrationStatus);
  const setQueue = usePlaybackStore((state) => state.setQueue);
  const replaceQueueFromUserIntent = usePlaybackStore((state) => state.replaceQueueFromUserIntent);
  const requestPlayTrack = usePlaybackStore((state) => state.requestPlayTrack);
  const toggleTrack = usePlaybackStore((state) => state.toggleTrack);

  const statsQuery = trpc.library.stats.useQuery({
    surface: isAdminMode ? "admin" : "user",
  });
  const tracksQuery = trpc.tracks.list.useQuery({
    limit: 50,
    order,
    edited: isAdminMode ? editedFilter : "all",
    q: query.length > 0 ? query : undefined,
    surface: isAdminMode ? "admin" : "user",
  });

  const ignoreMine = trpc.ignoredTracks.ignoreMine.useMutation({
    onSuccess: async () => {
      toast.success("已加入我的忽略");
      await Promise.all([
        tracksQuery.refetch(),
        statsQuery.refetch(),
        utils.ignoredTracks.listMine.invalidate(),
        utils.playlists.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "加入我的忽略失败");
    },
  });
  const ignoreGlobal = trpc.ignoredTracks.ignoreGlobal.useMutation({
    onSuccess: async () => {
      toast.success("已设为全局忽略");
      await Promise.all([
        tracksQuery.refetch(),
        statsQuery.refetch(),
        utils.ignoredTracks.listGlobal.invalidate(),
        utils.playlists.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "设为全局忽略失败");
    },
  });

  const currentTracks = React.useMemo(() => tracksQuery.data?.items ?? [], [tracksQuery.data?.items]);
  const playbackQueueTracks = React.useMemo<PlaybackQueueTrack[]>(
    () =>
      currentTracks.map((track) => ({
        id: track.id,
        title: renderCell(track.title, track.filename),
        artist: renderCell(track.artist, "未知艺人"),
      })),
    [currentTracks],
  );
  const sourceKey = isAdminMode ? "admin:library" : "user-library";

  React.useEffect(() => {
    setQueue(sessionKind, {
      tracks: playbackQueueTracks,
      sourceKey,
    });
  }, [playbackQueueTracks, sessionKind, setQueue, sourceKey]);

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
          {isAdminMode
            ? "管理员入口只保留单曲级编辑和查看能力；元数据、歌词、封面会先写数据库，再由后台异步回写音频文件。"
            : "浏览已扫描的曲库，支持搜索、排序和跨页面共享播放。"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-1">
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
        <CardHeader className="pb-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>曲目列表</CardTitle>
              <CardDescription>
                {tracksQuery.isLoading ? "加载中…" : `当前展示 ${(tracksQuery.data?.items ?? []).length} 条结果`}
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按标题、艺人、专辑、文件名或路径搜索"
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
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{query.length > 0 ? `搜索: ${query}` : "全部曲目"}</Badge>
            <Badge variant="outline">{isAdminMode ? "管理试听队列" : "用户播放队列"}</Badge>
            <Badge variant={queueSourceKey === sourceKey ? "secondary" : "outline"}>
              {queueSourceKey === sourceKey ? "当前队列来自这个列表" : getPlaybackQueueLabel(queueSourceKey)}
            </Badge>
            {hydrationStatus !== "ready" ? <span>正在恢复上次播放会话…</span> : null}
            {isAdminMode ? (
              <Badge variant="outline">
                {EDITED_FILTER_OPTIONS.find((option) => option.value === editedFilter)?.label}
              </Badge>
            ) : null}
            {deferredSearch !== search ? <span>搜索中…</span> : null}
          </div>

          {isAdminMode ? (
            <div className="flex flex-wrap gap-2">
              {EDITED_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={editedFilter === option.value ? "secondary" : "outline"}
                  onClick={() => {
                    React.startTransition(() => {
                      setEditedFilter(option.value);
                    });
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--ghost-border)] bg-white/64 shadow-[var(--surface-shadow)]">
            <Table>
              <TableHeader className="bg-[color:color-mix(in_srgb,var(--surface-container-low)_86%,white)]">
                <TableRow>
                  <TableHead>播放</TableHead>
                  {isAdminMode ? <TableHead>编辑</TableHead> : null}
                  <TableHead>{isAdminMode ? "忽略" : "操作"}</TableHead>
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
                  const editSummary = getTrackEditSummary({
                    metadataEdit: track.hasMetadataEdit
                      ? {
                          syncStatus: track.metadataSyncStatus ?? "synced",
                          syncErrorJson: null,
                        }
                      : null,
                    lyricsEdit: track.hasLyricsEdit
                      ? {
                          syncStatus: track.lyricsSyncStatus ?? "synced",
                          syncErrorJson: null,
                        }
                      : null,
                    coverEdit: track.hasCoverEdit
                      ? {
                          syncStatus: track.coverSyncStatus ?? "synced",
                          syncErrorJson: null,
                        }
                      : null,
                  });
                  const playbackTrack = {
                    id: track.id,
                    title: renderCell(track.title, track.filename),
                    artist: renderCell(track.artist, "未知艺人"),
                  };

                  return (
                    <TableRow
                      key={track.id}
                      className={cn(
                        "odd:bg-white/25",
                        isActiveTrack && "bg-[color:color-mix(in_srgb,var(--primary-container)_78%,white)]",
                      )}
                    >
                      <TableCell className="w-16">
                        <Button
                          type="button"
                          variant={isActiveTrack ? "secondary" : "ghost"}
                          size="icon-sm"
                          onClick={() => {
                            if (queueSourceKey !== sourceKey) {
                              replaceQueueFromUserIntent(sessionKind, {
                                tracks: playbackQueueTracks,
                                sourceKey,
                              });
                              requestPlayTrack(sessionKind, playbackTrack);
                              return;
                            }

                            if (activeTrackId === track.id) {
                              toggleTrack(sessionKind, playbackTrack);
                              return;
                            }

                            requestPlayTrack(sessionKind, playbackTrack);
                          }}
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
                      {isAdminMode ? (
                        <TableCell className="w-20">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingTrackId(track.id)}>
                            编辑
                          </Button>
                        </TableCell>
                      ) : null}
                      <TableCell className="w-28">
                        {isAdminMode ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={ignoreGlobal.isPending}
                            onClick={() => ignoreGlobal.mutate({ trackId: track.id })}
                          >
                            <EyeOffIcon data-icon="inline-start" />
                            全局忽略
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={ignoreMine.isPending}
                            onClick={() => ignoreMine.mutate({ trackId: track.id })}
                          >
                            <EyeOffIcon data-icon="inline-start" />
                            忽略
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{renderCell(track.title, track.filename)}</span>
                          {isPendingTrack ? (
                            <Badge variant="outline">准备中</Badge>
                          ) : isActiveTrack ? (
                            <Badge variant="secondary">{isAudioPlaying && !isPreparing ? "当前播放" : "当前已暂停"}</Badge>
                          ) : null}
                          {isAdminMode && editSummary.hasEdits ? (
                            <Badge
                              variant={
                                editSummary.state === "failed"
                                  ? "destructive"
                                  : editSummary.state === "synced"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {editSummary.label}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div>{renderCell(track.artist, "-")}</div>
                          {track.genre ? <div className="text-xs text-muted-foreground">{track.genre}</div> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div>{renderCell(track.album, "-")}</div>
                          {(track.year || track.albumArtist) ? (
                            <div className="text-xs text-muted-foreground">
                              {[track.albumArtist, track.year].filter(Boolean).join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[28rem] truncate font-mono text-xs">{track.path}</TableCell>
                      <TableCell>{formatDateTime(track.updatedAt)}</TableCell>
                    </TableRow>
                  );
                })}

                {!tracksQuery.isLoading && currentTracks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdminMode ? 8 : 7} className="py-10 text-center text-muted-foreground">
                      {query.length > 0 ? "没有匹配的曲目，换个关键词试试。" : "暂无曲目，请先触发一次 scan_full。"}
                    </TableCell>
                  </TableRow>
                ) : null}
                {tracksQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isAdminMode ? 8 : 7} className="py-10 text-center text-muted-foreground">
                      正在加载曲目列表…
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isAdminMode ? (
        <TrackEditSheet trackId={editingTrackId} open={editingTrackId !== null} onOpenChange={(open) => !open && setEditingTrackId(null)} />
      ) : null}
    </div>
  );
}
