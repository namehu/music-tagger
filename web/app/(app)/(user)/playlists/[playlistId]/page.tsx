"use client";

import React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { EyeOffIcon, LoaderCircleIcon, PauseCircleIcon, PlayCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlaybackModeLabel, getPlaybackQueueLabel } from "@/lib/playback-ui";
import { usePlaybackSession, usePlaybackStore, type PlaybackQueueTrack } from "@/store/playback-store";

function renderText(value: string | null | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = typeof params.playlistId === "string" ? params.playlistId : "";
  const utils = trpc.useUtils();
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const activeTrackId = usePlaybackSession("user", (state) => state.activeTrackId);
  const pendingTrackId = usePlaybackSession("user", (state) => state.pendingTrackId);
  const isAudioPlaying = usePlaybackSession("user", (state) => state.isAudioPlaying);
  const isPreparing = usePlaybackSession("user", (state) => state.isPreparing);
  const playbackMode = usePlaybackSession("user", (state) => state.playbackMode);
  const queueSourceKey = usePlaybackSession("user", (state) => state.queueSourceKey);
  const hydrationStatus = usePlaybackSession("user", (state) => state.hydrationStatus);
  const setQueue = usePlaybackStore((state) => state.setQueue);
  const replaceQueueFromUserIntent = usePlaybackStore((state) => state.replaceQueueFromUserIntent);
  const requestPlayTrack = usePlaybackStore((state) => state.requestPlayTrack);
  const toggleTrack = usePlaybackStore((state) => state.toggleTrack);
  const playlistQuery = trpc.playlists.get.useQuery(
    { playlistId },
    { enabled: playlistId.length > 0 },
  );
  const tracksQuery = trpc.tracks.list.useQuery({
    limit: 20,
    order: "title",
    edited: "all",
    q: deferredSearch.trim().length > 0 ? deferredSearch.trim() : undefined,
    surface: "user",
  });
  const addTrack = trpc.playlists.addTrack.useMutation({
    onSuccess: async () => {
      toast.success("已加入歌单");
      await playlistQuery.refetch();
      await utils.playlists.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "加入歌单失败");
    },
  });
  const removeTrack = trpc.playlists.removeTrack.useMutation({
    onSuccess: async () => {
      toast.success("已从歌单移除");
      await playlistQuery.refetch();
      await utils.playlists.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "移除曲目失败");
    },
  });
  const unignoreMine = trpc.ignoredTracks.unignoreMine.useMutation({
    onSuccess: async () => {
      toast.success("已从我的忽略恢复");
      await Promise.all([playlistQuery.refetch(), tracksQuery.refetch(), utils.ignoredTracks.listMine.invalidate()]);
    },
    onError: (error) => {
      toast.error(error.message ?? "解除忽略失败");
    },
  });

  const playlist = playlistQuery.data;
  const sourceKey = `playlist:${playlistId}`;
  const playlistTracks = React.useMemo<PlaybackQueueTrack[]>(
    () =>
      (playlist?.items ?? []).map((item) => ({
        id: item.track.id,
        title: item.track.title,
        artist: item.track.artist,
      })),
    [playlist?.items],
  );

  React.useEffect(() => {
    if (playlistTracks.length > 0) {
      setQueue("user", {
        tracks: playlistTracks,
        sourceKey,
      });
    }
  }, [playlistTracks, setQueue, sourceKey]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{playlist?.name ?? "歌单详情"}</h1>
        <p className="text-sm text-muted-foreground">按歌单保存顺序点播，也可以从下方曲库搜索结果中继续加入。</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{getPlaybackModeLabel(playbackMode)}</Badge>
          <Badge variant={queueSourceKey === sourceKey ? "secondary" : "outline"}>
            {queueSourceKey === sourceKey ? "当前队列来自这个歌单" : getPlaybackQueueLabel(queueSourceKey)}
          </Badge>
          {hydrationStatus !== "ready" ? <span>正在恢复上次播放会话…</span> : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>歌单曲目</CardTitle>
            <CardDescription>{playlist?.items.length ?? 0} 首曲目，播放时会按这个顺序切歌。</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-hidden rounded-2xl border bg-card/60">
              <Table>
                <TableHeader className="bg-muted/[0.45]">
                  <TableRow>
                    <TableHead>播放</TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>艺人</TableHead>
                    <TableHead>专辑</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(playlist?.items ?? []).map((item, index) => {
                    const isActiveTrack = activeTrackId === item.track.id;
                    const isPendingTrack = pendingTrackId === item.track.id;
                    const canTogglePlayback = isActiveTrack && !isPendingTrack;
                    const playbackTrack = {
                      id: item.track.id,
                      title: item.track.title,
                      artist: item.track.artist,
                    };
                    return (
                      <TableRow key={item.id} className={isActiveTrack ? "bg-muted/30" : undefined}>
                        <TableCell className="w-16">
                          <Button
                            type="button"
                            variant={isActiveTrack ? "secondary" : "ghost"}
                            size="icon-sm"
                            onClick={() => {
                              if (queueSourceKey !== sourceKey) {
                                replaceQueueFromUserIntent("user", {
                                  tracks: playlistTracks,
                                  sourceKey,
                                });
                                requestPlayTrack("user", playbackTrack);
                                return;
                              }

                              if (activeTrackId === item.track.id) {
                                toggleTrack("user", playbackTrack);
                                return;
                              }

                              requestPlayTrack("user", playbackTrack);
                            }}
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
                        <TableCell className="w-12">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{item.track.title}</span>
                            {item.ignoreSource === "mine" ? (
                              <Badge variant="outline">我的忽略</Badge>
                            ) : null}
                            {item.ignoreSource === "global" ? (
                              <Badge variant="secondary">全局忽略</Badge>
                            ) : null}
                            {isPendingTrack ? (
                              <Badge variant="outline">准备中</Badge>
                            ) : isActiveTrack ? (
                              <Badge variant="secondary">{isAudioPlaying && !isPreparing ? "当前播放" : "当前已暂停"}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{item.track.artist}</TableCell>
                        <TableCell>{renderText(item.track.album, "-")}</TableCell>
                        <TableCell className="w-24">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={removeTrack.isPending}
                              onClick={() =>
                                removeTrack.mutate({
                                  playlistId,
                                  itemId: item.id,
                                })
                              }
                            >
                              <Trash2Icon data-icon="inline-start" />
                              移除
                            </Button>
                            {item.canUnignoreTrack ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={unignoreMine.isPending}
                                onClick={() => unignoreMine.mutate({ trackId: item.track.id })}
                              >
                                <EyeOffIcon data-icon="inline-start" />
                                解除忽略
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!playlistQuery.isLoading && (playlist?.items.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        这个歌单还没有曲目，先从右侧曲库搜索结果中加入一些吧。
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {playlistQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        正在加载歌单内容…
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>从曲库加入</CardTitle>
            <CardDescription>当前版本先支持搜索后单首加入，不做拖拽排序。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题、艺人、专辑或文件名"
            />

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{deferredSearch.trim().length > 0 ? `搜索: ${deferredSearch.trim()}` : "默认候选"}</Badge>
              <span>忽略曲目会自动从这里过滤掉。</span>
            </div>

            <div className="space-y-3">
              {(tracksQuery.data?.items ?? []).map((track) => (
                <div key={track.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="truncate font-medium">{renderText(track.title, track.filename)}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {[renderText(track.artist, "未知艺人"), renderText(track.album, "-")].join(" · ")}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{track.path}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={addTrack.isPending || playlistId.length === 0}
                    onClick={() =>
                      addTrack.mutate({
                        playlistId,
                        trackId: track.id,
                      })
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    加入
                  </Button>
                </div>
              ))}

              {!tracksQuery.isLoading && (tracksQuery.data?.items.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  {deferredSearch.trim().length > 0 ? "没有匹配的曲目。" : "当前没有可加入的候选曲目。"}
                </div>
              ) : null}
              {tracksQuery.isLoading ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  正在加载曲库候选…
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
