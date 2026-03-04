'use client'
import { usePlayer } from '@/hooks/usePlayer'
import { useRef, useEffect, useState } from 'react'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const { currentSong, isPlaying, setPlaying, next, prev } = usePlayer()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isDragging, setIsDragging] = useState(false)

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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const handleTimeUpdate = () => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const handleSeekStart = () => setIsDragging(true)
  const handleSeekEnd = () => setIsDragging(false)

  if (!currentSong) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4">
      <audio
        ref={audioRef}
        onEnded={next}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{currentSong.title}</div>
          <div className="text-sm text-gray-400 truncate">{currentSong.artist || '-'}</div>
        </div>
        
        <div className="flex items-center gap-4 ml-4">
          <button onClick={prev} className="hover:text-gray-300">⏮</button>
          <button onClick={() => setPlaying(!isPlaying)} className="text-2xl hover:text-gray-300">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={next} className="hover:text-gray-300">⏭</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-10">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          onMouseDown={handleSeekStart}
          onMouseUp={handleSeekEnd}
          className="flex-1 h-1 accent-blue-500"
        />
        <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
        
        <div className="flex items-center gap-1 ml-2">
          <span>{volume === 0 ? '🔇' : '🔊'}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 accent-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
