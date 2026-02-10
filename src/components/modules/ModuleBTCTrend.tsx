'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useScanContext, useScan200DContext } from '../Layout'
import type {
  BTCTrendResult,
  BucketSummary,
  BucketedStock,
  TrendDirection,
  BucketType,
  IntegrityState,
  AnalysisMode,
} from '@/lib/btc-trend-engine'
import { BTC_PRIORITY_CARRIERS, BTC_MINERS, BTC_FLOW_PROXIES } from '@/lib/btc-trend-engine'

// ═══════════════════════════════════════════════════════════════════
// BTC TREND MODULE - Bitcoin Regime Intelligence Layer
// Equity-Driven, Treasury-Free BTC Direction Inference
// ═══════════════════════════════════════════════════════════════════

const TREND_COLORS: Record<TrendDirection, { bg: string; text: string; border: string; glow: string }> = {
  UP: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
  },
  DOWN: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/20',
  },
  NEUTRAL: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    glow: 'shadow-slate-500/20',
  },
}

const BUCKET_CONFIG: Record<BucketType, { icon: string; color: string; borderColor: string; bgColor: string }> = {
  risk_on_leader: { icon: '🟢', color: 'text-emerald-400', borderColor: 'border-emerald-500/30', bgColor: 'bg-emerald-500/10' },
  risk_off_warning: { icon: '🔴', color: 'text-red-400', borderColor: 'border-red-500/30', bgColor: 'bg-red-500/10' },
  volatility_carrier: { icon: '⚡', color: 'text-yellow-400', borderColor: 'border-yellow-500/30', bgColor: 'bg-yellow-500/10' },
  liquidity_proxy: { icon: '💧', color: 'text-blue-400', borderColor: 'border-blue-500/30', bgColor: 'bg-blue-500/10' },
}

