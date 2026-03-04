'use client'
import { useState } from 'react'
import { trpc } from '@/components/TRPCProvider'
import Link from 'next/link'

export default function ScanPage() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState<{ total: number; files: number } | null>(null)
  
  const scanMutation = trpc.scan.start.useMutation({
    onSuccess: (data) => setResult(data),
  })

  const handleScan = () => {
    if (!path) return
    scanMutation.mutate({ path })
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">扫描音乐</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          返回
        </Link>
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="输入音乐目录路径"
          className="border p-2 w-full max-w-md mr-2"
        />
        <button
          onClick={handleScan}
          disabled={scanMutation.isPending}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {scanMutation.isPending ? '扫描中...' : '开始扫描'}
        </button>
      </div>
      {result && (
        <p>扫描完成: 找到 {result.files} 个文件，导入 {result.total} 首歌曲</p>
      )}
    </main>
  )
}
