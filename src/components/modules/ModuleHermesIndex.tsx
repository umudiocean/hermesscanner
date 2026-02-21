'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useNasdaqTradeContext } from '../Layout'

// ================================================================
// HERMES AI INDEX — Tum Hisselerin Kalbi (VITRIN MODULU)
// Trade AI (teknik) + Terminal AI (temel) verilerini birlestirerek
// piyasanin genel durumunu tek bir composite endeks olarak gosterir.
// Premium animasyonlar + efektler ile kurumsal vitrin.
// ================================================================

interface FmpStock {
  symbol: string
  companyName: string
  sector: string
  price: number
  changePercent: number
  marketCap: number
  signal: string
  signalScore: number
  confidence?: number
  altmanZ?: number
  piotroski?: number
  riskScore?: number
  riskLevel?: string
}

interface MarketData {
  fearGreedIndex?: number
  fearGreedLabel?: string
  sectorPerformance?: Array<{ sector: string; changesPercentage: number }>
  gainers?: Array<{ symbol: string; name: string; changesPercentage: number; price: number }>
  losers?: Array<{ symbol: string; name: string; changesPercentage: number; price: number }>
}

const SIGNAL_LABELS: Record<string, string> = {
  strong_long: 'STRONG LONG',
  long: 'LONG',
  neutral: 'NOTR',
  short: 'SHORT',
  strong_short: 'STRONG SHORT',
}

function getSignalLabel(t: string): string { return SIGNAL_LABELS[t] || 'NOTR' }

function formatMcap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`
  return `$${mc}`
}

// ─── AnimatedNumber — sayilar yukaridan asagi kayarak gelir ───
function AnimatedNumber({ value, decimals = 1, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef<number>(0)
  useEffect(() => {
    const start = display
    const end = value
    const duration = 800
    const t0 = performance.now()
    function tick(now: number) {
      const elapsed = now - t0
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (end - start) * eased)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

// ─── Circular Gauge — Ana kalp atisi ───
function PulseGauge({ score, label, size = 160 }: { score: number; label: string; size?: number }) {
  const getTheme = (s: number) => {
    if (s <= 20) return { color: '#EF4444', glow: 'rgba(239,68,68,0.3)', text: 'EXTREME FEAR' }
    if (s <= 35) return { color: '#fb923c', glow: 'rgba(251,146,60,0.25)', text: 'FEAR' }
    if (s <= 50) return { color: '#94a3b8', glow: 'rgba(148,163,184,0.15)', text: 'NEUTRAL' }
    if (s <= 65) return { color: '#62CBC1', glow: 'rgba(98,203,193,0.25)', text: 'GREED' }
    return { color: '#B3945B', glow: 'rgba(179,148,91,0.35)', text: 'EXTREME GREED' }
  }
  const t = getTheme(score)
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="flex flex-col items-center animate-heartbeat">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer glow ring */}
        <div className="absolute inset-[-8px] rounded-full animate-radial-pulse" style={{ background: `radial-gradient(circle, ${t.glow}, transparent 70%)` }} />
        <svg className="w-full h-full -rotate-90 drop-shadow-lg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/[0.04]" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={t.color} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="transition-all duration-1000 drop-shadow-[0_0_8px_var(--glow)]" style={{ '--glow': t.glow, filter: `drop-shadow(0 0 6px ${t.glow})` } as React.CSSProperties} />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map(v => {
            const angle = (v / 100) * 360 - 90
            const rad = (angle * Math.PI) / 180
            const x1 = 60 + 44 * Math.cos(rad)
            const y1 = 60 + 44 * Math.sin(rad)
            const x2 = 60 + 48 * Math.cos(rad)
            const y2 = 60 + 48 * Math.sin(rad)
            return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1" strokeOpacity="0.15" />
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-black tabular-nums animate-number-glow" style={{ color: t.color }}>{Math.round(score)}</span>
          <span className="text-[9px] font-bold tracking-wider mt-0.5" style={{ color: t.color }}>{label || t.text}</span>
        </div>
      </div>
      <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mt-2">Piyasa Nabzi</span>
    </div>
  )
}

// ─── Direction Badge — animasyonlu yon gostergesi ───
function DirectionBadge({ direction, dirColor }: { direction: string; dirColor: string }) {
  const isLong = direction.includes('LONG')
  const isShort = direction.includes('SHORT')
  return (
    <div className="animate-scale-pop text-center">
      <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 backdrop-blur-sm transition-all duration-500 ${
        isLong ? 'border-hermes-green/30 bg-hermes-green/[0.06] shadow-lg shadow-hermes-green/10' :
        isShort ? 'border-red-500/30 bg-red-500/[0.06] shadow-lg shadow-red-500/10' :
        'border-white/10 bg-white/[0.03]'
      }`}>
        <span className={`text-2xl ${isLong ? 'animate-bounce' : isShort ? 'animate-bounce' : ''}`}>
          {isLong ? '🚀' : isShort ? '🔻' : '⚖️'}
        </span>
        <span className={`text-xl font-black tracking-wide ${dirColor}`}>{direction}</span>
      </div>
    </div>
  )
}

