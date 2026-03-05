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
import {
  Plus,
  MoreHorizontal,
  Play,
  Trash2,
  ListMusic,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

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
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(
    null
  );

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
  const removeSong = trpc.playlist.removeSong.useMutation({
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

  const toggleExpand = (id: string) => {
    setExpandedPlaylistId(expandedPlaylistId === id ? null : id);
  };

  return (
    <div className="border rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
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

      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-2 pb-4">
          {playlists?.map((playlist: Playlist) => (
            <div key={playlist.id} className="border rounded-md">
              <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded-t-md transition-colors">
                <div
                  className="flex-1 cursor-pointer min-w-0 flex items-center gap-2"
                  onClick={() => toggleExpand(playlist.id)}
                >
                  {expandedPlaylistId === playlist.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{playlist.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {playlist.songs.length} 首歌曲
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handlePlayPlaylist(playlist)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      播放列表
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deletePlaylist.mutate(playlist.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除列表
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {expandedPlaylistId === playlist.id && (
                <div className="border-t bg-gray-50/50 p-2 space-y-1">
                  {playlist.songs.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-2">
                      暂无歌曲
                    </div>
                  ) : (
                    playlist.songs.map((ps, index) => (
                      <div
                        key={`${ps.song.id}-${index}`}
                        className="flex items-center justify-between group p-1.5 hover:bg-gray-200 rounded text-sm transition-colors"
                      >
                        <div
                          className="flex-1 min-w-0 cursor-pointer flex items-center gap-2"
                          onClick={() => {
                            setPlaylist(
                              playlist.songs.map((s: PlaylistSong) => s.song)
                            );
                            play(ps.song);
                          }}
                        >
                          <div className="truncate font-medium text-gray-700">
                            {ps.song.title}
                          </div>
                          <div className="truncate text-gray-500 text-xs hidden sm:block">
                            - {ps.song.artist || "未知"}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSong.mutate({
                              playlistId: playlist.id,
                              songId: ps.song.id,
                            });
                          }}
                          title="从列表中移除"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
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
