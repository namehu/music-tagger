"use client";

import React from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { toast } from "sonner";
import { EyeOffIcon, LoaderCircleIcon, PauseCircleIcon, PlayCircleIcon } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";

import { trpc } from "@/app/_trpc/provider";
import type { AppRouter } from "@/server/trpc/root";
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
  type PlaybackQueueContext,
  type PlaybackQueueTrack,
  type PlaybackSessionKind,
} from "@/store/playback-store";

type TrackOrder = "recent" | "title" | "artist";
type EditedFilter = "all" | "edited" | "unedited";
type LibraryBrowserMode = "user" | "admin";

const USER_PAGE_SIZE = 100;
const ADMIN_PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

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

function toPlaybackTrack(track: TrackListItem): PlaybackQueueTrack {
  return {
    id: track.id,
    title: renderCell(track.title, track.filename),
    artist: renderCell(track.artist, "未知艺人"),
  };
}

function getPlaybackWindow(tracks: TrackListItem[], trackId: string) {
  const index = tracks.findIndex((track) => track.id === trackId);
  if (index < 0) {
    return tracks.slice(0, 43).map(toPlaybackTrack);
  }

  return tracks.slice(Math.max(0, index - 12), index + 31).map(toPlaybackTrack);
}

type TrackListItem = inferRouterOutputs<AppRouter>["tracks"]["list"]["items"][number];

