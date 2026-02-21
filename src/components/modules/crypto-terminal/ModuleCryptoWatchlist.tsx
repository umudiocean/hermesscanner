'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — WATCHLIST Module
// Favori coinlerin canli takibi — localStorage bazli
// K14: Kripto Saglik Skoru | K15: Anomali tespiti
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Star, Trash2, RefreshCw, AlertTriangle, Shield, ChevronUp, ChevronDown, Download, Search, Plus } from 'lucide-react'
import { getCoinCategories, getCategoryStyle, inferCategoryFromName } from '@/lib/crypto-terminal/crypto-categories'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'

type ValuationTag = 'COK UCUZ' | 'UCUZ' | 'NORMAL' | 'PAHALI' | 'COK PAHALI'

type TerminalSignal = 'STRONG' | 'GOOD' | 'NEUTRAL' | 'WEAK' | 'BAD'
type TradeSignal = 'STRONG LONG' | 'LONG' | 'NOTR' | 'SHORT' | 'STRONG SHORT'
type AISignal = 'CONFLUENCE BUY' | 'ALPHA LONG' | 'HERMES LONG' | 'HERMES SHORT' | 'ALPHA SHORT' | 'CONFLUENCE SELL' | '-'

interface WatchlistCoin {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  price_change_percentage_24h: number
  price_change_percentage_7d_in_currency: number
  market_cap: number
  total_volume: number
  sparkline_in_7d: { price: number[] } | null
  healthScore: number
  healthLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL'
  anomalies: string[]
  supplyRatio: number
  fdvMcap: number
  valuation: ValuationTag
  confidence: number
  riskScore: number
  terminalSignal: TerminalSignal
  tradeSignal: TradeSignal
  tradeScore: number
  aiSignal: AISignal
}

type SortField = 'symbol' | 'price' | 'change24h' | 'change7d' | 'marketCap' | 'health' | 'risk' | 'confidence' | 'valuation' | 'terminalSignal' | 'tradeSignal' | 'aiSignal'

const TERMINAL_SIGNAL_RANK: Record<TerminalSignal, number> = { 'STRONG': 0, 'GOOD': 1, 'NEUTRAL': 2, 'WEAK': 3, 'BAD': 4 }
const TRADE_SIGNAL_RANK: Record<TradeSignal, number> = { 'STRONG LONG': 0, 'LONG': 1, 'NOTR': 2, 'SHORT': 3, 'STRONG SHORT': 4 }
const AI_SIGNAL_RANK: Record<AISignal, number> = { 'CONFLUENCE BUY': 0, 'ALPHA LONG': 1, 'HERMES LONG': 2, '-': 3, 'HERMES SHORT': 4, 'ALPHA SHORT': 5, 'CONFLUENCE SELL': 6 }

function getTerminalSignal(fundamentalScore: number): TerminalSignal {
  if (fundamentalScore >= 80) return 'STRONG'
  if (fundamentalScore >= 60) return 'GOOD'
  if (fundamentalScore >= 40) return 'NEUTRAL'
  if (fundamentalScore >= 20) return 'WEAK'
  return 'BAD'
}

function getTradeSignal(score: number): TradeSignal {
  if (score <= 20) return 'STRONG LONG'
  if (score <= 30) return 'LONG'
  if (score >= 90) return 'STRONG SHORT'
  if (score >= 70) return 'SHORT'
  return 'NOTR'
}

function sigmoid(value: number, center: number, steepness: number): number {
  return 100 / (1 + Math.exp(-steepness * (value - center)))
}

function computeFundamentalScore(coin: any): number {
  const mcapRank = coin.market_cap_rank || 500
  const supplyRatio = coin.circulating_supply && coin.total_supply
    ? coin.circulating_supply / coin.total_supply : 0.5
  const volRatio = coin.total_volume && coin.market_cap
    ? coin.total_volume / coin.market_cap : 0
  return Math.round(
    sigmoid(Math.log10(coin.market_cap || 1), 9, 0.8) * 0.3 +
    (supplyRatio * 100) * 0.2 +
    (volRatio > 0.1 ? 70 : volRatio > 0.05 ? 50 : 30) * 0.2 +
    (mcapRank <= 20 ? 80 : mcapRank <= 100 ? 60 : mcapRank <= 300 ? 40 : 25) * 0.15 +
    (supplyRatio > 0.7 ? 65 : supplyRatio > 0.4 ? 50 : 35) * 0.15
  )
}

