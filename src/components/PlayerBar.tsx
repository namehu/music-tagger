"use client";
import { usePlayer } from "@/hooks/usePlayer";
import { useRef, useEffect, useState } from "react";

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const { currentSong, isPlaying, setPlaying, next, prev, playlist } =
    usePlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTimeRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.src = `/api/music?path=${encodeURIComponent(currentSong.filePath)}`;
      setIsReady(true);
    }
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current && isReady) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, isReady]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isDragging) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      currentTimeRef.current = time;
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    currentTimeRef.current = time;
  };

  const handleSeekStart = () => setIsDragging(true);
  const handleSeekEnd = () => {
    setIsDragging(false);
    if (audioRef.current) {
      audioRef.current.currentTime = currentTimeRef.current;
    }
  };

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
  };

  const handlePrev = () => {
    if (audioRef.current && currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      prev();
    }
  };

  const handleNext = () => {
    next();
  };

  const handleEnded = () => {
    next();
  };

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4">
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{currentSong.title}</div>
          <div className="text-sm text-gray-400 truncate">
            {currentSong.artist || "-"}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <button onClick={handlePrev} className="hover:text-gray-300 text-lg">
            ⏮
          </button>
          <button
            onClick={handlePlayPause}
            className="text-2xl hover:text-gray-300 w-10 h-10 flex items-center justify-center"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={handleNext} className="hover:text-gray-300 text-lg">
            ⏭
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-10">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          onMouseDown={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onTouchStart={handleSeekStart}
          onTouchEnd={handleSeekEnd}
          className="flex-1 h-1 accent-blue-500 cursor-pointer"
        />
        <span className="text-xs text-gray-400 w-10">
          {formatTime(duration)}
        </span>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
            className="hover:text-gray-300"
          >
            {volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 accent-blue-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
