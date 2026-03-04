import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const songId = formData.get('songId') as string | null

    if (!file || !songId) {
      return NextResponse.json({ error: 'Missing file or songId' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${songId}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'covers')
    
    await fs.mkdir(uploadDir, { recursive: true })
    await fs.writeFile(path.join(uploadDir, fileName), buffer)

    const coverPath = `/covers/${fileName}`
    return NextResponse.json({ coverPath })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
