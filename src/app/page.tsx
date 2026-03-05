"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { SongTable } from "@/components/SongTable";
import { FilterSidebar } from "@/components/FilterSidebar";
import { PlaylistPanel } from "@/components/PlaylistPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Filter, ListMusic } from "lucide-react";
import Link from "next/link";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedArtist = searchParams.get("artist");
  const selectedAlbum = searchParams.get("album");
  const page = parseInt(searchParams.get("page") || "1", 10);

  const updateFilters = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page when filter changes
    if (key !== "page") {
      params.delete("page");
    }
    
    // Clear album if artist changes (optional, based on previous logic)
    if (key === 'artist') {
        params.delete('album');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleArtistChange = (artist: string | null) => {
    updateFilters("artist", artist);
  };

  const handleAlbumChange = (album: string | null) => {
    updateFilters("album", album);
  };

  const handlePageChange = (page: number) => {
    updateFilters("page", page.toString());
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
        <div className="flex-1 min-w-0">
          <SongTable 
            artist={selectedArtist} 
            album={selectedAlbum} 
            page={page}
            onPageChange={handlePageChange}
          />
        </div>
        <div className="hidden lg:block w-72">
          <PlaylistPanel />
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
