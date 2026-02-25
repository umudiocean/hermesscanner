'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNasdaqTradeContext } from '../Layout'
import { getWatchlist, toggleWatchlist } from '@/lib/store'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'
import { useSignalRenderGuard } from '@/lib/hooks/useSignalRenderGuard'
import { PriceFlashCell, ScoreMiniBar } from '../premium-ui'
import SystemFreshnessBadge from '../SystemFreshnessBadge'
import LegalDisclaimerStrip from '../LegalDisclaimerStrip'
import { CSV_HEADERS, REVISION_TOOLTIPS } from './shared/revision-contract'

// ================================================================
// AI SIGNALS Module — V5
// NASDAQ TEKNIK + HERMES AI Terminal + Overvaluation Motor
// 6 sinyal: CONFLUENCE BUY/SELL, ALPHA LONG/SHORT, HERMES LONG/SHORT
//
// V5 Yenilikler:
//   - Overvaluation Score (0-100) short sinyalleri guclendirir
//   - SQUEEZE GUARD: shortFloat > 20% + yukselis → short engellenir
//   - CONFLUENCE SELL: Overval HIGH dahil edildi (AI BAD olmasa bile)
//   - ALPHA SHORT: Overval EXTREME (>=80) dahil edildi
// ================================================================

type BestSignalType =
  | 'confluence_buy' | 'alpha_long' | 'hermes_long' | 'smart_long' | 'signal_long'
  | 'signal_short' | 'smart_short' | 'hermes_short' | 'alpha_short' | 'confluence_sell'

interface BestSignalItem {
  symbol: string
  segment: string
  signalType: BestSignalType
  // NASDAQ TEKNIK
  teknikSignalType: string
  teknikScore: number
  // Hermes AI Terminal
  aiSignal: string
  aiScore: number
  // Market data
  price: number
  changePercent: number
  marketCap: number
  sector: string
  // FMP extras
  confidence: number
  signalConfidence: number
  valuationLabel: string
  overvalScore: number
  overvalLevel: string
  earningsDays: number | null
  analystEpsRevision30d: number
  analystEpsRevision90d: number
  // Target/Floor price
  targetPrice: number | null
  floorPrice: number | null
  riskReward: number | null
  zone: string | null
}

interface FmpStock {
  symbol: string
  companyName: string
  sector: string
  price: number
  changePercent: number
  marketCap: number
  signal: string
  signalScore: number
  // V2 fields
  confidence?: number
  altmanZ?: number
  piotroski?: number
  dcfUpside?: number
  analystConsensus?: string
  riskScore?: number
  riskLevel?: string
  valuationScore?: number
  valuationLabel?: string
  categories?: {
    valuation: number; health: number; growth: number; analyst: number; quality: number
    momentum: number; sector: number; smartMoney: number
  }
  // V5 fields
  overvalScore?: number
  overvalLevel?: string
  badges?: Array<{ type: string; label: string; severity: string }>
  shortFloat?: number
  priceTarget?: number
  yearHigh?: number
  yearLow?: number
  analystEpsRevision30d?: number
  analystEpsRevision90d?: number
}

// SADECE 6 SINYAL — Gorselde gorunen final liste
const SIGNAL_ORDER: BestSignalType[] = [
  'confluence_buy', 'alpha_long', 'hermes_long',
  'hermes_short', 'alpha_short', 'confluence_sell',
]

// KALDIRILDI: smart_long, signal_long, signal_short, smart_short

// Sutun tooltip aciklamalari
const COLUMN_TIPS: Record<string, string> = {
  symbol: 'Hisse sembolu',
  sector: 'Sirketin faaliyet gosterdigi sektor',
  bestSignal: 'BEST SINYAL: Teknik ve temel analiz birlesimi. CONFLUENCE = en guclu, ALPHA = cok guclu, HERMES = guvenilir',
  nTeknik: 'TEKNIK SINYAL: Z-Score + VWAP bazli teknik analiz sonucu. STRONG LONG/SHORT = en guclu, LONG/SHORT = guclu',
  teknikScore: 'TEKNIK SKOR (0-100): <=20 STRONG LONG, 21-30 LONG, 31-69 NOTR, 70-89 SHORT, >=90 STRONG SHORT',
  hAi: 'HERMES AI SINYAL: Temel analiz sonucu. STRONG = cok iyi, GOOD = iyi, NEUTRAL = notr, WEAK = zayif, BAD = kotu',
  aiScore: 'HERMES AI SKOR (0-100): Sirketin temel analiz puani. Percentile bazli hesaplanir.',
  confidence: 'GUVEN: Sinyal guveni (%). Teknik-temel uyum, risk ve squeeze/overval guard etkisine gore hesaplanir.',
  valuation: 'FIYATLAMA: Ucuzluk/Pahalik seviyesi. COK UCUZ, UCUZ, NORMAL, PAHALI, COK PAHALI',
  price: 'GUNCEL FIYAT: Hissenin son islem fiyati ($)',
  changePercent: 'GUNLUK DEGISIM: Bugunun fiyat degisimi (%)',
  marketCap: 'PIYASA DEGERI: Sirketin toplam degeri (B=Milyar, M=Milyon)',
  rev30: REVISION_TOOLTIPS.rev30,
  rev90: REVISION_TOOLTIPS.rev90,
}

