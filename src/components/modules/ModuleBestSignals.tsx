'use client'

import { useState, useMemo } from 'react'
import { useScanContext, useScan200DContext } from '../Layout'
import { ScanResult, Scan200DResult } from '@/lib/types'

// ═══════════════════════════════════════════════════════════════════
// BEST SIGNALS Module
// 200W + 200D çapraz sinyal analizi - En güçlü 4 sinyal kategorisi
//
// BEST LONG  = Strong Long (200W) + Strong Long (200D) → Altın/Sarı
// BEST SHORT = Strong Short (200W) + Strong Short (200D) → Kırmızı
// HERMES LONG  = Strong Long (200W) + Long (200D) → Yeşil
// HERMES SHORT = Strong Short (200W) + Short (200D) → Turuncu
// ═══════════════════════════════════════════════════════════════════

type BestSignalType = 'best_long' | 'best_short' | 'hermes_long' | 'hermes_short'

interface BestSignalItem {
  symbol: string
  segment: string
  signalType: BestSignalType
  score200w: number
  signal200w: string
  signalType200w: string
  score200d: number
  signal200d: string
  signalType200d: string
  price: number
  changePercent: number
  marketCap: number
  volume: number
  // 200W details
  rsi200w: number
  mfi200w: number
  adx200w: number
  quality200w: number
  // 200D details
  rsi200d: number
  mfi200d: number
  adx200d: number
  quality200d: number
  // Raw results for expanded detail
  raw200w: ScanResult
  raw200d: Scan200DResult
}

const SIGNAL_CONFIG: Record<BestSignalType, {
  label: string
  labelEn: string
  icon: string
  bg: string
  text: string
  border: string
  glow: string
  gradient: string
  badgeBg: string
}> = {
  best_long: {
    label: 'BEST LONG',
    labelEn: 'Perfect Long',
    icon: '👑',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    glow: 'shadow-yellow-500/10',
    gradient: 'from-yellow-500/20 to-amber-500/10',
    badgeBg: 'bg-yellow-500/20',
  },
  best_short: {
    label: 'BEST SHORT',
    labelEn: 'Perfect Short',
    icon: '💎',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/10',
    gradient: 'from-red-500/20 to-rose-500/10',
    badgeBg: 'bg-red-500/20',
  },
  hermes_long: {
    label: 'HERMES LONG',
    labelEn: 'Hermes Long',
    icon: '🟢',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/10',
    gradient: 'from-emerald-500/20 to-green-500/10',
    badgeBg: 'bg-emerald-500/20',
  },
  hermes_short: {
    label: 'HERMES SHORT',
    labelEn: 'Hermes Short',
    icon: '🟠',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    glow: 'shadow-orange-500/10',
    gradient: 'from-orange-500/20 to-amber-500/10',
    badgeBg: 'bg-orange-500/20',
  },
}

function getScoreColor(score: number): string {
  if (score <= 20) return 'text-yellow-400'
  if (score <= 40) return 'text-emerald-400'
  if (score < 60) return 'text-slate-300'
  if (score < 80) return 'text-orange-400'
  return 'text-red-400'
}

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
  return `${mc.toFixed(0)}`
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative w-14 h-1.5 rounded-full bg-gradient-to-r from-yellow-500 via-slate-500 to-red-500 opacity-40">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg"
        style={{ left: `calc(${Math.min(100, Math.max(0, score))}% - 4px)` }}
      />
    </div>
  )
}

function DualScoreDisplay({ score200w, score200d }: { score200w: number; score200d: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <div className="text-[9px] text-white/60 uppercase tracking-wider mb-0.5">200W</div>
        <div className={`font-mono font-bold text-base ${getScoreColor(score200w)}`}>{Math.round(score200w)}</div>
        <ScoreBar score={score200w} />
      </div>
      <div className="text-white/10 text-lg">+</div>
      <div className="text-center">
        <div className="text-[9px] text-white/60 uppercase tracking-wider mb-0.5">200D</div>
        <div className={`font-mono font-bold text-base ${getScoreColor(score200d)}`}>{Math.round(score200d)}</div>
        <ScoreBar score={score200d} />
      </div>
    </div>
  )
}

