'use client'

// HERMES AI CRYPTO TERMINAL — Tab: COINLER
// Top coins table with HERMES AI scoring, sparkline, watchlist, signal labels

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, Search, Zap, AlertTriangle, Minus, ChevronLeft, ChevronRight, Star, X, Crown, Gem, Layers, Coins, Activity, Flame, BarChart3, Eye } from 'lucide-react'
// HERMES_FIX: CLIENT_BUNDLE_WEIGHTS 2026-02-19 — Removed CRYPTO_SCORE_WEIGHTS import (proprietary IP)
import { CryptoTerminalCoin, CryptoScoreLevel, CryptoScoreBreakdown, CRYPTO_SCORE_LABELS, CRYPTO_CATEGORY_LABELS, CRYPTO_CATEGORY_KEYS } from '@/lib/crypto-terminal/coingecko-types'
import { getCoinCategories, getCategoryStyle, inferCategoryFromName, CryptoCategory } from '@/lib/crypto-terminal/crypto-categories'

interface TabCoinsProps {
  onSelectCoin: (id: string) => void
  onViewChart: (id: string) => void
  onAddToCompare: (id: string) => void
}

type SortField = 'marketCapRank' | 'price' | 'change1h' | 'change24h' | 'change7d' | 'change30d' | 'marketCap' | 'volume24h' | 'volumeToMcap' | 'score' | 'confidence' | 'supplyRatio' | 'fdvMcap' | 'risk' | 'tvl' | 'valuation'
type SortDir = 'asc' | 'desc'

const CRYPTO_WATCHLIST_KEY = 'hermes_crypto_watchlist'

function getCryptoWatchlist(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const d = localStorage.getItem(CRYPTO_WATCHLIST_KEY)
    return d ? JSON.parse(d) : []
  } catch { return [] }
}

function toggleCryptoWatchlist(id: string): string[] {
  const list = getCryptoWatchlist()
  const idx = list.indexOf(id)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(id)
  localStorage.setItem(CRYPTO_WATCHLIST_KEY, JSON.stringify(list))
  return [...list]
}

const SIGNAL_CONFIG: Record<CryptoScoreLevel, { color: string; icon: React.ReactNode; label: string; badge: string }> = {
  STRONG: { color: 'text-amber-400 bg-amber-500/12 border-amber-500/25', icon: <Zap size={11} />, label: 'GUCLU', badge: 'text-amber-400' },
  GOOD: { color: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25', icon: <TrendingUp size={11} />, label: 'IYI', badge: 'text-emerald-400' },
  NEUTRAL: { color: 'text-slate-300 bg-white/[0.04] border-white/[0.08]', icon: <Minus size={11} />, label: 'NOTR', badge: 'text-slate-400' },
  WEAK: { color: 'text-orange-400 bg-orange-500/12 border-orange-500/25', icon: <AlertTriangle size={11} />, label: 'ZAYIF', badge: 'text-orange-400' },
  BAD: { color: 'text-red-400 bg-red-500/12 border-red-500/25', icon: <TrendingDown size={11} />, label: 'KOTU', badge: 'text-red-400' },
}

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  if (p >= 0.0001) return `$${p.toFixed(6)}`
  return `$${p.toFixed(8)}`
}

