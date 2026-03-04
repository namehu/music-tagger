import type { Metadata } from 'next'
import './globals.css'
import { TRPCProvider } from '@/components/TRPCProvider'
import { PlayerBar } from '@/components/PlayerBar'

export const metadata: Metadata = {
  title: 'Music Tagger',
  description: '音乐标签管理应用',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body>
        <TRPCProvider>
          {children}
          <PlayerBar />
        </TRPCProvider>
      </body>
    </html>
  )
}
