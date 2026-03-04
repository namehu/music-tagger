'use client'
import { useState } from 'react'
import { trpc } from './TRPCProvider'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Upload } from "lucide-react"

interface Song {
  id: string
  title: string
  artist: string | null
  album: string | null
  genre: string | null
  year: number | null
  coverPath: string | null
}

interface SongEditorProps {
  song: Song
  onClose: () => void
  onSaved: () => void
}

export function SongEditor({ song, onClose, onSaved }: SongEditorProps) {
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist || '')
  const [album, setAlbum] = useState(song.album || '')
  const [genre, setGenre] = useState(song.genre || '')
  const [year, setYear] = useState(song.year?.toString() || '')
  const [coverPath, setCoverPath] = useState(song.coverPath || '')
  const [uploading, setUploading] = useState(false)

  const updateMutation = trpc.song.update.useMutation({
    onSuccess: () => {
      onSaved()
      onClose()
    },
  })

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('songId', song.id)

      const res = await fetch('/api/cover', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.coverPath) {
        setCoverPath(data.coverPath)
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = () => {
    updateMutation.mutate({
      id: song.id,
      title,
      artist: artist || undefined,
      album: album || undefined,
      genre: genre || undefined,
      year: year ? parseInt(year) : undefined,
      coverPath: coverPath || undefined,
    })
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑歌曲</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-40 h-40 border-2 border-dashed border-muted rounded-lg flex items-center justify-center overflow-hidden bg-muted/50 group">
              {coverPath ? (
                <>
                  <img src={coverPath} alt="封面" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="text-white h-8 w-8" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Upload className="h-8 w-8 mb-2" />
                  <span className="text-xs">上传封面</span>
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                标题
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="artist" className="text-right">
                艺术家
              </Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="album" className="text-right">
                专辑
              </Label>
              <Input
                id="album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="genre" className="text-right">
                流派
              </Label>
              <Input
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="year" className="text-right">
                年份
              </Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
