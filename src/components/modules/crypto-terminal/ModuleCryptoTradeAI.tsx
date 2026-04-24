'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — TRADE AI Module (K10)
// V377_R6.85_Z55 | L30_S90 — Pure Z-Score Mean-Reversion
// Top 1000 coins by market cap — 4-page parallel scan
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { Target, TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight, Star, Crosshair, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { trackSignal } from '@/lib/crypto-terminal/signalTracker'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'

interface TradeAIResult {
  score: number
  signal: string
  signalType: string
  zscore: number
  vwap: number
  deviation: number
  std: number
  vwapDistPct: number
  bands: { center: number; upperInner: number; lowerInner: number; upperOuter: number; lowerOuter: number }
  price: number
  dataPoints: number
  hasEnoughData: boolean
}

interface ScanItem {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  price_change_24h: number
  market_cap: number
  market_cap_rank: number
  total_volume: number
  circulating_supply: number
  total_supply: number | null
  fully_diluted_valuation: number | null
  ath_change_percentage: number
  tradeAI: TradeAIResult
}

type ValuationTag = 'COK UCUZ' | 'UCUZ' | 'NORMAL' | 'PAHALI' | 'COK PAHALI'

type SignalFilter = 'all' | 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'
type SortKey = 'score' | 'zscore' | 'price' | 'change' | 'mcap' | 'vwapDist' | 'confidence' | 'valuation'

function computeConfidence(s: ScanItem): number {
  return Math.min(95, Math.round(40 + Math.abs(s.tradeAI.score - 50) * 0.6 + (s.tradeAI.dataPoints > 300 ? 15 : 0)))
}

function computeValuation(s: ScanItem): ValuationTag {
  const fdv = s.fully_diluted_valuation ?? 0
  const mcap = s.market_cap || 1
  const fdvR = fdv > 0 ? fdv / mcap : 0
  const athDist = Math.abs(s.ath_change_percentage ?? 0)
  const supRatio = s.circulating_supply && s.total_supply && s.total_supply > 0
    ? s.circulating_supply / s.total_supply : 0.5
  if (fdvR > 0 && fdvR < 1.2 && athDist > 70 && supRatio > 0.7) return 'COK UCUZ'
  if (fdvR > 0 && fdvR < 1.5 && athDist > 50) return 'UCUZ'
  if (fdvR > 5 || athDist < 3) return 'COK PAHALI'
  if (fdvR > 3 || athDist < 10) return 'PAHALI'
  return 'NORMAL'
}

const VALUATION_RANK: Record<ValuationTag, number> = { 'COK UCUZ': 0, 'UCUZ': 1, 'NORMAL': 2, 'PAHALI': 3, 'COK PAHALI': 4 }

const TOTAL_PAGES = 4

const SIGNAL_CONFIG = {
  strong_long: { label: 'STRONG LONG', color: 'text-gold-400', bg: 'bg-gold-500/15 border-stroke-gold-strong', icon: <TrendingUp size={12} /> },
  long: { label: 'LONG', color: 'text-success-400', bg: 'bg-success-400/15 border-success-400/30', icon: <ArrowUpRight size={12} /> },
  neutral: { label: 'NOTR', color: 'text-text-secondary', bg: 'bg-white/5 border-stroke', icon: null },
  short: { label: 'SHORT', color: 'text-warning-400', bg: 'bg-warning-400/15 border-warning-400/30', icon: <ArrowDownRight size={12} /> },
  strong_short: { label: 'STRONG SHORT', color: 'text-danger-400', bg: 'bg-danger-400/15 border-danger-400/30', icon: <TrendingDown size={12} /> },
}

const TP_PCT = 1.5, SL_PCT = 8.0

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  return `$${p.toFixed(6)}`
}

function formatMcap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

