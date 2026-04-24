'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — AI SIGNALS Module
// Coins API + HERMES AI Score x Sparkline Momentum Capraz Sinyal
// 6-Sinyal Konsensus | /api/crypto-terminal/coins (hizli, cache'li)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Radio, RefreshCw, Star, Download } from 'lucide-react'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'
import { runSqueezeGuard, isShortSignal, SqueezeGuardInput, SqueezeGuardResult } from '@/lib/crypto-terminal/squeeze-guard'

type BestSignalType =
  | 'confluence_buy' | 'alpha_long' | 'hermes_long'
  | 'hermes_short' | 'alpha_short' | 'confluence_sell'

type ValuationTag = 'COK UCUZ' | 'UCUZ' | 'NORMAL' | 'PAHALI' | 'COK PAHALI' | ''

interface SignalRow {
  id: string
  symbol: string
  name: string
  image: string
  signalType: BestSignalType
  teknikSignal: string
  teknikScore: number
  zscore: number
  fundamentalScore: number
  fundamentalLevel: string
  confidence: number
  valuation: ValuationTag
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH'
  price: number
  change24h: number
  marketCap: number
  vwapDistPct: number
  overvalLevel: string
  overvalScore: number
  chiLevel: string
  chiScore: number
  shortBlocked: boolean
  targetPrice?: number | null
  floorPrice?: number | null
  targetPct?: number | null
  riskReward?: number | null
}

interface DerivativesFundingMap {
  [symbol: string]: {
    avgRate: number
    fundingZScore: number
    spreadPct: number
    oiChangePct: number
  }
}

interface CoinData {
  id: string
  symbol: string
  name: string
  image: string
  price: number
  change1h: number
  change24h: number
  change7d: number
  change30d: number
  marketCap: number
  marketCapRank: number
  volume24h: number
  volumeToMcap: number
  circulatingSupply: number
  totalSupply: number | null
  maxSupply: number | null
  ath: number
  athChangePercent: number
  fdv: number | null
  sparkline7d: number[]
  score: {
    total: number
    level: string
    confidence: number
    degraded: boolean
  } | null
  overvaluation?: {
    score: number
    level: 'EXTREME' | 'HIGH' | 'MODERATE' | 'FAIR' | 'UNDERVALUED'
  } | null
  healthIndex?: {
    score: number
    level: 'HEALTHY' | 'CAUTION' | 'RISKY' | 'CRITICAL'
  } | null
  priceTarget?: {
    targetPrice: number
    floorPrice: number
    targetPct: number
    floorPct: number
    riskReward: number
    zone: string
    confidence: number
    method: string
  } | null
}

const SIGNAL_ORDER: BestSignalType[] = [
  'confluence_buy', 'alpha_long', 'hermes_long',
  'hermes_short', 'alpha_short', 'confluence_sell',
]

