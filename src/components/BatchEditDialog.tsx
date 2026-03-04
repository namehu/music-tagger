'use client'
import { useState } from 'react'
import { trpc } from './TRPCProvider'

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-2">批量编辑 ({selectedIds.length} 首歌曲)</h2>
        <p className="text-sm text-gray-500 mb-4">留空表示不修改</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              艺术家
              <button
                onClick={() => setClearField(clearField === 'artist' ? null : 'artist')}
                className="ml-2 text-xs text-red-500"
              >
                {clearField === 'artist' ? '取消清除' : '清除'}
              </button>
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              专辑
              <button
                onClick={() => setClearField(clearField === 'album' ? null : 'album')}
                className="ml-2 text-xs text-red-500"
              >
                {clearField === 'album' ? '取消清除' : '清除'}
              </button>
            </label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              流派
              <button
                onClick={() => setClearField(clearField === 'genre' ? null : 'genre')}
                className="ml-2 text-xs text-red-500"
              >
                {clearField === 'genre' ? '取消清除' : '清除'}
              </button>
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              年份
              <button
                onClick={() => setClearField(clearField === 'year' ? null : 'year')}
                className="ml-2 text-xs text-red-500"
              >
                {clearField === 'year' ? '取消清除' : '清除'}
              </button>
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={batchUpdateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {batchUpdateMutation.isPending ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
