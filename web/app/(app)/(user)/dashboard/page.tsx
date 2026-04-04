"use client";

import Link from "next/link";
import { EyeOffIcon, FolderIcon, ListMusicIcon, Music4Icon } from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { CurrentPlaybackSummary } from "@/components/playback/current-playback-summary";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function UserDashboardPage() {
  const statsQuery = trpc.library.stats.useQuery({ surface: "user" });
  const playlistsQuery = trpc.playlists.list.useQuery();

  const quickLinks = [
    {
      title: "浏览音乐库",
      description: "搜索、查看并开始播放你想听的曲目。",
      href: "/library",
      icon: FolderIcon,
    },
    {
      title: "管理歌单",
      description: "创建自己的歌单并维护播放顺序。",
      href: "/playlists",
      icon: ListMusicIcon,
    },
    {
      title: "我的忽略",
      description: "查看你手动隐藏的曲目，并按需恢复。",
      href: "/ignored-tracks",
      icon: EyeOffIcon,
    },
  ];

  const stats = [
    { title: "曲目", value: statsQuery.data?.tracks ?? 0 },
    { title: "专辑", value: statsQuery.data?.albums ?? 0 },
    { title: "艺人", value: statsQuery.data?.artists ?? 0 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">用户首页</h1>
        <p className="text-sm text-muted-foreground">
          从这里进入你的音乐库和歌单，当前播放会在页面底部持续保留。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <Card key={item.title}>
            <CardHeader className="border-b">
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>当前可访问的库内数量</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <CurrentPlaybackSummary className="h-full" />

        <Card>
          <CardHeader className="border-b">
            <CardTitle>最近入口</CardTitle>
            <CardDescription>先把用户主入口和歌单能力立起来，最近播放稍后再扩展。</CardDescription>
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
                  <div className="rounded-lg border bg-muted/50 p-2 text-muted-foreground">
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

      <Card>
        <CardHeader className="border-b">
          <CardTitle>你的歌单</CardTitle>
          <CardDescription>先从已有歌单继续播放，或进入歌单页新建一个。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {(playlistsQuery.data ?? []).length > 0 ? (
            (playlistsQuery.data ?? []).slice(0, 5).map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlists/${playlist.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "flex h-auto w-full items-center justify-between rounded-xl border px-4 py-3",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border bg-muted/50 p-2 text-muted-foreground">
                    <Music4Icon className="size-4" />
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="font-medium">{playlist.name}</div>
                    <div className="text-sm text-muted-foreground">{playlist.itemCount} 首曲目</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">继续查看</div>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              你还没有歌单。前往歌单页创建第一个吧。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
