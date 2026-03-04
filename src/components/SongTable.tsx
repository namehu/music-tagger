"use client";
import { useState } from "react";
import { trpc } from "./TRPCProvider";
import { usePlayer } from "@/hooks/usePlayer";
import { SongEditor } from "./SongEditor";
import { BatchEditDialog } from "./BatchEditDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Edit, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  filePath: string;
  coverPath: string | null;
  lyrics: string | null;
}

export function SongTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchEdit, setShowBatchEdit] = useState(false);

  const { data, isLoading, refetch } = trpc.song.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
  });
  const { play, addToPlaylist } = usePlayer();

  const handleSaved = () => {
    refetch();
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedIds.size === data.songs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.songs.map((s) => s.id)));
    }
  };

  if (isLoading)
    return (
      <div className="p-4 text-center text-muted-foreground">加载中...</div>
    );

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="搜索歌曲..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        {selectedIds.size > 0 && (
          <Button onClick={() => setShowBatchEdit(true)} variant="default">
            批量编辑 ({selectedIds.size})
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    data
                      ? selectedIds.size === data.songs.length &&
                        data.songs.length > 0
                      : false
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>标题</TableHead>
              <TableHead>艺术家</TableHead>
              <TableHead>专辑</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.songs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  暂无歌曲
                </TableCell>
              </TableRow>
            )}
            {data?.songs.map((song) => (
              <TableRow
                key={song.id}
                data-state={selectedIds.has(song.id) && "selected"}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(song.id)}
                    onCheckedChange={() => toggleSelect(song.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{song.title}</TableCell>
                <TableCell>{song.artist || "-"}</TableCell>
                <TableCell>{song.album || "-"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">打开菜单</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>操作</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => {
                          play(song as any);
                          addToPlaylist(song as any);
                        }}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        播放
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingSong(song as any)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="px-4 text-sm text-muted-foreground">
                第 {page} / {totalPages} 页
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                下一页
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {editingSong && (
        <SongEditor
          key={editingSong.id}
          song={editingSong}
          onClose={() => setEditingSong(null)}
          onSaved={handleSaved}
        />
      )}

      {showBatchEdit && (
        <BatchEditDialog
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBatchEdit(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