function SignalCard({ item, expanded, onToggle, onWatchlistToggle, inWatchlist }: {
  item: BestSignalItem
  expanded: boolean
  onToggle: () => void
  onWatchlistToggle: () => void
  inWatchlist: boolean
}) {
  const config = SIGNAL_CONFIG[item.signalType]

  return (
    <div className={`rounded-xl border ${config.border} bg-gradient-to-br ${config.gradient} shadow-lg ${config.glow} transition-all hover:scale-[1.005]`}>
      {/* Main Row */}
      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={onToggle}>
        {/* Watchlist */}
        <button
          onClick={(e) => { e.stopPropagation(); onWatchlistToggle() }}
          className={`p-1 rounded transition-all shrink-0 ${inWatchlist ? 'text-yellow-400' : 'text-white/50 hover:text-white/50'}`}
        >
          {inWatchlist ? '★' : '☆'}
        </button>

        {/* Symbol + Segment */}
        <div className="min-w-[100px]">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white text-base">{item.symbol}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/70">{item.segment}</span>
          </div>
          <div className="text-[10px] text-white/60 mt-0.5">
            ${item.price.toFixed(2)}
            <span className={`ml-2 ${item.changePercent >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
              {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Dual Score */}
        <div className="flex-1 flex justify-center">
          <DualScoreDisplay score200w={item.score200w} score200d={item.score200d} />
        </div>

        {/* RSI */}
        <div className="text-center min-w-[50px] hidden lg:block">
          <div className="text-[9px] text-white/60 uppercase tracking-wider mb-0.5">RSI W</div>
          <div className={`font-mono font-bold text-sm ${item.rsi200w < 30 ? 'text-emerald-400' : item.rsi200w > 70 ? 'text-red-400' : 'text-white/60'}`}>{Math.round(item.rsi200w)}</div>
        </div>
        <div className="text-center min-w-[50px] hidden lg:block">
          <div className="text-[9px] text-white/60 uppercase tracking-wider mb-0.5">RSI D</div>
          <div className={`font-mono font-bold text-sm ${item.rsi200d < 30 ? 'text-emerald-400' : item.rsi200d > 70 ? 'text-red-400' : 'text-white/60'}`}>{Math.round(item.rsi200d)}</div>
        </div>

        {/* Combined Score */}
        <div className="text-center min-w-[60px]">
          <div className="text-[9px] text-white/60 uppercase tracking-wider mb-0.5">Avg</div>
          <div className={`font-mono font-bold text-lg ${getScoreColor((item.score200w + item.score200d) / 2)}`}>
            {Math.round((item.score200w + item.score200d) / 2)}
          </div>
        </div>

        {/* MktCap */}
        <div className="text-right min-w-[60px] hidden md:block">
          <div className="text-[9px] text-white/60 uppercase tracking-wider mb-0.5">MktCap</div>
          <div className="font-mono text-xs text-white/50">{formatMarketCap(item.marketCap)}</div>
        </div>

        {/* Expand arrow */}
        <div className={`text-white/60 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-white/5 px-4 py-4">
          <div className="grid grid-cols-2 gap-6">
            {/* 200W Details */}
            <div className="space-y-3">
              <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                200 HAFTA (Daily)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-white/70">Skor</span><span className={getScoreColor(item.score200w)}>{item.score200w.toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">Sinyal</span><span className="text-white/70">{item.signal200w}</span></div>
                <div className="flex justify-between"><span className="text-white/70">RSI</span><span className={item.rsi200w < 30 ? 'text-emerald-400' : item.rsi200w > 70 ? 'text-red-400' : 'text-white/70'}>{Math.round(item.rsi200w)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">MFI</span><span className={item.mfi200w < 20 ? 'text-emerald-400' : item.mfi200w > 80 ? 'text-red-400' : 'text-white/70'}>{Math.round(item.mfi200w)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">ADX</span><span className="text-white/70">{Math.round(item.adx200w)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">Kalite</span><span className={item.quality200w > 0.9 ? 'text-emerald-400' : item.quality200w < 0.7 ? 'text-red-400' : 'text-yellow-400'}>{item.quality200w.toFixed(2)}</span></div>
              </div>
              {/* Components */}
              <div className="text-[10px] text-white/60 font-semibold uppercase tracking-wider mt-2">Bilesenler</div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div className="text-center p-1.5 rounded bg-white/5">
                  <div className="text-white/60 text-[9px]">52W (70%)</div>
                  <div className={getScoreColor(item.raw200w.hermes.components.point52w)}>{item.raw200w.hermes.components.point52w.toFixed(1)}</div>
                </div>
                <div className="text-center p-1.5 rounded bg-white/5">
                  <div className="text-white/60 text-[9px]">MFI (15%)</div>
                  <div className={getScoreColor(item.raw200w.hermes.components.pointMfi)}>{item.raw200w.hermes.components.pointMfi.toFixed(1)}</div>
                </div>
                <div className="text-center p-1.5 rounded bg-white/5">
                  <div className="text-white/60 text-[9px]">RSI (15%)</div>
                  <div className={getScoreColor(item.raw200w.hermes.components.pointRsi)}>{item.raw200w.hermes.components.pointRsi.toFixed(1)}</div>
                </div>
              </div>
            </div>

            {/* 200D Details */}
            <div className="space-y-3">
              <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                200 GÜN (15dk)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-white/70">Skor</span><span className={getScoreColor(item.score200d)}>{item.score200d.toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">Sinyal</span><span className="text-white/70">{item.signal200d}</span></div>
                <div className="flex justify-between"><span className="text-white/70">RSI</span><span className={item.rsi200d < 30 ? 'text-emerald-400' : item.rsi200d > 70 ? 'text-red-400' : 'text-white/70'}>{Math.round(item.rsi200d)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">MFI</span><span className={item.mfi200d < 20 ? 'text-emerald-400' : item.mfi200d > 80 ? 'text-red-400' : 'text-white/70'}>{Math.round(item.mfi200d)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">ADX</span><span className="text-white/70">{Math.round(item.adx200d)}</span></div>
                <div className="flex justify-between"><span className="text-white/70">Kalite</span><span className={item.quality200d > 0.9 ? 'text-emerald-400' : item.quality200d < 0.7 ? 'text-red-400' : 'text-yellow-400'}>{item.quality200d.toFixed(2)}</span></div>
              </div>
              {/* Components */}
              <div className="text-[10px] text-white/60 font-semibold uppercase tracking-wider mt-2">Bilesenler</div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div className="text-center p-1.5 rounded bg-white/5">
                  <div className="text-white/60 text-[9px]">200D</div>
                  <div className={getScoreColor(item.raw200d.hermes.components.point200d)}>{item.raw200d.hermes.components.point200d.toFixed(1)}</div>
                </div>
                <div className="text-center p-1.5 rounded bg-white/5">
                  <div className="text-white/60 text-[9px]">50D</div>
                  <div className={getScoreColor(item.raw200d.hermes.components.point50d)}>{item.raw200d.hermes.components.point50d.toFixed(1)}</div>
                </div>
                <div className="text-center p-1.5 rounded bg-white/5">
                  <div className="text-white/60 text-[9px]">HalfD</div>
                  <div className={getScoreColor(item.raw200d.hermes.components.pointHalfd)}>{item.raw200d.hermes.components.pointHalfd.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SignalSection({ type, items, expandedRow, setExpandedRow, toggleWatchlistItem, isInWatchlist }: {
  type: BestSignalType
  items: BestSignalItem[]
  expandedRow: string | null
  setExpandedRow: (s: string | null) => void
  toggleWatchlistItem: (s: string) => void
  isInWatchlist: (s: string) => boolean
}) {
  const config = SIGNAL_CONFIG[type]

  return (
    <div>
      {/* Section Header */}
      <div className={`flex items-center gap-3 mb-3 px-1`}>
        <span className="text-xl">{config.icon}</span>
        <div>
          <h3 className={`text-sm font-bold ${config.text}`}>{config.label}</h3>
          <p className="text-[10px] text-white/60">
            {type === 'best_long' && 'Strong Long (200W) + Strong Long (200D)'}
            {type === 'best_short' && 'Strong Short (200W) + Strong Short (200D)'}
            {type === 'hermes_long' && 'Strong Long (200W) + Long (200D)'}
            {type === 'hermes_short' && 'Strong Short (200W) + Short (200D)'}
          </p>
        </div>
        <div className={`ml-auto px-2.5 py-1 rounded-full text-xs font-bold ${config.badgeBg} ${config.text}`}>
          {items.length}
        </div>
      </div>

      {/* Cards */}
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map(item => (
            <SignalCard
              key={item.symbol}
              item={item}
              expanded={expandedRow === `${type}-${item.symbol}`}
              onToggle={() => setExpandedRow(expandedRow === `${type}-${item.symbol}` ? null : `${type}-${item.symbol}`)}
              onWatchlistToggle={() => toggleWatchlistItem(item.symbol)}
              inWatchlist={isInWatchlist(item.symbol)}
            />
          ))}
        </div>
      ) : (
        <div className={`rounded-xl border border-dashed ${config.border} px-4 py-6 text-center`}>
          <span className="text-white/50 text-sm">Bu kategoride sinyal yok</span>
        </div>
      )}
    </div>
  )
}

type SortField = 'score' | 'rsi200w' | 'rsi200d' | 'mfi200w' | 'price' | 'change' | 'marketCap'
type SortDir = 'asc' | 'desc'
type FilterType = 'all' | BestSignalType

function exportBestSignalsCSV(items: BestSignalItem[], filename: string) {
  const headers = ['Symbol', 'Segment', 'Signal', 'Price', 'Change%', 'Score200W', 'Signal200W', 'Score200D', 'Signal200D', 'AvgScore', 'RSI_200W', 'MFI_200W', 'ADX_200W', 'Quality_200W', 'RSI_200D', 'MFI_200D', 'ADX_200D', 'Quality_200D', 'MarketCap']
  const rows = items.map(i => [
    i.symbol, i.segment, SIGNAL_CONFIG[i.signalType].label,
    i.price.toFixed(2), i.changePercent.toFixed(2),
    i.score200w.toFixed(1), i.signal200w,
    i.score200d.toFixed(1), i.signal200d,
    ((i.score200w + i.score200d) / 2).toFixed(1),
    i.rsi200w.toFixed(1), i.mfi200w.toFixed(1), i.adx200w.toFixed(1), i.quality200w.toFixed(2),
    i.rsi200d.toFixed(1), i.mfi200d.toFixed(1), i.adx200d.toFixed(1), i.quality200d.toFixed(2),
    i.marketCap,
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

export default function ModuleBestSignals() {
  const { results: results200w, loading: loading200w, toggleWatchlistItem, isInWatchlist } = useScanContext()
  const { results: results200d, loading: loading200d } = useScan200DContext()

  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'score' ? 'asc' : 'desc') }
  }

  // Cross-reference 200W and 200D results to find best signals
  const bestSignals = useMemo(() => {
    if (results200w.length === 0 || results200d.length === 0) return {
      best_long: [] as BestSignalItem[],
      best_short: [] as BestSignalItem[],
      hermes_long: [] as BestSignalItem[],
      hermes_short: [] as BestSignalItem[],
    }

    // Build 200D lookup by symbol
    const map200d = new Map<string, Scan200DResult>()
    for (const r of results200d) {
      map200d.set(r.symbol, r)
    }

    const bestLong: BestSignalItem[] = []
    const bestShort: BestSignalItem[] = []
    const hermesLong: BestSignalItem[] = []
    const hermesShort: BestSignalItem[] = []

    for (const r200w of results200w) {
      const r200d = map200d.get(r200w.symbol)
      if (!r200d) continue

      const base: Omit<BestSignalItem, 'signalType'> = {
        symbol: r200w.symbol,
        segment: r200w.segment,
        score200w: r200w.hermes.score,
        signal200w: r200w.hermes.signal,
        signalType200w: r200w.hermes.signalType,
        score200d: r200d.hermes.score,
        signal200d: r200d.hermes.signal,
        signalType200d: r200d.hermes.signalType,
        price: r200w.quote?.price || r200w.hermes.price,
        changePercent: r200w.quote?.changePercent || 0,
        marketCap: r200w.quote?.marketCap || 0,
        volume: r200w.quote?.volume || 0,
        rsi200w: r200w.hermes.indicators.rsi,
        mfi200w: r200w.hermes.indicators.mfi,
        adx200w: r200w.hermes.indicators.adx,
        quality200w: r200w.hermes.multipliers.quality,
        rsi200d: r200d.hermes.indicators.rsi,
        mfi200d: r200d.hermes.indicators.mfi,
        adx200d: r200d.hermes.indicators.adx,
        quality200d: r200d.hermes.multipliers.quality,
        raw200w: r200w,
        raw200d: r200d,
      }

      const w = r200w.hermes.signalType
      const d = r200d.hermes.signalType

      // BEST LONG: Strong Long (200W) + Strong Long (200D)
      if (w === 'strong_long' && d === 'strong_long') {
        bestLong.push({ ...base, signalType: 'best_long' })
      }
      // BEST SHORT: Strong Short (200W) + Strong Short (200D)
      else if (w === 'strong_short' && d === 'strong_short') {
        bestShort.push({ ...base, signalType: 'best_short' })
      }
      // HERMES LONG: Strong Long (200W) + Long (200D)
      else if (w === 'strong_long' && d === 'long') {
        hermesLong.push({ ...base, signalType: 'hermes_long' })
      }
      // HERMES SHORT: Strong Short (200W) + Short (200D)
      else if (w === 'strong_short' && d === 'short') {
        hermesShort.push({ ...base, signalType: 'hermes_short' })
      }
    }

    // Sort by average score (longs ascending, shorts descending)
    bestLong.sort((a, b) => (a.score200w + a.score200d) - (b.score200w + b.score200d))
    hermesLong.sort((a, b) => (a.score200w + a.score200d) - (b.score200w + b.score200d))
    bestShort.sort((a, b) => (b.score200w + b.score200d) - (a.score200w + a.score200d))
    hermesShort.sort((a, b) => (b.score200w + b.score200d) - (a.score200w + a.score200d))

    return {
      best_long: bestLong,
      best_short: bestShort,
      hermes_long: hermesLong,
      hermes_short: hermesShort,
    }
  }, [results200w, results200d])

  // Apply search filter
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filterFn = (i: BestSignalItem) => !searchQuery || i.symbol.toLowerCase().includes(q)
    return {
      best_long: bestSignals.best_long.filter(filterFn),
      best_short: bestSignals.best_short.filter(filterFn),
      hermes_long: bestSignals.hermes_long.filter(filterFn),
      hermes_short: bestSignals.hermes_short.filter(filterFn),
    }
  }, [bestSignals, searchQuery])

  // All signals flat list (for flat view when a specific filter is active)
  const allFilteredFlat = useMemo(() => {
    const all = [
      ...filtered.best_long,
      ...filtered.best_short,
      ...filtered.hermes_long,
      ...filtered.hermes_short,
    ]

    // Sort
    const sortFn = (a: BestSignalItem, b: BestSignalItem) => {
      let aVal: number, bVal: number
      switch (sortField) {
        case 'score': aVal = (a.score200w + a.score200d) / 2; bVal = (b.score200w + b.score200d) / 2; break
        case 'rsi200w': aVal = a.rsi200w; bVal = b.rsi200w; break
        case 'rsi200d': aVal = a.rsi200d; bVal = b.rsi200d; break
        case 'mfi200w': aVal = a.mfi200w; bVal = b.mfi200w; break
        case 'price': aVal = a.price; bVal = b.price; break
        case 'change': aVal = a.changePercent; bVal = b.changePercent; break
        case 'marketCap': aVal = a.marketCap; bVal = b.marketCap; break
        default: aVal = (a.score200w + a.score200d) / 2; bVal = (b.score200w + b.score200d) / 2
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    }

    return all.sort(sortFn)
  }, [filtered, sortField, sortDir])

  // Get items for the active filter
  const activeItems = useMemo(() => {
    if (activeFilter === 'all') return allFilteredFlat
    const items = [...filtered[activeFilter]]
    const sortFn = (a: BestSignalItem, b: BestSignalItem) => {
      let aVal: number, bVal: number
      switch (sortField) {
        case 'score': aVal = (a.score200w + a.score200d) / 2; bVal = (b.score200w + b.score200d) / 2; break
        case 'rsi200w': aVal = a.rsi200w; bVal = b.rsi200w; break
        case 'rsi200d': aVal = a.rsi200d; bVal = b.rsi200d; break
        case 'mfi200w': aVal = a.mfi200w; bVal = b.mfi200w; break
        case 'price': aVal = a.price; bVal = b.price; break
        case 'change': aVal = a.changePercent; bVal = b.changePercent; break
        case 'marketCap': aVal = a.marketCap; bVal = b.marketCap; break
        default: aVal = (a.score200w + a.score200d) / 2; bVal = (b.score200w + b.score200d) / 2
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    }
    return items.sort(sortFn)
  }, [activeFilter, filtered, allFilteredFlat, sortField, sortDir])

  const totalSignals = filtered.best_long.length + filtered.best_short.length + filtered.hermes_long.length + filtered.hermes_short.length
  const isLoading = loading200w || loading200d
  const hasData = results200w.length > 0 && results200d.length > 0

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-white/50 ml-0.5">↕</span>
    return <span className="text-blue-400 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-4">
      {/* Header Stats */}
      <div className="bg-[#0A0A10]/80 rounded-xl border border-white/5 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Best Signals
                <span className="text-xs font-normal text-white/60 bg-white/5 px-2 py-0.5 rounded">200W + 200D</span>
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                Her iki modülden çapraz onaylı en güçlü sinyaller
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5">
              {/* ALL button */}
              <button
                onClick={() => setActiveFilter('all')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  activeFilter === 'all'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 ring-1 ring-blue-500/30'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                Tümü <span className="font-mono">{totalSignals}</span>
              </button>

              {(['best_long', 'best_short', 'hermes_long', 'hermes_short'] as BestSignalType[]).map(type => {
                const config = SIGNAL_CONFIG[type]
                const count = filtered[type].length
                const isActive = activeFilter === type
                return (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(prev => prev === type ? 'all' : type)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isActive
                        ? `${config.badgeBg} ${config.border} ${config.text} ring-1 ring-current/30 scale-105`
                        : `${config.badgeBg} ${config.border} ${config.text} opacity-60 hover:opacity-100`
                    }`}
                  >
                    <span>{config.icon}</span>
                    <span>{count}</span>
                  </button>
                )
              })}
            </div>

            <div className="w-px h-8 bg-white/10" />

            {/* Search */}
            <input
              type="text"
              placeholder="Sembol ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 w-36"
            />

            {/* CSV Export */}
            <button
              onClick={() => {
                const items = activeFilter === 'all' ? allFilteredFlat : filtered[activeFilter]
                const name = activeFilter === 'all' ? 'best_signals_all' : `best_signals_${activeFilter}`
                exportBestSignalsCSV(items, name)
              }}
              disabled={totalSignals === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Excel/CSV İndir"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>

            <span className="text-xs text-white/70">{totalSignals} sinyal</span>
          </div>
        </div>

        {/* Data status */}
        {!hasData && !isLoading && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
            Her iki modülün de taranmış olması gerekiyor. Önce 200 HAFTA ve 200 GÜN modüllerinden tarama yapın.
          </div>
        )}
        {hasData && (
          <div className="mt-3 flex items-center gap-4 text-[10px] text-white/60">
            <span>200W: {results200w.length} hisse</span>
            <span>200D: {results200d.length} hisse</span>
            <span>Eşleşen: {Math.min(results200w.length, results200d.length)} hisse</span>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-white/70 animate-pulse">Veriler yükleniyor...</div>
        </div>
      )}

      {/* Sort Controls */}
      {hasData && !isLoading && totalSignals > 0 && (
        <div className="flex items-center gap-2 mb-4 px-1 flex-wrap">
          <span className="text-[10px] text-white/60 uppercase tracking-wider mr-1">Sırala:</span>
          {([
            { field: 'score' as SortField, label: 'Skor' },
            { field: 'rsi200w' as SortField, label: 'RSI 200W' },
            { field: 'rsi200d' as SortField, label: 'RSI 200D' },
            { field: 'mfi200w' as SortField, label: 'MFI' },
            { field: 'price' as SortField, label: 'Fiyat' },
            { field: 'change' as SortField, label: 'Değişim' },
            { field: 'marketCap' as SortField, label: 'Piyasa Değeri' },
          ]).map(({ field, label }) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                sortField === field
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'bg-white/5 border-white/5 text-white/70 hover:text-white/60 hover:bg-white/10'
              }`}
            >
              {label} <SortIcon field={field} />
            </button>
          ))}
        </div>
      )}

      {/* Signal Sections - Grid view for 'all', Flat view for specific filter */}
      {hasData && !isLoading && activeFilter === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BEST LONG - Gold */}
          <SignalSection
            type="best_long"
            items={filtered.best_long}
            expandedRow={expandedRow}
            setExpandedRow={setExpandedRow}
            toggleWatchlistItem={toggleWatchlistItem}
            isInWatchlist={isInWatchlist}
          />

          {/* BEST SHORT - Red */}
          <SignalSection
            type="best_short"
            items={filtered.best_short}
            expandedRow={expandedRow}
            setExpandedRow={setExpandedRow}
            toggleWatchlistItem={toggleWatchlistItem}
            isInWatchlist={isInWatchlist}
          />

          {/* HERMES LONG - Green */}
          <SignalSection
            type="hermes_long"
            items={filtered.hermes_long}
            expandedRow={expandedRow}
            setExpandedRow={setExpandedRow}
            toggleWatchlistItem={toggleWatchlistItem}
            isInWatchlist={isInWatchlist}
          />

          {/* HERMES SHORT - Orange */}
          <SignalSection
            type="hermes_short"
            items={filtered.hermes_short}
            expandedRow={expandedRow}
            setExpandedRow={setExpandedRow}
            toggleWatchlistItem={toggleWatchlistItem}
            isInWatchlist={isInWatchlist}
          />
        </div>
      )}

      {/* Flat filtered view when a specific signal type is selected */}
      {hasData && !isLoading && activeFilter !== 'all' && (
        <div>
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <span className="text-xl">{SIGNAL_CONFIG[activeFilter].icon}</span>
            <div>
              <h3 className={`text-sm font-bold ${SIGNAL_CONFIG[activeFilter].text}`}>{SIGNAL_CONFIG[activeFilter].label}</h3>
              <p className="text-[10px] text-white/60">
                {activeFilter === 'best_long' && 'Strong Long (200W) + Strong Long (200D)'}
                {activeFilter === 'best_short' && 'Strong Short (200W) + Strong Short (200D)'}
                {activeFilter === 'hermes_long' && 'Strong Long (200W) + Long (200D)'}
                {activeFilter === 'hermes_short' && 'Strong Short (200W) + Short (200D)'}
              </p>
            </div>
            <div className={`ml-auto px-2.5 py-1 rounded-full text-xs font-bold ${SIGNAL_CONFIG[activeFilter].badgeBg} ${SIGNAL_CONFIG[activeFilter].text}`}>
              {activeItems.length}
            </div>
          </div>

          {/* Table-like header for flat view */}
          {activeItems.length > 0 && (
            <div className="hidden lg:grid grid-cols-[40px_120px_1fr_80px_80px_80px_80px_80px_30px] gap-2 px-4 py-2 text-[9px] text-white/60 uppercase tracking-wider border-b border-white/5 mb-2">
              <div></div>
              <div>Sembol</div>
              <div className="text-center">200W + 200D</div>
              <div className="text-center cursor-pointer hover:text-white/50" onClick={() => handleSort('rsi200w')}>RSI 200W <SortIcon field="rsi200w" /></div>
              <div className="text-center cursor-pointer hover:text-white/50" onClick={() => handleSort('rsi200d')}>RSI 200D <SortIcon field="rsi200d" /></div>
              <div className="text-center cursor-pointer hover:text-white/50" onClick={() => handleSort('score')}>Avg <SortIcon field="score" /></div>
              <div className="text-center cursor-pointer hover:text-white/50" onClick={() => handleSort('change')}>Değişim <SortIcon field="change" /></div>
              <div className="text-right cursor-pointer hover:text-white/50" onClick={() => handleSort('marketCap')}>MktCap <SortIcon field="marketCap" /></div>
              <div></div>
            </div>
          )}

          {activeItems.length > 0 ? (
            <div className="space-y-2">
              {activeItems.map(item => (
                <SignalCard
                  key={item.symbol}
                  item={item}
                  expanded={expandedRow === `${activeFilter}-${item.symbol}`}
                  onToggle={() => setExpandedRow(expandedRow === `${activeFilter}-${item.symbol}` ? null : `${activeFilter}-${item.symbol}`)}
                  onWatchlistToggle={() => toggleWatchlistItem(item.symbol)}
                  inWatchlist={isInWatchlist(item.symbol)}
                />
              ))}
            </div>
          ) : (
            <div className={`rounded-xl border border-dashed ${SIGNAL_CONFIG[activeFilter].border} px-4 py-6 text-center`}>
              <span className="text-white/50 text-sm">Bu kategoride sinyal yok</span>
            </div>
          )}
        </div>
      )}

      {/* Empty state when data exists but no signals */}
      {hasData && !isLoading && totalSignals === 0 && !searchQuery && (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-white/60 mb-2">Sinyal Bulunamadı</h3>
          <p className="text-sm text-white/60 max-w-md mx-auto">
            200W ve 200D modülleri arasında çapraz onaylı sinyal yok.
            Her iki modülde de Strong Long/Short veya Strong + Long/Short olması gerekiyor.
          </p>
        </div>
      )}
    </div>
  )
}
