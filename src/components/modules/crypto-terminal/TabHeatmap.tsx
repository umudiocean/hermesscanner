'use client'

// HERMES AI CRYPTO TERMINAL — Tab: HEATMAP (K9)
// Market cap treemap — coin size proportional to market cap, color by 24h change

import { useState, useEffect, useRef } from 'react'
import { Grid3X3 } from 'lucide-react'

interface HeatmapCoin {
  id: string
  symbol: string
  name: string
  image: string
  market_cap: number
  current_price: number
  change1h: number
  change24h: number
  change7d: number
}

interface TabHeatmapProps {
  onSelectCoin: (id: string) => void
}

type TimeFilter = '1h' | '24h' | '7d'

function getChangeColor(change: number): string {
  if (change > 10) return 'bg-success-400'
  if (change > 5) return 'bg-success-400/80'
  if (change > 2) return 'bg-success-400/60'
  if (change > 0) return 'bg-success-400/40'
  if (change > -2) return 'bg-danger-400/40'
  if (change > -5) return 'bg-danger-400/60'
  if (change > -10) return 'bg-danger-400/80'
  return 'bg-danger-400'
}

function getChangeTextColor(change: number): string {
  if (change > 0) return 'text-emerald-200'
  if (change < 0) return 'text-red-200'
  return 'text-text-secondary'
}

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  return `$${p.toFixed(4)}`
}

interface TreemapRect {
  coin: HeatmapCoin
  x: number
  y: number
  width: number
  height: number
}

function calculateTreemap(coins: HeatmapCoin[], width: number, height: number): TreemapRect[] {
  if (coins.length === 0 || width <= 0 || height <= 0) return []

  const sorted = [...coins].sort((a, b) => b.market_cap - a.market_cap)
  const totalMcap = sorted.reduce((sum, c) => sum + c.market_cap, 0)
  if (totalMcap <= 0) return []

  const rects: TreemapRect[] = []
  let remaining = [...sorted]
  let x = 0, y = 0, w = width, h = height

  while (remaining.length > 0) {
    const isHorizontal = w >= h

    // Take a strip of items
    let stripArea = 0
    const stripItems: HeatmapCoin[] = []
    let bestAspectRatio = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]
      const itemArea = (item.market_cap / totalMcap) * width * height
      stripItems.push(item)
      stripArea += itemArea

      const stripLength = isHorizontal ? stripArea / h : stripArea / w
      let worstAR = 0
      for (const si of stripItems) {
        const siArea = (si.market_cap / totalMcap) * width * height
        const siLen = siArea / stripLength
        const ar = Math.max(stripLength / siLen, siLen / stripLength)
        worstAR = Math.max(worstAR, ar)
      }

      if (worstAR > bestAspectRatio && stripItems.length > 1) {
        stripItems.pop()
        stripArea -= itemArea
        break
      }
      bestAspectRatio = worstAR
    }

    // Layout the strip
    const stripLength = isHorizontal
      ? Math.min(stripArea / h, w)
      : Math.min(stripArea / w, h)

    let offset = 0
    for (const item of stripItems) {
      const itemArea = (item.market_cap / totalMcap) * width * height
      const itemLen = stripLength > 0 ? itemArea / stripLength : 0

      rects.push({
        coin: item,
        x: isHorizontal ? x : x + offset,
        y: isHorizontal ? y + offset : y,
        width: isHorizontal ? stripLength : itemLen,
        height: isHorizontal ? itemLen : stripLength,
      })
      offset += itemLen
    }

    // Update remaining area
    if (isHorizontal) {
      x += stripLength
      w -= stripLength
    } else {
      y += stripLength
      h -= stripLength
    }

    remaining = remaining.slice(stripItems.length)
  }

  return rects
}

