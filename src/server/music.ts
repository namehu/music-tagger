// @ts-ignore
const mm = require('music-metadata')

export async function parseAudioFile(filePath: string) {
  try {
    const metadata = await mm.parseFile(filePath)
    const { common, format } = metadata
    
    return {
      title: common.title || '',
      artist: common.artist || '',
      album: common.album || '',
      genre: common.genre?.[0] || '',
      year: common.year,
      duration: Math.round(format.duration || 0),
      trackNumber: common.track?.no,
    }
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error)
    return null
  }
}

export const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac']
