import { promises as fs } from 'fs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'No path' }, { status: 400 })

  try {
    const file = await fs.readFile(path)
    const ext = path.split('.').pop()?.toLowerCase() || 'mp3'
    const contentType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`
    
    return new NextResponse(file, {
      headers: { 'Content-Type': contentType },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
