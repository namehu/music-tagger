"use client";

import { useState } from "react";
import { SongTable } from "@/components/SongTable";
import { FilterSidebar } from "@/components/FilterSidebar";
import { PlaylistPanel } from "@/components/PlaylistPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Filter, ListMusic, Menu } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleArtistChange = (artist: string | null) => {
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setRefreshKey((k) => k + 1);
  };

  const handleAlbumChange = (album: string | null) => {
    setSelectedAlbum(album);
    setRefreshKey((k) => k + 1);
  };

  return (
    <main className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold">音乐库</h1>
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <Filter className="w-4 h-4 mr-1" />
                筛选
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <FilterSidebar
                selectedArtist={selectedArtist}
                selectedAlbum={selectedAlbum}
                onArtistChange={handleArtistChange}
                onAlbumChange={handleAlbumChange}
              />
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <ListMusic className="w-4 h-4 mr-1" />
                列表
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <PlaylistPanel />
            </SheetContent>
          </Sheet>
          <Link href="/scan" className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded text-sm md:text-base">
            扫描
          </Link>
        </div>
      </div>
      <div className="flex gap-6">
        <div className="hidden lg:block">
          <FilterSidebar
            selectedArtist={selectedArtist}
            selectedAlbum={selectedAlbum}
            onArtistChange={handleArtistChange}
            onAlbumChange={handleAlbumChange}
          />
        </div>
        <div className="flex-1 min-w-0" key={refreshKey}>
          <SongTable artist={selectedArtist} album={selectedAlbum} />
        </div>
        <div className="hidden lg:block w-72">
          <PlaylistPanel />
        </div>
      </div>
    </main>
  );
}