export default function TabHeatmap({ onSelectCoin }: TabHeatmapProps) {
  const [coins, setCoins] = useState<HeatmapCoin[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h')
  const [hoveredCoin, setHoveredCoin] = useState<HeatmapCoin | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  // Fetch coin data
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/crypto-terminal/coins?limit=250')
        if (!res.ok) throw new Error('Veri yuklenemedi')
        const data = await res.json()
        // Map terminal format to heatmap format
        const mapped: HeatmapCoin[] = (data.coins || []).map((c: any) => ({
          id: c.id,
          symbol: c.symbol || '',
          name: c.name || '',
          image: c.image || '',
          market_cap: c.marketCap || 0,
          current_price: c.price || 0,
          change1h: c.change1h || 0,
          change24h: c.change24h || 0,
          change7d: c.change7d || 0,
        }))
        setCoins(mapped.filter(c => c.market_cap > 0))
      } catch {
        setCoins([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Track container dimensions
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.height, 400),
        })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const rects = calculateTreemap(coins.slice(0, 80), dimensions.width, dimensions.height)

  const getChangeValue = (coin: HeatmapCoin): number => {
    switch (timeFilter) {
      case '1h': return coin.change1h || 0
      case '24h': return coin.change24h || 0
      case '7d': return coin.change7d || 0
      default: return coin.change24h || 0
    }
  }

  return (
    <div className="space-y-2 sm:space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 size={16} className="text-gold-400" />
          <h3 className="text-sm font-bold text-white">MARKET CAP HEATMAP</h3>
          <span className="text-[10px] text-text-tertiary">Top 80 Coin</span>
        </div>
        <div className="flex items-center gap-1">
          {(['1h', '24h', '7d'] as TimeFilter[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                timeFilter === tf
                  ? 'bg-gold-500/15 text-gold-300 border border-stroke-gold-strong'
                  : 'text-text-tertiary hover:text-text-secondary border border-transparent'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 sm:gap-3 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-danger-400" />
          <span className="text-[9px] text-text-tertiary">&lt;-10%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-danger-400/50" />
          <span className="text-[9px] text-text-tertiary">-5%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-white/10" />
          <span className="text-[9px] text-text-tertiary">0%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-success-400/50" />
          <span className="text-[9px] text-text-tertiary">+5%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-success-400" />
          <span className="text-[9px] text-text-tertiary">&gt;+10%</span>
        </div>
      </div>

      {/* Heatmap */}
      <div
        ref={containerRef}
        className="bg-surface-1 rounded-2xl border border-stroke-subtle relative overflow-hidden hover:border-stroke transition-all duration-300"
        style={{ minHeight: 500 }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-1/90 z-10">
            <div className="w-8 h-8 border-2 border-stroke-gold-strong border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}

        {!loading && rects.length > 0 && (
          <div className="relative" style={{ width: dimensions.width, height: dimensions.height }}>
            {rects.map(rect => {
              const change = getChangeValue(rect.coin)
              const isSmall = rect.width < 60 || rect.height < 40
              const isTiny = rect.width < 40 || rect.height < 30
              return (
                <div
                  key={rect.coin.id}
                  onClick={() => onSelectCoin(rect.coin.id)}
                  onMouseEnter={() => setHoveredCoin(rect.coin)}
                  onMouseLeave={() => setHoveredCoin(null)}
                  className={`absolute border border-[#0d0d14] cursor-pointer transition-all duration-150 hover:brightness-125 hover:z-10 ${getChangeColor(change)} flex flex-col items-center justify-center`}
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                  }}
                >
                  {!isTiny && (
                    <>
                      <span className={`font-bold ${isSmall ? 'text-[8px]' : 'text-[11px]'} text-text-primary`}>
                        {rect.coin.symbol.toUpperCase()}
                      </span>
                      {!isSmall && (
                        <span className={`text-[9px] font-medium ${getChangeTextColor(change)}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(1)}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredCoin && (
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-surface-2 border border-stroke rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 z-20 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-white">{hoveredCoin.symbol.toUpperCase()}</span>
              <span className="text-[10px] text-text-tertiary">{hoveredCoin.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white">{formatPrice(hoveredCoin.current_price)}</span>
              <span className={`text-[10px] font-medium ${getChangeTextColor(getChangeValue(hoveredCoin))}`}>
                {getChangeValue(hoveredCoin) > 0 ? '+' : ''}
                {getChangeValue(hoveredCoin).toFixed(2)}% ({timeFilter})
              </span>
              <span className="text-[9px] text-text-quaternary">MCap: ${(hoveredCoin.market_cap / 1e9).toFixed(1)}B</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
