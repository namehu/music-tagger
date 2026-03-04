'use client'
import { useState } from 'react'
import { trpc } from './TRPCProvider'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">编辑歌曲</h2>
        
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-40 h-40 border-2 border-dashed border-gray-300 rounded flex items-center justify-center overflow-hidden bg-gray-50">
              {coverPath ? (
                <img src={coverPath} alt="封面" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-sm">无封面</span>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">封面图片</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              disabled={uploading}
              className="w-full text-sm"
            />
            {uploading && <span className="text-sm text-gray-500">上传中...</span>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">艺术家</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">专辑</label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">流派</label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">年份</label>
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
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