function computeAISignal(tradeSignalType: string, fundamentalScore: number, riskLevel: string): AISignal {
  if (tradeSignalType === 'strong_long' || tradeSignalType === 'long') {
    const aiLevel = fundamentalScore >= 80 ? 'STRONG' : fundamentalScore >= 60 ? 'GOOD' : fundamentalScore >= 40 ? 'NEUTRAL' : 'WEAK'
    if ((aiLevel === 'STRONG' || aiLevel === 'GOOD') && riskLevel === 'LOW') return 'CONFLUENCE BUY'
    if (aiLevel === 'STRONG') return 'ALPHA LONG'
    if (aiLevel === 'GOOD' || aiLevel === 'NEUTRAL') return 'HERMES LONG'
  }
  if (tradeSignalType === 'strong_short' || tradeSignalType === 'short') {
    const aiLevel = fundamentalScore >= 40 ? 'NEUTRAL' : fundamentalScore >= 20 ? 'WEAK' : 'BAD'
    if ((aiLevel === 'BAD' || aiLevel === 'WEAK') && riskLevel === 'HIGH') return 'CONFLUENCE SELL'
    if (aiLevel === 'BAD') return 'ALPHA SHORT'
    if (aiLevel === 'WEAK' || aiLevel === 'NEUTRAL') return 'HERMES SHORT'
  }
  return '-'
}
type SortDir = 'asc' | 'desc'

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  return `$${p.toFixed(6)}`
}

function formatMcap(m: number): string {
  if (!m) return '-'
  if (m >= 1e12) return `$${(m / 1e12).toFixed(1)}T`
  if (m >= 1e9) return `$${(m / 1e9).toFixed(1)}B`
  if (m >= 1e6) return `$${(m / 1e6).toFixed(0)}M`
  return `$${m.toLocaleString()}`
}

// K14: Crypto Health Index (CHI)
function calculateHealthScore(coin: any): { score: number; level: WatchlistCoin['healthLevel']; anomalies: string[] } {
  const anomalies: string[] = []
  let score = 50
  const weights: number[] = []
  const scores: number[] = []

  // 1. Liquidity (25%) — vol/mcap ratio
  if (coin.market_cap > 0 && coin.total_volume > 0) {
    const volRatio = coin.total_volume / coin.market_cap
    const liqScore = volRatio > 0.2 ? 85 : volRatio > 0.1 ? 70 : volRatio > 0.05 ? 50 : volRatio > 0.02 ? 30 : 15
    scores.push(liqScore)
    weights.push(0.25)
    if (volRatio < 0.02) anomalies.push('DUSUK LIKIDITE')
    if (volRatio > 0.5) anomalies.push('ASIRI HACIM')
  }

  // 2. Momentum Stability (20%)
  const change24h = coin.price_change_percentage_24h || 0
  const change7d = coin.price_change_percentage_7d_in_currency || 0
  const volatility = Math.abs(change24h) + Math.abs(change7d || 0)
  const stabScore = volatility < 5 ? 80 : volatility < 15 ? 60 : volatility < 30 ? 40 : 20
  scores.push(stabScore)
  weights.push(0.20)
  if (Math.abs(change24h) > 15) anomalies.push(`${change24h > 0 ? 'SERT YUKSELIS' : 'SERT DUSUS'} (${change24h.toFixed(1)}%)`)
  if (Math.abs(change7d) > 30) anomalies.push(`7G ${change7d > 0 ? 'ANI YUKSELIS' : 'ANI DUSUS'} (${change7d.toFixed(1)}%)`)

  // 3. Market Cap Health (20%)
  if (coin.market_cap > 0) {
    const mcapScore = coin.market_cap > 1e10 ? 85 : coin.market_cap > 1e9 ? 70 : coin.market_cap > 1e8 ? 50 : coin.market_cap > 1e7 ? 30 : 15
    scores.push(mcapScore)
    weights.push(0.20)
    if (coin.market_cap < 1e7) anomalies.push('MICRO CAP RISKI')
  }

  // 4. Supply Health (15%)
  if (coin.circulating_supply && coin.total_supply && coin.total_supply > 0) {
    const supplyRatio = coin.circulating_supply / coin.total_supply
    const supScore = supplyRatio > 0.8 ? 80 : supplyRatio > 0.5 ? 60 : supplyRatio > 0.3 ? 40 : 20
    scores.push(supScore)
    weights.push(0.15)
    if (supplyRatio < 0.2) anomalies.push('DUSUK DOLASIMDAKI ARZ')
    if (coin.fully_diluted_valuation && coin.market_cap > 0) {
      const fdvRatio = coin.fully_diluted_valuation / coin.market_cap
      if (fdvRatio > 5) anomalies.push(`YUKSEK DILUTION (FDV/MCap: ${fdvRatio.toFixed(1)}x)`)
    }
  }

  // 5. ATH Distance (10%)
  if (coin.ath_change_percentage != null) {
    const athDist = Math.abs(coin.ath_change_percentage)
    const athScore = athDist < 10 ? 80 : athDist < 30 ? 65 : athDist < 60 ? 45 : athDist < 85 ? 25 : 10
    scores.push(athScore)
    weights.push(0.10)
    if (athDist > 90) anomalies.push('ATH\'DAN >%90 DUSUS')
  }

  // 6. Community / Ecosystem (10%)
  const hasTVL = coin.total_value_locked && coin.total_value_locked > 0
  const ecosScore = hasTVL ? 70 : 40
  scores.push(ecosScore)
  weights.push(0.10)

  // Calculate weighted average
  if (scores.length > 0 && weights.length > 0) {
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    score = Math.round(scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalWeight)
  }

  const level: WatchlistCoin['healthLevel'] =
    score >= 75 ? 'EXCELLENT' :
    score >= 60 ? 'GOOD' :
    score >= 45 ? 'FAIR' :
    score >= 30 ? 'POOR' : 'CRITICAL'

  return { score, level, anomalies }
}

