"use client";

import Link from "next/link";
import React from "react";
import {
  ArrowRightIcon,
  Clock3Icon,
  EyeOffIcon,
  FolderIcon,
  ListMusicIcon,
  LoaderCircleIcon,
  Music4Icon,
  PauseCircleIcon,
  PlayCircleIcon,
} from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { CurrentPlaybackSummary } from "@/components/playback/current-playback-summary";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePlaybackSession, usePlaybackStore } from "@/store/playback-store";

const DASHBOARD_RECENT_PLAYS_SOURCE_KEY = "dashboard:recent-plays";

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function UserDashboardPage() {
  const dashboardQuery = trpc.library.dashboard.useQuery();
  const activeTrackId = usePlaybackSession("user", (state) => state.activeTrackId);
  const pendingTrackId = usePlaybackSession("user", (state) => state.pendingTrackId);
  const isAudioPlaying = usePlaybackSession("user", (state) => state.isAudioPlaying);
  const queueSourceKey = usePlaybackSession("user", (state) => state.queueSourceKey);
  const replaceQueueFromUserIntent = usePlaybackStore((state) => state.replaceQueueFromUserIntent);
  const requestPlayTrack = usePlaybackStore((state) => state.requestPlayTrack);
  const toggleTrack = usePlaybackStore((state) => state.toggleTrack);

  const quickLinks = [
    {
      title: "浏览音乐库",
      description: "搜索、查看并继续点播你想听的曲目。",
      href: "/library",
      icon: FolderIcon,
    },
    {
      title: "管理歌单",
      description: "维护歌单并按保存顺序继续播放。",
      href: "/playlists",
      icon: ListMusicIcon,
    },
    {
      title: "我的忽略",
      description: "恢复你手动隐藏的曲目。",
      href: "/ignored-tracks",
      icon: EyeOffIcon,
    },
  ];

  const stats = [
    { title: "曲目", value: dashboardQuery.data?.stats.tracks ?? 0 },
    { title: "专辑", value: dashboardQuery.data?.stats.albums ?? 0 },
    { title: "艺人", value: dashboardQuery.data?.stats.artists ?? 0 },
  ];
  const recentPlayQueue = React.useMemo(
    () =>
      (dashboardQuery.data?.recentPlays ?? []).map((track) => ({
        id: track.trackId,
        title: track.title,
        artist: track.artist,
      })),
    [dashboardQuery.data?.recentPlays],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">用户首页</Badge>
          <Badge variant="outline">
            {dashboardQuery.data?.recentPlays.length ?? 0} 首最近播放
          </Badge>
          <Badge variant="outline">
            {dashboardQuery.data?.recentPlaylists.length ?? 0} 个最近更新歌单
          </Badge>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">继续听点什么？</h1>
          <p className="text-sm text-muted-foreground">
            这里聚合最近播放、最近更新歌单和最近更新曲目，帮助你从当前音乐入口继续往下走。
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <Card key={item.title}>
            <CardHeader className="pb-1">
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>当前对你可见的库内数量</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <CurrentPlaybackSummary
          sessionKind="user"
          className="h-full"
          title="继续收听"
          description="当前播放和恢复状态会在这里集中显示，刷新后也会尽量回到你上次停下的位置。"
          actionHref="/library"
          actionLabel="去音乐库"
        />

        <Card>
          <CardHeader className="pb-1">
            <CardTitle>快捷入口</CardTitle>
            <CardDescription>常用入口保留在这里，首页主视觉优先给最近使用。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "flex h-auto w-full items-start justify-start gap-3 px-4 py-4 text-left",
                  )}
                >
                  <div className="rounded-[1rem] bg-[color:var(--surface-container-low)] p-2.5 text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">{link.title}</div>
                    <div className="text-sm text-muted-foreground">{link.description}</div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="pb-1">
            <div className="space-y-1">
              <CardTitle>最近播放</CardTitle>
              <CardDescription>这里只展示最近点播过的曲目，不区分缓存命中还是未命中。</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {dashboardQuery.isLoading ? (
              <div className="rounded-[1.4rem] border border-dashed border-[color:var(--ghost-border)] bg-[color:var(--surface-container-low)] px-4 py-8 text-center text-sm text-muted-foreground">
                正在加载最近播放…
              </div>
            ) : (dashboardQuery.data?.recentPlays.length ?? 0) > 0 ? (
              (dashboardQuery.data?.recentPlays ?? []).map((track) => {
                const isActiveTrack = activeTrackId === track.trackId;
                const isPendingTrack = pendingTrackId === track.trackId;
                const canTogglePlayback = isActiveTrack && !isPendingTrack;
                const playbackTrack = {
                  id: track.trackId,
                  title: track.title,
                  artist: track.artist,
                };

                return (
                  <div
                    key={track.trackId}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[1.4rem] border border-[color:var(--ghost-border)] bg-white/68 px-4 py-3",
                      isActiveTrack && "bg-[color:color-mix(in_srgb,var(--primary-container)_78%,white)]",
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-medium">{track.title}</div>
                        {isPendingTrack ? (
                          <Badge variant="outline">准备中</Badge>
                        ) : isActiveTrack ? (
                          <Badge variant="secondary">{isAudioPlaying ? "当前播放" : "当前已暂停"}</Badge>
                        ) : null}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">{track.artist}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock3Icon className="size-3.5" />
                        <span>{formatDateTime(track.playedAt)}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={isActiveTrack ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (queueSourceKey !== DASHBOARD_RECENT_PLAYS_SOURCE_KEY) {
                          replaceQueueFromUserIntent("user", {
                            tracks: recentPlayQueue,
                            sourceKey: DASHBOARD_RECENT_PLAYS_SOURCE_KEY,
                          });
                          requestPlayTrack("user", playbackTrack);
                          return;
                        }

                        if (isActiveTrack) {
                          toggleTrack("user", playbackTrack);
                          return;
                        }

                        requestPlayTrack("user", playbackTrack);
                      }}
                    >
                      {isPendingTrack ? (
                        <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                      ) : canTogglePlayback && isAudioPlaying ? (
                        <PauseCircleIcon data-icon="inline-start" />
                      ) : (
                        <PlayCircleIcon data-icon="inline-start" />
                      )}
                      {isActiveTrack && isAudioPlaying ? "暂停" : "继续播放"}
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-[color:var(--ghost-border)] bg-[color:var(--surface-container-low)] px-4 py-8 text-center text-sm text-muted-foreground">
                还没有最近播放记录。先去音乐库点播几首曲目吧。
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-1">
              <div className="space-y-1">
                <CardTitle>最近更新的歌单</CardTitle>
                <CardDescription>这里按歌单更新时间排序，表示最近维护过的歌单。</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {dashboardQuery.isLoading ? (
                <div className="rounded-[1.4rem] border border-dashed border-[color:var(--ghost-border)] bg-[color:var(--surface-container-low)] px-4 py-8 text-center text-sm text-muted-foreground">
                  正在加载歌单…
                </div>
              ) : (dashboardQuery.data?.recentPlaylists.length ?? 0) > 0 ? (
                (dashboardQuery.data?.recentPlaylists ?? []).map((playlist) => (
                  <Link
                    key={playlist.id}
                    href={`/playlists/${playlist.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "flex h-auto w-full items-center justify-between rounded-[1.4rem] border border-[color:var(--ghost-border)] bg-white/68 px-4 py-3",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-[1rem] bg-[color:var(--surface-container-low)] p-2.5 text-muted-foreground">
                        <Music4Icon className="size-4" />
                      </div>
                      <div className="space-y-1 text-left">
                        <div className="font-medium">{playlist.name}</div>
                        <div className="text-sm text-muted-foreground">{playlist.itemCount} 首曲目</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>最近更新</div>
                      <div>{formatDateTime(playlist.updatedAt)}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-[color:var(--ghost-border)] bg-[color:var(--surface-container-low)] px-4 py-8 text-center text-sm text-muted-foreground">
                  你还没有歌单。先创建一个，再从详情页往里加歌吧。
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <div className="space-y-1">
                <CardTitle>最近更新的曲目</CardTitle>
                <CardDescription>这里反映曲库最近写入或最近变更的内容，完整浏览仍然去音乐库。</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {dashboardQuery.isLoading ? (
                <div className="rounded-[1.4rem] border border-dashed border-[color:var(--ghost-border)] bg-[color:var(--surface-container-low)] px-4 py-8 text-center text-sm text-muted-foreground">
                  正在加载最近更新曲目…
                </div>
              ) : (dashboardQuery.data?.recentTracks.length ?? 0) > 0 ? (
                <>
                  {(dashboardQuery.data?.recentTracks ?? []).map((track) => (
                    <div key={track.id} className="rounded-[1.4rem] border border-[color:var(--ghost-border)] bg-white/68 px-4 py-3">
                      <div className="font-medium">{track.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {[track.artist, track.album ?? "-"].join(" · ")}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">更新时间：{formatDateTime(track.updatedAt)}</div>
                    </div>
                  ))}
                  <Link href="/library" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                    前往音乐库
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </>
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-[color:var(--ghost-border)] bg-[color:var(--surface-container-low)] px-4 py-8 text-center text-sm text-muted-foreground">
                  还没有可展示的曲库更新，先触发一次扫描吧。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
