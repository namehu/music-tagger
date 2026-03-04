'use client'
import { usePlayer } from '@/hooks/usePlayer'
import { useRef, useEffect } from 'react'

export function PlayerBar() {
  const { currentSong, isPlaying, setPlaying, next, prev } = usePlayer()
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.src = `/api/music?path=${encodeURIComponent(currentSong.filePath)}`
      if (isPlaying) audioRef.current.play()
    }
  }, [currentSong])

  useEffect(() => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.play() : audioRef.current.pause()
    }
  }, [isPlaying])

  if (!currentSong) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4">
      <audio ref={audioRef} onEnded={next} />
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">{currentSong.title}</div>
          <div className="text-sm text-gray-400">{currentSong.artist}</div>
        </div>
        <div className="flex gap-4">
          <button onClick={prev} className="hover:text-gray-300">上一首</button>
          <button onClick={() => setPlaying(!isPlaying)} className="text-2xl">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={next} className="hover:text-gray-300">下一首</button>
        </div>
      </div>
    </div>
  )
}
