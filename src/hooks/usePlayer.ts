import { create } from 'zustand'

interface Song {
  id: string
  title: string
  artist: string | null
  album: string | null
  filePath: string
  coverPath: string | null
  lyrics: string | null
}

interface PlayerState {
  currentSong: Song | null
  playlist: Song[]
  isPlaying: boolean
  play: (song: Song) => void
  addToPlaylist: (song: Song) => void
  setPlaying: (playing: boolean) => void
  setPlaylist: (songs: Song[]) => void
  next: () => void
  prev: () => void
}

export const usePlayer = create<PlayerState>((set, get) => ({
  currentSong: null,
  playlist: [],
  isPlaying: false,

  play: (song) => set({ currentSong: song, isPlaying: true }),
  
  addToPlaylist: (song) => set((state) => ({
    playlist: [...state.playlist, song]
  })),
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  
  setPlaylist: (songs) => set({ playlist: songs }),

  next: () => {
    const { currentSong, playlist } = get()
    if (!currentSong || playlist.length === 0) return
    const idx = playlist.findIndex(s => s.id === currentSong.id)
    const nextIdx = (idx + 1) % playlist.length
    set({ currentSong: playlist[nextIdx] })
  },
  
  prev: () => {
    const { currentSong, playlist } = get()
    if (!currentSong || playlist.length === 0) return
    const idx = playlist.findIndex(s => s.id === currentSong.id)
    const prevIdx = idx === 0 ? playlist.length - 1 : idx - 1
    set({ currentSong: playlist[prevIdx] })
  },
}))