const SIGNAL_CONFIG: Record<BestSignalType, {
  label: string; bg: string; text: string; border: string; badgeBg: string
}> = {
  confluence_buy: { label: 'CONFLUENCE BUY', bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/40', badgeBg: 'bg-violet-500/25' },
  alpha_long: { label: 'ALPHA LONG', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30', badgeBg: 'bg-amber-500/20' },
  hermes_long: { label: 'HERMES LONG', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', badgeBg: 'bg-emerald-500/20' },
  hermes_short: { label: 'HERMES SHORT', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', badgeBg: 'bg-red-500/20' },
  alpha_short: { label: 'ALPHA SHORT', bg: 'bg-red-600/15', text: 'text-red-500', border: 'border-red-600/40', badgeBg: 'bg-red-600/25' },
  confluence_sell: { label: 'CONFLUENCE SELL', bg: 'bg-fuchsia-600/15', text: 'text-fuchsia-400', border: 'border-fuchsia-600/40', badgeBg: 'bg-fuchsia-600/25' },
}

// Sparkline-based momentum score (0-100): low = oversold/bullish, high = overbought/bearish
function computeSparklineMomentum(sparkline: number[]): { score: number; trend: string } {
  if (!sparkline || sparkline.length < 24) return { score: 50, trend: 'NOTR' }

  const n = sparkline.length
  const last = sparkline[n - 1]
  const first = sparkline[0]
  if (!last || !first || first === 0) return { score: 50, trend: 'NOTR' }

  const totalChange = (last - first) / first
  const recentSlice = sparkline.slice(-24)
  const recentFirst = recentSlice[0]
  const recentChange = recentFirst > 0 ? (last - recentFirst) / recentFirst : 0

  // Mean of sparkline
  let sum = 0
  for (const p of sparkline) sum += p
  const mean = sum / n

  // Simple Z-score: how far is current price from 7d mean, normalized by range
  const min = Math.min(...sparkline)
  const max = Math.max(...sparkline)
  const range = max - min
  const zLike = range > 0 ? (last - mean) / range : 0

  // Score: 50 + contribution from 7d change + recent change + position in range
  const raw = 50
    + totalChange * 150   // 7d momentum
    + recentChange * 100  // 24h momentum boost
    + zLike * 30          // position in range

  const score = Math.round(Math.max(0, Math.min(100, raw)))

  let trend: string
  if (score <= 20) trend = 'STRONG LONG'
  else if (score <= 35) trend = 'LONG'
  else if (score >= 90) trend = 'STRONG SHORT'
  else if (score >= 70) trend = 'SHORT'
  else trend = 'NOTR'

  return { score, trend }
}

function matchSignal(
  teknikSignalType: string,
  fundamentalScore: number,
  riskLevel: string,
  overvalLevel?: string,
  chiLevel?: string,
): BestSignalType | null {
  if (teknikSignalType === 'strong_long' || teknikSignalType === 'long') {
    const aiLevel = fundamentalScore >= 80 ? 'STRONG' : fundamentalScore >= 60 ? 'GOOD' : fundamentalScore >= 40 ? 'NEUTRAL' : 'WEAK'
    const isHealthy = chiLevel === 'HEALTHY'
    const isNotOvervalued = overvalLevel === 'FAIR' || overvalLevel === 'UNDERVALUED'
    if ((aiLevel === 'STRONG' || aiLevel === 'GOOD') && riskLevel === 'LOW' && (isHealthy || isNotOvervalued)) return 'confluence_buy'
    if (aiLevel === 'STRONG' || (aiLevel === 'GOOD' && isHealthy)) return 'alpha_long'
    if (aiLevel === 'GOOD' || aiLevel === 'NEUTRAL') return 'hermes_long'
  }
  if (teknikSignalType === 'strong_short' || teknikSignalType === 'short') {
    const aiLevel = fundamentalScore >= 40 ? 'NEUTRAL' : fundamentalScore >= 20 ? 'WEAK' : 'BAD'
    const isOvervalued = overvalLevel === 'EXTREME' || overvalLevel === 'HIGH'
    const isUnhealthy = chiLevel === 'RISKY' || chiLevel === 'CRITICAL'
    if ((aiLevel === 'BAD' || aiLevel === 'WEAK') && riskLevel === 'HIGH' && (isOvervalued || isUnhealthy)) return 'confluence_sell'
    if (aiLevel === 'BAD' || (aiLevel === 'WEAK' && isOvervalued)) return 'alpha_short'
    if (aiLevel === 'WEAK' || aiLevel === 'NEUTRAL') return 'hermes_short'
  }
  return null
}

function generateSignalRows(coins: CoinData[], fundingMap: DerivativesFundingMap = {}, slaBlocked = false): SignalRow[] {
  const rows: SignalRow[] = []

  for (const coin of coins) {
    const { score: momentum, trend } = computeSparklineMomentum(coin.sparkline7d)

    let teknikSignalType: string
    if (momentum <= 20) teknikSignalType = 'strong_long'
    else if (momentum <= 35) teknikSignalType = 'long'
    else if (momentum >= 90) teknikSignalType = 'strong_short'
    else if (momentum >= 70) teknikSignalType = 'short'
    else teknikSignalType = 'neutral'

    if (teknikSignalType === 'neutral') continue

    // Use HERMES AI Score as fundamental score, fallback to market-cap based estimate
    let fundamentalScore: number
    if (coin.score && !coin.score.degraded) {
      fundamentalScore = coin.score.total
    } else {
      const mcapRank = coin.marketCapRank || 500
      const supplyRatio = coin.circulatingSupply && coin.totalSupply && coin.totalSupply > 0
        ? coin.circulatingSupply / coin.totalSupply : 0.5
      const volRatio = coin.volumeToMcap || 0

      fundamentalScore = Math.round(
        (mcapRank <= 10 ? 80 : mcapRank <= 50 ? 65 : mcapRank <= 200 ? 50 : mcapRank <= 500 ? 35 : 20) * 0.35 +
        (supplyRatio > 0.7 ? 70 : supplyRatio > 0.4 ? 55 : 35) * 0.25 +
        (volRatio > 0.1 ? 75 : volRatio > 0.05 ? 55 : 30) * 0.2 +
        (Math.abs(coin.athChangePercent) > 50 ? 60 : 40) * 0.2
      )
    }

    const fundamentalLevel = fundamentalScore >= 80 ? 'STRONG'
      : fundamentalScore >= 60 ? 'GOOD'
      : fundamentalScore >= 40 ? 'NEUTRAL'
      : fundamentalScore >= 20 ? 'WEAK' : 'BAD'

    const mcapRank = coin.marketCapRank || 500
    const riskLevel: SignalRow['riskLevel'] = mcapRank <= 20 ? 'LOW' : mcapRank <= 100 ? 'MODERATE' : 'HIGH'

    const overvalLevel = coin.overvaluation?.level || ''
    const chiLevel = coin.healthIndex?.level || ''

    let signalType = matchSignal(teknikSignalType, fundamentalScore, riskLevel, overvalLevel, chiLevel)
    if (!signalType) continue

    // HERMES_FIX: SLA_FAILCLOSED_v1 — Block short/sell signals when data is stale
    // HERMES_FIX: SQUEEZE_GUARD_v1 2026-02-19 SEVERITY: CRITICAL
    // All short signals must pass through squeeze guard. Fail-closed.
    let shortBlocked = false
    if (isShortSignal(signalType) && slaBlocked) {
      shortBlocked = true
      signalType = null
    }
    if (signalType && isShortSignal(signalType)) {
      const sym = coin.symbol?.toUpperCase() || ''
      const fData = fundingMap[sym]
      const sparkline = coin.sparkline7d || []
      const p1h = coin.change1h ?? undefined
      const p24h = coin.change24h ?? undefined
      // Approximate 4h change from sparkline (last 24 points = ~4h of 7d/168pt sparkline)
      let p4h: number | undefined
      if (sparkline.length >= 24) {
        const ref = sparkline[sparkline.length - 24]
        const last = sparkline[sparkline.length - 1]
        if (ref > 0) p4h = ((last - ref) / ref) * 100
      }
      // Approximate realized volatility Z from sparkline
      let rvZ: number | undefined
      if (sparkline.length >= 48) {
        const returns: number[] = []
        for (let i = 1; i < sparkline.length; i++) {
          if (sparkline[i - 1] > 0) returns.push((sparkline[i] - sparkline[i - 1]) / sparkline[i - 1])
        }
        if (returns.length > 10) {
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length
          const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
          const std = Math.sqrt(variance)
          const recent = returns.slice(-24)
          const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length
          const recentStd = Math.sqrt(recent.reduce((a, b) => a + (b - recentMean) ** 2, 0) / recent.length)
          if (std > 0) rvZ = (recentStd - std) / std
        }
      }

      const guardInput: SqueezeGuardInput = {
        fundingRate: fData?.avgRate,
        fundingZScore: fData?.fundingZScore,
        openInterestChange24hPct: fData?.oiChangePct,
        openInterestChange7dPct: undefined,
        priceChange1hPct: p1h,
        priceChange4hPct: p4h,
        priceChange24hPct: p24h,
        dexLiquidityUSD: undefined,
        volume24h: coin.volume24h ?? undefined,
        spreadPct: fData?.spreadPct,
        realizedVolatilityZ: rvZ,
        marketCapRank: coin.marketCapRank ?? undefined,
        dataFreshnessMinutes: fData ? 5 : undefined,
      }

      const guard = runSqueezeGuard(guardInput)
      if (guard.blocked) {
        shortBlocked = true
        signalType = null
      }
    }

    if (!signalType) continue

    let overvalBoost = 0
    let chiBoost = 0
    if (signalType.includes('long') || signalType === 'confluence_buy') {
      if (chiLevel === 'HEALTHY') chiBoost = 8
      else if (chiLevel === 'CAUTION') chiBoost = 3
      if (overvalLevel === 'UNDERVALUED') overvalBoost = 6
      else if (overvalLevel === 'FAIR') overvalBoost = 3
    } else {
      if (overvalLevel === 'EXTREME') overvalBoost = 10
      else if (overvalLevel === 'HIGH') overvalBoost = 5
      if (chiLevel === 'CRITICAL') chiBoost = 8
      else if (chiLevel === 'RISKY') chiBoost = 4
    }

    const confidence = Math.min(95, Math.round(
      40
      + Math.abs(momentum - 50) * 0.4
      + (fundamentalScore > 65 || fundamentalScore < 35 ? 12 : 0)
      + (coin.score ? 10 : 0)
      + (coin.sparkline7d.length >= 168 ? 5 : 0)
      + overvalBoost
      + chiBoost
    ))

    const fdvMcap = coin.fdv && coin.marketCap ? coin.fdv / coin.marketCap : 0
    const athDist = Math.abs(coin.athChangePercent ?? 0)
    const supplyRatio = coin.circulatingSupply && coin.totalSupply && coin.totalSupply > 0
      ? coin.circulatingSupply / coin.totalSupply : 0.5
    let valuation: ValuationTag = 'NORMAL'
    if (fdvMcap > 0 && fdvMcap < 1.2 && athDist > 70 && supplyRatio > 0.7) valuation = 'COK UCUZ'
    else if (fdvMcap > 0 && fdvMcap < 1.5 && athDist > 50) valuation = 'UCUZ'
    else if (fdvMcap > 5 || athDist < 3) valuation = 'COK PAHALI'
    else if (fdvMcap > 3 || athDist < 10) valuation = 'PAHALI'

    // Approximate VWAP dist from sparkline mean
    const sparkMean = coin.sparkline7d.length > 0
      ? coin.sparkline7d.reduce((a, b) => a + b, 0) / coin.sparkline7d.length : 0
    const vwapDistPct = sparkMean > 0 ? ((coin.price - sparkMean) / sparkMean) * 100 : 0

    rows.push({
      id: coin.id,
      symbol: coin.symbol?.toUpperCase() || '',
      name: coin.name || '',
      image: coin.image || '',
      signalType,
      teknikSignal: trend,
      teknikScore: momentum,
      zscore: +(vwapDistPct / 10).toFixed(2),
      fundamentalScore,
      fundamentalLevel,
      confidence,
      valuation,
      riskLevel,
      price: coin.price,
      change24h: coin.change24h || 0,
      marketCap: coin.marketCap,
      vwapDistPct: +vwapDistPct.toFixed(2),
      overvalLevel,
      overvalScore: coin.overvaluation?.score ?? -1,
      chiLevel,
      chiScore: coin.healthIndex?.score ?? -1,
      shortBlocked: false,
      targetPrice: coin.priceTarget?.targetPrice ?? null,
      floorPrice: coin.priceTarget?.floorPrice ?? null,
      targetPct: coin.priceTarget?.targetPct ?? null,
      riskReward: coin.priceTarget?.riskReward ?? null,
    })
  }

  return rows.sort((a, b) => {
    const ia = SIGNAL_ORDER.indexOf(a.signalType)
    const ib = SIGNAL_ORDER.indexOf(b.signalType)
    if (ia !== ib) return ia - ib
    return a.teknikScore - b.teknikScore
  })
}

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  return `$${p.toFixed(6)}`
}

function formatMcap(v: number): string {
  if (!v) return '-'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

export interface ModuleCryptoSignalsProps {
  onSelectCoin?: (coinId: string) => void
}

export default function ModuleCryptoSignals({ onSelectCoin }: ModuleCryptoSignalsProps = {}) {
  const canCSV = useCanDownloadCSV()
  const [rows, setRows] = useState<SignalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<BestSignalType | 'all'>('all')
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<string>('signal')
  const [sortAsc, setSortAsc] = useState(true)
  const [coinCount, setCoinCount] = useState(0)

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

  const [slaWarning, setSlaWarning] = useState<string | null>(null)

  const loadSignals = useCallback(async () => {
    setLoading(true)
    try {
      // HERMES_FIX: SLA_FAILCLOSED_v1 — Fetch health SLA alongside data for fail-closed
      const [coinsRes, derivRes, healthRes] = await Promise.allSettled([
        fetch('/api/crypto-terminal/coins?page=1'),
        fetch('/api/crypto-terminal/derivatives'),
        fetch('/api/system/health'),
      ])

      const coinsData = coinsRes.status === 'fulfilled' && coinsRes.value.ok
        ? await coinsRes.value.json() : null
      const derivData = derivRes.status === 'fulfilled' && derivRes.value.ok
        ? await derivRes.value.json() : null
      const healthData = healthRes.status === 'fulfilled' && healthRes.value.ok
        ? await healthRes.value.json() : null

      // HERMES_FIX: SLA_FAILCLOSED_v1 — Check SLA breaches to block risk outputs
      const sla = healthData?.sla as { scanBreached?: boolean; derivativesBreached?: boolean; coinsBulkBreached?: boolean } | undefined
      const hasSlaBreach = sla?.scanBreached || sla?.derivativesBreached
      if (hasSlaBreach) {
        setSlaWarning(sla?.scanBreached ? 'Scan data stale' : 'Derivatives data stale')
      } else {
        setSlaWarning(null)
      }

      const coins: CoinData[] = coinsData?.coins || []
      setCoinCount(coins.length)

      // Build funding map from derivatives data for squeeze guard
      const fundingMap: DerivativesFundingMap = {}
      if (derivData?.fundingRates && Array.isArray(derivData.fundingRates)) {
        const allRates = derivData.fundingRates as Array<{ symbol: string; avgRate: number; rates: number[] }>
        const allAvgRates = allRates.map(r => r.avgRate).filter(r => r !== 0)
        const mean = allAvgRates.length > 0 ? allAvgRates.reduce((a, b) => a + b, 0) / allAvgRates.length : 0
        const std = allAvgRates.length > 1
          ? Math.sqrt(allAvgRates.reduce((a, b) => a + (b - mean) ** 2, 0) / (allAvgRates.length - 1))
          : 1
        for (const entry of allRates) {
          const fz = std > 0 ? (entry.avgRate - mean) / std : 0
          fundingMap[entry.symbol] = {
            avgRate: entry.avgRate,
            fundingZScore: fz,
            spreadPct: 0,
            oiChangePct: 0,
          }
        }
      }

      setRows(generateSignalRows(coins, fundingMap, hasSlaBreach))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSignals() }, [loadSignals])

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const filtered = useMemo(() => {
    const data = filter === 'all' ? rows : rows.filter(r => r.signalType === filter)
    const sorted = [...data]
    sorted.sort((a, b) => {
      let va: number, vb: number
      switch (sortField) {
        case 'teknikScore': va = a.teknikScore; vb = b.teknikScore; break
        case 'aiScore': va = a.fundamentalScore; vb = b.fundamentalScore; break
        case 'confidence': va = a.confidence; vb = b.confidence; break
        case 'price': va = a.price; vb = b.price; break
        case 'change': va = a.change24h; vb = b.change24h; break
        case 'mcap': va = a.marketCap; vb = b.marketCap; break
        default: {
          const ia = SIGNAL_ORDER.indexOf(a.signalType)
          const ib = SIGNAL_ORDER.indexOf(b.signalType)
          if (ia !== ib) return sortAsc ? ia - ib : ib - ia
          va = a.teknikScore; vb = b.teknikScore; break
        }
      }
      return sortAsc ? va - vb : vb - va
    })
    return sorted
  }, [rows, filter, sortField, sortAsc])

  const signalCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const type of SIGNAL_ORDER) counts[type] = 0
    for (const r of rows) counts[r.signalType] = (counts[r.signalType] || 0) + 1
    return counts
  }, [rows])

  const buyCount = rows.filter(r => ['confluence_buy', 'alpha_long', 'hermes_long'].includes(r.signalType)).length
  const sellCount = rows.filter(r => ['hermes_short', 'alpha_short', 'confluence_sell'].includes(r.signalType)).length

  const downloadCSV = () => {
    const header = 'Symbol,Name,Sinyal,Momentum,Momentum Skor,HERMES Skor,Guven%,Overval,CHI,Fiyatlama,Risk,Fiyat,Degisim%,MCap'
    const csvRows = filtered.map(r => {
      const cfg = SIGNAL_CONFIG[r.signalType]
      return [
        r.symbol,
        `"${r.name}"`,
        cfg.label,
        r.teknikSignal,
        r.teknikScore,
        r.fundamentalScore,
        r.confidence,
        r.overvalLevel || '-',
        r.chiLevel || '-',
        r.valuation || 'NORMAL',
        r.riskLevel,
        r.price.toFixed(6),
        r.change24h.toFixed(2),
        r.marketCap,
      ].join(',')
    })
    const csv = [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `hermes_crypto_signals_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold cursor-pointer hover:text-text-secondary transition-colors select-none whitespace-nowrap"
    >
      {children}
      {sortField === field && <span className="ml-0.5 text-amber-400">{sortAsc ? '\u25B2' : '\u25BC'}</span>}
    </th>
  )

  return (
    <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Radio size={20} className="text-[#0d0d0d]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">CRYPTO AI <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">SIGNALS</span></h2>
            <p className="text-[10px] text-text-tertiary">HERMES AI Skor x Momentum x Overval x CHI Capraz Sinyal | {coinCount > 0 ? `${coinCount} coin` : ''}</p>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">{buyCount} ALIS</span>
            <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-bold text-red-400">{sellCount} SATIS</span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-stroke text-[10px] font-bold text-text-tertiary">{rows.length} TOPLAM</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && canCSV && (
            <button onClick={downloadCSV} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-3 text-text-tertiary border border-white/8 hover:bg-surface-3 hover:text-text-secondary transition-all">
              <Download size={12} className="inline mr-1" />CSV
            </button>
          )}
          {loading && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-bold">
              <RefreshCw size={13} className="animate-spin" />Guncelleniyor...
            </span>
          )}
        </div>
      </div>

      {/* SLA warning kaldirildi — kullanici deneyimini bozuyor */}

      {/* Signal Filter Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-200
            ${filter === 'all'
              ? 'bg-gradient-to-r from-violet-500/15 to-violet-600/8 text-violet-300 border-violet-500/35'
              : 'text-text-tertiary border-stroke-subtle hover:text-text-secondary hover:border-stroke'}`}
        >
          TUMU ({rows.length})
        </button>
        {SIGNAL_ORDER.map(type => {
          const cfg = SIGNAL_CONFIG[type]
          const count = signalCounts[type] || 0
          const isActive = filter === type
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-200
                ${isActive
                  ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                  : 'text-text-tertiary border-stroke-subtle hover:text-text-secondary hover:border-stroke'}`}
            >
              {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-surface-3 rounded-2xl border border-stroke-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-1 border-b border-stroke-subtle">
                <th className="w-8 px-2 py-2"></th>
                <SortHeader field="symbol">COIN</SortHeader>
                <SortHeader field="signal">SINYAL</SortHeader>
                <SortHeader field="teknikScore">MOMENTUM</SortHeader>
                <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold whitespace-nowrap">SKOR</th>
                <SortHeader field="aiScore">HERMES AI</SortHeader>
                <SortHeader field="confidence">GUVEN</SortHeader>
                <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold whitespace-nowrap" title="Asiri Deger Skoru">OVERVAL</th>
                <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold whitespace-nowrap" title="Crypto Health Index">CHI</th>
                <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold whitespace-nowrap">FIYATLAMA</th>
                <SortHeader field="price">FIYAT</SortHeader>
                <SortHeader field="change">DEGISIM%</SortHeader>
                <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold whitespace-nowrap text-right hidden xl:table-cell" title="Hedef Fiyat">HEDEF</th>
                <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold whitespace-nowrap text-right hidden xl:table-cell" title="Dip Fiyat">DIP</th>
                <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-text-tertiary font-semibold whitespace-nowrap text-center hidden xl:table-cell" title="Risk/Odul Orani">R:R</th>
                <SortHeader field="mcap">MCAP</SortHeader>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td colSpan={16} className="px-3 py-3"><div className="h-4 bg-surface-2 animate-pulse rounded-lg" /></td>
                </tr>
              ))}
              {!loading && filtered.map(r => {
                const cfg = SIGNAL_CONFIG[r.signalType]
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectCoin?.(r.id)}
                    className={`border-b border-white/[0.03] hover:bg-violet-500/[0.03] transition-colors ${onSelectCoin ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleWatchlist(r.id)} className="text-text-tertiary hover:text-amber-400 transition-colors">
                        <Star size={12} fill={watchlist.has(r.id) ? '#f59e0b' : 'none'} className={watchlist.has(r.id) ? 'text-amber-400' : ''} />
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        {r.image && <img src={r.image} alt="" className="w-4 h-4 rounded-full" />}
                        <span className="font-bold text-white text-[11px]">{r.symbol}</span>
                        <span className="text-[8px] text-text-tertiary hidden sm:inline">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black border ${cfg.badgeBg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`text-[10px] font-semibold ${
                        r.teknikScore <= 20 ? 'text-amber-400' :
                        r.teknikScore <= 35 ? 'text-emerald-400' :
                        r.teknikScore >= 90 ? 'text-red-500' :
                        r.teknikScore >= 70 ? 'text-red-400' : 'text-text-tertiary'
                      }`}>
                        {r.teknikSignal}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={`text-[10px] font-bold tabular-nums ${
                        r.teknikScore <= 30 ? 'text-emerald-400' : r.teknikScore >= 70 ? 'text-red-400' : 'text-text-tertiary'
                      }`}>{r.teknikScore}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`text-[10px] font-semibold ${
                        r.fundamentalLevel === 'STRONG' ? 'text-amber-400' :
                        r.fundamentalLevel === 'GOOD' ? 'text-emerald-400' :
                        r.fundamentalLevel === 'WEAK' ? 'text-orange-400' :
                        r.fundamentalLevel === 'BAD' ? 'text-red-400' : 'text-text-tertiary'
                      }`}>{r.fundamentalLevel}</span>
                      <span className="text-[9px] text-text-tertiary ml-1">{r.fundamentalScore}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[10px] font-bold tabular-nums ${
                        r.confidence >= 70 ? 'text-amber-400' : r.confidence >= 50 ? 'text-text-secondary' : 'text-text-tertiary'
                      }`}>{r.confidence}%</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r.overvalLevel ? (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                          r.overvalLevel === 'EXTREME' ? 'text-red-400 bg-red-500/15' :
                          r.overvalLevel === 'HIGH' ? 'text-orange-400 bg-orange-500/10' :
                          r.overvalLevel === 'MODERATE' ? 'text-text-tertiary bg-surface-2' :
                          r.overvalLevel === 'FAIR' ? 'text-emerald-400 bg-emerald-500/10' :
                          'text-emerald-300 bg-emerald-500/15'
                        }`}>
                          {r.overvalLevel === 'EXTREME' ? 'ASIRI' :
                           r.overvalLevel === 'HIGH' ? 'YUKSEK' :
                           r.overvalLevel === 'MODERATE' ? 'ORTA' :
                           r.overvalLevel === 'FAIR' ? 'UYGUN' : 'UCUZ'}
                        </span>
                      ) : <span className="text-[10px] text-text-quaternary">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r.chiLevel ? (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                          r.chiLevel === 'HEALTHY' ? 'text-emerald-400 bg-emerald-500/15' :
                          r.chiLevel === 'CAUTION' ? 'text-amber-400 bg-amber-500/10' :
                          r.chiLevel === 'RISKY' ? 'text-orange-400 bg-orange-500/10' :
                          'text-red-400 bg-red-500/15'
                        }`}>
                          {r.chiLevel === 'HEALTHY' ? 'SAGLIKLI' :
                           r.chiLevel === 'CAUTION' ? 'DIKKAT' :
                           r.chiLevel === 'RISKY' ? 'RISKLI' : 'KRITIK'}
                        </span>
                      ) : <span className="text-[10px] text-text-quaternary">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        r.valuation === 'COK UCUZ' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' :
                        r.valuation === 'UCUZ' ? 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15' :
                        r.valuation === 'PAHALI' ? 'text-orange-400 bg-orange-500/8 border-orange-500/15' :
                        r.valuation === 'COK PAHALI' ? 'text-red-400 bg-red-500/8 border-red-500/15' :
                        'text-text-tertiary bg-surface-2 border-stroke-subtle'
                      }`}>{r.valuation || 'NORMAL'}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-[10px] font-medium text-white tabular-nums">{formatPrice(r.price)}</span>
                    </td>
                    <td className={`px-2 py-2 text-right text-[10px] font-medium tabular-nums ${r.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.change24h >= 0 ? '+' : ''}{r.change24h.toFixed(2)}%
                    </td>
                    <td className="px-2 py-2 text-right hidden xl:table-cell">
                      {r.targetPrice != null ? (
                        <span className={`text-[10px] font-mono font-semibold ${(r.targetPct ?? 0) >= 0 ? 'text-success-400' : 'text-red-400'}`}>
                          ${r.targetPrice < 1 ? r.targetPrice.toPrecision(4) : r.targetPrice.toFixed(2)}
                        </span>
                      ) : <span className="text-[10px] text-text-quaternary">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right hidden xl:table-cell">
                      {r.floorPrice != null ? (
                        <span className="text-[10px] font-mono text-red-400/80">
                          ${r.floorPrice < 1 ? r.floorPrice.toPrecision(4) : r.floorPrice.toFixed(2)}
                        </span>
                      ) : <span className="text-[10px] text-text-quaternary">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center hidden xl:table-cell">
                      {r.riskReward != null ? (
                        <span className={`text-[10px] font-mono font-bold ${
                          r.riskReward >= 2 ? 'text-success-400' :
                          r.riskReward >= 1 ? 'text-gold-300' : 'text-red-400'
                        }`}>{r.riskReward.toFixed(1)}</span>
                      ) : <span className="text-[10px] text-text-quaternary">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-[10px] text-text-tertiary tabular-nums">{formatMcap(r.marketCap)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-text-quaternary text-sm">
            Aktif sinyal bulunamadi
          </div>
        )}
        <div className="px-4 py-2 border-t border-stroke-subtle flex justify-between">
          <span className="text-[10px] text-text-tertiary">{filtered.length} sinyal gosteriliyor / {rows.length} toplam</span>
          <span className="text-[10px] text-text-quaternary">HERMES AI Score x Momentum x Overvaluation x CHI</span>
        </div>
      </div>
    </div>
  )
}