export function LibraryBrowser({ mode }: { mode: LibraryBrowserMode }) {
  const isAdminMode = mode === "admin";
  const sessionKind: PlaybackSessionKind = isAdminMode ? "admin" : "user";
  const utils = trpc.useUtils();
  const virtuosoRef = React.useRef<VirtuosoHandle>(null);
  const [search, setSearch] = React.useState("");
  const [order, setOrder] = React.useState<TrackOrder>("recent");
  const [editedFilter, setEditedFilter] = React.useState<EditedFilter>("all");
  const [adminPageIndex, setAdminPageIndex] = React.useState(0);
  const [adminPageSize, setAdminPageSize] = React.useState<(typeof ADMIN_PAGE_SIZE_OPTIONS)[number]>(50);
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
  const adminTracksQuery = trpc.tracks.list.useQuery(
    {
      limit: adminPageSize,
      pageIndex: adminPageIndex,
      order,
      edited: editedFilter,
      q: query.length > 0 ? query : undefined,
      surface: "admin",
    },
    { enabled: isAdminMode },
  );
  const userTracksQuery = trpc.tracks.list.useInfiniteQuery(
    {
      limit: USER_PAGE_SIZE,
      order,
      edited: "all",
      q: query.length > 0 ? query : undefined,
      surface: "user",
    },
    {
      enabled: !isAdminMode,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  );

  const ignoreMine = trpc.ignoredTracks.ignoreMine.useMutation({
    onSuccess: async () => {
      toast.success("已加入我的忽略");
      await Promise.all([
        userTracksQuery.refetch(),
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
        adminTracksQuery.refetch(),
        statsQuery.refetch(),
        utils.ignoredTracks.listGlobal.invalidate(),
        utils.playlists.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "设为全局忽略失败");
    },
  });

  const currentTracks = React.useMemo(
    () =>
      isAdminMode
        ? (adminTracksQuery.data?.items ?? [])
        : (userTracksQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [adminTracksQuery.data?.items, isAdminMode, userTracksQuery.data?.pages],
  );
  const totalCount =
    (isAdminMode ? adminTracksQuery.data?.totalCount : userTracksQuery.data?.pages[0]?.totalCount) ?? 0;
  const sourceKey = isAdminMode ? "admin:library" : "user-library";
  const playbackQueueTracks = React.useMemo(() => currentTracks.map(toPlaybackTrack), [currentTracks]);
  const userQueueContext = React.useMemo<PlaybackQueueContext>(
    () => ({
      source: "library",
      surface: "user",
      order,
      edited: "all",
      q: query.length > 0 ? query : undefined,
    }),
    [order, query],
  );

  React.useEffect(() => {
    if (!isAdminMode) {
      return;
    }

    setQueue(sessionKind, {
      tracks: playbackQueueTracks,
      sourceKey,
      totalCount: playbackQueueTracks.length,
    });
  }, [isAdminMode, playbackQueueTracks, sessionKind, setQueue, sourceKey]);

  React.useEffect(() => {
    setAdminPageIndex(0);
    virtuosoRef.current?.scrollToIndex({ index: 0, align: "start" });
  }, [editedFilter, order, query]);

  React.useEffect(() => {
    if (statsQuery.error) {
      toast.error(statsQuery.error.message ?? "统计信息加载失败");
    }
  }, [statsQuery.error]);

  React.useEffect(() => {
    const error = isAdminMode ? adminTracksQuery.error : userTracksQuery.error;
    if (error) {
      toast.error(error.message ?? "曲目列表加载失败");
    }
  }, [adminTracksQuery.error, isAdminMode, userTracksQuery.error]);

  const statCards = [
    { title: "曲目", value: statsQuery.data?.tracks ?? 0 },
    { title: "专辑", value: statsQuery.data?.albums ?? 0 },
    { title: "艺人", value: statsQuery.data?.artists ?? 0 },
  ];
  const isLoadingTracks = isAdminMode ? adminTracksQuery.isLoading : userTracksQuery.isLoading;
  const hasNextPage = !isAdminMode && Boolean(userTracksQuery.hasNextPage);
  const adminPageCount = Math.max(1, Math.ceil(totalCount / adminPageSize));

  function handlePlay(track: TrackListItem) {
    const playbackTrack = toPlaybackTrack(track);
    if (isAdminMode) {
      if (queueSourceKey !== sourceKey) {
        replaceQueueFromUserIntent(sessionKind, {
          tracks: playbackQueueTracks,
          sourceKey,
          totalCount: playbackQueueTracks.length,
        });
        requestPlayTrack(sessionKind, playbackTrack);
        return;
      }

      if (activeTrackId === track.id) {
        toggleTrack(sessionKind, playbackTrack);
        return;
      }

      requestPlayTrack(sessionKind, playbackTrack);
      return;
    }

    if (queueSourceKey !== sourceKey) {
      replaceQueueFromUserIntent("user", {
        tracks: getPlaybackWindow(currentTracks, track.id),
        sourceKey,
        queueContext: userQueueContext,
        totalCount,
      });
      requestPlayTrack("user", playbackTrack);
      return;
    }

    if (activeTrackId === track.id) {
      toggleTrack("user", playbackTrack);
      return;
    }

    replaceQueueFromUserIntent("user", {
      tracks: getPlaybackWindow(currentTracks, track.id),
      sourceKey,
      queueContext: userQueueContext,
      totalCount,
    });
    requestPlayTrack("user", playbackTrack);
  }

  function renderTrackRow(track: TrackListItem, virtualIndex?: number) {
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

    if (!isAdminMode) {
      return (
        <div
          className={cn(
            "grid min-h-24 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[color:var(--ghost-border)] bg-white/55 px-3 py-3 sm:grid-cols-[auto_1.4fr_1fr_auto]",
            isActiveTrack && "bg-[color:color-mix(in_srgb,var(--primary-container)_78%,white)]",
          )}
        >
          <Button
            type="button"
            variant={isActiveTrack ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => handlePlay(track)}
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
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-medium">{renderCell(track.title, track.filename)}</span>
              {isPendingTrack ? <Badge variant="outline">准备中</Badge> : null}
              {isActiveTrack ? (
                <Badge variant="secondary">{isAudioPlaying && !isPreparing ? "当前播放" : "当前已暂停"}</Badge>
              ) : null}
            </div>
            <div className="truncate text-sm text-muted-foreground">{renderCell(track.path, "-")}</div>
          </div>
          <div className="hidden min-w-0 text-sm sm:block">
            <div className="truncate">{renderCell(track.artist, "未知艺人")}</div>
            <div className="truncate text-muted-foreground">{renderCell(track.album, "-")}</div>
          </div>
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
          <span className="sr-only">第 {(virtualIndex ?? 0) + 1} 条</span>
        </div>
      );
    }

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
            onClick={() => handlePlay(track)}
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
          <Button type="button" variant="outline" size="sm" onClick={() => setEditingTrackId(track.id)}>
            编辑
          </Button>
        </TableCell>
        <TableCell className="w-28">
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
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <span>{renderCell(track.title, track.filename)}</span>
            {isPendingTrack ? <Badge variant="outline">准备中</Badge> : null}
            {isActiveTrack ? (
              <Badge variant="secondary">{isAudioPlaying && !isPreparing ? "当前播放" : "当前已暂停"}</Badge>
            ) : null}
            {editSummary.hasEdits ? (
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
            {track.year || track.albumArtist ? (
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
  }

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
                {isLoadingTracks
                  ? "加载中…"
                  : isAdminMode
                    ? `第 ${adminPageIndex + 1} / ${adminPageCount} 页，共 ${totalCount} 条`
                    : `已加载 ${currentTracks.length} / ${totalCount} 条`}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
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
              <div className="flex flex-wrap items-center gap-2">
                {ADMIN_PAGE_SIZE_OPTIONS.map((size) => (
                  <Button
                    key={size}
                    type="button"
                    size="sm"
                    variant={adminPageSize === size ? "secondary" : "outline"}
                    onClick={() => {
                      setAdminPageSize(size);
                      setAdminPageIndex(0);
                    }}
                  >
                    {size} / 页
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--ghost-border)] bg-white/64 shadow-[var(--surface-shadow)]">
            {isAdminMode ? (
              <Table>
                <TableHeader className="bg-[color:color-mix(in_srgb,var(--surface-container-low)_86%,white)]">
                  <TableRow>
                    <TableHead>播放</TableHead>
                    <TableHead>编辑</TableHead>
                    <TableHead>忽略</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>艺人</TableHead>
                    <TableHead>专辑</TableHead>
                    <TableHead>路径</TableHead>
                    <TableHead>更新时间</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {currentTracks.map((track) => renderTrackRow(track))}
                  {!isLoadingTracks && currentTracks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        {query.length > 0 ? "没有匹配的曲目，换个关键词试试。" : "暂无曲目，请先触发一次 scan_full。"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {isLoadingTracks ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        正在加载曲目列表…
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                style={{ height: "min(70vh, 760px)" }}
                data={currentTracks}
                endReached={() => {
                  if (hasNextPage && !userTracksQuery.isFetchingNextPage) {
                    void userTracksQuery.fetchNextPage();
                  }
                }}
                itemContent={(index, track) => renderTrackRow(track, index)}
                components={{
                  EmptyPlaceholder: () =>
                    !isLoadingTracks ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        {query.length > 0 ? "没有匹配的曲目，换个关键词试试。" : "暂无曲目，请先触发一次 scan_full。"}
                      </div>
                    ) : null,
                  Footer: () => (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      {userTracksQuery.isFetchingNextPage
                        ? "继续加载中…"
                        : hasNextPage
                          ? "向下滚动加载更多"
                          : currentTracks.length > 0
                            ? "已经到底了"
                            : isLoadingTracks
                              ? "正在加载曲目列表…"
                              : null}
                    </div>
                  ),
                }}
              />
            )}
          </div>

          {isAdminMode ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                第 {adminPageIndex + 1} / {adminPageCount} 页
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={adminPageIndex === 0 || adminTracksQuery.isFetching}
                  onClick={() => setAdminPageIndex((value) => Math.max(0, value - 1))}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={adminPageIndex >= adminPageCount - 1 || adminTracksQuery.isFetching}
                  onClick={() => setAdminPageIndex((value) => Math.min(adminPageCount - 1, value + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isAdminMode ? (
        <TrackEditSheet
          trackId={editingTrackId}
          open={editingTrackId !== null}
          onOpenChange={(open) => !open && setEditingTrackId(null)}
        />
      ) : null}
    </div>
  );
}