export default function ModuleCryptoTradeAI() {
  const canCSV = useCanDownloadCSV()
  const [items, setItems] = useState<ScanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagesLoaded, setPagesLoaded] = useState(0)
  const [filter, setFilter] = useState<SignalFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortAsc, setSortAsc] = useState(true)
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [scanInfo, setScanInfo] = useState<{ scanned: number; cached: boolean; duration: number } | null>(null)
  const scanStartRef = useRef(0)

  useEffect(() => {
    const stored = localStorage.getItem('hermes_crypto_watchlist')
    if (stored) {
      try { setWatchlist(new Set(JSON.parse(stored))) } catch { /* */ }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hermes_crypto_watchlist' && e.newValue) {
        try { setWatchlist(new Set(JSON.parse(e.newValue))) } catch { /* */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleWatchlist = useCallback((id: string) => {
    setWatchlist(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem('hermes_crypto_watchlist', JSON.stringify([...next]))
      return next
    })
  }, [])

  const loadScan = useCallback(async (refresh = false) => {
    setLoading(true)
    setPagesLoaded(0)
    setItems([])
    scanStartRef.current = Date.now()

    const allResults: ScanItem[] = []
    let allCached = true
    let completed = 0

    const fetchPage = async (page: number) => {
      try {
        const url = `/api/crypto-terminal/scan?page=${page}${refresh ? '&refresh=1' : ''}`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (!data.cached) allCached = false
        if (Array.isArray(data.results)) {
          allResults.push(...data.results)
        }
      } catch { /* page failed */ }
      completed++
      setPagesLoaded(completed)
      setItems([...allResults])
    }

    await Promise.all(
      Array.from({ length: TOTAL_PAGES }, (_, i) => fetchPage(i + 1))
    )

    const duration = Date.now() - scanStartRef.current
    setScanInfo({ scanned: allResults.length, cached: allCached, duration })
    setLoading(false)
  }, [])

  useEffect(() => { loadScan() }, [loadScan])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'score') }
  }

  const filteredItems = items.filter(s => {
    const st = s?.tradeAI?.signalType
    if (!st) return false
    if (filter === 'all') return st !== 'neutral'
    return st === filter
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    let va: number, vb: number
    switch (sortKey) {
      case 'score': va = a.tradeAI.score; vb = b.tradeAI.score; break
      case 'zscore': va = a.tradeAI.zscore; vb = b.tradeAI.zscore; break
      case 'price': va = a.current_price; vb = b.current_price; break
      case 'change': va = a.price_change_24h; vb = b.price_change_24h; break
      case 'mcap': va = a.market_cap; vb = b.market_cap; break
      case 'vwapDist': va = a.tradeAI.vwapDistPct; vb = b.tradeAI.vwapDistPct; break
      case 'confidence': va = computeConfidence(a); vb = computeConfidence(b); break
      case 'valuation': va = VALUATION_RANK[computeValuation(a)]; vb = VALUATION_RANK[computeValuation(b)]; break
      default: va = a.tradeAI.score; vb = b.tradeAI.score
    }
    return sortAsc ? va - vb : vb - va
  })

  const counts = {
    strong_long: items.filter(s => s?.tradeAI?.signalType === 'strong_long').length,
    long: items.filter(s => s?.tradeAI?.signalType === 'long').length,
    neutral: items.filter(s => s?.tradeAI?.signalType === 'neutral').length,
    short: items.filter(s => s?.tradeAI?.signalType === 'short').length,
    strong_short: items.filter(s => s?.tradeAI?.signalType === 'strong_short').length,
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null
    return sortAsc ? <ChevronUp size={10} className="inline ml-0.5 opacity-60" /> : <ChevronDown size={10} className="inline ml-0.5 opacity-60" />
  }

  const progressPct = loading ? Math.round((pagesLoaded / TOTAL_PAGES) * 100) : 100

  const downloadCSV = () => {
    const header = 'Symbol,Name,Sinyal,Skor,Z-Score,VWAP%,Guven%,Fiyatlama,Fiyat,Degisim%,MCap'
    const csvRows = sortedItems.map(s => {
      const cfg = SIGNAL_CONFIG[s.tradeAI.signalType as keyof typeof SIGNAL_CONFIG] || SIGNAL_CONFIG.neutral
      return [
        s.symbol,
        `"${s.name}"`,
        cfg.label,
        s.tradeAI.score,
        s.tradeAI.zscore.toFixed(2),
        s.tradeAI.vwapDistPct.toFixed(1),
        computeConfidence(s),
        computeValuation(s),
        s.current_price.toFixed(6),
        s.price_change_24h.toFixed(2),
        s.market_cap,
      ].join(',')
    })
    const csv = [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `hermes_crypto_trade_ai_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Target size={20} className="text-[#0d0d0d]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">CRYPTO TRADE <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">AI</span></h2>
            <p className="text-[10px] text-text-tertiary">Top 1000 Coin | Pure Z-Score Mean-Reversion</p>
          </div>
          {scanInfo && !loading && (
            <div className="hidden sm:flex items-center gap-2 ml-3">
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-stroke text-[9px] text-text-tertiary">
                {scanInfo.scanned} coin {scanInfo.cached ? '(cache)' : `(${(scanInfo.duration / 1000).toFixed(1)}s)`}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[9px] text-text-tertiary tabular-nums">{pagesLoaded}/{TOTAL_PAGES}</span>
            </div>
          )}
          {sortedItems.length > 0 && canCSV && (
            <button onClick={downloadCSV} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-3 text-text-tertiary border border-white/8 hover:bg-surface-3 hover:text-text-secondary transition-all">
              <Download size={12} className="inline mr-1" />CSV
            </button>
          )}
          <button onClick={() => loadScan(true)} disabled={loading}
            className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-stroke-gold-strong text-gold-300 text-xs font-bold hover:from-amber-500/25 hover:to-orange-500/15 hover:border-stroke-gold-strong hover:shadow-lg hover:shadow-amber-500/15 hover:scale-[1.03] transition-all duration-300 disabled:opacity-50">
            <RefreshCw size={13} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
            {loading ? `Taraniyor... ${items.length}` : 'Tara'}
          </button>
        </div>
      </div>

      {/* Signal Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 mb-4">
        {([
          { key: 'strong_long' as const, label: 'S. LONG',
            active: 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-stroke-gold-strong shadow-lg shadow-amber-500/20 scale-[1.03]',
            idle: 'bg-gradient-to-br from-amber-500/8 to-transparent border-amber-500/15 hover:border-stroke-gold-strong hover:shadow-md hover:shadow-amber-500/20 hover:scale-[1.02]',
            textActive: 'text-gold-300', textIdle: 'text-gold-400', subActive: 'text-gold-400', subIdle: 'text-gold-500' },
          { key: 'long' as const, label: 'LONG',
            active: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-success-400/40 shadow-lg shadow-emerald-500/20 scale-[1.03]',
            idle: 'bg-gradient-to-br from-emerald-500/8 to-transparent border-emerald-500/15 hover:border-success-400/30 hover:shadow-md hover:shadow-emerald-500/20 hover:scale-[1.02]',
            textActive: 'text-success-300', textIdle: 'text-success-400', subActive: 'text-success-400', subIdle: 'text-success-500' },
          { key: 'neutral' as const, label: 'NOTR',
            active: 'bg-gradient-to-br from-slate-500/20 to-slate-600/10 border-slate-500/40 shadow-lg shadow-slate-500/15 scale-[1.03]',
            idle: 'bg-gradient-to-br from-slate-500/8 to-transparent border-slate-500/15 hover:border-slate-500/30 hover:shadow-md hover:shadow-slate-500/15 hover:scale-[1.02]',
            textActive: 'text-text-secondary', textIdle: 'text-text-tertiary', subActive: 'text-text-tertiary', subIdle: 'text-text-tertiary' },
          { key: 'short' as const, label: 'SHORT',
            active: 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/40 shadow-lg shadow-orange-500/20 scale-[1.03]',
            idle: 'bg-gradient-to-br from-orange-500/8 to-transparent border-orange-500/15 hover:border-warning-400/30 hover:shadow-md hover:shadow-orange-500/20 hover:scale-[1.02]',
            textActive: 'text-orange-300', textIdle: 'text-warning-400', subActive: 'text-warning-400', subIdle: 'text-warning-500' },
          { key: 'strong_short' as const, label: 'S. SHORT',
            active: 'bg-gradient-to-br from-red-500/20 to-red-600/10 border-danger-400/40 shadow-lg shadow-red-500/20 scale-[1.03]',
            idle: 'bg-gradient-to-br from-red-500/8 to-transparent border-red-500/15 hover:border-danger-400/30 hover:shadow-md hover:shadow-red-500/20 hover:scale-[1.02]',
            textActive: 'text-danger-300', textIdle: 'text-danger-400', subActive: 'text-danger-400', subIdle: 'text-danger-400' },
        ]).map(({ key, label, active, idle, textActive, textIdle, subActive, subIdle }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`group relative py-3 rounded-xl border text-center transition-all duration-300 overflow-hidden
              ${filter === key ? active : idle}`}
          >
            <div className={`text-xl font-black tabular-nums ${filter === key ? `${textActive} opacity-100` : `${textIdle} opacity-70 group-hover:opacity-100`}`}>
              {counts[key]}
            </div>
            <div className={`text-[9px] font-bold tracking-wider ${filter === key ? `${subActive} opacity-80` : `${subIdle} opacity-40 group-hover:opacity-70`}`}>{label}</div>
            {filter === key && <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 pointer-events-none" />}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-1 text-[9px] text-text-tertiary uppercase tracking-wider">
                <th className="text-left px-3 py-2.5 w-8"></th>
                <th className="text-left px-3 py-2.5">Coin</th>
                <th className="text-right px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary" onClick={() => handleSort('price')}>Fiyat <SortIcon k="price" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary" onClick={() => handleSort('change')}>24s % <SortIcon k="change" /></th>
                <th className="text-center px-3 py-2.5">Sinyal</th>
                <th className="text-right px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary" onClick={() => handleSort('score')}>Skor <SortIcon k="score" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary" onClick={() => handleSort('zscore')}>Z-Score <SortIcon k="zscore" /></th>
                <th className="text-center px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary" onClick={() => handleSort('confidence')}>Guven <SortIcon k="confidence" /></th>
                <th className="text-center px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary" onClick={() => handleSort('valuation')}>Fiyatlama <SortIcon k="valuation" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary hidden lg:table-cell" onClick={() => handleSort('vwapDist')}>VWAP % <SortIcon k="vwapDist" /></th>
                <th className="text-right px-3 py-2.5 hidden xl:table-cell">Hedef</th>
                <th className="text-right px-3 py-2.5 hidden xl:table-cell">Dip</th>
                <th className="text-center px-3 py-2.5 hidden xl:table-cell">R:R</th>
                <th className="text-right px-3 py-2.5 cursor-pointer select-none hover:text-text-secondary hidden md:table-cell" onClick={() => handleSort('mcap')}>MCap <SortIcon k="mcap" /></th>
                <th className="text-center px-3 py-2.5 w-10">Takip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
                <tr key={i}><td colSpan={16} className="px-3 py-3"><div className="h-4 bg-surface-3 animate-pulse rounded" /></td></tr>
              ))}
              {sortedItems.slice(0, 200).map(s => {
                const ai = s.tradeAI
                const cfg = SIGNAL_CONFIG[ai.signalType as keyof typeof SIGNAL_CONFIG] || SIGNAL_CONFIG.neutral
                const isLong = ai.signalType === 'strong_long' || ai.signalType === 'long'
                const isShort = ai.signalType === 'strong_short' || ai.signalType === 'short'
                const tp = isLong ? s.current_price * (1 + TP_PCT / 100) : isShort ? s.current_price * (1 - TP_PCT / 100) : s.current_price
                const sl = isLong ? s.current_price * (1 - SL_PCT / 100) : isShort ? s.current_price * (1 + SL_PCT / 100) : s.current_price
                const expanded = expandedRow === s.id
                const conf = computeConfidence(s)
                const val = computeValuation(s)

                return (
                  <tr key={s.id} className={`hover:bg-surface-2 transition-colors cursor-pointer ${expanded ? 'bg-white/[0.015]' : ''}`} onClick={() => setExpandedRow(expanded ? null : s.id)}>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleWatchlist(s.id)} className="text-text-tertiary hover:text-gold-400 transition-colors">
                        <Star size={12} fill={watchlist.has(s.id) ? '#f59e0b' : 'none'} className={watchlist.has(s.id) ? 'text-gold-400' : ''} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {s.image && <img src={s.image} alt="" className="w-5 h-5 rounded-full" />}
                        <div>
                          <span className="font-bold text-white">{s.symbol}</span>
                          <span className="text-[9px] text-text-quaternary ml-1 hidden sm:inline">{s.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-white">{formatPrice(s.current_price)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${s.price_change_24h >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                      {s.price_change_24h >= 0 ? '+' : ''}{s.price_change_24h.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-white">{ai.score}</td>
                    <td className={`px-3 py-2 text-right font-mono text-[10px] ${ai.zscore < -1 ? 'text-success-400' : ai.zscore > 1 ? 'text-danger-400' : 'text-text-tertiary'}`}>
                      {ai.zscore > 0 ? '+' : ''}{ai.zscore.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-bold tabular-nums ${conf >= 70 ? 'text-gold-400' : conf >= 50 ? 'text-text-secondary' : 'text-text-tertiary'}`}>{conf}%</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        val === 'COK UCUZ' ? 'text-success-300 bg-success-400/10 border-success-400/30' :
                        val === 'UCUZ' ? 'text-success-400 bg-success-400/8 border-emerald-500/15' :
                        val === 'PAHALI' ? 'text-warning-400 bg-orange-500/8 border-orange-500/15' :
                        val === 'COK PAHALI' ? 'text-danger-400 bg-danger-400/8 border-red-500/15' :
                        'text-text-tertiary bg-surface-2 border-stroke-subtle'
                      }`}>{val}</span>
                    </td>
                    <td className={`px-3 py-2 text-right text-[10px] hidden lg:table-cell ${ai.vwapDistPct < -3 ? 'text-success-400' : ai.vwapDistPct > 3 ? 'text-danger-400' : 'text-text-tertiary'}`}>
                      {ai.vwapDistPct > 0 ? '+' : ''}{ai.vwapDistPct.toFixed(1)}%
                    </td>
                    {/* Hedef (upperInner band) */}
                    <td className="px-3 py-2 text-right hidden xl:table-cell">
                      {ai.bands.upperInner > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className={`font-mono text-[10px] font-semibold ${ai.bands.upperInner > s.current_price ? 'text-success-400' : 'text-danger-400'}`}>
                            {formatPrice(ai.bands.upperInner)}
                          </span>
                          <span className="text-[8px] text-text-tertiary">{s.current_price > 0 ? `${((ai.bands.upperInner - s.current_price) / s.current_price * 100) >= 0 ? '+' : ''}${((ai.bands.upperInner - s.current_price) / s.current_price * 100).toFixed(1)}%` : ''}</span>
                        </div>
                      ) : <span className="text-text-quaternary">{'\u2014'}</span>}
                    </td>
                    {/* Dip (lowerInner band) */}
                    <td className="px-3 py-2 text-right hidden xl:table-cell">
                      {ai.bands.lowerInner > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-[10px] text-danger-400/70">{formatPrice(ai.bands.lowerInner)}</span>
                          <span className="text-[8px] text-text-tertiary">{s.current_price > 0 ? `${((ai.bands.lowerInner - s.current_price) / s.current_price * 100).toFixed(1)}%` : ''}</span>
                        </div>
                      ) : <span className="text-text-quaternary">{'\u2014'}</span>}
                    </td>
                    {/* R:R */}
                    <td className="px-3 py-2 text-center hidden xl:table-cell">
                      {(() => {
                        const upside = ai.bands.upperInner > 0 ? ai.bands.upperInner - s.current_price : 0
                        const downside = ai.bands.lowerInner > 0 ? s.current_price - ai.bands.lowerInner : 0
                        const rr = downside > 0 ? upside / downside : 0
                        if (rr <= 0) return <span className="text-text-quaternary">{'\u2014'}</span>
                        return <span className={`font-mono text-[10px] font-bold ${rr >= 2 ? 'text-success-400' : rr >= 1 ? 'text-gold-400' : 'text-danger-400'}`}>{rr.toFixed(1)}</span>
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right text-[10px] text-text-quaternary hidden md:table-cell">{formatMcap(s.market_cap)}</td>
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      {ai.signalType !== 'neutral' && (
                        <button
                          onClick={() => trackSignal(s.id, s.symbol, ai.signal, s.current_price, tp, sl)}
                          title="Sinyali takip et"
                          className="text-text-tertiary hover:text-gold-400 transition-colors"
                        >
                          <Crosshair size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded Detail */}
        {expandedRow && (() => {
          const s = items.find(x => x.id === expandedRow)
          if (!s) return null
          const ai = s.tradeAI
          return (
            <div className="px-4 py-3 border-t border-stroke-subtle bg-surface-1/50 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-[10px]">
              <div>
                <div className="text-text-quaternary uppercase mb-0.5">VWAP (377g)</div>
                <div className="text-white font-mono">{formatPrice(ai.vwap)}</div>
              </div>
              <div>
                <div className="text-text-quaternary uppercase mb-0.5">Z-Score</div>
                <div className={`font-mono ${ai.zscore < -1 ? 'text-success-400' : ai.zscore > 1 ? 'text-danger-400' : 'text-text-secondary'}`}>
                  {ai.zscore > 0 ? '+' : ''}{ai.zscore.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-text-quaternary uppercase mb-0.5">Ust Bant (+1σ)</div>
                <div className="text-danger-400/60 font-mono">{formatPrice(ai.bands.upperInner)}</div>
              </div>
              <div>
                <div className="text-text-quaternary uppercase mb-0.5">Alt Bant (-1σ)</div>
                <div className="text-success-400/60 font-mono">{formatPrice(ai.bands.lowerInner)}</div>
              </div>
              <div>
                <div className="text-text-quaternary uppercase mb-0.5">StdDev</div>
                <div className="text-text-tertiary font-mono">{formatPrice(ai.std)}</div>
              </div>
              <div>
                <div className="text-text-quaternary uppercase mb-0.5">Veri</div>
                <div className="text-text-tertiary">{ai.dataPoints} gun {ai.hasEnoughData ? '(Tam)' : '(Kismi)'}</div>
              </div>
            </div>
          )
        })()}

        <div className="px-4 py-2 border-t border-stroke-subtle flex justify-between">
          <span className="text-[10px] text-text-tertiary">{sortedItems.length} sinyal / {items.length} coin tarandi</span>
          <span className="text-[10px] text-text-quaternary">Top 1000 Coin | Pure Z-Score | TP {TP_PCT}% / SL {SL_PCT}%</span>
        </div>
      </div>
    </div>
  )
}
