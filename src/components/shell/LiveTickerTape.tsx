'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// LiveTickerTape — premium scrolling instrument tape
// • Pulls quotes from /api/quotes/live with graceful fallback
// • Smooth marquee (CSS-only, paused on hover, GPU accelerated)
// • Tabular mono numbers, semantic up/down coloring
// ═══════════════════════════════════════════════════════════════════

interface Quote {
  symbol: string
  label?: string
  price: number | null
  changePct: number | null
}

const FALLBACK: Quote[] = [
  { symbol: 'SPX',     label: 'S&P 500',    price: 5847.32, changePct: 0.42 },
  { symbol: 'NDX',     label: 'NASDAQ-100', price: 20612.45, changePct: 0.68 },
  { symbol: 'DJI',     label: 'DOW',        price: 43215.10, changePct: 0.18 },
  { symbol: 'VIX',     label: 'VIX',        price: 14.86,   changePct: -2.1 },
  { symbol: 'BTCUSD',  label: 'BTC',        price: 96845.0, changePct: 1.24 },
  { symbol: 'ETHUSD',  label: 'ETH',        price: 3412.5,  changePct: 0.87 },
  { symbol: 'XAUUSD',  label: 'GOLD',       price: 2682.4,  changePct: -0.32 },
  { symbol: 'EURUSD',  label: 'EUR/USD',    price: 1.0428,  changePct: -0.15 },
  { symbol: 'USDJPY',  label: 'USD/JPY',    price: 156.21,  changePct: 0.22 },
  { symbol: 'USDTRY',  label: 'USD/TRY',    price: 35.52,   changePct: 0.08 },
]

interface Props {
  className?: string
  speedSeconds?: number   // full loop duration
}

export function LiveTickerTape({ className, speedSeconds = 80 }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>(FALLBACK)
  const fetchedOnceRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const symbols = FALLBACK.map(q => q.symbol).join(',')
        const res = await fetch(`/api/quotes/live?symbols=${symbols}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json().catch(() => null)
        const live = (data?.quotes ?? []) as Array<{ symbol: string; price?: number; changePct?: number }>
        if (Array.isArray(live) && live.length > 0) {
          // Merge with fallback labels
          const merged = FALLBACK.map(fb => {
            const match = live.find(l => l.symbol?.toUpperCase() === fb.symbol)
            return match
              ? { ...fb, price: match.price ?? fb.price, changePct: match.changePct ?? fb.changePct }
              : fb
          })
          if (!cancelled) {
            setQuotes(merged)
            fetchedOnceRef.current = true
          }
        }
      } catch {
        // silent — fallback shown
      }
    }
    load()
    const iv = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  // Doubled list for seamless marquee
  const loop = [...quotes, ...quotes]

  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden',
        'border-y border-stroke-subtle bg-surface-1/50 backdrop-blur-sm',
        className,
      )}
      role="marquee"
      aria-label="Canlı piyasa fiyatları"
    >
      {/* Edge fade masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-surface-0 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-surface-0 to-transparent" />

      <div
        className="flex items-center gap-8 py-2 whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]"
        style={{ animation: `ticker-marquee ${speedSeconds}s linear infinite` }}
      >
        {loop.map((q, i) => {
          const up = (q.changePct ?? 0) >= 0
          const tone = q.changePct === null
            ? 'text-text-tertiary'
            : up ? 'text-success-400' : 'text-danger-400'
          return (
            <div key={`${q.symbol}-${i}`} className="inline-flex items-center gap-2.5 shrink-0">
              <span className="text-2xs font-semibold tracking-widest uppercase text-text-tertiary">
                {q.label ?? q.symbol}
              </span>
              <span className="text-xs font-mono font-semibold tabular-nums text-text-primary">
                {q.price === null ? '—' : q.price.toLocaleString('en-US', { maximumFractionDigits: q.price < 10 ? 4 : 2 })}
              </span>
              <span className={cn('text-2xs font-mono font-semibold tabular-nums inline-flex items-center gap-0.5', tone)}>
                <span aria-hidden>{up ? '▲' : '▼'}</span>
                {q.changePct === null ? '—' : `${Math.abs(q.changePct).toFixed(2)}%`}
              </span>
              <span className="text-stroke text-2xs">·</span>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        @keyframes ticker-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [role='marquee'] > div:nth-child(3) { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