const INTEGRITY_COLORS: Record<IntegrityState, { bg: string; text: string }> = {
  NORMAL: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  DEGRADED: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  FAIL_CLOSED: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

function ScoreMeter({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const angle = (score / 100) * 180 - 90 // -90 to +90 degrees
  const isLg = size === 'lg'
  const radius = isLg ? 80 : 40
  const cx = isLg ? 90 : 45
  const cy = isLg ? 90 : 45

  return (
    <div className={`relative ${isLg ? 'w-[180px] h-[100px]' : 'w-[90px] h-[50px]'}`}>
      <svg viewBox={`0 0 ${cx * 2} ${cy + 10}`} className="w-full h-full">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={isLg ? 12 : 6}
          strokeLinecap="round"
        />
        {/* Gradient arc segments */}
        {/* Red zone (0-30) */}
        <path
          d={describeArc(cx, cy, radius, -180, -180 + 54)}
          fill="none"
          stroke="rgba(239,68,68,0.4)"
          strokeWidth={isLg ? 12 : 6}
          strokeLinecap="round"
        />
        {/* Yellow zone (30-50) */}
        <path
          d={describeArc(cx, cy, radius, -180 + 54, -180 + 90)}
          fill="none"
          stroke="rgba(234,179,8,0.3)"
          strokeWidth={isLg ? 12 : 6}
        />
        {/* Neutral zone (50) */}
        <path
          d={describeArc(cx, cy, radius, -180 + 90, -180 + 108)}
          fill="none"
          stroke="rgba(148,163,184,0.3)"
          strokeWidth={isLg ? 12 : 6}
        />
        {/* Light green (60-80) */}
        <path
          d={describeArc(cx, cy, radius, -180 + 108, -180 + 144)}
          fill="none"
          stroke="rgba(34,197,94,0.3)"
          strokeWidth={isLg ? 12 : 6}
        />
        {/* Green zone (80-100) */}
        <path
          d={describeArc(cx, cy, radius, -180 + 144, 0)}
          fill="none"
          stroke="rgba(16,185,129,0.4)"
          strokeWidth={isLg ? 12 : 6}
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (radius - 15) * Math.cos((angle * Math.PI) / 180)}
          y2={cy + (radius - 15) * Math.sin((angle * Math.PI) / 180)}
          stroke="white"
          strokeWidth={isLg ? 2.5 : 1.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={isLg ? 4 : 2} fill="white" />
      </svg>
    </div>
  )
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180
  const x1 = cx + radius * Math.cos(startRad)
  const y1 = cy + radius * Math.sin(startRad)
  const x2 = cx + radius * Math.cos(endRad)
  const y2 = cy + radius * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence > 60 ? 'bg-emerald-500' : confidence > 35 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full">
      <div className="flex justify-between text-[9px] text-white/60 mb-1">
        <span>Confidence</span>
        <span>{confidence.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${confidence}%` }} />
      </div>
    </div>
  )
}

function BucketCard({ bucket }: { bucket: BucketSummary }) {
  const config = BUCKET_CONFIG[bucket.type]
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 transition-all hover:scale-[1.01]`}>
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <div>
            <h4 className={`text-xs font-bold ${config.color}`}>{bucket.label}</h4>
            <span className="text-[9px] text-white/60">{bucket.memberCount} stocks</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
            bucket.signal === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' :
            bucket.signal === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
            'bg-white/5 text-white/70'
          }`}>
            {bucket.signal}
          </span>
          <span className={`text-white/60 transition-transform text-xs ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>

      {/* Strength indicator */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] text-white/60">Strength:</span>
        <div className="flex gap-0.5">
          {['STRONG', 'NEUTRAL', 'WEAK'].map((level) => (
            <div
              key={level}
              className={`w-6 h-1.5 rounded-full ${
                (bucket.strength === 'STRONG') ? config.bgColor.replace('/10', '/40') :
                (bucket.strength === 'NEUTRAL' && level !== 'STRONG') ? 'bg-white/15' :
                (bucket.strength === 'WEAK' && level === 'WEAK') ? 'bg-white/10' :
                'bg-white/5'
              }`}
            />
          ))}
        </div>
        <span className={`text-[9px] font-bold ${config.color}`}>{bucket.strength}</span>
      </div>

      {/* Sub-score */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] text-white/60">Score:</span>
        <div className="flex-1 h-1.5 rounded-full bg-white/5">
          <div
            className={`h-full rounded-full transition-all ${
              bucket.subScore > 60 ? 'bg-emerald-500/60' :
              bucket.subScore < 40 ? 'bg-red-500/60' :
              'bg-slate-500/40'
            }`}
            style={{ width: `${bucket.subScore}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-white/50">{bucket.subScore.toFixed(0)}</span>
      </div>

      {/* Consistency */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-white/60">Consistency:</span>
        <span className={`text-[9px] font-mono ${
          bucket.internalConsistency > 0.7 ? 'text-emerald-400' :
          bucket.internalConsistency > 0.4 ? 'text-yellow-400' :
          'text-red-400'
        }`}>
          {(bucket.internalConsistency * 100).toFixed(0)}%
        </span>
      </div>

      {/* Expanded: top members */}
      {expanded && bucket.topMembers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="text-[9px] text-white/60 mb-2 font-semibold uppercase tracking-wider">Top Contributors</div>
          <div className="space-y-1">
            {bucket.topMembers.map((member) => (
              <div key={member.symbol} className="flex items-center justify-between text-xs">
                <span className="font-mono text-white/70">{member.symbol}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] ${member.direction === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {member.direction === 'positive' ? '↑' : '↓'}
                  </span>
                  <span className="font-mono text-white/70">{(member.score * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContributorRow({ stock, rank }: { stock: BucketedStock; rank: number }) {
  const bucketConfig = BUCKET_CONFIG[stock.bucket]

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-all">
      <span className="text-xs text-white/50 font-mono w-5 text-right">{rank}</span>
      <span className="font-mono font-bold text-white text-sm min-w-[60px]">{stock.symbol}</span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded ${bucketConfig.bgColor} ${bucketConfig.color}`}>
        {bucketConfig.icon} {stock.bucket.replace(/_/g, ' ')}
      </span>
      <div className="flex-1" />
      <div className="text-right min-w-[50px]">
        <div className="text-[9px] text-white/60">Lead Corr</div>
        <div className={`font-mono text-xs ${stock.leadLag.bestLeadCorr > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {stock.leadLag.bestLeadCorr > 0 ? '+' : ''}{(stock.leadLag.bestLeadCorr * 100).toFixed(1)}%
        </div>
      </div>
      <div className="text-right min-w-[50px]">
        <div className="text-[9px] text-white/60">Lag</div>
        <div className="font-mono text-xs text-white/60">-{stock.leadLag.bestLeadLag}d</div>
      </div>
      <div className="text-right min-w-[50px]">
        <div className="text-[9px] text-white/60">Ret 5D</div>
        <div className={`font-mono text-xs ${stock.features.returns5d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {stock.features.returns5d >= 0 ? '+' : ''}{(stock.features.returns5d * 100).toFixed(1)}%
        </div>
      </div>
      <div className="text-right min-w-[40px]">
        <div className="text-[9px] text-white/60">Score</div>
        <div className="font-mono text-xs text-white/60">{(stock.contributionScore * 100).toFixed(1)}</div>
      </div>
    </div>
  )
}

// All known BTC-related symbols (for Hermes signal lookup)
const ALL_BTC_SYMBOLS = new Set([
  ...Object.keys(BTC_PRIORITY_CARRIERS),
  ...BTC_MINERS,
  ...BTC_FLOW_PROXIES,
])

function getSignalColor(signalType: string): string {
  switch (signalType) {
    case 'strong_long': return 'text-emerald-400'
    case 'long': return 'text-green-400'
    case 'neutral': return 'text-white/60'
    case 'short': return 'text-orange-400'
    case 'strong_short': return 'text-red-400'
    default: return 'text-white/60'
  }
}

function getSignalBg(signalType: string): string {
  switch (signalType) {
    case 'strong_long': return 'bg-emerald-500/15'
    case 'long': return 'bg-green-500/10'
    case 'neutral': return 'bg-white/5'
    case 'short': return 'bg-orange-500/10'
    case 'strong_short': return 'bg-red-500/15'
    default: return 'bg-white/5'
  }
}

function getSignalLabel(signalType: string): string {
  switch (signalType) {
    case 'strong_long': return 'STRONG LONG'
    case 'long': return 'LONG'
    case 'neutral': return 'NEUTRAL'
    case 'short': return 'SHORT'
    case 'strong_short': return 'STRONG SHORT'
    default: return signalType
  }
}

export default function ModuleBTCTrend() {
  const { results: results200w } = useScanContext()
  const { results: results200d } = useScan200DContext()

  const [result, setResult] = useState<BTCTrendResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('relaxed')

  // Build Hermes signal map for BTC-related stocks
  const hermesSignals = useMemo(() => {
    const map = new Map<string, {
      symbol: string
      role: string
      tier: 'flow' | 'miner' | 'other'
      score200w?: number
      signal200w?: string
      signalType200w?: string
      rsi200w?: number
      score200d?: number
      signal200d?: string
      signalType200d?: string
      rsi200d?: number
      price?: number
      changePercent?: number
    }>()

    for (const sym of ALL_BTC_SYMBOLS) {
      const priorityInfo = BTC_PRIORITY_CARRIERS[sym]
      const tier = priorityInfo?.tier || (BTC_MINERS.has(sym) ? 'miner' : 'flow')
      const role = priorityInfo?.role || (BTC_MINERS.has(sym) ? 'BTC Miner' : 'BTC Related')

      const r200w = results200w.find(r => r.symbol === sym)
      const r200d = results200d.find(r => r.symbol === sym)

      if (!r200w && !r200d) continue

      map.set(sym, {
        symbol: sym,
        role,
        tier,
        score200w: r200w?.hermes.score,
        signal200w: r200w?.hermes.signal,
        signalType200w: r200w?.hermes.signalType,
        rsi200w: r200w?.hermes.indicators.rsi,
        score200d: r200d?.hermes.score,
        signal200d: r200d?.hermes.signal,
        signalType200d: r200d?.hermes.signalType,
        rsi200d: r200d?.hermes.indicators.rsi,
        price: r200w?.quote?.price || r200d?.quote?.price,
        changePercent: r200w?.quote?.changePercent || r200d?.quote?.changePercent,
      })
    }

    return map
  }, [results200w, results200d])

  // Compute Hermes-based BTC sentiment from signal distribution
  const hermesSentiment = useMemo(() => {
    const signals = Array.from(hermesSignals.values())
    if (signals.length === 0) return null

    let bullishScore = 0
    let bearishScore = 0
    let total = 0

    for (const s of signals) {
      // 200W signal weight
      if (s.signalType200w) {
        total++
        if (s.signalType200w === 'strong_long') bullishScore += 2
        else if (s.signalType200w === 'long') bullishScore += 1
        else if (s.signalType200w === 'short') bearishScore += 1
        else if (s.signalType200w === 'strong_short') bearishScore += 2
      }
      // 200D signal weight
      if (s.signalType200d) {
        total++
        if (s.signalType200d === 'strong_long') bullishScore += 2
        else if (s.signalType200d === 'long') bullishScore += 1
        else if (s.signalType200d === 'short') bearishScore += 1
        else if (s.signalType200d === 'strong_short') bearishScore += 2
      }
    }

    if (total === 0) return null

    const maxPossible = total * 2 // each signal can contribute max 2
    const netScore = bullishScore - bearishScore
    const normalizedScore = ((netScore / maxPossible) + 1) / 2 * 100 // 0-100

    let direction: TrendDirection = 'NEUTRAL'
    if (normalizedScore > 60) direction = 'UP'
    else if (normalizedScore < 40) direction = 'DOWN'

    const strongLongs = signals.filter(s => s.signalType200w === 'strong_long' || s.signalType200d === 'strong_long').length
    const strongShorts = signals.filter(s => s.signalType200w === 'strong_short' || s.signalType200d === 'strong_short').length

    return {
      score: Math.round(normalizedScore * 10) / 10,
      direction,
      bullishScore,
      bearishScore,
      total: signals.length,
      strongLongs,
      strongShorts,
    }
  }, [hermesSignals])

  const fetchTrend = useCallback(async (force = false, analysisMode?: AnalysisMode) => {
    setLoading(true)
    setError(null)
    const m = analysisMode || mode
    try {
      const params = new URLSearchParams()
      if (force) params.set('force', 'true')
      params.set('mode', m)
      const res = await fetch(`/api/btc-trend?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: BTCTrendResult = await res.json()
      setResult(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [mode])

  const handleModeChange = (newMode: AnalysisMode) => {
    setMode(newMode)
    fetchTrend(true, newMode)
  }

  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  if (loading && !result) {
    return (
      <div className="max-w-[1920px] mx-auto px-6 py-4">
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center text-3xl mb-6 animate-pulse">
            ₿
          </div>
          <div className="text-white/70 text-sm animate-pulse mb-2">BTC Trend analizi hesaplanıyor...</div>
          <div className="text-white/50 text-xs">Equity verileri yükleniyor ve korelasyonlar hesaplanıyor</div>
        </div>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="max-w-[1920px] mx-auto px-6 py-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <div className="text-red-400 text-sm font-semibold mb-2">BTC Trend Analizi Hatası</div>
          <div className="text-red-300/60 text-xs mb-4">{error}</div>
          <button
            onClick={() => fetchTrend(true)}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-all"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const trendColors = TREND_COLORS[result.trend]

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-4">
      {/* ═══ Executive Summary ═══ */}
      <div className={`rounded-2xl border ${trendColors.border} ${trendColors.bg} shadow-xl ${trendColors.glow} p-6 mb-6`}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          {/* Left: Trend Direction */}
          <div className="flex items-center gap-6">
            <div>
              <ScoreMeter score={result.score} />
              <div className="text-center mt-1">
                <span className="font-mono text-2xl font-bold text-white">{result.score.toFixed(1)}</span>
                <span className="text-xs text-white/60 ml-1">/100</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">₿</span>
                <div>
                  <div className={`text-3xl font-black tracking-tight ${trendColors.text}`}>
                    {result.trend}
                  </div>
                  <div className="text-[10px] text-white/60 uppercase tracking-wider">BTC Trend Direction</div>
                </div>
              </div>

              {/* BTC Price */}
              {result.btcPrice && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-mono text-lg text-white/70">${result.btcPrice.toLocaleString()}</span>
                  {result.btcChange24h !== undefined && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      result.btcChange24h >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {result.btcChange24h >= 0 ? '+' : ''}{result.btcChange24h.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Confidence + Refresh */}
          <div className="flex flex-col items-end gap-3 min-w-[200px]">
            <ConfidenceBar confidence={result.confidence} />

            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/50">
                {new Date(result.timestamp).toLocaleTimeString('tr-TR')}
              </span>
              <button
                onClick={() => fetchTrend(true)}
                disabled={loading}
                className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  loading
                    ? 'bg-white/5 text-white/60 cursor-wait'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10'
                }`}
              >
                {loading ? '⟳ Hesaplanıyor...' : '⟳ Yenile'}
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => handleModeChange('strict')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  mode === 'strict'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-white/70 hover:text-white/60'
                }`}
              >
                STRICT
              </button>
              <button
                onClick={() => handleModeChange('relaxed')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  mode === 'relaxed'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-white/70 hover:text-white/60'
                }`}
              >
                RELAXED
              </button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                mode === 'strict' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
              }`}>
                {mode === 'strict' ? 'Treasury+Miners Free' : 'Miners Included'}
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/60">
                {result.integrity.stocksAnalyzed} carriers
              </span>
              {result.integrity.priorityCarriersFound > 0 && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                  {result.integrity.priorityCarriersFound} priority
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Regime Explanation */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs text-white/50 leading-relaxed">{result.regimeExplanation}</p>
        </div>
      </div>

      {/* ═══ Bucket Heatmap ═══ */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          Structural Buckets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {result.buckets.map((bucket) => (
            <BucketCard key={bucket.type} bucket={bucket} />
          ))}
        </div>
      </div>

      {/* ═══ Priority BTC Carriers (Known Proxies) ═══ */}
      {result.priorityCarrierSummary.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            BTC Priority Carriers
            <span className="text-[9px] font-normal text-white/60 bg-white/5 px-2 py-0.5 rounded">Known Proxies</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.priorityCarrierSummary.map((carrier) => {
              const bucketCfg = BUCKET_CONFIG[carrier.bucket]
              const hermesData = hermesSignals.get(carrier.symbol)
              return (
                <div key={carrier.symbol} className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-4 hover:bg-orange-500/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-base">{carrier.symbol}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                        carrier.tier === 'flow' ? 'bg-blue-500/15 text-blue-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {carrier.tier === 'flow' ? 'FLOW' : 'MINER'}
                      </span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${bucketCfg.bgColor} ${bucketCfg.color}`}>
                      {bucketCfg.icon}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/70 mb-2">{carrier.role}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <div className="text-[8px] text-white/55 uppercase">1D</div>
                      <div className={`font-mono ${carrier.returns1d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {carrier.returns1d >= 0 ? '+' : ''}{(carrier.returns1d * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] text-white/55 uppercase">5D</div>
                      <div className={`font-mono ${carrier.returns5d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {carrier.returns5d >= 0 ? '+' : ''}{(carrier.returns5d * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] text-white/55 uppercase">Lead Corr</div>
                      <div className={`font-mono ${carrier.leadCorr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {carrier.leadCorr >= 0 ? '+' : ''}{(carrier.leadCorr * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {/* Hermes Signals Row */}
                  {hermesData && (
                    <div className="border-t border-orange-500/10 pt-2 mt-1">
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <div className="text-[8px] text-white/55 uppercase">200W</div>
                          {hermesData.signalType200w ? (
                            <span className={`font-bold ${getSignalColor(hermesData.signalType200w)}`}>
                              {getSignalLabel(hermesData.signalType200w)}
                            </span>
                          ) : (
                            <span className="text-white/50">N/A</span>
                          )}
                        </div>
                        <div>
                          <div className="text-[8px] text-white/55 uppercase">200D</div>
                          {hermesData.signalType200d ? (
                            <span className={`font-bold ${getSignalColor(hermesData.signalType200d)}`}>
                              {getSignalLabel(hermesData.signalType200d)}
                            </span>
                          ) : (
                            <span className="text-white/50">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ HERMES Signal-Based BTC Sentiment ═══ */}
      {hermesSignals.size > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            HERMES Sinyal Bazlı BTC Duyarlılığı
            <span className="text-[9px] font-normal text-white/50 bg-white/5 px-2 py-0.5 rounded">200W + 200D</span>
          </h3>

          {/* Sentiment Summary */}
          {hermesSentiment && (
            <div className={`rounded-xl border p-4 mb-4 ${
              hermesSentiment.direction === 'UP' ? 'border-emerald-500/30 bg-emerald-500/5' :
              hermesSentiment.direction === 'DOWN' ? 'border-red-500/30 bg-red-500/5' :
              'border-white/10 bg-white/5'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`text-2xl font-black ${
                    hermesSentiment.direction === 'UP' ? 'text-emerald-400' :
                    hermesSentiment.direction === 'DOWN' ? 'text-red-400' :
                    'text-white/60'
                  }`}>
                    {hermesSentiment.direction === 'UP' ? '▲' : hermesSentiment.direction === 'DOWN' ? '▼' : '◆'} {hermesSentiment.direction}
                  </div>
                  <div>
                    <div className="text-xs text-white/70">HERMES Sentiment Score</div>
                    <div className="font-mono text-lg font-bold text-white">{hermesSentiment.score.toFixed(1)}<span className="text-white/50 text-xs">/100</span></div>
                  </div>
                </div>
                <div className="flex gap-6 text-xs">
                  <div className="text-center">
                    <div className="text-white/50">Bullish</div>
                    <div className="font-mono text-emerald-400 text-lg font-bold">{hermesSentiment.bullishScore}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/50">Bearish</div>
                    <div className="font-mono text-red-400 text-lg font-bold">{hermesSentiment.bearishScore}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/50">Strong Long</div>
                    <div className="font-mono text-emerald-400 font-bold">{hermesSentiment.strongLongs}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/50">Strong Short</div>
                    <div className="font-mono text-red-400 font-bold">{hermesSentiment.strongShorts}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Per-stock Hermes signals table */}
          <div className="bg-[#0A0A10]/80 rounded-xl border border-white/5 overflow-hidden">
            <div className="hidden lg:grid grid-cols-[120px_100px_80px_100px_60px_80px_100px_60px_80px] gap-2 px-4 py-2 text-[9px] text-white/60 uppercase tracking-wider border-b border-white/5">
              <div>Symbol</div>
              <div>Role</div>
              <div>Price</div>
              <div className="text-center">200W Signal</div>
              <div className="text-center">Score</div>
              <div className="text-center">RSI</div>
              <div className="text-center">200D Signal</div>
              <div className="text-center">Score</div>
              <div className="text-center">RSI</div>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {Array.from(hermesSignals.values())
                .sort((a, b) => {
                  // Sort: flow first, then miners; within group by avg score
                  if (a.tier !== b.tier) return a.tier === 'flow' ? -1 : 1
                  const aAvg = ((a.score200w || 50) + (a.score200d || 50)) / 2
                  const bAvg = ((b.score200w || 50) + (b.score200d || 50)) / 2
                  return aAvg - bAvg
                })
                .map((s) => (
                  <div key={s.symbol} className="grid grid-cols-1 lg:grid-cols-[120px_100px_80px_100px_60px_80px_100px_60px_80px] gap-2 px-4 py-2.5 hover:bg-white/[0.03] transition-all items-center">
                    {/* Symbol */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">{s.symbol}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                        s.tier === 'flow' ? 'bg-blue-500/15 text-blue-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {s.tier === 'flow' ? 'FLOW' : 'MINER'}
                      </span>
                    </div>
                    {/* Role */}
                    <div className="text-[10px] text-white/60">{s.role}</div>
                    {/* Price */}
                    <div className="text-xs">
                      {s.price ? (
                        <span className="font-mono text-white/80">${s.price.toFixed(2)}</span>
                      ) : (
                        <span className="text-white/50">-</span>
                      )}
                      {s.changePercent !== undefined && (
                        <span className={`ml-1 text-[10px] ${s.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {/* 200W Signal */}
                    <div className="text-center">
                      {s.signalType200w ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${getSignalBg(s.signalType200w)} ${getSignalColor(s.signalType200w)}`}>
                          {getSignalLabel(s.signalType200w)}
                        </span>
                      ) : (
                        <span className="text-white/50 text-[10px]">N/A</span>
                      )}
                    </div>
                    {/* 200W Score */}
                    <div className="text-center font-mono text-xs">
                      {s.score200w !== undefined ? (
                        <span className={getSignalColor(s.signalType200w || 'neutral')}>{s.score200w.toFixed(0)}</span>
                      ) : '-'}
                    </div>
                    {/* 200W RSI */}
                    <div className="text-center font-mono text-xs">
                      {s.rsi200w !== undefined ? (
                        <span className={s.rsi200w < 30 ? 'text-emerald-400' : s.rsi200w > 70 ? 'text-red-400' : 'text-white/70'}>
                          {Math.round(s.rsi200w)}
                        </span>
                      ) : '-'}
                    </div>
                    {/* 200D Signal */}
                    <div className="text-center">
                      {s.signalType200d ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${getSignalBg(s.signalType200d)} ${getSignalColor(s.signalType200d)}`}>
                          {getSignalLabel(s.signalType200d)}
                        </span>
                      ) : (
                        <span className="text-white/50 text-[10px]">N/A</span>
                      )}
                    </div>
                    {/* 200D Score */}
                    <div className="text-center font-mono text-xs">
                      {s.score200d !== undefined ? (
                        <span className={getSignalColor(s.signalType200d || 'neutral')}>{s.score200d.toFixed(0)}</span>
                      ) : '-'}
                    </div>
                    {/* 200D RSI */}
                    <div className="text-center font-mono text-xs">
                      {s.rsi200d !== undefined ? (
                        <span className={s.rsi200d < 30 ? 'text-emerald-400' : s.rsi200d > 70 ? 'text-red-400' : 'text-white/70'}>
                          {Math.round(s.rsi200d)}
                        </span>
                      ) : '-'}
                    </div>
                  </div>
                ))}
            </div>
            {hermesSignals.size === 0 && (
              <div className="text-center py-8 text-white/50 text-sm">
                Hermes verileri yok. Önce 200 HAFTA ve 200 GÜN taraması yapın.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Top Equity Contributors ═══ */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Top 10 Lead Indicators
        </h3>
        <div className="bg-[#0A0A10]/80 rounded-xl border border-white/5 overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 text-[9px] text-white/60 uppercase tracking-wider border-b border-white/5">
            <span className="w-5">#</span>
            <span className="min-w-[60px]">Symbol</span>
            <span className="flex-1">Bucket</span>
            <span className="min-w-[50px] text-right">Lead Corr</span>
            <span className="min-w-[50px] text-right">Lag</span>
            <span className="min-w-[50px] text-right">Ret 5D</span>
            <span className="min-w-[40px] text-right">Score</span>
          </div>
          <div className="divide-y divide-white/[0.02]">
            {result.topContributors.map((stock, idx) => (
              <ContributorRow key={stock.symbol} stock={stock} rank={idx + 1} />
            ))}
          </div>
          {result.topContributors.length === 0 && (
            <div className="text-center py-8 text-white/50 text-sm">
              Yeterli veri yok. Önce 200 HAFTA taraması yapın.
            </div>
          )}
        </div>
      </div>

      {/* ═══ System Integrity ═══ */}
      <div className="bg-[#0A0A10]/60 rounded-xl border border-white/5 p-4">
        <h3 className="text-sm font-bold text-white/50 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          System Integrity
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <div className="text-[9px] text-white/60 uppercase tracking-wider mb-1">Reliability</div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${INTEGRITY_COLORS[result.integrity.reliabilityState].bg} ${INTEGRITY_COLORS[result.integrity.reliabilityState].text}`}>
              {result.integrity.reliabilityState}
            </span>
          </div>
          <div>
            <div className="text-[9px] text-white/60 uppercase tracking-wider mb-1">Mode</div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              result.mode === 'strict' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
            }`}>
              {result.mode.toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-[9px] text-white/60 uppercase tracking-wider mb-1">Data Gaps</div>
            <span className={`text-xs font-bold ${result.integrity.dataGaps ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {result.integrity.dataGaps ? 'YES' : 'NO'}
            </span>
          </div>
          <div>
            <div className="text-[9px] text-white/60 uppercase tracking-wider mb-1">Stocks Analyzed</div>
            <span className="text-xs font-mono text-white/60">{result.integrity.stocksAnalyzed}</span>
            <span className="text-[9px] text-white/50 ml-1">({result.integrity.stocksExcluded} excl)</span>
          </div>
          <div>
            <div className="text-[9px] text-white/60 uppercase tracking-wider mb-1">Priority Carriers</div>
            <span className="text-xs font-mono text-violet-400">{result.integrity.priorityCarriersFound}</span>
            <span className="text-[9px] text-white/50 ml-1">{result.integrity.minersIncluded ? '+miners' : 'no miners'}</span>
          </div>
          <div>
            <div className="text-[9px] text-white/60 uppercase tracking-wider mb-1">Data Quality</div>
            <span className={`text-xs font-mono ${
              result.integrity.dataQualityScore > 80 ? 'text-emerald-400' :
              result.integrity.dataQualityScore > 50 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {result.integrity.dataQualityScore}%
            </span>
            <span className="text-[9px] text-white/50 ml-1">({result.integrity.benchmarkDataDays}d)</span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 text-center">
        <p className="text-[9px] text-white/50">
          This module is a Bitcoin regime intelligence layer. It does not generate trading signals.
          Statistical reasoning only. Accuracy &gt; excitement. Stability &gt; frequency.
        </p>
      </div>
    </div>
  )
}