function formatMcap(v: number): string {
  if (!v) return '-'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

function computeSupplyRatio(c: CryptoTerminalCoin): number {
  if (!c.totalSupply || c.totalSupply <= 0 || c.circulatingSupply <= 0) return 0
  return Math.min(100, (c.circulatingSupply / c.totalSupply) * 100)
}

function computeFdvMcap(c: CryptoTerminalCoin): number {
  if (!c.fdv || c.fdv <= 0 || c.marketCap <= 0) return 0
  return c.fdv / c.marketCap
}

function computeRiskScore(c: CryptoTerminalCoin): number {
  let risk = 50
  const volMc = c.marketCap > 0 ? c.volume24h / c.marketCap : 0
  if (volMc < 0.01) risk += 15
  else if (volMc > 0.5) risk += 10
  const fdvR = computeFdvMcap(c)
  if (fdvR > 5) risk += 15
  else if (fdvR > 3) risk += 10
  else if (fdvR > 0 && fdvR < 1.5) risk -= 10
  const athDist = Math.abs(c.athChangePercent ?? 0)
  if (athDist > 90) risk += 10
  else if (athDist < 10) risk -= 5
  if (c.marketCap >= 10e9) risk -= 15
  else if (c.marketCap >= 1e9) risk -= 8
  else if (c.marketCap < 10e6) risk += 12
  return Math.max(0, Math.min(100, risk))
}

type ValuationLabel = 'COK UCUZ' | 'UCUZ' | 'NORMAL' | 'PAHALI' | 'COK PAHALI' | ''
function computeValuation(c: CryptoTerminalCoin): ValuationLabel {
  const fdvR = computeFdvMcap(c)
  const athDist = Math.abs(c.athChangePercent ?? 0)
  const supRatio = computeSupplyRatio(c)
  if (fdvR > 0 && fdvR < 1.2 && athDist > 70 && supRatio > 70) return 'COK UCUZ'
  if (fdvR > 0 && fdvR < 1.5 && athDist > 50) return 'UCUZ'
  if (fdvR > 5 || athDist < 3) return 'COK PAHALI'
  if (fdvR > 3 || athDist < 10) return 'PAHALI'
  return 'NORMAL'
}

type MaturityLabel = 'OLGUN' | 'GELISEN' | 'GENC' | 'YENI' | ''
function computeMaturity(c: CryptoTerminalCoin): { score: number; label: MaturityLabel } {
  let score = 0
  if (c.athDate) {
    const ageYears = (Date.now() - new Date(c.athDate).getTime()) / (365.25 * 86400000)
    if (ageYears >= 5) score += 35
    else if (ageYears >= 3) score += 25
    else if (ageYears >= 1) score += 15
    else score += 5
  }
  if (c.marketCap >= 10e9) score += 30
  else if (c.marketCap >= 1e9) score += 22
  else if (c.marketCap >= 100e6) score += 12
  else score += 3
  const sr = computeSupplyRatio(c)
  if (sr >= 80) score += 20
  else if (sr >= 50) score += 12
  else if (sr > 0) score += 5
  if (c.marketCapRank <= 20) score += 15
  else if (c.marketCapRank <= 100) score += 10
  else if (c.marketCapRank <= 500) score += 5
  const final = Math.min(100, score)
  let label: MaturityLabel = ''
  if (final >= 75) label = 'OLGUN'
  else if (final >= 50) label = 'GELISEN'
  else if (final >= 25) label = 'GENC'
  else label = 'YENI'
  return { score: final, label }
}

const MATURITY_COLOR: Record<MaturityLabel, string> = {
  'OLGUN': 'text-emerald-400',
  'GELISEN': 'text-blue-400',
  'GENC': 'text-amber-400',
  'YENI': 'text-red-400',
  '': 'text-white/40',
}

function valuationRank(v: ValuationLabel): number {
  switch (v) {
    case 'COK UCUZ': return 1
    case 'UCUZ': return 2
    case 'NORMAL': return 3
    case 'PAHALI': return 4
    case 'COK PAHALI': return 5
    default: return 3
  }
}

const VALUATION_STYLE: Record<ValuationLabel, string> = {
  'COK UCUZ': 'text-emerald-300 bg-emerald-500/15',
  'UCUZ': 'text-emerald-400 bg-emerald-500/10',
  'NORMAL': 'text-slate-300 bg-white/[0.04]',
  'PAHALI': 'text-orange-400 bg-orange-500/10',
  'COK PAHALI': 'text-red-400 bg-red-500/10',
  '': 'text-white/40',
}

function CoinCategoryTags({ coin }: { coin: CryptoTerminalCoin }) {
  const cats = getCoinCategories(coin.id)
  const tags: CryptoCategory[] = cats.length > 0 ? cats : inferCategoryFromName(coin.name, coin.symbol)
  const mat = computeMaturity(coin)
  if (tags.length === 0 && !mat.label) return null
  return (
    <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
      {tags.slice(0, 2).map(t => {
        const s = getCategoryStyle(t)
        return <span key={t} className={`text-[8px] font-bold px-1 py-px rounded ${s.bg} ${s.text}`}>{t}</span>
      })}
      {mat.label && (
        <span className={`text-[7px] font-bold px-1 py-px rounded bg-white/[0.03] ${MATURITY_COLOR[mat.label]}`}>{mat.label}</span>
      )}
    </div>
  )
}

// HERMES_FIX: S1-UI 2026-02-19 SEVERITY: HIGH
// Score breakdown popup removed from bulk list — category data is proprietary IP.
// Full breakdown is available on the detail page (/coin/[id]) only.
function ScoreWithBreakdown({ coin, sigCfg }: { coin: CryptoTerminalCoin; sigCfg: { badge: string } }) {
  return (
    <div className="relative inline-block">
      <span className={`text-[11px] font-bold tabular-nums ${sigCfg.badge}`}>
        {coin.score!.total}
      </span>
      {coin.score!.degraded && (
        <span className="ml-0.5 text-[8px] text-orange-400/50" title="Eksik veri — skor yaklasik">~</span>
      )}
    </div>
  )
}

function ChangeCell({ value }: { value: number }) {
  if (value == null) return <span className="text-white/40">-</span>
  const isPos = value > 0
  return (
    <span className={`text-xs tabular-nums font-medium ${isPos ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-white/40'}`}>
      {isPos ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 72
  const h = 22
  const step = Math.max(1, Math.floor(data.length / 30))
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1)
  const points = sampled.map((v, i) => {
    const x = (i / (sampled.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="inline-block w-full h-auto min-w-0" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={isPositive ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function TabCoins({ onSelectCoin, onViewChart, onAddToCompare }: TabCoinsProps) {
  const [coins, setCoins] = useState<CryptoTerminalCoin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('marketCapRank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [serverPage, setServerPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalEstimate, setTotalEstimate] = useState(0)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [signalFilter, setSignalFilter] = useState<CryptoScoreLevel | null>(null)
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [fearGreed, setFearGreed] = useState<{ index: number; label: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadFG() {
      try {
        const res = await fetch('/api/crypto-terminal/market')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.fearGreed) setFearGreed({ index: data.fearGreed.index, label: data.fearGreed.label })
      } catch { /* silent */ }
    }
    loadFG()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setWatchlist(getCryptoWatchlist())
    const onStorage = (e: StorageEvent) => {
      if (e.key === CRYPTO_WATCHLIST_KEY && e.newValue) {
        try { setWatchlist(JSON.parse(e.newValue)) } catch { /* */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Fetch 1000 coins per server page (cached 1h on backend, 24h on disk)
  useEffect(() => {
    let cancelled = false

    async function loadPage(pg: number) {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/crypto-terminal/coins?page=${pg}`)
        if (!res.ok) throw new Error('Coin verisi yuklenemedi')
        const data = await res.json()
        if (cancelled) return
        setCoins(data.coins || [])
        setTotalPages(data.totalPages || 1)
        setTotalEstimate(data.totalEstimate || 0)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
          setLoading(false)
        }
      }
    }

    loadPage(serverPage)
    return () => { cancelled = true }
  }, [serverPage])

  // Signal counts for filter cards — computed from ALL loaded coins
  const signalCounts = useMemo(() => {
    const counts: Record<CryptoScoreLevel, number> = { STRONG: 0, GOOD: 0, NEUTRAL: 0, WEAK: 0, BAD: 0 }
    for (const c of coins) {
      const level = c.score?.level ?? 'NEUTRAL'
      counts[level]++
    }
    return counts
  }, [coins])

  // Quick filter counts
  const quickFilterCounts = useMemo(() => {
    let mega = 0, large = 0, mid = 0, small = 0, micro = 0
    let bullish24 = 0, bearish24 = 0, volSpike = 0, watchCount = 0, newAth = 0
    for (const c of coins) {
      const mc = c.marketCap ?? 0
      if (mc >= 10e9) mega++
      else if (mc >= 1e9) large++
      else if (mc >= 100e6) mid++
      else if (mc >= 10e6) small++
      else micro++

      if (c.change24h > 5) bullish24++
      if (c.change24h < -5) bearish24++
      if (mc > 0 && c.volume24h / mc > 0.3) volSpike++
      if (watchlist.includes(c.id)) watchCount++
      if (c.athChangePercent != null && c.athChangePercent > -1) newAth++
    }
    return { mega, large, mid, small, micro, bullish24, bearish24, volSpike, watchCount, newAth }
  }, [coins, watchlist])

  // Client-side filtering and sorting of current page data
  const filtered = useMemo(() => {
    let result = [...coins]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    }
    if (signalFilter) {
      result = result.filter(c => (c.score?.level ?? 'NEUTRAL') === signalFilter)
    }
    if (quickFilter) {
      result = result.filter(c => {
        const mc = c.marketCap ?? 0
        switch (quickFilter) {
          case 'mega': return mc >= 10e9
          case 'large': return mc >= 1e9 && mc < 10e9
          case 'mid': return mc >= 100e6 && mc < 1e9
          case 'small': return mc >= 10e6 && mc < 100e6
          case 'micro': return mc < 10e6
          case 'bullish24': return c.change24h > 5
          case 'bearish24': return c.change24h < -5
          case 'volSpike': return mc > 0 && c.volume24h / mc > 0.3
          case 'watchlist': return watchlist.includes(c.id)
          case 'newAth': return c.athChangePercent != null && c.athChangePercent > -1
          default: return true
        }
      })
    }
    result.sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortField) {
        case 'score': aVal = a.score?.total ?? 0; bVal = b.score?.total ?? 0; break
        case 'confidence': aVal = a.score?.confidence ?? 0; bVal = b.score?.confidence ?? 0; break
        case 'supplyRatio': aVal = computeSupplyRatio(a); bVal = computeSupplyRatio(b); break
        case 'fdvMcap': aVal = computeFdvMcap(a); bVal = computeFdvMcap(b); break
        case 'risk': aVal = computeRiskScore(a); bVal = computeRiskScore(b); break
        case 'tvl': aVal = a.tvl ?? 0; bVal = b.tvl ?? 0; break
        case 'valuation': aVal = valuationRank(computeValuation(a)); bVal = valuationRank(computeValuation(b)); break
        default: aVal = (a[sortField] as number) ?? 0; bVal = (b[sortField] as number) ?? 0
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return result
  }, [coins, search, sortField, sortDir, signalFilter, quickFilter, watchlist])

  // No client-side pagination — show all 1000 filtered coins on the page
  // Server handles pagination (1000 coins per page)

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'marketCapRank' ? 'asc' : 'desc')
    }
  }, [sortField])

  const handleToggleWatch = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setWatchlist(toggleCryptoWatchlist(id))
  }, [])

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-12 bg-white/[0.02] rounded-lg animate-pulse" />
      ))}
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <span className="text-2xl sm:text-3xl mb-2 sm:mb-3">&#9888;</span>
      <p className="text-white/60 text-sm">{error}</p>
    </div>
  )

  const SortHeader = ({ field, children, className = '', align = 'left', tip }: { field: SortField; children: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; tip?: string }) => (
    <th
      className={`py-2.5 text-[10px] font-bold text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/60 transition-colors whitespace-nowrap ${className}`}
      onClick={() => handleSort(field)}
      title={tip}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {children}
        {sortField === field && <span className="text-amber-400">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
      </div>
    </th>
  )

  const SIGNAL_CARDS: { level: CryptoScoreLevel; label: string; color: string; glow: string; border: string; activeBorder: string; bg: string; activeBg: string; iconBg: string }[] = [
    { level: 'STRONG', label: 'GUCLU', color: 'text-amber-300', glow: 'shadow-amber-500/25', border: 'border-amber-500/25', activeBorder: 'border-amber-400/50', bg: 'bg-gradient-to-br from-amber-500/10 to-amber-600/5', activeBg: 'bg-gradient-to-br from-amber-500/25 to-amber-600/15', iconBg: 'bg-amber-500/20' },
    { level: 'GOOD', label: 'IYI', color: 'text-emerald-300', glow: 'shadow-emerald-500/25', border: 'border-emerald-500/25', activeBorder: 'border-emerald-400/50', bg: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5', activeBg: 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/15', iconBg: 'bg-emerald-500/20' },
    { level: 'NEUTRAL', label: 'NOTR', color: 'text-slate-300', glow: 'shadow-slate-500/20', border: 'border-white/10', activeBorder: 'border-white/25', bg: 'bg-gradient-to-br from-slate-500/8 to-slate-600/5', activeBg: 'bg-gradient-to-br from-slate-500/20 to-slate-600/10', iconBg: 'bg-white/[0.08]' },
    { level: 'WEAK', label: 'ZAYIF', color: 'text-orange-300', glow: 'shadow-orange-500/25', border: 'border-orange-500/25', activeBorder: 'border-orange-400/50', bg: 'bg-gradient-to-br from-orange-500/10 to-orange-600/5', activeBg: 'bg-gradient-to-br from-orange-500/25 to-orange-600/15', iconBg: 'bg-orange-500/20' },
    { level: 'BAD', label: 'KOTU', color: 'text-red-300', glow: 'shadow-red-500/25', border: 'border-red-500/25', activeBorder: 'border-red-400/50', bg: 'bg-gradient-to-br from-red-500/10 to-red-600/5', activeBg: 'bg-gradient-to-br from-red-500/25 to-red-600/15', iconBg: 'bg-red-500/20' },
  ]

  return (
    <div className="space-y-2 sm:space-y-3 animate-fade-in">
      {/* Signal Filter Cards — Premium Glow */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
        {SIGNAL_CARDS.map(card => {
          const count = signalCounts[card.level]
          const isActive = signalFilter === card.level
          const icon = SIGNAL_CONFIG[card.level].icon
          return (
            <button
              key={card.level}
              onClick={() => setSignalFilter(isActive ? null : card.level)}
              className={`group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer
                ${isActive
                  ? `${card.activeBg} ${card.activeBorder} shadow-lg ${card.glow} scale-[1.03]`
                  : `${card.bg} ${card.border} hover:shadow-md hover:${card.glow} hover:scale-[1.02]`
                }`}
            >
              <div className="px-2 sm:px-3 py-2 sm:py-3 flex items-center gap-2 sm:gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg} ${card.color} shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className={`text-[10px] font-bold tracking-wider ${card.color} ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>{card.label}</div>
                  <div className={`text-base sm:text-xl font-black tabular-nums leading-tight ${card.color} ${isActive ? 'opacity-100' : 'opacity-70'}`}>{count}</div>
                </div>
              </div>
              {isActive && <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 pointer-events-none" />}
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} style={{ background: `linear-gradient(to right, transparent, var(--tw-shadow-color, rgba(255,255,255,0.2)), transparent)` }} />
            </button>
          )
        })}
      </div>

      {/* Quick Filters — Market Cap & Trend — Colorful & Bold */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {([
          { id: 'mega', label: 'Mega Cap', sub: '$10B+', count: quickFilterCounts.mega, icon: <Crown size={13} />, color: 'text-violet-300', glow: 'shadow-violet-500/30', border: 'border-violet-500/30', activeBorder: 'border-violet-400/60', bg: 'bg-gradient-to-r from-violet-500/15 to-violet-600/10', activeBg: 'bg-gradient-to-r from-violet-500/30 to-violet-600/20', iconBg: 'bg-violet-500/20' },
          { id: 'large', label: 'Large Cap', sub: '$1-10B', count: quickFilterCounts.large, icon: <Gem size={13} />, color: 'text-blue-300', glow: 'shadow-blue-500/30', border: 'border-blue-500/30', activeBorder: 'border-blue-400/60', bg: 'bg-gradient-to-r from-blue-500/15 to-blue-600/10', activeBg: 'bg-gradient-to-r from-blue-500/30 to-blue-600/20', iconBg: 'bg-blue-500/20' },
          { id: 'mid', label: 'Mid Cap', sub: '$100M-1B', count: quickFilterCounts.mid, icon: <Layers size={13} />, color: 'text-cyan-300', glow: 'shadow-cyan-500/30', border: 'border-cyan-500/30', activeBorder: 'border-cyan-400/60', bg: 'bg-gradient-to-r from-cyan-500/15 to-cyan-600/10', activeBg: 'bg-gradient-to-r from-cyan-500/30 to-cyan-600/20', iconBg: 'bg-cyan-500/20' },
          { id: 'small', label: 'Small Cap', sub: '$10-100M', count: quickFilterCounts.small, icon: <Coins size={13} />, color: 'text-teal-300', glow: 'shadow-teal-500/30', border: 'border-teal-500/30', activeBorder: 'border-teal-400/60', bg: 'bg-gradient-to-r from-teal-500/15 to-teal-600/10', activeBg: 'bg-gradient-to-r from-teal-500/30 to-teal-600/20', iconBg: 'bg-teal-500/20' },
          { id: 'micro', label: 'Micro Cap', sub: '<$10M', count: quickFilterCounts.micro, icon: <Activity size={13} />, color: 'text-pink-300', glow: 'shadow-pink-500/30', border: 'border-pink-500/30', activeBorder: 'border-pink-400/60', bg: 'bg-gradient-to-r from-pink-500/15 to-pink-600/10', activeBg: 'bg-gradient-to-r from-pink-500/30 to-pink-600/20', iconBg: 'bg-pink-500/20' },
          { id: 'bullish24', label: 'Yukselis', sub: '24s >+5%', count: quickFilterCounts.bullish24, icon: <TrendingUp size={13} />, color: 'text-emerald-300', glow: 'shadow-emerald-500/30', border: 'border-emerald-500/30', activeBorder: 'border-emerald-400/60', bg: 'bg-gradient-to-r from-emerald-500/15 to-emerald-600/10', activeBg: 'bg-gradient-to-r from-emerald-500/30 to-emerald-600/20', iconBg: 'bg-emerald-500/20' },
          { id: 'bearish24', label: 'Dusus', sub: '24s <-5%', count: quickFilterCounts.bearish24, icon: <TrendingDown size={13} />, color: 'text-red-300', glow: 'shadow-red-500/30', border: 'border-red-500/30', activeBorder: 'border-red-400/60', bg: 'bg-gradient-to-r from-red-500/15 to-red-600/10', activeBg: 'bg-gradient-to-r from-red-500/30 to-red-600/20', iconBg: 'bg-red-500/20' },
          { id: 'volSpike', label: 'Hacim Patlamasi', sub: 'Vol/MC >30%', count: quickFilterCounts.volSpike, icon: <Flame size={13} />, color: 'text-orange-300', glow: 'shadow-orange-500/30', border: 'border-orange-500/30', activeBorder: 'border-orange-400/60', bg: 'bg-gradient-to-r from-orange-500/15 to-orange-600/10', activeBg: 'bg-gradient-to-r from-orange-500/30 to-orange-600/20', iconBg: 'bg-orange-500/20' },
          { id: 'newAth', label: 'ATH Yakin', sub: 'Zirveye <1%', count: quickFilterCounts.newAth, icon: <BarChart3 size={13} />, color: 'text-amber-300', glow: 'shadow-amber-500/30', border: 'border-amber-500/30', activeBorder: 'border-amber-400/60', bg: 'bg-gradient-to-r from-amber-500/15 to-amber-600/10', activeBg: 'bg-gradient-to-r from-amber-500/30 to-amber-600/20', iconBg: 'bg-amber-500/20' },
          { id: 'watchlist', label: 'Izleme', sub: 'Favoriler', count: quickFilterCounts.watchCount, icon: <Eye size={13} />, color: 'text-yellow-300', glow: 'shadow-yellow-500/30', border: 'border-yellow-500/30', activeBorder: 'border-yellow-400/60', bg: 'bg-gradient-to-r from-yellow-500/15 to-yellow-600/10', activeBg: 'bg-gradient-to-r from-yellow-500/30 to-yellow-600/20', iconBg: 'bg-yellow-500/20' },
        ] as const).map(f => {
          const isActive = quickFilter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setQuickFilter(isActive ? null : f.id)}
              className={`group relative inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] font-semibold border transition-all duration-300 cursor-pointer
                ${isActive
                  ? `${f.activeBg} ${f.activeBorder} ${f.color} shadow-lg ${f.glow} scale-[1.03]`
                  : `${f.bg} ${f.border} ${f.color} opacity-70 hover:opacity-100 hover:shadow-md hover:${f.glow} hover:scale-[1.02]`
                }`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${f.iconBg} transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {f.icon}
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[11px] font-bold">{f.label}</span>
                <span className="text-[8px] opacity-50 font-normal">{f.sub}</span>
              </span>
              <span className={`text-sm font-black tabular-nums ml-0.5 ${isActive ? 'opacity-100' : 'opacity-60'}`}>{f.count}</span>
              {isActive && <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 pointer-events-none" />}
            </button>
          )
        })}
      </div>

      {/* Active filter indicator */}
      {(signalFilter || quickFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          {signalFilter && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${SIGNAL_CONFIG[signalFilter].color}`}>
              {SIGNAL_CONFIG[signalFilter].icon}
              {SIGNAL_CONFIG[signalFilter].label}
              <button onClick={() => setSignalFilter(null)} className="ml-1 hover:text-white"><X size={10} /></button>
            </span>
          )}
          {quickFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-white/10 bg-white/[0.04] text-white/60">
              {quickFilter}
              <button onClick={() => setQuickFilter(null)} className="ml-1 hover:text-white"><X size={10} /></button>
            </span>
          )}
          <button
            onClick={() => { setSignalFilter(null); setQuickFilter(null) }}
            className="text-[10px] text-white/40 hover:text-white/60 underline transition-colors"
          >
            Tum filtreleri kaldir
          </button>
          <span className="text-[11px] text-white/40 ml-auto tabular-nums">{filtered.length} sonuc</span>
        </div>
      )}

      {/* Search & info bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <CoinSearchInput
          search={search}
          setSearch={(v) => { setSearch(v) }}
          onSelectCoin={onSelectCoin}
          localCount={filtered.length}
        />
        <div className="flex items-center gap-3">
          {fearGreed && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
              fearGreed.index >= 70 ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' :
              fearGreed.index >= 55 ? 'text-green-300 border-green-500/20 bg-green-500/10' :
              fearGreed.index >= 45 ? 'text-slate-300 border-white/10 bg-white/[0.04]' :
              fearGreed.index >= 30 ? 'text-orange-300 border-orange-500/20 bg-orange-500/10' :
              'text-red-300 border-red-500/20 bg-red-500/10'
            }`} title="Crypto Fear & Greed Index">
              <Activity size={11} />
              F&G: {fearGreed.index} — {fearGreed.label}
            </span>
          )}
          <span className="text-[11px] text-white/35">{filtered.length.toLocaleString()} / {coins.length.toLocaleString()} coin</span>
          <span className="text-[11px] text-white/35">Sayfa {serverPage} / {totalPages} ({totalEstimate.toLocaleString()} toplam)</span>
        </div>
      </div>

      {/* Top Pagination */}
      <PaginationControls serverPage={serverPage} totalPages={totalPages} totalEstimate={totalEstimate} filteredCount={filtered.length} onPageChange={setServerPage} />

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-1.5 sm:space-y-2">
        {filtered.map(coin => {
          const scoreLevel = coin.score?.level ?? 'NEUTRAL'
          const sigCfg = SIGNAL_CONFIG[scoreLevel]
          const isWatched = watchlist.includes(coin.id)
          return (
            <div
              key={coin.id}
              onClick={() => onSelectCoin(coin.id)}
              className="bg-[#151520] rounded-xl border border-white/[0.06] p-2.5 sm:p-3 active:bg-white/[0.04] cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button onClick={(e) => handleToggleWatch(e, coin.id)} className="p-0.5">
                    <Star size={14} className={isWatched ? 'text-amber-400 fill-amber-400' : 'text-white/35'} />
                  </button>
                  <img src={coin.image} alt={coin.symbol} className="w-6 h-6 rounded-full" loading="lazy" />
                  <div>
                    <span className="text-sm font-bold text-white">{coin.symbol.toUpperCase()}</span>
                    <span className="text-[10px] text-white/40 ml-1.5">#{coin.marketCapRank}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white tabular-nums">{formatPrice(coin.price)}</div>
                  <ChangeCell value={coin.change24h} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <span>MCap: {formatMcap(coin.marketCap)}</span>
                  <span>Vol: {formatMcap(coin.volume24h)}</span>
                </div>
                {coin.score && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sigCfg.color}`}>
                    {sigCfg.icon} {sigCfg.label} {coin.score.total}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed">
          <colgroup>
            {/* Star */}<col style={{ width: '2%' }} />
            {/* # */}<col style={{ width: '2.5%' }} />
            {/* Coin */}<col style={{ width: '10%' }} />
            {/* Fiyat */}<col style={{ width: '7%' }} />
            {/* Sinyal */}<col style={{ width: '7%' }} />
            {/* Skor */}<col style={{ width: '3%' }} />
            {/* Guven */}<col style={{ width: '4%' }} />
            {/* Fiyatlama */}<col style={{ width: '5.5%' }} />
            {/* Risk */}<col style={{ width: '3.5%' }} />
            {/* Overval */}<col style={{ width: '4.5%' }} />
            {/* CHI */}<col style={{ width: '4%' }} />
            {/* 1s */}<col style={{ width: '4.5%' }} />
            {/* 24s */}<col style={{ width: '4.5%' }} />
            {/* 7g */}<col style={{ width: '4.5%' }} />
            {/* 30g */}<col style={{ width: '4.5%' }} />
            {/* Piyasa Deg */}<col style={{ width: '7%' }} />
            {/* Hacim 24s */}<col style={{ width: '6%' }} />
            {/* TVL */}<col style={{ width: '5%' }} />
            {/* Arz */}<col style={{ width: '3%' }} />
            {/* FDV/MC */}<col style={{ width: '3%' }} />
            {/* V/MC */}<col style={{ width: '4%' }} />
            {/* 7g Sparkline */}<col style={{ width: '4.5%' }} />
          </colgroup>
          <thead className="sticky top-0 bg-[#0c0c14] z-10">
            <tr>
              <th className="py-2.5 pl-2 pr-0 text-[10px] font-bold text-white/40" title="Izleme listesine ekle/cikar"></th>
              <SortHeader field="marketCapRank" className="pl-1 pr-1" align="left" tip="Piyasa degeri sirasina gore rank">#</SortHeader>
              <th className="py-2.5 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider" title="Coin adi, sembol ve kategori etiketleri">Coin</th>
              <SortHeader field="price" className="px-2" align="right" tip="Guncel USD fiyati">Fiyat</SortHeader>
              <SortHeader field="score" className="px-2" align="right" tip="HERMES AI skor bazli sinyal seviyesi (GUCLU/IYI/NOTR/ZAYIF/KOTU)">Sinyal</SortHeader>
              <SortHeader field="score" className="px-1" align="center" tip="HERMES AI toplam skor (0-100) — 8 kategorinin agirlikli ortalamasi">Skor</SortHeader>
              <SortHeader field="confidence" className="px-1" align="center" tip="Veri kalitesi guveni — kac kategoride gercek veri var (%30-95)">Guven</SortHeader>
              <SortHeader field="valuation" className="px-1" align="center" tip="ATH mesafesi + FDV/MCap orani + arz oranina gore fiyatlama etiketi">Fiyatlama</SortHeader>
              <SortHeader field="risk" className="px-1" align="center" tip="Likidite, FDV dilution, ATH mesafesi ve piyasa degerine gore risk skoru (0-100)">Risk</SortHeader>
              <th className="py-2.5 px-1 text-[10px] font-bold text-white/40 uppercase tracking-wider text-center cursor-default" title="Asiri Deger Skoru — FDV/MCap, ATH yakinligi, balina yogunlugu, momentum yorgunlugu">Overval</th>
              <th className="py-2.5 px-1 text-[10px] font-bold text-white/40 uppercase tracking-wider text-center cursor-default" title="Crypto Health Index — TVL trendi, holder buyumesi, borsa sagligi, likidite derinligi, gelistirici aktivitesi">CHI</th>
              <th className="py-2.5 px-1 text-[10px] font-bold text-white/40 uppercase tracking-wider text-right cursor-default hidden xl:table-cell" title="Hedef Fiyat — Fibonacci + Fair Value + Momentum + TVL/MCap hibrit hesaplama">Hedef</th>
              <th className="py-2.5 px-1 text-[10px] font-bold text-white/40 uppercase tracking-wider text-right cursor-default hidden xl:table-cell" title="Dip Fiyat — Fibonacci destek + FDV/MCap basinci + Saglik endeksi">Dip</th>
              <th className="py-2.5 px-1 text-[10px] font-bold text-white/40 uppercase tracking-wider text-center cursor-default hidden xl:table-cell" title="Risk/Odul orani — yuksek = olumlu">R:R</th>
              <SortHeader field="change1h" className="px-1.5" align="right" tip="Son 1 saatteki fiyat degisimi (%)">1s</SortHeader>
              <SortHeader field="change24h" className="px-1.5" align="right" tip="Son 24 saatteki fiyat degisimi (%)">24s</SortHeader>
              <SortHeader field="change7d" className="px-1.5" align="right" tip="Son 7 gundeki fiyat degisimi (%)">7g</SortHeader>
              <SortHeader field="change30d" className="px-1.5" align="right" tip="Son 30 gundeki fiyat degisimi (%)">30g</SortHeader>
              <SortHeader field="marketCap" className="px-2" align="right" tip="Toplam piyasa degeri (Dolasimdaki arz x Fiyat)">Piyasa Deg.</SortHeader>
              <SortHeader field="volume24h" className="px-2" align="right" tip="Son 24 saatlik islem hacmi (USD)">Hacim 24s</SortHeader>
              <SortHeader field="tvl" className="px-1" align="right" tip="Total Value Locked — DeFi protokollerinde kilitli toplam deger">TVL</SortHeader>
              <SortHeader field="supplyRatio" className="px-1" align="right" tip="Dolasimdaki arz / Toplam arz orani — yuksek = daha az dilution riski">Arz%</SortHeader>
              <SortHeader field="fdvMcap" className="px-1" align="right" tip="Fully Diluted Valuation / Market Cap — yuksek = gelecekte arz basinci riski">FDV/MC</SortHeader>
              <SortHeader field="volumeToMcap" className="px-1.5" align="right" tip="Hacim/Piyasa degeri orani — yuksek likidite ve ilgi gostergesi">V/MC</SortHeader>
              <th className="py-2.5 px-1 text-[10px] font-bold text-white/40 uppercase tracking-wider text-center" title="Son 7 gunluk fiyat hareketi grafigi">7g</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(coin => {
              const scoreLevel = coin.score?.level ?? 'NEUTRAL'
              const sigCfg = SIGNAL_CONFIG[scoreLevel]
              const isWatched = watchlist.includes(coin.id)
              const volMcRatio = coin.marketCap > 0 ? (coin.volume24h / coin.marketCap) : 0
              return (
                <tr
                  key={coin.id}
                  onClick={() => onSelectCoin(coin.id)}
                  className="border-b border-white/[0.03] hover:bg-amber-500/[0.03] cursor-pointer transition-colors"
                >
                  <td className="pl-2 pr-0 py-2">
                    <button onClick={(e) => handleToggleWatch(e, coin.id)} className="p-0.5 hover:scale-110 transition-transform">
                      <Star size={13} className={isWatched ? 'text-amber-400 fill-amber-400' : 'text-white/10 hover:text-white/40'} />
                    </button>
                  </td>
                  <td className="pl-1 pr-1 py-2 text-[11px] text-white/40 tabular-nums">{coin.marketCapRank}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={coin.image} alt={coin.symbol} className="w-5 h-5 rounded-full flex-shrink-0" loading="lazy" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-white">{coin.symbol.toUpperCase()}</span>
                          <span className="text-[10px] text-white/40 hidden xl:inline truncate">{coin.name}</span>
                        </div>
                        <CoinCategoryTags coin={coin} />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-[11px] text-white font-semibold tabular-nums whitespace-nowrap">{formatPrice(coin.price)}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {coin.score ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${sigCfg.color}`}>
                        {sigCfg.icon} {sigCfg.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/35">-</span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {coin.score ? (
                      <ScoreWithBreakdown coin={coin} sigCfg={sigCfg} />
                    ) : (
                      <span className="text-[10px] text-white/35">-</span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {coin.score ? (
                      <span className={`text-[10px] font-semibold tabular-nums ${coin.score.confidence >= 80 ? 'text-amber-400' : coin.score.confidence >= 50 ? 'text-white/60' : 'text-white/35'}`}>
                        %{Math.round(coin.score.confidence)}
                      </span>
                    ) : <span className="text-[10px] text-white/35">—</span>}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {(() => {
                      const vl = computeValuation(coin)
                      return vl ? (
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${VALUATION_STYLE[vl]}`}>{vl}</span>
                      ) : <span className="text-[10px] text-white/35">—</span>
                    })()}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {(() => {
                      const r = computeRiskScore(coin)
                      return (
                        <span className={`text-[10px] font-bold tabular-nums ${r >= 70 ? 'text-red-400' : r >= 50 ? 'text-orange-400' : r >= 30 ? 'text-white/60' : 'text-emerald-400'}`}>
                          {r}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {coin.overvaluation ? (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        coin.overvaluation.level === 'EXTREME' ? 'text-red-400 bg-red-500/15' :
                        coin.overvaluation.level === 'HIGH' ? 'text-orange-400 bg-orange-500/10' :
                        coin.overvaluation.level === 'MODERATE' ? 'text-white/60 bg-white/[0.04]' :
                        coin.overvaluation.level === 'FAIR' ? 'text-emerald-400 bg-emerald-500/10' :
                        'text-emerald-300 bg-emerald-500/15'
                      }`}>
                        {coin.overvaluation.level === 'EXTREME' ? 'ASIRI' :
                         coin.overvaluation.level === 'HIGH' ? 'YUKSEK' :
                         coin.overvaluation.level === 'MODERATE' ? 'ORTA' :
                         coin.overvaluation.level === 'FAIR' ? 'UYGUN' : 'UCUZ'}
                      </span>
                    ) : <span className="text-[10px] text-white/35">—</span>}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {coin.healthIndex ? (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        coin.healthIndex.level === 'HEALTHY' ? 'text-emerald-400 bg-emerald-500/15' :
                        coin.healthIndex.level === 'CAUTION' ? 'text-amber-400 bg-amber-500/10' :
                        coin.healthIndex.level === 'RISKY' ? 'text-orange-400 bg-orange-500/10' :
                        'text-red-400 bg-red-500/15'
                      }`}>
                        {coin.healthIndex.level === 'HEALTHY' ? 'SAGLIKLI' :
                         coin.healthIndex.level === 'CAUTION' ? 'DIKKAT' :
                         coin.healthIndex.level === 'RISKY' ? 'RISKLI' : 'KRITIK'}
                      </span>
                    ) : <span className="text-[10px] text-white/35">—</span>}
                  </td>
                  <td className="px-1 py-2 text-right hidden xl:table-cell">
                    {coin.priceTarget ? (
                      <span className={`text-[10px] font-mono font-semibold ${coin.priceTarget.targetPct >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                        ${coin.priceTarget.targetPrice < 1 ? coin.priceTarget.targetPrice.toPrecision(4) : coin.priceTarget.targetPrice.toFixed(2)}
                      </span>
                    ) : <span className="text-[10px] text-white/35">—</span>}
                  </td>
                  <td className="px-1 py-2 text-right hidden xl:table-cell">
                    {coin.priceTarget ? (
                      <span className="text-[10px] font-mono text-red-400/80">
                        ${coin.priceTarget.floorPrice < 1 ? coin.priceTarget.floorPrice.toPrecision(4) : coin.priceTarget.floorPrice.toFixed(2)}
                      </span>
                    ) : <span className="text-[10px] text-white/35">—</span>}
                  </td>
                  <td className="px-1 py-2 text-center hidden xl:table-cell">
                    {coin.priceTarget ? (
                      <span className={`text-[10px] font-mono font-bold ${
                        coin.priceTarget.riskReward >= 2 ? 'text-hermes-green' :
                        coin.priceTarget.riskReward >= 1 ? 'text-gold-300' : 'text-red-400'
                      }`}>{coin.priceTarget.riskReward.toFixed(1)}</span>
                    ) : <span className="text-[10px] text-white/35">—</span>}
                  </td>
                  <td className="px-1.5 py-2 text-right"><ChangeCell value={coin.change1h} /></td>
                  <td className="px-1.5 py-2 text-right"><ChangeCell value={coin.change24h} /></td>
                  <td className="px-1.5 py-2 text-right"><ChangeCell value={coin.change7d} /></td>
                  <td className="px-1.5 py-2 text-right"><ChangeCell value={coin.change30d} /></td>
                  <td className="px-2 py-2 text-right text-[11px] text-white/60 tabular-nums whitespace-nowrap">{formatMcap(coin.marketCap)}</td>
                  <td className="px-2 py-2 text-right text-[11px] text-white/50 tabular-nums whitespace-nowrap">{formatMcap(coin.volume24h)}</td>
                  <td className="px-1 py-2 text-right text-[10px] tabular-nums whitespace-nowrap">
                    {coin.tvl && coin.tvl > 0 ? (
                      <span className="text-purple-400/80">{formatMcap(coin.tvl)}</span>
                    ) : <span className="text-white/10">—</span>}
                  </td>
                  <td className="px-1 py-2 text-right">
                    {(() => {
                      const sr = computeSupplyRatio(coin)
                      return sr > 0 ? (
                        <span className={`text-[10px] tabular-nums font-medium ${sr >= 80 ? 'text-emerald-400' : sr >= 50 ? 'text-white/60' : 'text-orange-400'}`}>
                          {sr.toFixed(0)}%
                        </span>
                      ) : <span className="text-[10px] text-white/35">—</span>
                    })()}
                  </td>
                  <td className="px-1 py-2 text-right">
                    {(() => {
                      const fdr = computeFdvMcap(coin)
                      return fdr > 0 ? (
                        <span className={`text-[10px] tabular-nums font-medium ${fdr > 3 ? 'text-red-400' : fdr > 1.5 ? 'text-orange-400' : 'text-emerald-400'}`}>
                          {fdr.toFixed(1)}x
                        </span>
                      ) : <span className="text-[10px] text-white/35">—</span>
                    })()}
                  </td>
                  <td className="px-1.5 py-2 text-right">
                    <span className={`text-[10px] tabular-nums font-medium ${volMcRatio >= 0.15 ? 'text-amber-400' : volMcRatio >= 0.05 ? 'text-white/60' : 'text-white/40'}`}>
                      {(volMcRatio * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-1 py-2 text-center">
                    {coin.sparkline7d && coin.sparkline7d.length > 0 && (
                      <MiniSparkline data={coin.sparkline7d} isPositive={(coin.change7d ?? 0) >= 0} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination */}
      <PaginationControls serverPage={serverPage} totalPages={totalPages} totalEstimate={totalEstimate} filteredCount={filtered.length} onPageChange={setServerPage} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Pagination Controls — reusable for top & bottom
// ═══════════════════════════════════════════════════════════════════

function PaginationControls({ serverPage, totalPages, totalEstimate, filteredCount, onPageChange }: {
  serverPage: number; totalPages: number; totalEstimate: number; filteredCount: number; onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={serverPage === 1}
          className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/8 text-[10px] text-white/50 hover:text-white disabled:opacity-20 transition-colors"
        >
          Ilk
        </button>
        <button
          onClick={() => onPageChange(Math.max(1, serverPage - 1))}
          disabled={serverPage === 1}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-white/50 hover:text-white disabled:opacity-20 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(9, totalPages) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 9) pageNum = i + 1
            else if (serverPage <= 5) pageNum = i + 1
            else if (serverPage >= totalPages - 4) pageNum = totalPages - 8 + i
            else pageNum = serverPage - 4 + i
            if (pageNum < 1 || pageNum > totalPages) return null
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-bold tabular-nums transition-all
                  ${pageNum === serverPage
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                    : 'bg-white/[0.03] border border-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
                  }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => onPageChange(Math.min(totalPages, serverPage + 1))}
          disabled={serverPage >= totalPages}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-white/50 hover:text-white disabled:opacity-20 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={serverPage >= totalPages}
          className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/8 text-[10px] text-white/50 hover:text-white disabled:opacity-20 transition-colors"
        >
          Son
        </button>
      </div>
      <div className="flex items-center justify-center gap-3 text-[10px] text-white/40">
        <span>Sayfa {serverPage} / {totalPages}</span>
        <span>|</span>
        <span>#{(serverPage - 1) * 1000 + 1} - #{Math.min(serverPage * 1000, totalEstimate)}</span>
        <span>|</span>
        <span>{filteredCount.toLocaleString()} gosteriliyor / {totalEstimate.toLocaleString()} toplam</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Coin Search Input with Autocomplete Dropdown (18,000+ coins)
// Searches the full CoinGecko coins list via /api/crypto-terminal/search
// ═══════════════════════════════════════════════════════════════════

interface SearchResultItem {
  id: string
  symbol: string
  name: string
  matchedContract?: { chain: string; address: string }
}

function CoinSearchInput({
  search, setSearch, onSelectCoin, localCount,
}: {
  search: string
  setSearch: (v: string) => void
  onSelectCoin: (id: string) => void
  localCount: number
}) {
  const [acResults, setAcResults] = useState<SearchResultItem[]>([])
  const [acOpen, setAcOpen] = useState(false)
  const [acLoading, setAcLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAcOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced remote search — only when local results are few
  useEffect(() => {
    if (!search || search.trim().length < 1) {
      setAcResults([])
      setAcOpen(false)
      return
    }

    // Show autocomplete if the user typed something
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const q = search.trim()
      if (q.length < 1) return

      setAcLoading(true)
      try {
        const res = await fetch(`/api/crypto-terminal/search?q=${encodeURIComponent(q)}&limit=15`)
        if (res.ok) {
          const data = await res.json()
          setAcResults(data.results || [])
          setAcOpen(true)
          setSelectedIdx(-1)
        }
      } catch {
        // Silent
      } finally {
        setAcLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!acOpen || acResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, acResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIdx >= 0 && selectedIdx < acResults.length) {
        onSelectCoin(acResults[selectedIdx].id)
        setSearch('')
        setAcOpen(false)
      } else if (acResults.length > 0) {
        onSelectCoin(acResults[0].id)
        setSearch('')
        setAcOpen(false)
      }
    } else if (e.key === 'Escape') {
      setAcOpen(false)
    }
  }, [acOpen, acResults, selectedIdx, onSelectCoin, setSearch])

  const handleSelect = useCallback((coinId: string) => {
    onSelectCoin(coinId)
    setSearch('')
    setAcOpen(false)
    inputRef.current?.blur()
  }, [onSelectCoin, setSearch])

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35 z-10" />
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => { if (acResults.length > 0) setAcOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder="Coin, token veya contract ara..."
        className="w-full sm:w-72 pl-8 pr-8 py-1.5 text-xs bg-white/[0.04] border border-white/8 rounded-lg text-white placeholder-white/25 focus:outline-none focus:border-amber-500/30"
      />
      {search && (
        <button
          onClick={() => { setSearch(''); setAcOpen(false); setAcResults([]) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors z-10"
        >
          <X size={13} />
        </button>
      )}
      {acLoading && (
        <div className="absolute right-7 top-1/2 -translate-y-1/2 z-10">
          <div className="w-3 h-3 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {acOpen && acResults.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full sm:w-80 max-h-[320px] overflow-y-auto bg-[#151520] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 z-50">
          <div className="px-3 py-1 border-b border-white/[0.04] flex items-center justify-between">
            <span className="text-[10px] text-white/40">{acResults.length} sonuc (18,000+ coin)</span>
            {localCount === 0 && <span className="text-[9px] text-amber-400/40">Listede yok — tikla detay gor</span>}
          </div>
          {acResults.map((coin, idx) => (
            <button
              key={coin.id}
              onClick={() => handleSelect(coin.id)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                ${idx === selectedIdx ? 'bg-amber-500/10' : 'hover:bg-white/[0.04]'}
                ${idx < acResults.length - 1 ? 'border-b border-white/[0.02]' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase">{coin.symbol}</span>
                  <span className="text-[10px] text-white/40 truncate">{coin.name}</span>
                </div>
                {coin.matchedContract ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[8px] px-1 py-px rounded bg-violet-500/20 text-violet-300 border border-violet-500/20 font-medium uppercase">{coin.matchedContract.chain}</span>
                    <span className="text-[9px] text-white/40 truncate font-mono">{coin.matchedContract.address.slice(0, 8)}...{coin.matchedContract.address.slice(-6)}</span>
                  </div>
                ) : (
                  <span className="text-[9px] text-white/35 truncate block">{coin.id}</span>
                )}
              </div>
              <span className="text-[10px] text-amber-400/40 shrink-0">Detay →</span>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {acOpen && search.trim().length >= 2 && acResults.length === 0 && !acLoading && (
        <div className="absolute top-full left-0 mt-1 w-full sm:w-80 bg-[#151520] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 z-50 p-3 text-center">
          <span className="text-[11px] text-white/35">Sonuc bulunamadi</span>
        </div>
      )}
    </div>
  )
}
