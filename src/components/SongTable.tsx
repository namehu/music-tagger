'use client'
import { useState } from 'react'
import { trpc } from './TRPCProvider'
import { usePlayer } from '@/hooks/usePlayer'
import { SongEditor } from './SongEditor'
import { BatchEditDialog } from './BatchEditDialog'

interface Song {
  id: string
  title: string
  artist: string | null
  album: string | null
  genre: string | null
  year: number | null
  filePath: string
  coverPath: string | null
}

export function SongTable() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchEdit, setShowBatchEdit] = useState(false)
  
  const { data, isLoading, refetch } = trpc.song.list.useQuery({ 
    page, 
    limit: 20,
    search: search || undefined 
  })
  const { play, addToPlaylist } = usePlayer()

  const handleSaved = () => {
    refetch()
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (!data) return
    if (selectedIds.size === data.songs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.songs.map(s => s.id)))
    }
  }

  if (isLoading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="搜索歌曲..."
          className="border rounded px-3 py-2 w-full max-w-xs"
        />
        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowBatchEdit(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            批量编辑 ({selectedIds.size})
          </button>
        )}
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2 w-10">
              <input
                type="checkbox"
                checked={data ? selectedIds.size === data.songs.length && data.songs.length > 0 : false}
                onChange={toggleSelectAll}
              />
            </th>
            <th className="p-2">标题</th>
            <th className="p-2">艺术家</th>
            <th className="p-2">专辑</th>
            <th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {data?.songs.map((song) => (
            <tr key={song.id} className={`border-b hover:bg-gray-50 ${selectedIds.has(song.id) ? 'bg-blue-50' : ''}`}>
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(song.id)}
                  onChange={() => toggleSelect(song.id)}
                />
              </td>
              <td className="p-2">{song.title}</td>
              <td className="p-2">{song.artist || '-'}</td>
              <td className="p-2">{song.album || '-'}</td>
              <td className="p-2">
                <button
                  onClick={() => { play(song as any); addToPlaylist(song as any) }}
                  className="mr-2 text-blue-600 hover:underline"
                >
                  播放
                </button>
                <button
                  onClick={() => setEditingSong(song as any)}
                  className="text-gray-600 hover:underline"
                >
                  编辑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data && data.total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-3 py-1">
            第 {page} / {Math.ceil(data.total / 20)} 页
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 20 >= data.total}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}

      {editingSong && (
        <SongEditor
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
  )
}
