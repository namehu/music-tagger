import { SongTable } from '@/components/SongTable'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">音乐库</h1>
        <Link href="/scan" className="bg-blue-600 text-white px-4 py-2 rounded">
          扫描音乐
        </Link>
      </div>
      <SongTable />
    </main>
  )
}