function daysUntil(dateStr: string): number | null {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const a = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const b = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function calcSignalConfidence(
  signalType: BestSignalType,
  teknikSignalType: string,
  aiSignal: string,
  fmpConfidence: number,
  riskScore?: number,
  overvalScore?: number,
  earningsDays?: number | null,
): number {
  let score = Math.max(30, Math.min(100, fmpConfidence || 50))

  // Strong technical states are more reliable than neutral edge cases.
  if (teknikSignalType === 'strong_long' || teknikSignalType === 'strong_short') score += 8
  else if (teknikSignalType === 'long' || teknikSignalType === 'short') score += 3

  // AI quality alignment
  if (aiSignal === 'STRONG' || aiSignal === 'BAD') score += 6
  else if (aiSignal === 'GOOD' || aiSignal === 'WEAK') score += 3

  // Risk-aware adjustment
  if (riskScore !== undefined) {
    if (signalType.includes('long') && riskScore > 65) score -= 10
    if (signalType.includes('short') && riskScore < 35) score -= 8
  }

  // Overvaluation supports short confidence, weakens long confidence.
  if (overvalScore !== undefined) {
    if (signalType.includes('short') && overvalScore >= 65) score += 5
    if (signalType.includes('long') && overvalScore >= 65) score -= 6
  }

  // Earnings proximity penalty: event risk rises close to report day.
  if (earningsDays !== null && earningsDays !== undefined && Math.abs(earningsDays) <= 7) {
    score -= 12
  }

  return Math.max(5, Math.min(99, Math.round(score)))
}

const SIGNAL_CONFIG: Record<BestSignalType, {
  label: string
  desc: string
  teknikReq: string
  aiReq: string
  bg: string
  text: string
  border: string
  glow: string
  gradient: string
  badgeBg: string
  icon: string
  color: string
  shortLabel: string
}> = {
  confluence_buy: {
    label: 'CONFLUENCE BUY',
    shortLabel: 'CONF BUY',
    desc: 'Teknik + Temel + Dusuk Risk',
    teknikReq: 'STRONG LONG',
    aiReq: 'STRONG',
    bg: 'bg-violet-500/15',
    text: 'text-violet-300',
    border: 'border-violet-500/40',
    glow: 'shadow-violet-500/30',
    gradient: 'from-violet-500/25 to-indigo-500/10',
    badgeBg: 'bg-violet-500/25',
    icon: '\u{1F48E}',
    color: 'text-violet-300 bg-violet-500/15',
  },
  alpha_long: {
    label: 'ALPHA LONG',
    shortLabel: 'ALPHA L',
    desc: 'Teknik + Temel mukemmel',
    teknikReq: 'STRONG LONG',
    aiReq: 'STRONG',
    bg: 'bg-gold-400/10',
    text: 'text-gold-300',
    border: 'border-gold-400/30',
    glow: 'shadow-gold-400/20',
    gradient: 'from-gold-400/20 to-gold-600/5',
    badgeBg: 'bg-gold-400/20',
    icon: '\u{1F451}',
    color: 'text-gold-300 bg-gold-400/10',
  },
  hermes_long: {
    label: 'HERMES LONG',
    shortLabel: 'H-LONG',
    desc: 'Teknik guclu + Temel iyi',
    teknikReq: 'STRONG LONG',
    aiReq: 'GOOD',
    bg: 'bg-hermes-green/10',
    text: 'text-hermes-green',
    border: 'border-hermes-green/30',
    glow: 'shadow-hermes-green/20',
    gradient: 'from-hermes-green/20 to-hermes-green/5',
    badgeBg: 'bg-hermes-green/20',
    icon: '\u{1F7E2}',
    color: 'text-hermes-green bg-hermes-green/10',
  },
  smart_long: {
    label: 'SMART LONG',
    shortLabel: 'SM-L',
    desc: 'Teknik alis + Temel mukemmel',
    teknikReq: 'LONG',
    aiReq: 'STRONG',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/20',
    gradient: 'from-cyan-500/20 to-sky-500/5',
    badgeBg: 'bg-cyan-500/20',
    icon: '\u{1F9E0}',
    color: 'text-cyan-400 bg-cyan-500/10',
  },
  signal_long: {
    label: 'SIGNAL LONG',
    shortLabel: 'SIG-L',
    desc: 'Teknik alis + Temel iyi',
    teknikReq: 'LONG',
    aiReq: 'GOOD',
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    glow: 'shadow-teal-500/20',
    gradient: 'from-teal-500/20 to-hermes-green/5',
    badgeBg: 'bg-teal-500/20',
    icon: '\u{2705}',
    color: 'text-teal-400 bg-teal-500/10',
  },
  signal_short: {
    label: 'SIGNAL SHORT',
    shortLabel: 'SIG-S',
    desc: 'Teknik satis + Temel zayif',
    teknikReq: 'SHORT',
    aiReq: 'WEAK',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    glow: 'shadow-orange-500/20',
    gradient: 'from-orange-500/20 to-amber-500/5',
    badgeBg: 'bg-orange-500/20',
    icon: '\u{26A0}\u{FE0F}',
    color: 'text-orange-400 bg-orange-500/10',
  },
  smart_short: {
    label: 'SMART SHORT',
    shortLabel: 'SM-S',
    desc: 'Teknik satis + Temel kotu',
    teknikReq: 'SHORT',
    aiReq: 'BAD',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/20',
    gradient: 'from-rose-500/20 to-red-500/5',
    badgeBg: 'bg-rose-500/20',
    icon: '\u{1F4C9}',
    color: 'text-rose-400 bg-rose-500/10',
  },
  hermes_short: {
    label: 'HERMES SHORT',
    shortLabel: 'H-SHORT',
    desc: 'Teknik guclu satis + Temel zayif',
    teknikReq: 'STRONG SHORT',
    aiReq: 'WEAK',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/20',
    gradient: 'from-red-500/20 to-red-600/5',
    badgeBg: 'bg-red-500/20',
    icon: '\u{1F534}',
    color: 'text-red-400 bg-red-500/10',
  },
  alpha_short: {
    label: 'ALPHA SHORT',
    shortLabel: 'ALPHA S',
    desc: 'Teknik + Temel en kotu',
    teknikReq: 'STRONG SHORT',
    aiReq: 'BAD',
    bg: 'bg-red-600/15',
    text: 'text-red-500',
    border: 'border-red-600/40',
    glow: 'shadow-red-600/30',
    gradient: 'from-red-600/25 to-rose-600/10',
    badgeBg: 'bg-red-600/25',
    icon: '\u{1F480}',
    color: 'text-red-500 bg-red-600/15',
  },
  confluence_sell: {
    label: 'CONFLUENCE SELL',
    shortLabel: 'CONF SELL',
    desc: 'Teknik + Temel + Yuksek Risk',
    teknikReq: 'STRONG SHORT',
    aiReq: 'BAD',
    bg: 'bg-fuchsia-600/15',
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-600/40',
    glow: 'shadow-fuchsia-600/30',
    gradient: 'from-fuchsia-600/25 to-pink-600/10',
    badgeBg: 'bg-fuchsia-600/25',
    icon: '\u{1F52E}',
    color: 'text-fuchsia-400 bg-fuchsia-600/15',
  },
}

// ─── Combination map: teknikSignalType + aiSignal + risk + overval => BestSignalType ───
// V5: Overvaluation Score ile guclendirilmis short sinyaller
// SQUEEZE_GUARD: shortFloat > 20% + yukselis → SHORT sinyaller engellenir
function matchSignal(
  teknikSignalType: string,
  aiSignal: string,
  riskScore?: number,
  overvalScore?: number,
  overvalLevel?: string,
  shortFloat?: number,
  changePercent?: number,
): BestSignalType | null {
  const isLong = teknikSignalType === 'strong_long' || teknikSignalType === 'long'
  const isShort = teknikSignalType === 'strong_short' || teknikSignalType === 'short'

  // LONG sinyalleri
  if (isLong) {
    if ((aiSignal === 'STRONG' || aiSignal === 'GOOD') && riskScore !== undefined && riskScore <= 35) {
      return 'confluence_buy'
    }
    if (aiSignal === 'STRONG') {
      return 'alpha_long'
    }
    if (aiSignal === 'GOOD' || aiSignal === 'NEUTRAL') {
      return 'hermes_long'
    }
  }

  // SHORT sinyalleri — V5: Overvaluation Score destegi
  if (isShort) {
    // SQUEEZE GUARD: Yuksek short float + yukselis = short sinyal engelle
    if ((shortFloat ?? 0) > 20 && (changePercent ?? 0) > 2) {
      return null
    }

    const overval = overvalScore ?? 0
    const hasHighOverval = overval >= 65 || overvalLevel === 'HIGH' || overvalLevel === 'EXTREME'

    // CONFLUENCE SELL: Teknik short + (AI BAD veya OVERVAL HIGH) + Risk yuksek
    if (riskScore !== undefined && riskScore >= 65) {
      if ((aiSignal === 'BAD' || aiSignal === 'WEAK') || hasHighOverval) {
        return 'confluence_sell'
      }
    }

    // ALPHA SHORT: Teknik short + AI BAD veya Overvaluation EXTREME
    if (aiSignal === 'BAD' || (overvalLevel === 'EXTREME' && overval >= 80)) {
      return 'alpha_short'
    }

    // HERMES SHORT: Teknik short + (AI WEAK/NEUTRAL veya Overval HIGH)
    if (aiSignal === 'WEAK' || aiSignal === 'NEUTRAL' || hasHighOverval) {
      return 'hermes_short'
    }
  }

  return null
}

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
  return `${mc.toFixed(0)}`
}