// ─── Stat Card — hover efektli ───
function StatCard({ title, value, sub, icon, color = 'text-gold-300', className = '' }: {
  title: string; value: string | number; sub?: string; icon: string; color?: string; className?: string
}) {
  return (
    <div className={`group relative bg-[#141414] rounded-xl border border-gold-400/8 p-3.5 hover:border-gold-400/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-gold-400/5 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-gold-400/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base group-hover:scale-110 transition-transform duration-300">{icon}</span>
          <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">{title}</span>
        </div>
        <div className={`text-xl font-black tabular-nums ${color}`}>{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</div>
        {sub && <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Gauge Bar — parlayan animasyonlu ───
function GaugeBar({ value, label, color, subLabel }: {
  value: number; label: string; color: string; subLabel?: string
}) {
  const pct = Math.min(100, Math.max(0, value))
  const barColor = color.includes('green') ? '#62CBC1' : color.includes('gold') ? '#B3945B' : color.includes('red') ? '#EF4444' : '#94a3b8'
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${color}`}><AnimatedNumber value={value} /></span>
      </div>
      <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-1000 relative" style={{ width: `${pct}%`, backgroundColor: barColor }}>
          <div className="absolute inset-0 rounded-full opacity-50" style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`, backgroundSize: '200% 100%', animation: 'bar-sweep 2s linear infinite' }} />
        </div>
      </div>
      {subLabel && <span className="text-[9px] text-white/20 mt-0.5 block">{subLabel}</span>}
    </div>
  )
}

// ─── Signal Distribution — interaktif bar ───
function SignalDistBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (total === 0) return null
  const segments = [
    { key: 'strong_long', color: '#B3945B', glow: 'rgba(179,148,91,0.3)', label: 'S.LONG' },
    { key: 'long', color: '#62CBC1', glow: 'rgba(98,203,193,0.3)', label: 'LONG' },
    { key: 'neutral', color: '#64748b', glow: 'rgba(100,116,139,0.2)', label: 'NOTR' },
    { key: 'short', color: '#fb923c', glow: 'rgba(251,146,60,0.3)', label: 'SHORT' },
    { key: 'strong_short', color: '#EF4444', glow: 'rgba(239,68,68,0.3)', label: 'S.SHORT' },
  ]
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <div>
      <div className="flex h-8 rounded-xl overflow-hidden border border-white/[0.06] shadow-inner">
        {segments.map(s => {
          const count = counts[s.key] || 0
          const pct = (count / total) * 100
          if (pct < 0.3) return null
          const isHov = hovered === s.key
          return (
            <div
              key={s.key}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ width: `${pct}%`, backgroundColor: s.color, boxShadow: isHov ? `0 0 20px ${s.glow}` : 'none' }}
              className={`transition-all duration-300 relative cursor-default ${isHov ? 'brightness-125 z-10 scale-y-110' : ''}`}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                {pct > 6 && <span className={`text-[10px] font-bold transition-all duration-200 ${isHov ? 'text-white scale-110' : 'text-white/70'}`}>{count}</span>}
              </div>
              {isHov && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-2.5 py-1 rounded-lg shadow-xl z-20 whitespace-nowrap animate-scale-pop">
                  <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.label}: {count}</span>
                  <span className="text-[10px] text-white/40 ml-1.5">({pct.toFixed(1)}%)</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 px-1">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-1 group cursor-default" onMouseEnter={() => setHovered(s.key)} onMouseLeave={() => setHovered(null)}>
            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${hovered === s.key ? 'scale-125' : ''}`} style={{ backgroundColor: s.color }} />
            <span className={`text-[9px] transition-colors ${hovered === s.key ? 'text-white/70' : 'text-white/25'}`}>{s.label}</span>
            <span className={`text-[10px] font-bold tabular-nums transition-colors ${hovered === s.key ? 'text-white/90' : 'text-white/40'}`}>{counts[s.key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sector Heatmap — hover glow ───
function SectorHeatmap({ sectorStats }: { sectorStats: Array<{ sector: string; avgScore: number; avgChange: number; count: number; avgAiScore: number }> }) {
  if (sectorStats.length === 0) return null
  const sorted = [...sectorStats].sort((a, b) => a.avgScore - b.avgScore)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {sorted.map((s, i) => {
        const scoreColor = s.avgScore <= 20 ? 'border-gold-400/20 bg-gold-400/[0.04]' :
          s.avgScore <= 30 ? 'border-hermes-green/20 bg-hermes-green/[0.04]' :
          s.avgScore < 70 ? 'border-white/8 bg-white/[0.02]' :
          s.avgScore < 90 ? 'border-orange-500/20 bg-orange-500/[0.04]' :
          'border-red-500/20 bg-red-500/[0.04]'
        const textColor = s.avgScore <= 20 ? 'text-gold-300' :
          s.avgScore <= 30 ? 'text-hermes-green' :
          s.avgScore < 70 ? 'text-white/50' :
          s.avgScore < 90 ? 'text-orange-400' : 'text-red-400'
        return (
          <div key={s.sector} className={`group relative rounded-xl border p-3 ${scoreColor} transition-all duration-300 hover:scale-[1.03] hover:shadow-lg cursor-default overflow-hidden`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="text-[10px] font-semibold truncate text-white/60">{shortSector(s.sector)}</div>
              <div className="flex items-end justify-between mt-1.5">
                <span className={`text-base sm:text-lg font-black tabular-nums ${textColor}`}>{s.avgScore.toFixed(0)}</span>
                <div className="text-right">
                  <span className={`text-[11px] tabular-nums font-bold ${s.avgChange >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                    {s.avgChange >= 0 ? '+' : ''}{s.avgChange.toFixed(2)}%
                  </span>
                  <div className="text-[9px] text-white/25">Sektor</div>
                </div>
              </div>
              {/* Mini bar */}
              <div className="h-1 bg-white/[0.04] rounded-full mt-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, s.avgScore)}%`, backgroundColor: s.avgScore <= 20 ? '#B3945B' : s.avgScore <= 30 ? '#62CBC1' : s.avgScore < 70 ? '#64748b' : s.avgScore < 90 ? '#fb923c' : '#EF4444' }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function shortSector(s: string): string {
  const map: Record<string, string> = {
    'Financial Services': 'Finans', 'Consumer Cyclical': 'Tuketici Dng.',
    'Consumer Defensive': 'Tuketici Sav.', 'Communication Services': 'Iletisim',
    'Basic Materials': 'Hammadde', 'Real Estate': 'Gayrimenkul',
    'Healthcare': 'Saglik', 'Technology': 'Teknoloji', 'Industrials': 'Endustri',
    'Energy': 'Enerji', 'Utilities': 'Altyapi',
  }
  return map[s] || s
}

// ─── Top Movers — hover slide efekti ───
function TopMovers({ title, items, color, icon }: {
  title: string; icon: string
  items: Array<{ symbol: string; score: number; changePercent: number; price: number; signalType: string }>
  color: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">{title}</span>
      </div>
      <div className="space-y-1">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.symbol} className="group flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200 hover:translate-x-1 cursor-default" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-white/20 w-3 font-mono">{i + 1}</span>
              <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors">{item.symbol}</span>
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${
                item.signalType === 'strong_long' ? 'bg-gold-400/10 text-gold-300 border-gold-400/20' :
                item.signalType === 'long' ? 'bg-hermes-green/10 text-hermes-green border-hermes-green/20' :
                item.signalType === 'short' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                item.signalType === 'strong_short' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                'bg-white/[0.04] text-white/30 border-white/[0.06]'
              }`}>{getSignalLabel(item.signalType)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 tabular-nums font-mono">${item.price.toFixed(2)}</span>
              <span className={`text-xs font-bold tabular-nums ${color} group-hover:scale-110 transition-transform origin-right`}>
                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Live ticker tape ───
function TickerTape({ items }: { items: Array<{ symbol: string; change: number }> }) {
  if (items.length === 0) return null
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden relative h-7 border-y border-gold-400/[0.06] bg-[#0a0a0a]">
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10" />
      <div className="flex items-center gap-6 animate-[scroll-x_40s_linear_infinite] whitespace-nowrap py-1">
        {doubled.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="flex items-center gap-1.5 text-[10px]">
            <span className="font-bold text-white/50">{item.symbol}</span>
            <span className={`font-semibold tabular-nums ${item.change >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
              {item.change >= 0 ? '▲' : '▼'}{Math.abs(item.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
      <style>{`@keyframes scroll-x { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
    </div>
  )
}

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function ModuleHermesIndex() {
  const { results, loading, summary } = useNasdaqTradeContext()
  const [fmpStocks, setFmpStocks] = useState<FmpStock[]>([])
  const [marketData, setMarketData] = useState<MarketData>({})
  const [loadingFmp, setLoadingFmp] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        setLoadingFmp(true)
        const [stocksRes, marketRes] = await Promise.all([
          fetch('/api/fmp-terminal/stocks'),
          fetch('/api/fmp-terminal/market'),
        ])
        if (!cancelled) {
          if (stocksRes.ok) { const d = await stocksRes.json(); setFmpStocks(d.stocks || []) }
          if (marketRes.ok) { const d = await marketRes.json(); setMarketData(d) }
        }
      } catch { /* silent */ } finally { if (!cancelled) setLoadingFmp(false) }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const indexStats = useMemo(() => {
    if (results.length === 0) return null
    const signalCounts: Record<string, number> = { strong_long: 0, long: 0, neutral: 0, short: 0, strong_short: 0 }
    let totalScore = 0, totalRsi = 0, totalMfi = 0, totalChange = 0, totalMcap = 0
    for (const r of results) {
      signalCounts[r.hermes.signalType] = (signalCounts[r.hermes.signalType] || 0) + 1
      totalScore += r.hermes.score
      totalRsi += r.hermes.indicators.rsi
      totalMfi += r.hermes.indicators.mfi
      totalChange += r.quote?.changePercent || 0
      if (r.quote?.marketCap) totalMcap += r.quote.marketCap
    }
    const n = results.length
    const avgScore = totalScore / n
    const avgRsi = totalRsi / n
    const avgMfi = totalMfi / n
    const avgChange = totalChange / n
    const longs = signalCounts.strong_long + signalCounts.long
    const shorts = signalCounts.strong_short + signalCounts.short
    const neutrals = signalCounts.neutral
    const longPct = (longs / n) * 100
    const shortPct = (shorts / n) * 100
    const direction = longPct > 60 ? 'STRONG LONG' : longPct > 45 ? 'LONG' : shortPct > 60 ? 'STRONG SHORT' : shortPct > 45 ? 'SHORT' : 'NOTR'
    const dirColor = direction.includes('LONG') ? 'text-hermes-green' : direction.includes('SHORT') ? 'text-red-400' : 'text-white/50'

    const sectorMap = new Map<string, { scores: number[]; changes: number[]; aiScores: number[] }>()
    const fmpMap = new Map<string, FmpStock>()
    for (const s of fmpStocks) fmpMap.set(s.symbol, s)
    for (const r of results) {
      const fmp = fmpMap.get(r.symbol)
      const sector = fmp?.sector || 'Unknown'
      if (!sectorMap.has(sector)) sectorMap.set(sector, { scores: [], changes: [], aiScores: [] })
      const entry = sectorMap.get(sector)!
      entry.scores.push(r.hermes.score)
      entry.changes.push(r.quote?.changePercent || 0)
      entry.aiScores.push(fmp?.signalScore || 50)
    }
    const sectorStats = Array.from(sectorMap.entries()).filter(([s]) => s !== 'Unknown').map(([sector, data]) => ({
      sector,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      avgChange: data.changes.reduce((a, b) => a + b, 0) / data.changes.length,
      count: data.scores.length,
      avgAiScore: data.aiScores.reduce((a, b) => a + b, 0) / data.aiScores.length,
    }))

    let avgAiScore = 50, avgRisk = 50, aiStrongCount = 0, aiBadCount = 0
    if (fmpStocks.length > 0) {
      let totalAi = 0, totalRisk = 0, riskN = 0
      for (const s of fmpStocks) {
        totalAi += s.signalScore
        if (s.riskScore !== undefined) { totalRisk += s.riskScore; riskN++ }
        if (s.signal === 'STRONG') aiStrongCount++
        if (s.signal === 'BAD') aiBadCount++
      }
      avgAiScore = totalAi / fmpStocks.length
      if (riskN > 0) avgRisk = totalRisk / riskN
    }

    const sorted = [...results].filter(r => r.quote?.changePercent !== undefined)
    const topGainers = [...sorted].sort((a, b) => (b.quote?.changePercent || 0) - (a.quote?.changePercent || 0)).slice(0, 5).map(r => ({ symbol: r.symbol, score: r.hermes.score, changePercent: r.quote?.changePercent || 0, price: r.quote?.price || r.hermes.price, signalType: r.hermes.signalType }))
    const topLosers = [...sorted].sort((a, b) => (a.quote?.changePercent || 0) - (b.quote?.changePercent || 0)).slice(0, 5).map(r => ({ symbol: r.symbol, score: r.hermes.score, changePercent: r.quote?.changePercent || 0, price: r.quote?.price || r.hermes.price, signalType: r.hermes.signalType }))
    const topStrongLongs = [...results].filter(r => r.hermes.signalType === 'strong_long').sort((a, b) => a.hermes.score - b.hermes.score).slice(0, 5).map(r => ({ symbol: r.symbol, score: r.hermes.score, changePercent: r.quote?.changePercent || 0, price: r.quote?.price || r.hermes.price, signalType: r.hermes.signalType }))
    const topStrongShorts = [...results].filter(r => r.hermes.signalType === 'strong_short').sort((a, b) => b.hermes.score - a.hermes.score).slice(0, 5).map(r => ({ symbol: r.symbol, score: r.hermes.score, changePercent: r.quote?.changePercent || 0, price: r.quote?.price || r.hermes.price, signalType: r.hermes.signalType }))

    const marketPulse = 100 - avgScore
    const tickerItems = sorted.slice(0, 30).map(r => ({ symbol: r.symbol, change: r.quote?.changePercent || 0 }))

    return { n, avgScore, avgRsi, avgMfi, avgChange, totalMcap, signalCounts, longs, shorts, neutrals, longPct, shortPct, direction, dirColor, sectorStats, avgAiScore, avgRisk, aiStrongCount, aiBadCount, topGainers, topLosers, topStrongLongs, topStrongShorts, marketPulse, tickerItems }
  }, [results, fmpStocks])

  const isLoading = loading || loadingFmp

  if (isLoading && !indexStats) {
    return (
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
          <div className="relative">
            <div className="w-20 h-20 border-[3px] border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl animate-pulse">💎</span>
            </div>
          </div>
          <div className="text-center">
            <span className="text-white/40 text-sm block gold-shimmer font-bold">HERMES AI INDEX</span>
            <span className="text-white/20 text-xs mt-1 block">Tum piyasa verilerini birlestiriyor...</span>
          </div>
          <div className="flex gap-2 mt-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-gold-400/30 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!indexStats) {
    return (
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="text-center py-24">
          <div className="text-7xl mb-5 animate-float">💎</div>
          <h3 className="text-xl font-bold text-white/50 mb-2 gold-shimmer inline-block">HERMES AI INDEX</h3>
          <p className="text-white/25 text-sm max-w-md mx-auto mt-2">
            Trade AI taramasi tamamlandiktan sonra aktif olur. Yukaridaki <span className="text-gold-300 font-semibold">Scan</span> butonuna basin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-[1920px] mx-auto px-2 sm:px-4 py-2 sm:py-4 ${mounted ? 'animate-fade-in' : ''}`}>
      {/* ═══ HEADER ═══ */}
      <div className="mb-4 stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl animate-float">💎</span>
          <h2 className="text-base sm:text-lg font-black tracking-wide">
            <span className="text-white/90">HERMES</span>
            <span className="gold-shimmer ml-1.5">AI INDEX</span>
          </h2>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gold-400/10 text-gold-400/60 font-bold border border-gold-400/15 animate-border-shimmer">
            {indexStats.n} HISSE
          </span>
          {isLoading && <div className="w-3 h-3 border border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />}
        </div>
        <p className="text-[11px] text-white/25 ml-10">
          NASDAQ/NYSE piyasasinin teknik + temel analiz birlesimi — canli endeks
        </p>
      </div>

      {/* ═══ TICKER TAPE ═══ */}
      <div className="mb-4 stagger-2 rounded-xl overflow-hidden">
        <TickerTape items={indexStats.tickerItems} />
      </div>

      {/* ═══ TOP ROW: Gauge + Direction + Stats ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-2 sm:mb-4">
        {/* Pulse Gauge */}
        <div className="stagger-2 bg-[#111111] rounded-2xl border border-gold-400/10 p-3 sm:p-4 lg:p-6 flex items-center justify-center hover:border-gold-400/20 transition-all duration-500 gold-border-glow">
          <PulseGauge score={indexStats.marketPulse} label={marketData.fearGreedLabel || ''} />
        </div>

        {/* Direction + Gauges */}
        <div className="stagger-3 bg-[#111111] rounded-2xl border border-gold-400/10 p-3 sm:p-4 lg:p-5 flex flex-col justify-between hover:border-gold-400/20 transition-all duration-500 gold-border-glow">
          <DirectionBadge direction={indexStats.direction} dirColor={indexStats.dirColor} />
          <div className="text-[10px] text-white/25 text-center mt-2 mb-3">
            Long: <span className="text-hermes-green font-bold">{indexStats.longPct.toFixed(1)}%</span>
            {' | '}Notr: <span className="text-white/40 font-bold">{((indexStats.neutrals / indexStats.n) * 100).toFixed(1)}%</span>
            {' | '}Short: <span className="text-red-400 font-bold">{indexStats.shortPct.toFixed(1)}%</span>
          </div>
          <div className="space-y-2.5">
            <GaugeBar value={indexStats.avgScore} label="Ort. Teknik Skor" color={indexStats.avgScore <= 40 ? 'text-hermes-green' : indexStats.avgScore <= 60 ? 'text-white/60' : 'text-red-400'} subLabel="0=Alis baskisi, 100=Satis baskisi" />
            <GaugeBar value={indexStats.avgAiScore} label="Ort. HERMES AI Skor" color={indexStats.avgAiScore >= 60 ? 'text-hermes-green' : indexStats.avgAiScore >= 40 ? 'text-white/60' : 'text-red-400'} subLabel="0=Kotu, 100=Mukemmel" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 stagger-4">
          <StatCard title="Ort. Degisim" value={`${indexStats.avgChange >= 0 ? '+' : ''}${indexStats.avgChange.toFixed(2)}%`} icon="📈" color={indexStats.avgChange >= 0 ? 'text-hermes-green' : 'text-red-400'} />
          <StatCard title="Ort. Risk" value={indexStats.avgRisk.toFixed(0)} icon="🛡️" color={indexStats.avgRisk <= 40 ? 'text-hermes-green' : indexStats.avgRisk <= 60 ? 'text-gold-300' : 'text-red-400'} sub={indexStats.avgRisk <= 40 ? 'Dusuk Risk' : indexStats.avgRisk <= 60 ? 'Orta Risk' : 'Yuksek Risk'} />
          <StatCard title="Ort. RSI" value={indexStats.avgRsi.toFixed(1)} icon="📊" color={indexStats.avgRsi < 40 ? 'text-hermes-green' : indexStats.avgRsi > 60 ? 'text-red-400' : 'text-white/60'} sub={indexStats.avgRsi < 30 ? 'Asiri Satim' : indexStats.avgRsi > 70 ? 'Asiri Alim' : 'Normal'} />
          <StatCard title="Ort. MFI" value={indexStats.avgMfi.toFixed(1)} icon="💰" color={indexStats.avgMfi < 40 ? 'text-hermes-green' : indexStats.avgMfi > 60 ? 'text-red-400' : 'text-white/60'} sub={indexStats.avgMfi < 20 ? 'Para Girisi' : indexStats.avgMfi > 80 ? 'Para Cikisi' : 'Dengeli'} />
        </div>
      </div>

      {/* ═══ SIGNAL DISTRIBUTION ═══ */}
      <div className="stagger-5 bg-[#111111] rounded-2xl border border-gold-400/10 p-3 sm:p-4 lg:p-5 mb-4 hover:border-gold-400/20 transition-all duration-500 gold-border-glow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Sinyal Dagilimi</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-hermes-green font-bold">{indexStats.longs} Long</span>
            <span className="text-white/30">|</span>
            <span className="text-red-400 font-bold">{indexStats.shorts} Short</span>
          </div>
        </div>
        <SignalDistBar counts={indexStats.signalCounts} total={indexStats.n} />
      </div>

      {/* ═══ AI TERMINAL OVERVIEW ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 mb-2 sm:mb-4 stagger-6">
        <StatCard title="AI STRONG" value={indexStats.aiStrongCount} icon="⭐" color="text-gold-300" sub="Temel analiz guclu" />
        <StatCard title="AI BAD" value={indexStats.aiBadCount} icon="⚠️" color="text-red-400" sub="Temel analiz kotu" />
        <StatCard title="Toplam Mcap" value={formatMcap(indexStats.totalMcap)} icon="🏦" color="text-white/60" sub="Tum hisseler" />
        <StatCard title="Fear & Greed" value={marketData.fearGreedIndex?.toFixed(0) || '-'} icon="🎭" color={(marketData.fearGreedIndex || 50) <= 40 ? 'text-red-400' : (marketData.fearGreedIndex || 50) <= 60 ? 'text-white/60' : 'text-gold-300'} sub={marketData.fearGreedLabel || '-'} />
      </div>

      {/* ═══ SECTOR HEATMAP ═══ */}
      <div className="bg-[#111111] rounded-2xl border border-gold-400/10 p-3 sm:p-4 lg:p-5 mb-4 hover:border-gold-400/20 transition-all duration-500 gold-border-glow">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🗺️</span>
          <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Sektor Haritasi</span>
          <span className="text-[9px] text-white/20">(Teknik Skor Ortalamasi — dusuk = alis baskisi)</span>
        </div>
        <SectorHeatmap sectorStats={indexStats.sectorStats} />
      </div>

      {/* ═══ TOP MOVERS + STRONGEST SIGNALS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-2 sm:mb-4">
        <div className="bg-[#111111] rounded-2xl border border-gold-400/10 p-4 hover:border-hermes-green/20 transition-all duration-500 gold-border-glow">
          <TopMovers title="En Cok Yukselenler" items={indexStats.topGainers} color="text-hermes-green" icon="🟢" />
        </div>
        <div className="bg-[#111111] rounded-2xl border border-gold-400/10 p-4 hover:border-red-500/20 transition-all duration-500 gold-border-glow">
          <TopMovers title="En Cok Dusenler" items={indexStats.topLosers} color="text-red-400" icon="🔴" />
        </div>
        <div className="bg-[#111111] rounded-2xl border border-gold-400/10 p-4 hover:border-gold-400/20 transition-all duration-500 gold-border-glow">
          <TopMovers title="En Guclu LONG" items={indexStats.topStrongLongs} color="text-gold-300" icon="🏆" />
        </div>
        <div className="bg-[#111111] rounded-2xl border border-gold-400/10 p-4 hover:border-orange-500/20 transition-all duration-500 gold-border-glow">
          <TopMovers title="En Guclu SHORT" items={indexStats.topStrongShorts} color="text-orange-400" icon="⚡" />
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="flex items-center justify-between text-[10px] text-white/15 px-2 pb-2">
        <span>Trade AI: {results.length} | Terminal AI: {fmpStocks.length} | Sektorler: {indexStats.sectorStats.length}</span>
        <span className="tabular-nums">Guncelleme: {new Date().toLocaleTimeString('tr-TR')}</span>
      </div>
    </div>
  )
}
