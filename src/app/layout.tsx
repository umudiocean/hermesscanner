import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HERMES Scanner - NASDAQ V5.1',
  description: 'HERMES Institutional VWAP Scanner - 440 NASDAQ hisse otomatik tarama',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🟣</text></svg>',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-[#0A0A0F]">
        {children}
      </body>
    </html>
  )
}