// ─── Filter Button Component ───
function FilterBtn({ active, onClick, cfg, count }: {
  active: boolean
  onClick: () => void
  cfg: typeof SIGNAL_CONFIG[BestSignalType]
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
        transition-all duration-200 border
        ${active
          ? `${cfg.badgeBg} ${cfg.text} ${cfg.border} shadow-lg ${cfg.glow}`
          : 'bg-white/[0.03] text-white/60 border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70'}
      `}
    >
      <span className="text-sm">{cfg.icon}</span>
      <span>{cfg.label}</span>
      {count !== undefined && (
        <span className={`font-bold tabular-nums ${active ? 'text-white/90' : 'text-white/60'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Teknik Signal Badge ───
const SIGNAL_LABELS: Record<string, string> = {
  strong_long: 'STRONG LONG',
  long: 'LONG',
  neutral: 'NOTR',
  short: 'SHORT',
  strong_short: 'STRONG SHORT',
}

function getSignalLabel(signalType: string): string {
  return SIGNAL_LABELS[signalType] || 'NOTR'
}

function TeknikBadge({ signalType }: { signalType: string }) {
  const colors: Record<string, string> = {
    strong_long: 'text-gold-300 bg-gold-400/15 border-gold-400/30',
    long: 'text-hermes-green bg-hermes-green/15 border-hermes-green/30',
    neutral: 'text-white/50 bg-white/[0.05] border-white/[0.08]',
    short: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    strong_short: 'text-red-400 bg-red-500/15 border-red-500/30',
  }
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[signalType] || colors['neutral']}`}>
      {getSignalLabel(signalType)}
    </span>
  )
}

// ─── AI Signal Badge ───
function AiBadge({ signal, score }: { signal: string; score: number }) {
  const colors: Record<string, string> = {
    'STRONG': 'text-gold-300 bg-gold-400/15 border-gold-400/30',
    'GOOD': 'text-hermes-green bg-hermes-green/15 border-hermes-green/30',
    'NEUTRAL': 'text-white/50 bg-white/[0.05] border-white/[0.08]',
    'WEAK': 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    'BAD': 'text-red-400 bg-red-500/15 border-red-500/30',
  }
  const labels: Record<string, string> = {
    'STRONG': 'Guclu',
    'GOOD': 'Iyi',
    'NEUTRAL': 'Notr',
    'WEAK': 'Zayif',
    'BAD': 'Kotu',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[signal] || colors['NEUTRAL']}`}>
      {labels[signal] || signal}
      <span className="opacity-60">{score}</span>
    </span>
  )
}