const HEALTH_COLORS = {
  EXCELLENT: 'text-emerald-400',
  GOOD: 'text-emerald-300',
  FAIR: 'text-amber-400',
  POOR: 'text-orange-400',
  CRITICAL: 'text-red-400',
}

interface SearchResult {
  id: string
  symbol: string
  name: string
  thumb?: string
  large?: string
  market_cap_rank?: number | null
}

const WATCHLIST_KEY = 'hermes_crypto_watchlist'

export default function ModuleCryptoWatchlist() {
  const canCSV = useCanDownloadCSV()
  const [watchlistIds, setWatchlistIds] = useState<string[]>([])
  const [coins, setCoins] = useState<WatchlistCoin[]>([])
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<SortField>('health')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return field }
      setSortDir('desc')
      return field
    })
  }, [])

  const searchCoins = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/crypto-terminal/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) return
      const data = await res.json()
      setSearchResults(data.results?.slice(0, 12) || [])
    } catch { setSearchResults([]) }
    finally { setSearchLoading(false) }
  }, [])

  const handleSearchInput = useCallback((q: string) => {
    setSearchQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchCoins(q), 250)
  }, [searchCoins])

  const addToWatchlist = useCallback((id: string) => {
    setWatchlistIds(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next))
      return next
    })
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function WTH({ field, children, align = 'left' }: { field: SortField; children: React.ReactNode; align?: string }) {
    const active = sortField === field
    return (
      <th
        onClick={() => handleSort(field)}
        className={`py-2 px-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors text-${align}
          ${active ? 'text-amber-400' : 'text-white/30 hover:text-white/50'}`}
      >
        <span className="inline-flex items-center gap-0.5">
          {children}
          {active && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
        </span>
      </th>
    )
  }

  const sortedCoins = useMemo(() => {
    const sorted = [...coins]
    sorted.sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortField) {
        case 'symbol': return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
        case 'price': aVal = a.current_price; bVal = b.current_price; break
        case 'change24h': aVal = a.price_change_percentage_24h; bVal = b.price_change_percentage_24h; break
        case 'change7d': aVal = a.price_change_percentage_7d_in_currency; bVal = b.price_change_percentage_7d_in_currency; break
        case 'marketCap': aVal = a.market_cap; bVal = b.market_cap; break
        case 'health': aVal = a.healthScore; bVal = b.healthScore; break
        case 'risk': aVal = a.riskScore; bVal = b.riskScore; break
        case 'confidence': aVal = a.confidence; bVal = b.confidence; break
        case 'valuation': {
          const vr: Record<ValuationTag, number> = { 'COK UCUZ': 0, 'UCUZ': 1, 'NORMAL': 2, 'PAHALI': 3, 'COK PAHALI': 4 }
          aVal = vr[a.valuation]; bVal = vr[b.valuation]; break
        }
        case 'terminalSignal': aVal = TERMINAL_SIGNAL_RANK[a.terminalSignal]; bVal = TERMINAL_SIGNAL_RANK[b.terminalSignal]; break
        case 'tradeSignal': aVal = TRADE_SIGNAL_RANK[a.tradeSignal]; bVal = TRADE_SIGNAL_RANK[b.tradeSignal]; break
        case 'aiSignal': aVal = AI_SIGNAL_RANK[a.aiSignal]; bVal = AI_SIGNAL_RANK[b.aiSignal]; break
        default: aVal = 0; bVal = 0
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return sorted
  }, [coins, sortField, sortDir])

  const downloadCSV = useCallback(() => {
    if (sortedCoins.length === 0) return
    const header = 'Symbol,Name,Fiyat,24s%,Terminal AI,Trade AI,AI Signal,Saglik,Guven%,Fiyatlama,Risk,MCap'
    const rows = sortedCoins.map(c => [
      c.symbol, `"${c.name}"`, c.current_price.toFixed(6),
      c.price_change_percentage_24h.toFixed(2),
      c.terminalSignal,
      c.tradeSignal,
      c.aiSignal,
      `${c.healthScore} (${c.healthLevel})`,
      Math.round(c.confidence),
      c.valuation,
      c.riskScore,
      c.market_cap,
    ].join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `hermes_crypto_watchlist_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }, [sortedCoins])

  useEffect(() => {
    const stored = localStorage.getItem(WATCHLIST_KEY)
    if (stored) {
      try { setWatchlistIds(JSON.parse(stored)) } catch { /* */ }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === WATCHLIST_KEY && e.newValue) {
        try { setWatchlistIds(JSON.parse(e.newValue)) } catch { /* */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeFromWatchlist = useCallback((id: string) => {
    setWatchlistIds(prev => {
      const next = prev.filter(i => i !== id)
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next))
      return next
    })
    setCoins(prev => prev.filter(c => c.id !== id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WATCHLIST_KEY])

  const loadCoins = useCallback(async () => {
    if (watchlistIds.length === 0) { setCoins([]); return }
    setLoading(true)
    try {
      const idsParam = watchlistIds.join(',')

      // Fetch watchlist market data + Trade AI scan data in parallel
      const [watchRes, ...scanPages] = await Promise.all([
        fetch(`/api/crypto-terminal/watchlist?ids=${encodeURIComponent(idsParam)}`),
        fetch('/api/crypto-terminal/scan?page=1'),
        fetch('/api/crypto-terminal/scan?page=2'),
        fetch('/api/crypto-terminal/scan?page=3'),
        fetch('/api/crypto-terminal/scan?page=4'),
      ])

      if (!watchRes.ok) throw new Error('Failed')
      const data = await watchRes.json()
      const allCoins = data.coins || []

      // Build Trade AI score map from scan results
      const tradeAIMap = new Map<string, { score: number; signalType: string }>()
      for (const pageRes of scanPages) {
        if (!pageRes.ok) continue
        try {
          const pageData = await pageRes.json()
          if (Array.isArray(pageData.results)) {
            for (const r of pageData.results) {
              if (r?.id && r?.tradeAI) {
                tradeAIMap.set(r.id, { score: r.tradeAI.score, signalType: r.tradeAI.signalType })
              }
            }
          }
        } catch { /* skip failed page */ }
      }

      const watchCoins: WatchlistCoin[] = []
      for (const coin of allCoins) {
        const { score, level, anomalies } = calculateHealthScore(coin)

        const supplyRatio = coin.circulating_supply && coin.total_supply && coin.total_supply > 0
          ? Math.min(100, (coin.circulating_supply / coin.total_supply) * 100) : 0
        const fdvMcap = coin.fully_diluted_valuation && coin.market_cap
          ? coin.fully_diluted_valuation / coin.market_cap : 0
        const athDist = Math.abs(coin.ath_change_percentage ?? 0)

        let valuation: ValuationTag = 'NORMAL'
        if (fdvMcap > 0 && fdvMcap < 1.2 && athDist > 70 && supplyRatio > 70) valuation = 'COK UCUZ'
        else if (fdvMcap > 0 && fdvMcap < 1.5 && athDist > 50) valuation = 'UCUZ'
        else if (fdvMcap > 5 || athDist < 3) valuation = 'COK PAHALI'
        else if (fdvMcap > 3 || athDist < 10) valuation = 'PAHALI'

        let riskScore = 50
        const volRatio = coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0
        if (volRatio < 0.01) riskScore += 15
        else if (volRatio > 0.5) riskScore += 10
        if (fdvMcap > 5) riskScore += 15
        else if (fdvMcap > 3) riskScore += 10
        else if (fdvMcap > 0 && fdvMcap < 1.5) riskScore -= 10
        if (athDist > 90) riskScore += 10
        else if (athDist < 10) riskScore -= 5
        if (coin.market_cap >= 10e9) riskScore -= 15
        else if (coin.market_cap >= 1e9) riskScore -= 8
        else if (coin.market_cap < 10e6) riskScore += 12
        riskScore = Math.max(0, Math.min(100, riskScore))

        const confidence = coin.score?.confidence ?? (score > 60 ? 70 : score > 40 ? 50 : 30)

        // Terminal AI signal — fundamental score based
        const fundamentalScore = computeFundamentalScore(coin)
        const terminalSignal = getTerminalSignal(fundamentalScore)

        // Trade AI signal — Z-Score based (from scan results)
        const tradeData = tradeAIMap.get(coin.id)
        const tradeScore = tradeData?.score ?? 50
        const tradeSignal = getTradeSignal(tradeScore)
        const tradeSignalType = tradeData?.signalType ?? 'neutral'

        // AI Signal — cross-signal (teknik x temel)
        const mcapRank = coin.market_cap_rank || 500
        const riskLevel = mcapRank <= 20 ? 'LOW' : mcapRank <= 100 ? 'MODERATE' : 'HIGH'
        const aiSignal = computeAISignal(tradeSignalType, fundamentalScore, riskLevel)

        watchCoins.push({
          id: coin.id,
          symbol: coin.symbol?.toUpperCase() || '',
          name: coin.name || '',
          image: coin.image || '',
          current_price: coin.current_price || 0,
          price_change_percentage_24h: coin.price_change_percentage_24h || 0,
          price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency || 0,
          market_cap: coin.market_cap || 0,
          total_volume: coin.total_volume || 0,
          sparkline_in_7d: coin.sparkline_in_7d || null,
          healthScore: score,
          healthLevel: level,
          anomalies,
          supplyRatio: Math.round(supplyRatio),
          fdvMcap: Math.round(fdvMcap * 10) / 10,
          valuation,
          confidence,
          riskScore,
          terminalSignal,
          tradeSignal,
          tradeScore,
          aiSignal,
        })
      }

      setCoins(watchCoins)
    } catch {
      setCoins([])
    } finally {
      setLoading(false)
    }
  }, [watchlistIds])

  useEffect(() => { loadCoins() }, [loadCoins])

  return (
    <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Star size={20} className="text-[#0d0d0d]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">CRYPTO <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">WATCHLIST</span></h2>
            <p className="text-[10px] text-white/30">{watchlistIds.length} coin takip ediliyor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div ref={searchRef} className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 text-amber-300 hover:from-amber-500/25 hover:border-amber-500/40 transition-all"
            >
              <Plus size={12} className="inline mr-1" />Coin Ekle
            </button>
            {showSearch && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-[#151520] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                    <Search size={13} className="text-white/30 flex-shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      placeholder="Coin ara... (BTC, ETH...)"
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/20"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {searchLoading && <div className="p-3 text-center text-[10px] text-white/30">Araniyor...</div>}
                  {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <div className="p-3 text-center text-[10px] text-white/20">Sonuc bulunamadi</div>
                  )}
                  {searchResults.map(r => {
                    const alreadyAdded = watchlistIds.includes(r.id)
                    const imgUrl = r.thumb || r.large || `https://assets.coingecko.com/coins/images/1/thumb/${r.id}.png`
                    return (
                      <button
                        key={r.id}
                        onClick={() => !alreadyAdded && addToWatchlist(r.id)}
                        disabled={alreadyAdded}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.04] cursor-pointer'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 text-[8px] font-bold text-white/30 uppercase">
                          {r.symbol?.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-white">{r.symbol?.toUpperCase()}</span>
                          <span className="text-[10px] text-white/25 ml-1.5 truncate">{r.name}</span>
                        </div>
                        {alreadyAdded
                          ? <Star size={11} className="text-amber-400 flex-shrink-0" fill="#f59e0b" />
                          : <Plus size={11} className="text-white/20 flex-shrink-0" />
                        }
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {sortedCoins.length > 0 && canCSV && (
            <button onClick={downloadCSV} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] text-white/40 border border-white/8 hover:bg-white/[0.08] hover:text-white/60 transition-all">
              <Download size={12} className="inline mr-1" />CSV
            </button>
          )}
          <button onClick={loadCoins} disabled={loading}
            className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:from-amber-500/25 hover:to-orange-500/15 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/15 hover:scale-[1.03] transition-all duration-300">
            <RefreshCw size={13} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
            Yenile
          </button>
        </div>
      </div>

      {watchlistIds.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
          <Star size={40} className="text-white/10 mb-2 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-white/60 mb-2">Izleme Listesi Bos</h3>
          <p className="text-sm text-white/25 max-w-md">
            Coinlerin yanindaki yildiz ikonuna tiklayarak izleme listenize ekleyin.
            Terminal ve Trade AI modullerinden coin ekleyebilirsiniz.
          </p>
        </div>
      )}

      {/* Watchlist Table */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#151520] rounded-xl border border-white/[0.06] p-3 sm:p-4 h-14 animate-pulse" />
          ))}
        </div>
      )}
      {!loading && sortedCoins.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#0c0c14] z-10">
              <tr>
                <th className="py-2 px-2 w-8"></th>
                <WTH field="symbol">Coin</WTH>
                <WTH field="price" align="right">Fiyat</WTH>
                <WTH field="change24h" align="right">24s</WTH>
                <WTH field="terminalSignal" align="center">Terminal AI</WTH>
                <WTH field="tradeSignal" align="center">Trade AI</WTH>
                <WTH field="aiSignal" align="center">AI Signal</WTH>
                <WTH field="health" align="center">Saglik</WTH>
                <WTH field="confidence" align="center">Guven</WTH>
                <WTH field="valuation" align="center">Fiyatlama</WTH>
                <WTH field="risk" align="center">Risk</WTH>
                <WTH field="marketCap" align="right">MCap</WTH>
                <th className="py-2 px-2 text-[10px] font-bold text-white/30 uppercase text-center">Uyarilar</th>
              </tr>
            </thead>
            <tbody>
              {sortedCoins.map(coin => {
                const cats = getCoinCategories(coin.id)
                const tags = cats.length > 0 ? cats : inferCategoryFromName(coin.name, coin.symbol)
                return (
                  <tr key={coin.id} className="border-b border-white/[0.03] hover:bg-amber-500/[0.03] transition-colors group">
                    <td className="px-2 py-2.5">
                      <button onClick={() => removeFromWatchlist(coin.id)} className="text-white/15 hover:text-red-400 p-0.5 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {coin.image && <img src={coin.image} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-white">{coin.symbol}</span>
                            <span className="text-[10px] text-white/20 hidden lg:inline truncate">{coin.name}</span>
                          </div>
                          {tags.length > 0 && (
                            <div className="flex gap-0.5 mt-0.5">
                              {tags.slice(0, 2).map(t => {
                                const s = getCategoryStyle(t)
                                return <span key={t} className={`text-[7px] font-bold px-1 py-px rounded ${s.bg} ${s.text}`}>{t}</span>
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[11px] text-white font-semibold tabular-nums">{formatPrice(coin.current_price)}</td>
                    <td className={`px-2 py-2.5 text-right text-[11px] font-medium tabular-nums ${coin.price_change_percentage_24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h.toFixed(2)}%
                    </td>
                    {/* Terminal AI Signal */}
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        coin.terminalSignal === 'STRONG' ? 'text-amber-300 bg-amber-500/15 border border-amber-500/30' :
                        coin.terminalSignal === 'GOOD' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25' :
                        coin.terminalSignal === 'WEAK' ? 'text-orange-400 bg-orange-500/10 border border-orange-500/25' :
                        coin.terminalSignal === 'BAD' ? 'text-red-400 bg-red-500/10 border border-red-500/25' :
                        'text-white/35 bg-white/[0.03] border border-white/[0.06]'
                      }`}>{coin.terminalSignal}</span>
                    </td>
                    {/* Trade AI Signal */}
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        coin.tradeSignal === 'STRONG LONG' ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30' :
                        coin.tradeSignal === 'LONG' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                        coin.tradeSignal === 'SHORT' ? 'text-red-400 bg-red-500/10 border border-red-500/20' :
                        coin.tradeSignal === 'STRONG SHORT' ? 'text-red-300 bg-red-500/15 border border-red-500/30' :
                        'text-white/35 bg-white/[0.03] border border-white/[0.06]'
                      }`}>{coin.tradeSignal}</span>
                    </td>
                    {/* AI Signal (Cross) */}
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        coin.aiSignal === 'CONFLUENCE BUY' ? 'text-violet-300 bg-violet-500/15 border border-violet-500/30' :
                        coin.aiSignal === 'ALPHA LONG' ? 'text-amber-300 bg-amber-500/15 border border-amber-500/30' :
                        coin.aiSignal === 'HERMES LONG' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25' :
                        coin.aiSignal === 'HERMES SHORT' ? 'text-red-400 bg-red-500/10 border border-red-500/25' :
                        coin.aiSignal === 'ALPHA SHORT' ? 'text-red-500 bg-red-600/15 border border-red-600/30' :
                        coin.aiSignal === 'CONFLUENCE SELL' ? 'text-fuchsia-400 bg-fuchsia-600/15 border border-fuchsia-600/30' :
                        'text-white/20 bg-transparent'
                      }`}>{coin.aiSignal}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[11px] font-bold tabular-nums ${HEALTH_COLORS[coin.healthLevel]}`}>{coin.healthScore}</span>
                        <div className="w-10 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              coin.healthScore >= 75 ? 'bg-emerald-500' :
                              coin.healthScore >= 60 ? 'bg-emerald-400' :
                              coin.healthScore >= 45 ? 'bg-amber-400' :
                              coin.healthScore >= 30 ? 'bg-orange-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${coin.healthScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold tabular-nums ${coin.confidence >= 70 ? 'text-amber-400' : coin.confidence >= 50 ? 'text-white/60' : 'text-white/25'}`}>
                        %{Math.round(coin.confidence)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        coin.valuation === 'COK UCUZ' ? 'text-emerald-300 bg-emerald-500/15' :
                        coin.valuation === 'UCUZ' ? 'text-emerald-400 bg-emerald-500/10' :
                        coin.valuation === 'PAHALI' ? 'text-orange-400 bg-orange-500/10' :
                        coin.valuation === 'COK PAHALI' ? 'text-red-400 bg-red-500/10' :
                        'text-white/40 bg-white/[0.04]'
                      }`}>{coin.valuation}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[10px] font-bold tabular-nums ${
                        coin.riskScore >= 70 ? 'text-red-400' :
                        coin.riskScore >= 50 ? 'text-orange-400' :
                        coin.riskScore >= 30 ? 'text-white/60' : 'text-emerald-400'
                      }`}>{coin.riskScore}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[11px] text-white/50 tabular-nums">{formatMcap(coin.market_cap)}</td>
                    <td className="px-2 py-2.5 text-center">
                      {coin.anomalies.length > 0 ? (
                        <div className="flex items-center justify-center gap-1" title={coin.anomalies.join(' | ')}>
                          <AlertTriangle size={11} className="text-red-400/60" />
                          <span className="text-[9px] text-red-400/70">{coin.anomalies.length}</span>
                        </div>
                      ) : (
                        <Shield size={11} className="text-emerald-400/30 mx-auto" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

