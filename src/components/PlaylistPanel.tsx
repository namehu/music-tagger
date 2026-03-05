"use client";

import { useState } from "react";
import { trpc } from "./TRPCProvider";
import { usePlayer } from "@/hooks/usePlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Play, Trash2, ListMusic } from "lucide-react";

interface PlaylistSong {
  song: {
    id: string;
    title: string;
    artist: string | null;
    album: string | null;
    filePath: string;
    coverPath: string | null;
    lyrics: string | null;
  };
}

interface Playlist {
  id: string;
  name: string;
  songs: PlaylistSong[];
}

export function PlaylistPanel() {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: playlists, refetch } = trpc.playlist.list.useQuery();
  const createPlaylist = trpc.playlist.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewPlaylistName("");
      setIsCreateOpen(false);
    },
  });
  const deletePlaylist = trpc.playlist.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const { play, setPlaylist } = usePlayer();

  const handleCreate = () => {
    if (newPlaylistName.trim()) {
      createPlaylist.mutate({ name: newPlaylistName.trim() });
    }
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    if (playlist.songs.length > 0) {
      setPlaylist(playlist.songs.map((s: PlaylistSong) => s.song));
      play(playlist.songs[0].song);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <ListMusic className="w-5 h-5" />
          播放列表
        </h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建播放列表</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="播放列表名称"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button onClick={handleCreate}>创建</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {playlists?.map((playlist: Playlist) => (
            <div
              key={playlist.id}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-100"
            >
              <div
                className="flex-1 cursor-pointer min-w-0"
                onClick={() => handlePlayPlaylist(playlist)}
              >
                <div className="font-medium truncate">{playlist.name}</div>
                <div className="text-xs text-muted-foreground">
                  {playlist.songs.length} 首歌曲
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handlePlayPlaylist(playlist)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    播放
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => deletePlaylist.mutate(playlist.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {playlists?.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              暂无播放列表
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