// ─── Skeleton Loading ───
function SkeletonRow() {
  return (
    <tr className="border-b border-gold-400/5">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3 bg-gold-400/5 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function ModuleNasdaqSignals() {
  const { results: results52w, loading: loading52w, marketRegime, vixValue, signalsPaused, pauseReason, positionSizeMultiplier } = useNasdaqTradeContext()
  const renderGuard = useSignalRenderGuard()
  const canCSV = useCanDownloadCSV()
  const [fmpStocks, setFmpStocks] = useState<FmpStock[]>([])
  const [loadingFmp, setLoadingFmp] = useState(true)
  const [fmpError, setFmpError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<BestSignalType | 'all'>('all')
  const [revisionFilter, setRevisionFilter] = useState<'all' | 'up' | 'down'>('all')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'symbol' | 'sector' | 'bestSignal' | 'nTeknik' | 'teknikScore' | 'hAi' | 'aiScore' | 'confidence' | 'valuation' | 'price' | 'changePercent' | 'marketCap'>('teknikScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [watchTrigger, setWatchTrigger] = useState(0)

  // Load watchlist from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('hermes-watchlist-nasdaq')
    if (stored) {
      try {
        const arr = JSON.parse(stored)
        if (Array.isArray(arr)) {
          setWatchlist(new Set(arr))
        }
      } catch {}
    }
  }, [])

  // Toggle watchlist
  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      const next = new Set(prev)
      if (next.has(symbol)) {
        next.delete(symbol)
      } else {
        next.add(symbol)
      }
      localStorage.setItem('hermes-watchlist-nasdaq', JSON.stringify([...next]))
      return next
    })
  }
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [fmpRetryCount, setFmpRetryCount] = useState(0)
  const [earningsMap, setEarningsMap] = useState<Map<string, number>>(new Map())

  const handleToggleWatchlist = useCallback((e: React.MouseEvent, symbol: string) => {
    e.stopPropagation()
    toggleWatchlist(symbol)
  }, [])

  // FMP verisi SADECE Trade AI verisi hazir oldugunda cekilir (senkronizasyon)
  useEffect(() => {
    if (results52w.length === 0) {
      setLoadingFmp(false)
      setFmpStocks([])
      setFmpError(null)
      return
    }

    let cancelled = false
    async function fetchFmp() {
      try {
        setLoadingFmp(true)
        setFmpError(null)
        const res = await fetch('/api/fmp-terminal/stocks')
        if (!res.ok) throw new Error(`Veri cekme hatasi: ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setFmpStocks(data.stocks || [])
        }
      } catch (err) {
        if (!cancelled) {
          setFmpError(err instanceof Error ? err.message : 'FMP veri alinamadi')
        }
      } finally {
        if (!cancelled) setLoadingFmp(false)
      }
    }
    fetchFmp()
    return () => { cancelled = true }
  }, [results52w.length, fmpRetryCount])

  // Earnings proximity map (for event-risk aware signal confidence)
  useEffect(() => {
    if (results52w.length === 0) {
      setEarningsMap(new Map())
      return
    }

    let cancelled = false
    async function fetchEarningsWindow() {
      try {
        const res = await fetch('/api/fmp-terminal/calendar?days=21')
        if (!res.ok) return
        const data = await res.json()
        const m = new Map<string, number>()
        for (const e of (data.earnings || [])) {
          const sym = typeof e.symbol === 'string' ? e.symbol.toUpperCase() : ''
          const ds = typeof e.date === 'string' ? daysUntil(e.date) : null
          if (!sym || ds === null) continue
          const prev = m.get(sym)
          if (prev === undefined || Math.abs(ds) < Math.abs(prev)) m.set(sym, ds)
        }
        if (!cancelled) setEarningsMap(m)
      } catch {
        // advisory only
      }
    }
    fetchEarningsWindow()
    return () => { cancelled = true }
  }, [results52w.length])

  // Combine signals - sadece 6 sinyal
  const { signals, counts, conflictCount } = useMemo(() => {
    const items: BestSignalItem[] = []
    let conflicts = 0
    const cnt: Record<BestSignalType | 'all', number> = {
      all: 0,
      confluence_buy: 0, alpha_long: 0, hermes_long: 0,
      hermes_short: 0, alpha_short: 0, confluence_sell: 0,
      // Eski sinyaller icin dummy (TypeScript uyumlulugu)
      smart_long: 0, signal_long: 0, signal_short: 0, smart_short: 0,
    }

    if (!results52w.length || !fmpStocks.length) return { signals: items, counts: cnt, conflictCount: 0 }

    // Build FMP lookup
    const fmpMap = new Map<string, FmpStock>()
    for (const s of fmpStocks) {
      fmpMap.set(s.symbol, s)
    }

    for (const r of results52w) {
      const fmp = fmpMap.get(r.symbol)
      if (!fmp) continue

      const isLong = r.hermes.signalType === 'strong_long' || r.hermes.signalType === 'long'
      const isShort = r.hermes.signalType === 'strong_short' || r.hermes.signalType === 'short'
      const ai = fmp.signal
      if ((isLong && (ai === 'WEAK' || ai === 'BAD')) || (isShort && (ai === 'GOOD' || ai === 'STRONG'))) {
        conflicts++
      }

      const bestType = matchSignal(
        r.hermes.signalType, fmp.signal, fmp.riskScore,
        fmp.overvalScore, fmp.overvalLevel, fmp.shortFloat,
        fmp.changePercent,
      )
      if (!bestType) continue

      items.push({
        symbol: r.symbol,
        segment: r.segment,
        signalType: bestType,
        teknikSignalType: r.hermes.signalType,
        teknikScore: r.hermes.score,
        aiSignal: fmp.signal,
        aiScore: fmp.signalScore,
        price: r.quote?.price || r.hermes.price,
        changePercent: r.quote?.changePercent || 0,
        marketCap: r.quote?.marketCap || fmp.marketCap || 0,
        sector: fmp.sector || '-',
        confidence: fmp.confidence || 0,
        signalConfidence: calcSignalConfidence(
          bestType,
          r.hermes.signalType,
          fmp.signal,
          fmp.confidence || 0,
          fmp.riskScore,
          fmp.overvalScore,
          earningsMap.get(r.symbol) ?? null,
        ),
        valuationLabel: fmp.valuationLabel || '',
        overvalScore: fmp.overvalScore || 0,
        overvalLevel: fmp.overvalLevel || 'LOW',
        earningsDays: earningsMap.get(r.symbol) ?? null,
        targetPrice: r.priceTarget?.targetPrice ?? ((fmp.priceTarget ?? 0) > 0 ? (fmp.priceTarget as number) : null),
        floorPrice: r.priceTarget?.floorPrice ?? ((fmp.yearLow ?? 0) > 0 ? (fmp.yearLow as number) : null),
        analystEpsRevision30d: fmp.analystEpsRevision30d || 0,
        analystEpsRevision90d: fmp.analystEpsRevision90d || 0,
        riskReward: r.priceTarget?.riskReward ?? (() => {
          const p = r.quote?.price || r.hermes.price
          const t = fmp.priceTarget ?? 0
          const f = fmp.yearLow ?? 0
          if (t > 0 && f > 0 && p > 0) {
            const up = Math.abs(t - p)
            const dn = Math.abs(p - f)
            return dn > 0.01 ? Math.round((up / dn) * 10) / 10 : null
          }
          return null
        })(),
        zone: r.priceTarget?.zone ?? null,
      })
      cnt[bestType]++
      cnt.all++
    }

    return { signals: items, counts: cnt, conflictCount: conflicts }
  }, [results52w, fmpStocks, earningsMap])

  // Filter & sort
  const filtered = useMemo(() => {
    let list = activeFilter === 'all' ? signals : signals.filter(s => s.signalType === activeFilter)

    if (revisionFilter === 'up') {
      list = list.filter(s => (s.analystEpsRevision30d || 0) > 0 || (s.analystEpsRevision90d || 0) > 0)
    } else if (revisionFilter === 'down') {
      list = list.filter(s => (s.analystEpsRevision30d || 0) < 0 || (s.analystEpsRevision90d || 0) < 0)
    }

    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter(s => s.symbol.includes(q) || s.sector.toUpperCase().includes(q))
    }

    const SIGNAL_RANK: Record<string, number> = {
      'confluence_buy': 1, 'alpha_long': 2, 'hermes_long': 3, 'smart_long': 4, 'signal_long': 5,
      'signal_short': 6, 'smart_short': 7, 'hermes_short': 8, 'alpha_short': 9, 'confluence_sell': 10,
    }
    const TEKNIK_RANK: Record<string, number> = {
      'strong_long': 1, 'long': 2, 'neutral': 3, 'short': 4, 'strong_short': 5,
    }
    const AI_RANK: Record<string, number> = {
      'STRONG': 1, 'GOOD': 2, 'NEUTRAL': 3, 'WEAK': 4, 'BAD': 5,
    }
    const VALUATION_RANK: Record<string, number> = {
      'COK UCUZ': 1, 'UCUZ': 2, 'NORMAL': 3, 'PAHALI': 4, 'COK PAHALI': 5,
    }
    function valuationRank(label: string): number {
      return VALUATION_RANK[label] ?? 99
    }

    list.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      switch (sortField) {
        case 'symbol': va = a.symbol; vb = b.symbol; break
        case 'sector': va = a.sector; vb = b.sector; break
        case 'bestSignal': va = SIGNAL_RANK[a.signalType] || 99; vb = SIGNAL_RANK[b.signalType] || 99; break
        case 'nTeknik': va = TEKNIK_RANK[a.teknikSignalType] || 99; vb = TEKNIK_RANK[b.teknikSignalType] || 99; break
        case 'teknikScore': va = a.teknikScore; vb = b.teknikScore; break
        case 'hAi': va = AI_RANK[a.aiSignal] || 99; vb = AI_RANK[b.aiSignal] || 99; break
        case 'aiScore': va = a.aiScore; vb = b.aiScore; break
        case 'confidence': va = a.signalConfidence; vb = b.signalConfidence; break
        case 'valuation': va = valuationRank(a.valuationLabel || ''); vb = valuationRank(b.valuationLabel || ''); break
        case 'price': va = a.price; vb = b.price; break
        case 'changePercent': va = a.changePercent; vb = b.changePercent; break
        case 'marketCap': va = a.marketCap; vb = b.marketCap; break
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

    return list
  }, [signals, activeFilter, revisionFilter, search, sortField, sortDir])

  const isLoading = loading52w || loadingFmp

  // Sort handler
  function handleSort(field: typeof sortField) {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'symbol' || field === 'sector' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (field !== sortField) return <span className="text-white/40 ml-0.5">{'\u2195'}</span>
    return <span className="text-gold-300 ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  // CSV download
  function downloadCSV(market: 'nasdaq' | 'crypto') {
    const rows = filtered
    if (rows.length === 0) return

    const header = CSV_HEADERS.nasdaqSignals
    const csvRows = rows.map(r => {
      const cfg = SIGNAL_CONFIG[r.signalType]
      return [
        r.symbol,
        `"${r.sector}"`,
        cfg.label,
        getSignalLabel(r.teknikSignalType),
        r.teknikScore,
        r.aiSignal,
        r.aiScore,
        r.signalConfidence > 0 ? r.signalConfidence : '',
        (r.analystEpsRevision30d || 0).toFixed(2),
        (r.analystEpsRevision90d || 0).toFixed(2),
        r.valuationLabel || '',
        r.price.toFixed(2),
        r.changePercent.toFixed(2),
        r.marketCap,
      ].join(',')
    })

    const csv = [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.download = `hermes_${market}_signals_${ts}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-2 sm:py-4 animate-fade-in">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{'\u26A1'}</span>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">AI SIGNALS</h2>
          <span className="text-xs text-gold-400/40 ml-2">TRADE AI + NASDAQ TERMINAL AI</span>
          <div className="ml-auto">
            <SystemFreshnessBadge />
          </div>
        </div>
        <p className="text-[11px] text-white/40 ml-9">
          Teknik analiz (52W Z-Score/VWAP) ve temel analiz (P/E, P/B, ROE, Borc) sinyallerinin capraz onay birlesimleri
        </p>
        <div className="ml-9 mt-2">
          <LegalDisclaimerStrip compact />
        </div>
      </div>

      {/* Regime Warning Banner */}
      {(signalsPaused || marketRegime === 'RISK_OFF' || marketRegime === 'CRISIS') && (
        <div className={`mb-3 rounded-xl border p-3 flex items-center gap-3 ${
          marketRegime === 'CRISIS'
            ? 'bg-red-500/10 border-red-500/30'
            : marketRegime === 'RISK_OFF'
              ? 'bg-orange-500/10 border-orange-500/25'
              : 'bg-amber-500/8 border-amber-500/20'
        }`}>
          <span className="text-xl shrink-0">{marketRegime === 'CRISIS' ? '\u{1F6A8}' : '\u{26A0}\u{FE0F}'}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${
              marketRegime === 'CRISIS' ? 'text-red-400' : 'text-orange-400'
            }`}>
              {signalsPaused ? 'SIGNALS PAUSED' : `${marketRegime.replace('_', ' ')} REGIME`}
              {vixValue !== null && <span className="ml-2 font-normal opacity-70">VIX: {vixValue.toFixed(1)}</span>}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">
              {pauseReason || (
                marketRegime === 'CRISIS'
                  ? 'Extreme volatility — all new signals suspended. Existing positions monitored.'
                  : marketRegime === 'RISK_OFF'
                    ? `Position size reduced to ${Math.round(positionSizeMultiplier * 100)}%. Exercise extra caution.`
                    : `Elevated risk. Position size: ${Math.round(positionSizeMultiplier * 100)}%.`
              )}
            </p>
          </div>
          {positionSizeMultiplier < 1 && positionSizeMultiplier > 0 && (
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold text-white/60">{Math.round(positionSizeMultiplier * 100)}%</div>
              <div className="text-[9px] text-white/40">Pos Size</div>
            </div>
          )}
        </div>
      )}

      {renderGuard.blocked && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs font-bold text-red-300">SIGNAL RENDER BLOCKED (SYSTEM DOWN)</p>
          <p className="text-[10px] text-red-200/80 mt-1">
            Reason: {renderGuard.reason} | ScanAge: {renderGuard.scanAgeMin ?? 'n/a'}m | QuoteAge: {renderGuard.quoteAgeMin ?? 'n/a'}m
          </p>
        </div>
      )}
      {!renderGuard.blocked && renderGuard.staleWarning && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-bold text-amber-300">FRESHNESS WARNING</p>
          <p className="text-[10px] text-amber-200/80 mt-1">
            Scan verisi guncel olmayabilir. ScanAge: {renderGuard.scanAgeMin ?? 'n/a'}m | QuoteAge: {renderGuard.quoteAgeMin ?? 'n/a'}m
          </p>
        </div>
      )}

      {/* Signal Filter Buttons */}
      <div className="glass-card rounded-xl p-2 sm:p-4 mb-2 sm:mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gold-400/50 mr-1">Sinyal:</span>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              activeFilter === 'all'
                ? 'bg-gold-400/10 text-gold-300 border-gold-400/25'
                : 'bg-midnight-50/50 text-white/50 border-gold-400/8 hover:bg-midnight-50/80'
            }`}
          >
            Tumu <span className={`ml-1 font-bold tabular-nums ${activeFilter === 'all' ? 'text-white/90' : 'text-white/60'}`}>{counts.all}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gold-400/50 mr-1">EPS Rev:</span>
          <button
            onClick={() => setRevisionFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
              revisionFilter === 'all'
                ? 'bg-gold-400/10 text-gold-300 border-gold-400/25'
                : 'bg-midnight-50/50 text-white/50 border-gold-400/8 hover:bg-midnight-50/80'
            }`}
          >
            Tumu
          </button>
          <button
            onClick={() => setRevisionFilter('up')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
              revisionFilter === 'up'
                ? 'bg-hermes-green/12 text-hermes-green border-hermes-green/30'
                : 'bg-midnight-50/50 text-white/50 border-gold-400/8 hover:bg-midnight-50/80'
            }`}
          >
            Rev Up
          </button>
          <button
            onClick={() => setRevisionFilter('down')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
              revisionFilter === 'down'
                ? 'bg-red-500/12 text-red-400 border-red-500/30'
                : 'bg-midnight-50/50 text-white/50 border-gold-400/8 hover:bg-midnight-50/80'
            }`}
          >
            Rev Down
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_ORDER.map(type => (
            <FilterBtn
              key={type}
              active={activeFilter === type}
              onClick={() => setActiveFilter(activeFilter === type ? 'all' : type)}
              cfg={SIGNAL_CONFIG[type]}
              count={counts[type]}
            />
          ))}
        </div>

        {/* Search + Tooltip */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sembol veya sektor ara..."
            className="bg-midnight-50/50 border border-gold-400/10 rounded-lg px-3 py-1.5 text-xs text-white/80 placeholder-white/25 w-60 focus:outline-none focus:border-gold-400/25 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-white/50 hover:text-white/70 text-xs">
              Temizle
            </button>
          )}
          {/* Column Tooltip */}
          {tooltip && (
            <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 bg-gold-400/8 border border-gold-400/15 rounded-lg text-xs text-gold-200 animate-fade-in">
              <span className="text-gold-400">i</span>
              {tooltip}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {conflictCount > 0 && (
              <span
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-300"
                title="Teknik ve HERMES AI yonu celisen senaryo adedi. Bu satirlar 6-sinyal kontrati nedeniyle listede yer almaz."
              >
                Conflict {conflictCount}
              </span>
            )}
            {canCSV && (
              <button
                onClick={() => downloadCSV('nasdaq')}
                disabled={filtered.length === 0 || renderGuard.blocked}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-gold-400/10 text-gold-300 border border-gold-400/20 hover:bg-gold-400/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="NASDAQ sinyallerini CSV olarak indir"
              >
                CSV Indir
              </button>
            )}
            <span className="text-[11px] text-white/50 tabular-nums">
              <span className="font-bold text-gold-300">{filtered.length}</span>
              <span className="text-white/40"> / {counts.all} sinyal</span>
            </span>
          </div>
        </div>
      </div>

      {/* Trade AI verisi yok - once tara */}
      {!loading52w && results52w.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
          <p className="text-amber-400 text-sm font-semibold">Trade AI verisi henuz yuklenmedi</p>
          <p className="text-amber-400/70 text-xs mt-1">
            AI SIGNALS, Trade AI ve Terminal AI verilerini birlestirir. Lutfen once TRADE AI modulune gidip Tara butonuna basin veya sayfa yuklenene kadar bekleyin.
          </p>
        </div>
      )}

      {/* FMP (Terminal AI) yukleniyor */}
      {results52w.length > 0 && loadingFmp && !fmpError && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin shrink-0" />
          <p className="text-violet-300 text-sm">FMP (Terminal AI) verisi yukleniyor...</p>
        </div>
      )}

      {/* FMP Hata - Yeniden Dene */}
      {fmpError && results52w.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-400 text-sm font-semibold">FMP (Terminal AI) verisi alinamadi</p>
          <p className="text-red-400/60 text-xs mt-1">{fmpError}</p>
          <button
            onClick={() => setFmpRetryCount(c => c + 1)}
            className="mt-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      {/* Signal Summary Cards (when showing all) */}
      {activeFilter === 'all' && !isLoading && counts.all > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-2 mb-2 sm:mb-4">
          {SIGNAL_ORDER.map(type => {
            const cfg = SIGNAL_CONFIG[type]
            const count = counts[type]
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className={`
                  bg-gradient-to-br ${cfg.gradient} border ${cfg.border}
                  rounded-xl p-3 text-center transition-all duration-200
                  hover:scale-[1.02] hover:shadow-lg ${cfg.glow}
                  ${count === 0 ? 'opacity-40' : ''}
                `}
              >
                <div className="text-xl mb-1">{cfg.icon}</div>
                <div className={`text-[10px] font-bold ${cfg.text} mb-0.5`}>{cfg.label}</div>
                <div className={`text-lg font-black tabular-nums ${count === 0 ? 'text-white/35' : 'text-white/90'}`}>{count}</div>
                <div className="text-[9px] text-white/50 mt-0.5">{cfg.desc}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* Active Filter Info */}
      {activeFilter !== 'all' && (
        <div className={`bg-gradient-to-r ${SIGNAL_CONFIG[activeFilter].gradient} border ${SIGNAL_CONFIG[activeFilter].border} rounded-xl p-3 mb-4 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{SIGNAL_CONFIG[activeFilter].icon}</span>
            <div>
              <span className={`text-sm font-bold ${SIGNAL_CONFIG[activeFilter].text}`}>
                {SIGNAL_CONFIG[activeFilter].label}
              </span>
              <span className="text-[10px] text-white/60 ml-2">
                N.Teknik: {SIGNAL_CONFIG[activeFilter].teknikReq} + H.AI: {SIGNAL_CONFIG[activeFilter].aiReq}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gold-400/10 bg-midnight-50/30">
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('symbol')} onMouseEnter={() => setTooltip(COLUMN_TIPS.symbol)} onMouseLeave={() => setTooltip(null)}>
                  Sembol <SortIcon field="symbol" />
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('sector')} onMouseEnter={() => setTooltip(COLUMN_TIPS.sector)} onMouseLeave={() => setTooltip(null)}>
                  Sektor <SortIcon field="sector" />
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('bestSignal')} onMouseEnter={() => setTooltip(COLUMN_TIPS.bestSignal)} onMouseLeave={() => setTooltip(null)}>
                  Best Sinyal <SortIcon field="bestSignal" />
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('nTeknik')} onMouseEnter={() => setTooltip(COLUMN_TIPS.nTeknik)} onMouseLeave={() => setTooltip(null)}>
                  N. Teknik <SortIcon field="nTeknik" />
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('teknikScore')} onMouseEnter={() => setTooltip(COLUMN_TIPS.teknikScore)} onMouseLeave={() => setTooltip(null)}>
                  Teknik Skor <SortIcon field="teknikScore" />
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('hAi')} onMouseEnter={() => setTooltip(COLUMN_TIPS.hAi)} onMouseLeave={() => setTooltip(null)}>
                  H. AI <SortIcon field="hAi" />
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('aiScore')} onMouseEnter={() => setTooltip(COLUMN_TIPS.aiScore)} onMouseLeave={() => setTooltip(null)}>
                  AI Skor <SortIcon field="aiScore" />
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('confidence')} onMouseEnter={() => setTooltip(COLUMN_TIPS.confidence)} onMouseLeave={() => setTooltip(null)}>
                  Guven <SortIcon field="confidence" />
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('valuation')} onMouseEnter={() => setTooltip(COLUMN_TIPS.valuation)} onMouseLeave={() => setTooltip(null)}>
                  Fiyatlama <SortIcon field="valuation" />
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('price')} onMouseEnter={() => setTooltip(COLUMN_TIPS.price)} onMouseLeave={() => setTooltip(null)}>
                  Fiyat <SortIcon field="price" />
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('changePercent')} onMouseEnter={() => setTooltip(COLUMN_TIPS.changePercent)} onMouseLeave={() => setTooltip(null)}>
                  Degisim <SortIcon field="changePercent" />
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider cursor-pointer select-none hover:text-white/80"
                  onClick={() => handleSort('marketCap')} onMouseEnter={() => setTooltip(COLUMN_TIPS.marketCap)} onMouseLeave={() => setTooltip(null)}>
                  M.Cap <SortIcon field="marketCap" />
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider hidden xl:table-cell" title="Hedef Fiyat">
                  Hedef
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider hidden xl:table-cell" title="Dip Fiyat">
                  Dip
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-white/60 uppercase tracking-wider hidden xl:table-cell" title="Risk/Odul">
                  R:R
                </th>
              </tr>
            </thead>
            <tbody>
              {renderGuard.blocked ? (
                // Only show block message during market hours
                renderGuard.marketOpen ? (
                  <tr>
                    <td colSpan={15} className="text-center py-12 space-y-2">
                      <div className="text-red-300 text-sm font-medium">
                        Signals temporarily blocked - System health check failed
                      </div>
                      <div className="text-white/40 text-xs">
                        Scan age: {renderGuard.scanAgeMin?.toFixed(0) || 'N/A'} min • System will auto-recover
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Market closed - show signals normally (no block)
                  filtered.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="text-center py-12 text-white/40 text-sm">
                        {counts.all === 0
                          ? 'Veri bekleniyor... NASDAQ TEKNIK ve Hermes AI taramasi tamamlaninca sinyaller gorunecek.'
                          : 'Bu filtreye uygun sinyal bulunamadi.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, idx) => {
                      const cfg = SIGNAL_CONFIG[item.signalType]
                      return (
                        <tr
                          key={`${item.symbol}-${item.signalType}`}
                          className={`
                            border-b border-gold-400/5 premium-row
                            hover:bg-gradient-to-r hover:from-gold-400/[0.02] hover:to-transparent
                            transition-all duration-200 cursor-pointer
                          `}
                          onClick={() => window.location.href = `/nasdaq?tab=terminal&symbol=${item.symbol}`}
                        >
                          {/* Symbol */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleWatchlist(item.symbol)
                                  setWatchTrigger(t => t + 1)
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
                                title={watchlist.has(item.symbol) ? 'Favori' : 'Favorilere ekle'}
                              >
                                {watchlist.has(item.symbol) ? (
                                  <svg className="w-3.5 h-3.5 fill-gold-400" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5 stroke-white/40" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                )}
                              </button>
                              <span className="text-xs font-bold text-white tracking-wide">{item.symbol}</span>
                            </div>
                          </td>

                          {/* Best Signal Badge */}
                          <td className="px-3 py-2.5">
                            <span className={`
                              inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide
                              ${cfg.color} border ${cfg.border}
                            `}>
                              <span className={cfg.icon}></span>
                              {cfg.shortLabel}
                            </span>
                          </td>

                          {/* Rest of the row... continue with existing code */}
                          <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                            <span className={`text-xs ${
                              item.teknikSignalType === 'strong_long' ? 'text-hermes-green font-bold' :
                              item.teknikSignalType === 'long' ? 'text-hermes-green' :
                              item.teknikSignalType === 'strong_short' ? 'text-red-400 font-bold' :
                              item.teknikSignalType === 'short' ? 'text-red-400' :
                              'text-white/40'
                            }`}>
                              {item.teknikScore.toFixed(0)}
                            </span>
                          </td>

                          {/* AI Signal */}
                          <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                            <span className={`text-xs ${
                              item.aiSignal === 'STRONG' ? 'text-gold-400 font-bold' :
                              item.aiSignal === 'GOOD' ? 'text-hermes-green font-bold' :
                              item.aiSignal === 'WEAK' ? 'text-orange-400' :
                              item.aiSignal === 'BAD' ? 'text-red-400 font-bold' :
                              'text-white/40'
                            }`}>
                              {item.aiScore.toFixed(0)}
                            </span>
                          </td>

                          {/* Confidence */}
                          <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${item.signalConfidence >= 70 ? 'bg-hermes-green' : item.signalConfidence >= 40 ? 'bg-gold-300' : 'bg-white/20'}`}
                                  style={{ width: `${item.signalConfidence}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-white/40">{item.signalConfidence}%</span>
                            </div>
                          </td>

                          {/* Valuation */}
                          <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              item.valuationLabel === 'COK UCUZ' ? 'bg-hermes-green/20 text-hermes-green' :
                              item.valuationLabel === 'UCUZ' ? 'bg-hermes-green/10 text-hermes-green/80' :
                              item.valuationLabel === 'PAHALI' ? 'bg-red-400/10 text-red-400/80' :
                              item.valuationLabel === 'COK PAHALI' ? 'bg-red-400/20 text-red-400' :
                              'bg-white/5 text-white/40'
                            }`}>
                              {item.valuationLabel}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="px-3 py-2.5 text-right">
                            <PriceFlashCell price={item.price} />
                            <div className={`text-[10px] ${item.changePercent >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                              {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </div>
                          </td>

                          {/* Market Cap */}
                          <td className="px-3 py-2.5 text-right text-xs text-white/60 hidden xl:table-cell">
                            {item.marketCap >= 1e9 ? `${(item.marketCap / 1e9).toFixed(1)}B` : `${(item.marketCap / 1e6).toFixed(0)}M`}
                          </td>

                          {/* Sector */}
                          <td className="px-3 py-2.5 text-xs text-white/50 hidden 2xl:table-cell truncate max-w-[120px]">
                            {item.sector || '—'}
                          </td>

                          {/* Target Price */}
                          <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                            {item.targetPrice != null ? (
                              <span className="text-xs font-mono text-hermes-green/80">${item.targetPrice.toFixed(2)}</span>
                            ) : <span className="text-white/40 text-[10px]">—</span>}
                          </td>

                          {/* Floor Price */}
                          <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                            {item.floorPrice != null ? (
                              <span className="text-xs font-mono text-red-400/80">${item.floorPrice.toFixed(2)}</span>
                            ) : <span className="text-white/40 text-[10px]">—</span>}
                          </td>

                          {/* R:R */}
                          <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                            {item.riskReward != null ? (
                              <span className={`text-xs font-mono font-bold ${
                                item.riskReward >= 2 ? 'text-hermes-green' :
                                item.riskReward >= 1 ? 'text-gold-300' : 'text-red-400'
                              }`}>{item.riskReward.toFixed(1)}</span>
                            ) : <span className="text-white/40 text-[10px]">—</span>}
                          </td>
                        </tr>
                      )
                    })
                  )
                )
              ) : isLoading ? (
                Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-12 text-white/40 text-sm">
                    {counts.all === 0
                      ? 'Veri bekleniyor... NASDAQ TEKNIK ve Hermes AI taramasi tamamlaninca sinyaller gorunecek.'
                      : 'Bu filtreye uygun sinyal bulunamadi.'}
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const cfg = SIGNAL_CONFIG[item.signalType]
                  return (
                    <tr
                      key={`${item.symbol}-${item.signalType}`}
                      className={`
                        border-b border-gold-400/5 premium-row
                        ${idx % 2 === 0 ? 'bg-transparent' : 'bg-midnight-50/20'}
                        ${item.signalType === 'confluence_buy' ? 'row-glow-strong-long' :
                          item.signalType === 'alpha_long' || item.signalType === 'hermes_long' ? 'row-glow-long' :
                          item.signalType === 'confluence_sell' ? 'row-glow-strong-short' :
                          item.signalType === 'alpha_short' || item.signalType === 'hermes_short' ? 'row-glow-short' : ''
                        }
                      `}
                    >
                      {/* Symbol */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleToggleWatchlist(e, item.symbol)}
                            className={`shrink-0 p-0.5 rounded transition-all duration-200 ${
                              watchlist.has(item.symbol)
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-white/35 hover:text-amber-400/60'
                            }`}
                            title={watchlist.has(item.symbol) ? 'Watchlist\'ten cikar' : 'Watchlist\'e ekle'}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill={watchlist.has(item.symbol) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          </button>
                          <span className="text-xs font-bold text-white">{item.symbol}</span>
                          <span className="text-[9px] text-white/40 font-medium">{item.segment}</span>
                        </div>
                      </td>

                      {/* Sector */}
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] text-white/60 truncate max-w-[90px] inline-block">{item.sector}</span>
                      </td>

                      {/* Best Signal Badge */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border ${cfg.badgeBg} ${cfg.text} ${cfg.border}`}>
                          <span>{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </td>

                      {/* N.Teknik Signal */}
                      <td className="px-3 py-2.5 text-center">
                        <TeknikBadge signalType={item.teknikSignalType} />
                      </td>

                      {/* Teknik Score */}
                      <td className="px-3 py-2.5 text-center">
                        <ScoreMiniBar value={100 - item.teknikScore} maxWidth={48} />
                      </td>

                      {/* H.AI Signal */}
                      <td className="px-3 py-2.5 text-center">
                        <AiBadge signal={item.aiSignal} score={item.aiScore} />
                      </td>

                      {/* AI Score */}
                      <td className="px-3 py-2.5 text-center">
                        <ScoreMiniBar value={item.aiScore} maxWidth={48} />
                      </td>

                      {/* Guven (Confidence) */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center leading-tight">
                          <span className={`text-[11px] tabular-nums font-medium ${
                            item.signalConfidence >= 70 ? 'text-hermes-green/70' : item.signalConfidence >= 50 ? 'text-amber-400/70' : 'text-white/35'
                          }`}>{item.signalConfidence > 0 ? `${item.signalConfidence}%` : '—'}</span>
                          <span className={`text-[9px] tabular-nums ${
                            (item.analystEpsRevision30d || 0) > 0 ? 'text-hermes-green/80' :
                            (item.analystEpsRevision30d || 0) < 0 ? 'text-red-400/80' : 'text-white/35'
                          }`}>
                            R30 {(item.analystEpsRevision30d || 0) !== 0 ? `${(item.analystEpsRevision30d || 0) > 0 ? '+' : ''}${(item.analystEpsRevision30d || 0).toFixed(1)}%` : '—'}
                          </span>
                          {item.earningsDays !== null && Math.abs(item.earningsDays) <= 7 && (
                            <span className="text-[9px] text-red-300/80 font-semibold">
                              E{item.earningsDays >= 0 ? '+' : ''}{item.earningsDays}d
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Fiyatlama (Valuation) */}
                      <td className="px-3 py-2.5 text-center">
                        {item.valuationLabel ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            item.valuationLabel === 'COK UCUZ' ? 'text-hermes-green bg-hermes-green/15' :
                            item.valuationLabel === 'UCUZ' ? 'text-hermes-green bg-hermes-green/10' :
                            item.valuationLabel === 'NORMAL' ? 'text-slate-300 bg-white/[0.04]' :
                            item.valuationLabel === 'PAHALI' ? 'text-orange-400 bg-orange-500/10' :
                            item.valuationLabel === 'COK PAHALI' ? 'text-red-400 bg-red-500/10' :
                            'text-white/35 bg-white/[0.03]'
                          }`}>{item.valuationLabel}</span>
                        ) : <span className="text-white/40 text-[10px]">—</span>}
                      </td>

                      {/* Price */}
                      <td className="px-3 py-2.5 text-right">
                        <PriceFlashCell price={item.price} className="text-xs text-white font-semibold" />
                      </td>

                      {/* Change % */}
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-semibold tabular-nums ${item.changePercent >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                          {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                        </span>
                      </td>

                      {/* Market Cap */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-[10px] text-white/60 tabular-nums">{formatMarketCap(item.marketCap)}</span>
                      </td>

                      {/* Target Price */}
                      <td className="px-3 py-2.5 text-right hidden xl:table-cell">
                        {item.targetPrice != null ? (
                          <span className={`text-xs font-mono font-semibold ${
                            item.targetPrice > item.price ? 'text-hermes-green' : 'text-red-400'
                          }`}>${item.targetPrice.toFixed(2)}</span>
                        ) : <span className="text-white/40 text-[10px]">—</span>}
                      </td>

                      {/* Floor Price */}
                      <td className="px-3 py-2.5 text-right hidden xl:table-cell">
                        {item.floorPrice != null ? (
                          <span className="text-xs font-mono text-red-400/80">${item.floorPrice.toFixed(2)}</span>
                        ) : <span className="text-white/40 text-[10px]">—</span>}
                      </td>

                      {/* R:R */}
                      <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                        {item.riskReward != null ? (
                          <span className={`text-xs font-mono font-bold ${
                            item.riskReward >= 2 ? 'text-hermes-green' :
                            item.riskReward >= 1 ? 'text-gold-300' : 'text-red-400'
                          }`}>{item.riskReward.toFixed(1)}</span>
                        ) : <span className="text-white/40 text-[10px]">—</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      {!isLoading && counts.all > 0 && (
        <div className="mt-3 flex items-center justify-between text-[10px] text-white/40 px-1">
          <span>
            TRADE AI + Terminal AI eslesme sinyalleri
          </span>
          <span>
            Son guncelleme: {new Date().toLocaleTimeString('tr-TR')}
          </span>
        </div>
      )}
    </div>
  )
}
