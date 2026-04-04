"use client";

import Link from "next/link";
import React from "react";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { trpc } from "@/app/_trpc/provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function PlaylistsPage() {
  const utils = trpc.useUtils();
  const [name, setName] = React.useState("");
  const [editingPlaylistId, setEditingPlaylistId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const playlistsQuery = trpc.playlists.list.useQuery();
  const createPlaylist = trpc.playlists.create.useMutation({
    onSuccess: async () => {
      toast.success("歌单已创建");
      setName("");
      await utils.playlists.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "创建歌单失败");
    },
  });
  const renamePlaylist = trpc.playlists.rename.useMutation({
    onSuccess: async () => {
      toast.success("歌单名称已更新");
      setEditingPlaylistId(null);
      setEditingName("");
      await utils.playlists.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "重命名失败");
    },
  });
  const removePlaylist = trpc.playlists.remove.useMutation({
    onSuccess: async () => {
      toast.success("歌单已删除");
      await utils.playlists.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "删除歌单失败");
    },
  });

  const playlists = playlistsQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">歌单</h1>
        <p className="text-sm text-muted-foreground">管理你自己的歌单，按保存顺序点播其中的曲目。</p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>新建歌单</CardTitle>
          <CardDescription>第一版先支持个人歌单，不做共享和协作。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：夜间循环 / 周末精选"
            className="sm:max-w-md"
          />
          <Button
            type="button"
            disabled={createPlaylist.isPending || name.trim().length === 0}
            onClick={() => createPlaylist.mutate({ name: name.trim() })}
          >
            <PlusIcon data-icon="inline-start" />
            {createPlaylist.isPending ? "创建中..." : "创建歌单"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {playlists.map((playlist) => {
          const isEditing = editingPlaylistId === playlist.id;
          return (
            <Card key={playlist.id}>
              <CardHeader className="border-b">
                <div className="space-y-1">
                  <CardTitle>{playlist.name}</CardTitle>
                  <CardDescription>{playlist.itemCount} 首曲目</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>创建时间：{formatDateTime(playlist.createdAt)}</div>
                  <div>最近更新：{formatDateTime(playlist.updatedAt)}</div>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={renamePlaylist.isPending || editingName.trim().length === 0}
                        onClick={() =>
                          renamePlaylist.mutate({
                            playlistId: playlist.id,
                            name: editingName.trim(),
                          })
                        }
                      >
                        {renamePlaylist.isPending ? "保存中..." : "保存名称"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingPlaylistId(null)}>
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/playlists/${playlist.id}`}
                      className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                    >
                      打开歌单
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingPlaylistId(playlist.id);
                        setEditingName(playlist.name);
                      }}
                    >
                      <PencilIcon data-icon="inline-start" />
                      重命名
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!window.confirm(`确定删除歌单“${playlist.name}”吗？`)) {
                          return;
                        }
                        removePlaylist.mutate({ playlistId: playlist.id });
                      }}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      删除
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!playlistsQuery.isLoading && playlists.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            还没有歌单。先创建一个，再从详情页把曲目加入进去。
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
