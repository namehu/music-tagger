'use client'
import { trpc } from './TRPCProvider'
import { usePlayer } from '@/hooks/usePlayer'

export function SongTable() {
  const { data, isLoading } = trpc.song.list.useQuery({ page: 1, limit: 50 })
  const { play, addToPlaylist } = usePlayer()

  if (isLoading) return <div>加载中...</div>

  return (
    <table className="w-full">
      <thead>
        <tr className="text-left border-b">
          <th className="p-2">标题</th>
          <th className="p-2">艺术家</th>
          <th className="p-2">专辑</th>
          <th className="p-2">操作</th>
        </tr>
      </thead>
      <tbody>
        {data?.songs.map((song) => (
          <tr key={song.id} className="border-b hover:bg-gray-50">
            <td className="p-2">{song.title}</td>
            <td className="p-2">{song.artist || '-'}</td>
            <td className="p-2">{song.album || '-'}</td>
            <td className="p-2">
              <button
                onClick={() => { play(song); addToPlaylist(song) }}
                className="mr-2 text-blue-600 hover:underline"
              >
                播放
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
