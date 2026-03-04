"use client";
import { useState } from "react";
import { trpc } from "./TRPCProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, Upload, X } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  coverPath: string | null;
  lyrics: string | null;
}

interface SongEditorProps {
  song: Song;
  onClose: () => void;
  onSaved: () => void;
}

export function SongEditor({ song, onClose, onSaved }: SongEditorProps) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist || "");
  const [album, setAlbum] = useState(song.album || "");
  const [genre, setGenre] = useState(song.genre || "");
  const [year, setYear] = useState(song.year?.toString() || "");
  const [lyrics, setLyrics] = useState(song.lyrics || "");
  const [coverPath, setCoverPath] = useState<string | null>(
    song.coverPath || null,
  );
  const [uploading, setUploading] = useState(false);

  const updateMutation = trpc.song.update.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("songId", song.id);

      const res = await fetch("/api/cover", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.coverPath) {
        setCoverPath(data.coverPath);
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: song.id,
      title,
      artist: artist || undefined,
      album: album || undefined,
      genre: genre || undefined,
      year: year ? parseInt(year) : undefined,
      coverPath: coverPath,
      lyrics: lyrics || undefined,
    });
  };

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>编辑歌曲</SheetTitle>
          <SheetDescription>修改歌曲的元数据信息和封面。</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="grid gap-6 py-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-40 h-40 border-2 border-dashed border-muted rounded-lg flex items-center justify-center bg-muted/50 group">
                {coverPath ? (
                  <>
                    <div className="relative w-full h-full overflow-hidden rounded-md">
                      <img
                        src={coverPath}
                        alt="封面"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Upload className="text-white h-8 w-8" />
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverPath(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground pointer-events-none">
                    <Upload className="h-8 w-8 mb-2" />
                    <span className="text-xs">上传封面</span>
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                />
              </div>
              {uploading && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上传中...
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="artist">艺术家</Label>
                  <Input
                    id="artist"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="album">专辑</Label>
                  <Input
                    id="album"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="genre">流派</Label>
                  <Input
                    id="genre"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="year">年份</Label>
                  <Input
                    id="year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lyrics">歌词</Label>
                <Textarea
                  id="lyrics"
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="在此输入歌词..."
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t mt-auto">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            保存
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
