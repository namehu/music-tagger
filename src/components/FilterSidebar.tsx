"use client";

import { trpc } from "./TRPCProvider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FilterSidebarProps {
  selectedArtist: string | null;
  selectedAlbum: string | null;
  onArtistChange: (artist: string | null) => void;
  onAlbumChange: (album: string | null) => void;
}

export function FilterSidebar({
  selectedArtist,
  selectedAlbum,
  onArtistChange,
  onAlbumChange,
}: FilterSidebarProps) {
  const { data: filters } = trpc.song.getFilters.useQuery();

  const clearFilters = () => {
    onArtistChange(null);
    onAlbumChange(null);
  };

  const hasFilters = selectedArtist || selectedAlbum;

  return (
    <div className="w-64 flex-shrink-0 border-r pr-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">筛选</h2>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            清除
          </Button>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              艺术家 ({filters?.artists.length || 0})
            </h3>
            <div className="space-y-1">
              {filters?.artists.map((artist) => (
                <Button
                  key={artist}
                  variant={selectedArtist === artist ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start truncate"
                  onClick={() =>
                    onArtistChange(selectedArtist === artist ? null : artist)
                  }
                >
                  {artist}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              专辑 ({filters?.albums.length || 0})
            </h3>
            <div className="space-y-1">
              {filters?.albums.map((album) => (
                <Button
                  key={album}
                  variant={selectedAlbum === album ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start truncate"
                  onClick={() =>
                    onAlbumChange(selectedAlbum === album ? null : album)
                  }
                >
                  {album}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
