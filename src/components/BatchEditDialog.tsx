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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface BatchEditDialogProps {
  selectedIds: string[]
  onClose: () => void
  onSaved: () => void
}

export function BatchEditDialog({ selectedIds, onClose, onSaved }: BatchEditDialogProps) {
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState('')
  const [clearField, setClearField] = useState<string | null>(null)

  const batchUpdateMutation = trpc.song.batchUpdate.useMutation({
    onSuccess: () => {
      onSaved()
      onClose()
    },
  })

  const handleSave = () => {
    const data: any = {}
    if (artist) data.artist = artist
    if (album) data.album = album
    if (genre) data.genre = genre
    if (year) data.year = parseInt(year)
    
    if (clearField) {
      data[clearField] = null
    }

    if (Object.keys(data).length > 0) {
      batchUpdateMutation.mutate({ ids: selectedIds, data })
    }
  }

  const toggleClear = (field: string) => {
    setClearField(clearField === field ? null : field)
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>批量编辑 ({selectedIds.length} 首歌曲)</DialogTitle>
          <DialogDescription>
            输入要修改的字段，留空表示不修改。点击“清除”可清空该字段。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="artist" className="text-right flex items-center justify-end gap-2">
              艺术家
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                disabled={clearField === 'artist'}
                className={clearField === 'artist' ? 'opacity-50' : ''}
              />
              <Button
                variant={clearField === 'artist' ? "destructive" : "outline"}
                size="sm"
                onClick={() => toggleClear('artist')}
                className="whitespace-nowrap"
              >
                {clearField === 'artist' ? '取消' : '清除'}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="album" className="text-right flex items-center justify-end gap-2">
              专辑
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                disabled={clearField === 'album'}
                className={clearField === 'album' ? 'opacity-50' : ''}
              />
              <Button
                variant={clearField === 'album' ? "destructive" : "outline"}
                size="sm"
                onClick={() => toggleClear('album')}
                className="whitespace-nowrap"
              >
                {clearField === 'album' ? '取消' : '清除'}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="genre" className="text-right flex items-center justify-end gap-2">
              流派
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                disabled={clearField === 'genre'}
                className={clearField === 'genre' ? 'opacity-50' : ''}
              />
              <Button
                variant={clearField === 'genre' ? "destructive" : "outline"}
                size="sm"
                onClick={() => toggleClear('genre')}
                className="whitespace-nowrap"
              >
                {clearField === 'genre' ? '取消' : '清除'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="year" className="text-right flex items-center justify-end gap-2">
              年份
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={clearField === 'year'}
                className={clearField === 'year' ? 'opacity-50' : ''}
              />
              <Button
                variant={clearField === 'year' ? "destructive" : "outline"}
                size="sm"
                onClick={() => toggleClear('year')}
                className="whitespace-nowrap"
              >
                {clearField === 'year' ? '取消' : '清除'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={batchUpdateMutation.isPending}>
            {batchUpdateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
