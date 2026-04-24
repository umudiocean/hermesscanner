import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { TopLoadingBar } from '@/components/shell/TopLoadingBar'
import './globals.css'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Root Layout
// Premium typography stack: Inter (UI) + JetBrains Mono (numeric data)
// ═══════════════════════════════════════════════════════════════════

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'HERMES AI — Institutional Trading Terminal',
  description:
    'Kurumsal seviye VWAP tarayıcı, Z-Score sinyal motoru ve fundamental analiz terminali. NASDAQ • CRYPTO • EUROPE.',
  metadataBase: new URL('https://www.apphermesai.com'),
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🟣</text></svg>',
  },
  openGraph: {
    title: 'HERMES AI — Institutional Trading Terminal',
    description:
      'NASDAQ, CRYPTO ve EUROPE pazarları için kurumsal sınıf VWAP + Z-Score sinyal terminali.',
    type: 'website',
    locale: 'tr_TR',
  },
}

export const viewport: Viewport = {
  themeColor: '#08090B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-surface-0 font-sans antialiased text-text-primary">
        <TopLoadingBar />
        {children}
      </body>
    </html>
  )
}
