'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useNasdaqTradeContext } from '../Layout'
import { PremiumGauge, FearGreedBar, AILoading, LiveDot } from '../premium-ui'

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
  long: 'LONG',
  neutral: 'BEKLE',
  short: 'SHORT',
  strong_long: 'LONG',
  strong_short: 'SHORT',
}

function getSignalLabel(t: string): string { return SIGNAL_LABELS[t] || 'BEKLE' }

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
    if (s <= 20) return { color: '#F04848', glow: 'rgba(239,68,68,0.3)', text: 'EXTREME FEAR' }
    if (s <= 35) return { color: '#fb923c', glow: 'rgba(251,146,60,0.25)', text: 'FEAR' }
    if (s <= 50) return { color: '#94a3b8', glow: 'rgba(148,163,184,0.15)', text: 'NEUTRAL' }
    if (s <= 65) return { color: '#3FCAB4', glow: 'rgba(98,203,193,0.25)', text: 'GREED' }
    return { color: '#D4B86A', glow: 'rgba(179,148,91,0.35)', text: 'EXTREME GREED' }
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
      <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-semibold mt-2">Piyasa Nabzi</span>
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
        isLong ? 'border-success-400/30 bg-success-400/[0.06] shadow-lg shadow-success-400/10' :
        isShort ? 'border-danger-400/30 bg-danger-400/[0.06] shadow-lg shadow-red-500/10' :
        'border-stroke bg-surface-2'
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
    <div className={`group relative bg-[#141414] rounded-xl border border-stroke-gold p-3.5 hover:border-stroke-gold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-gold-400/5 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-gold-400/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base group-hover:scale-110 transition-transform duration-300">{icon}</span>
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">{title}</span>
        </div>
        <div className={`text-xl font-black tabular-nums ${color}`}>{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</div>
        {sub && <div className="text-[10px] text-text-quaternary mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Gauge Bar — parlayan animasyonlu ───
function GaugeBar({ value, label, color, subLabel }: {
  value: number; label: string; color: string; subLabel?: string
}) {
  const pct = Math.min(100, Math.max(0, value))
  const barColor = color.includes('green') ? '#3FCAB4' : color.includes('gold') ? '#D4B86A' : color.includes('red') ? '#F04848' : '#94a3b8'
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${color}`}><AnimatedNumber value={value} /></span>
      </div>
      <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-1000 relative" style={{ width: `${pct}%`, backgroundColor: barColor }}>
          <div className="absolute inset-0 rounded-full opacity-50" style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`, backgroundSize: '200% 100%', animation: 'bar-sweep 2s linear infinite' }} />
        </div>
      </div>
      {subLabel && <span className="text-[9px] text-text-tertiary mt-0.5 block">{subLabel}</span>}
    </div>
  )
}

// ─── Signal Distribution — interaktif bar ───
function SignalDistBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (total === 0) return null
  const segments = [
    { key: 'long', color: '#3FCAB4', glow: 'rgba(98,203,193,0.3)', label: 'LONG' },
    { key: 'neutral', color: '#64748b', glow: 'rgba(100,116,139,0.2)', label: 'BEKLE' },
    { key: 'short', color: '#F04848', glow: 'rgba(239,68,68,0.3)', label: 'SHORT' },
  ]
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <div>
      <div className="flex h-8 rounded-xl overflow-hidden border border-stroke-subtle shadow-inner">
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
                {pct > 6 && <span className={`text-[10px] font-bold transition-all duration-200 ${isHov ? 'text-white scale-110' : 'text-text-secondary'}`}>{count}</span>}
              </div>
              {isHov && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface-2 border border-stroke px-2.5 py-1 rounded-lg shadow-xl z-20 whitespace-nowrap animate-scale-pop">
                  <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.label}: {count}</span>
                  <span className="text-[10px] text-text-tertiary ml-1.5">({pct.toFixed(1)}%)</span>
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
            <span className={`text-[9px] transition-colors ${hovered === s.key ? 'text-text-secondary' : 'text-text-quaternary'}`}>{s.label}</span>
            <span className={`text-[10px] font-bold tabular-nums transition-colors ${hovered === s.key ? 'text-text-primary' : 'text-text-tertiary'}`}>{counts[s.key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sector Heatmap — glassmorphism cards + scan line ───
function HermesIndexCard({ idx, compact = false }: { idx: { name: string; icon: string; tier: string; count: number; avg: number; strong: number; good: number; neutral: number; weak: number; bad: number; label: string; color: string }; compact?: boolean }) {
  const tierBorder = idx.tier === 'official' ? 'border-violet-500/10 hover:border-info-400/30' :
    idx.tier === 'cap' ? 'border-blue-500/8 hover:border-blue-500/25' :
    'border-amber-500/8 hover:border-amber-500/25'
  return (
    <div className={`group bg-surface-1 rounded-xl border ${tierBorder} ${compact ? 'p-2.5' : 'p-3 sm:p-4'} transition-all duration-500 overflow-hidden relative`}>
      <div className="absolute inset-0 bg-gradient-to-br from-gold-400/[0.015] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={compact ? 'text-sm' : 'text-base'}>{idx.icon}</span>
            <div className="min-w-0">
              <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold text-text-primary truncate block`}>{idx.name}</span>
              <span className="text-[8px] text-text-quaternary">{idx.count} hisse</span>
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className={`${compact ? 'text-lg' : 'text-2xl'} font-black tabular-nums leading-none`} style={{ color: idx.color }}>
              <AnimatedNumber value={idx.avg} decimals={0} />
            </span>
            <span className="text-[8px] font-bold px-1 py-0.5 rounded-full mt-0.5" style={{ color: idx.color, backgroundColor: `${idx.color}12`, border: `1px solid ${idx.color}25` }}>
              {idx.label}
            </span>
          </div>
        </div>
        <div className="h-1 bg-surface-3 rounded-full overflow-hidden mb-1.5">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${idx.avg}%`, background: `linear-gradient(90deg, ${idx.color}50, ${idx.color})` }} />
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-px mb-1">
          {idx.strong > 0 && <div className="bg-gold-400 rounded-sm" style={{ flex: idx.strong }} />}
          {idx.good > 0 && <div className="bg-success-400 rounded-sm" style={{ flex: idx.good }} />}
          {idx.neutral > 0 && <div className="bg-slate-500/80 rounded-sm" style={{ flex: idx.neutral }} />}
          {idx.weak > 0 && <div className="bg-warning-400 rounded-sm" style={{ flex: idx.weak }} />}
          {idx.bad > 0 && <div className="bg-danger-400 rounded-sm" style={{ flex: idx.bad }} />}
        </div>
        {!compact && (
          <div className="flex flex-wrap justify-between text-[7px] text-text-quaternary">
            <span className="text-gold-400">{idx.strong}</span>
            <span className="text-success-400">{idx.good}</span>
            <span className="text-text-tertiary">{idx.neutral}</span>
            <span className="text-warning-400">{idx.weak}</span>
            <span className="text-danger-400">{idx.bad}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SectorHeatmap({ sectorStats }: { sectorStats: Array<{ sector: string; avgScore: number; avgChange: number; count: number; avgAiScore: number }> }) {
  if (sectorStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-xl bg-surface-2 border border-stroke-subtle flex items-center justify-center animate-empty-float mb-4">
          <span className="text-2xl">🗺️</span>
        </div>
        <p className="text-sm text-text-tertiary">Sektor verisi bekleniyor...</p>
      </div>
    )
  }
  const sorted = [...sectorStats].sort((a, b) => a.avgScore - b.avgScore)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {sorted.map((s, i) => {
        const accentColor = s.avgScore <= 20 ? '#D4B86A' : s.avgScore <= 30 ? '#3FCAB4' : s.avgScore < 70 ? '#64748b' : s.avgScore < 90 ? '#fb923c' : '#F04848'
        const borderClass = s.avgScore <= 20 ? 'border-stroke-gold' :
          s.avgScore <= 30 ? 'border-success-400/15' :
          s.avgScore < 70 ? 'border-stroke-subtle' :
          s.avgScore < 90 ? 'border-orange-500/15' : 'border-red-500/15'
        const textColor = s.avgScore <= 20 ? 'text-gold-300' :
          s.avgScore <= 30 ? 'text-success-400' :
          s.avgScore < 70 ? 'text-text-secondary' :
          s.avgScore < 90 ? 'text-warning-400' : 'text-danger-400'
        return (
          <div key={s.sector} className={`group relative rounded-xl border p-3 ${borderClass} bg-surface-2 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] cursor-default overflow-hidden`}
            style={{ animationDelay: `${i * 40}ms` }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
              background: `radial-gradient(circle at 50% 50%, ${accentColor}10, transparent 70%)`
            }} />
            <div className="absolute inset-0 scan-line opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold truncate text-text-secondary max-w-[80%]">{shortSector(s.sector)}</span>
                <span className="text-[9px] text-text-tertiary tabular-nums">{s.count}</span>
              </div>
              <div className="flex items-end justify-between mt-2">
                <span className={`text-lg font-black tabular-nums ${textColor}`}>{s.avgScore.toFixed(0)}</span>
                <span className={`text-[11px] tabular-nums font-bold ${s.avgChange >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                  {s.avgChange >= 0 ? '+' : ''}{s.avgChange.toFixed(2)}%
                </span>
              </div>
              <div className="h-1 bg-surface-3 rounded-full mt-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{
                  width: `${Math.min(100, s.avgScore)}%`,
                  backgroundColor: accentColor,
                  boxShadow: `0 0 6px ${accentColor}40`
                }} />
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
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">{title}</span>
      </div>
      <div className="space-y-1">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.symbol} className="group flex items-center justify-between px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition-all duration-200 hover:translate-x-1 cursor-default" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-text-tertiary w-3 font-mono">{i + 1}</span>
              <span className="text-xs font-bold text-text-primary group-hover:text-white transition-colors">{item.symbol}</span>
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${
                (item.signalType === 'long' || item.signalType === 'strong_long') ? 'bg-success-400/10 text-success-400 border-success-400/20' :
                (item.signalType === 'short' || item.signalType === 'strong_short') ? 'bg-danger-400/10 text-danger-400 border-danger-400/30' :
                'bg-surface-3 text-text-tertiary border-stroke-subtle'
              }`}>{getSignalLabel(item.signalType)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-text-tertiary tabular-nums font-mono">${item.price.toFixed(2)}</span>
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
function TickerTape({ items }: { items: Array<{ symbol: string; price: number; change: number }> }) {
  if (items.length === 0) return null
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden relative h-8 border-y border-gold-400/[0.06] bg-surface-0/80 backdrop-blur-sm">
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10" />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-40 live-dot" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-400" />
        </span>
        <span className="text-[9px] font-bold tracking-widest text-success-400/70">LIVE</span>
      </div>
      <div className="flex items-center gap-7 ticker-scroll whitespace-nowrap py-1.5 pl-16">
        {doubled.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="flex items-center gap-1.5 text-[10px]">
            <span className="font-bold text-text-secondary">{item.symbol}</span>
            <span className="text-text-tertiary tabular-nums font-mono">${item.price.toFixed(2)}</span>
            <span className={`font-semibold tabular-nums ${item.change >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
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
  const [indexMembership, setIndexMembership] = useState<Record<string, string[]>>({})
  const [pulseData, setPulseData] = useState<{ composite: number; level: string; levelLabel: string; marketOpen: boolean; components?: { id: string; name: string; value: number; available: boolean }[] } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        setLoadingFmp(true)
        const [stocksRes, marketRes, macroRes, pulseRes] = await Promise.all([
          fetch('/api/fmp-terminal/stocks'),
          fetch('/api/fmp-terminal/market'),
          fetch('/api/fmp-terminal/macro').catch(() => null),
          fetch('/api/wall-street-pulse').catch(() => null),
        ])
        if (!cancelled) {
          if (stocksRes.ok) { const d = await stocksRes.json(); setFmpStocks(d.stocks || []) }
          if (marketRes.ok) { const d = await marketRes.json(); setMarketData(d) }
          if (macroRes?.ok) { const d = await macroRes.json(); setIndexMembership(d.indexMembership || {}) }
          if (pulseRes?.ok) { const d = await pulseRes.json(); if (d && typeof d.composite === 'number') setPulseData(d) }
        }
      } catch { /* silent */ } finally { if (!cancelled) setLoadingFmp(false) }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const indexStats = useMemo(() => {
    if (results.length === 0) return null
    const signalCounts: Record<string, number> = { long: 0, neutral: 0, short: 0 }
    let totalScore = 0, totalRsi = 0, totalMfi = 0, totalChange = 0, totalMcap = 0
    for (const r of results) {
      const mapped = (r.hermes.signalType === 'strong_long') ? 'long' : (r.hermes.signalType === 'strong_short') ? 'short' : (r.hermes.signalType === 'long' || r.hermes.signalType === 'short' || r.hermes.signalType === 'neutral') ? r.hermes.signalType : 'neutral'
      signalCounts[mapped] = (signalCounts[mapped] || 0) + 1
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
    const longs = signalCounts.long
    const shorts = signalCounts.short
    const neutrals = signalCounts.neutral
    const longPct = (longs / n) * 100
    const shortPct = (shorts / n) * 100
    const direction = longPct > 45 ? 'LONG' : shortPct > 45 ? 'SHORT' : 'BEKLE'
    const dirColor = direction === 'LONG' ? 'text-success-400' : direction === 'SHORT' ? 'text-danger-400' : 'text-text-secondary'

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
    const topStrongLongs = [...results].filter(r => r.hermes.signalType === 'long' || r.hermes.signalType === 'strong_long').sort((a, b) => a.hermes.score - b.hermes.score).slice(0, 5).map(r => ({ symbol: r.symbol, score: r.hermes.score, changePercent: r.quote?.changePercent || 0, price: r.quote?.price || r.hermes.price, signalType: r.hermes.signalType }))
    const topStrongShorts = [...results].filter(r => r.hermes.signalType === 'short' || r.hermes.signalType === 'strong_short').sort((a, b) => b.hermes.score - a.hermes.score).slice(0, 5).map(r => ({ symbol: r.symbol, score: r.hermes.score, changePercent: r.quote?.changePercent || 0, price: r.quote?.price || r.hermes.price, signalType: r.hermes.signalType }))

    const marketPulse = 100 - avgScore
    const tickerItems = sorted.slice(0, 30).map(r => ({ symbol: r.symbol, price: r.quote?.price || r.hermes.price, change: r.quote?.changePercent || 0 }))

    return { n, avgScore, avgRsi, avgMfi, avgChange, totalMcap, signalCounts, longs, shorts, neutrals, longPct, shortPct, direction, dirColor, sectorStats, avgAiScore, avgRisk, aiStrongCount, aiBadCount, topGainers, topLosers, topStrongLongs, topStrongShorts, marketPulse, tickerItems }
  }, [results, fmpStocks])

  // Endeks bazli HERMES AI skor kartlari — 3 resmi + 7 sentetik = 10 endeks
  const indexScoreCards = useMemo(() => {
    if (fmpStocks.length === 0) return []
    const fmpMap = new Map(fmpStocks.map(s => [s.symbol, s]))

    // Resmi endeksler
    const sp500Syms: string[] = []
    const ndx100Syms: string[] = []
    const djiaSyms: string[] = []
    for (const [sym, idxList] of Object.entries(indexMembership)) {
      if (idxList.includes('SP500')) sp500Syms.push(sym)
      if (idxList.includes('NDX100')) ndx100Syms.push(sym)
      if (idxList.includes('DJIA')) djiaSyms.push(sym)
    }

    // Sentetik endeksler — marketCap ve sektor bazli
    const withMcap = fmpStocks.filter(s => s.marketCap > 0 && s.signalScore > 0)
    const sorted = [...withMcap].sort((a, b) => b.marketCap - a.marketCap)
    const megaSyms = sorted.filter(s => s.marketCap >= 200e9).map(s => s.symbol)
    const largeSyms = sorted.filter(s => s.marketCap >= 10e9 && s.marketCap < 200e9).map(s => s.symbol)
    const midSyms = sorted.filter(s => s.marketCap >= 2e9 && s.marketCap < 10e9).map(s => s.symbol)
    const smallSyms = sorted.filter(s => s.marketCap >= 300e6 && s.marketCap < 2e9).map(s => s.symbol)
    const techSyms = sorted.filter(s => s.sector === 'Technology').slice(0, 100).map(s => s.symbol)
    const healthSyms = sorted.filter(s => s.sector === 'Healthcare').slice(0, 50).map(s => s.symbol)
    const finSyms = sorted.filter(s => s.sector === 'Financial Services').slice(0, 50).map(s => s.symbol)

    type IdxDef = { name: string; icon: string; tier: 'official' | 'cap' | 'sector'; members: string[] }
    function calcIndexStats(def: IdxDef) {
      const scored = def.members.map(s => fmpMap.get(s)).filter((s): s is FmpStock => !!s && s.signalScore > 0)
      const scores = scored.map(s => s.signalScore)
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const strong = scored.filter(s => s.signal === 'STRONG').length
      const good = scored.filter(s => s.signal === 'GOOD').length
      const neutral = scored.filter(s => s.signal === 'NEUTRAL').length
      const weak = scored.filter(s => s.signal === 'WEAK').length
      const bad = scored.filter(s => s.signal === 'BAD').length
      let label: string, color: string
      if (avg >= 70) { label = 'GUCLU'; color = '#3FCAB4' }
      else if (avg >= 55) { label = 'IYI'; color = '#3FCAB4' }
      else if (avg >= 45) { label = 'NOTR'; color = '#94a3b8' }
      else if (avg >= 30) { label = 'ZAYIF'; color = '#fb923c' }
      else { label = 'KOTU'; color = '#f87171' }
      return { name: def.name, icon: def.icon, tier: def.tier, count: scored.length, avg, strong, good, neutral, weak, bad, label, color }
    }

    const defs: IdxDef[] = [
      { name: 'S&P 500', icon: '🏛️', tier: 'official', members: sp500Syms },
      { name: 'NASDAQ-100', icon: '💻', tier: 'official', members: ndx100Syms },
      { name: 'Dow Jones 30', icon: '🏦', tier: 'official', members: djiaSyms },
      { name: 'MEGA CAP', icon: '👑', tier: 'cap', members: megaSyms },
      { name: 'LARGE CAP', icon: '🔵', tier: 'cap', members: largeSyms },
      { name: 'MID CAP', icon: '🟢', tier: 'cap', members: midSyms },
      { name: 'SMALL CAP', icon: '🟡', tier: 'cap', members: smallSyms },
      { name: 'TECH 100', icon: '⚡', tier: 'sector', members: techSyms },
      { name: 'HEALTH 50', icon: '🏥', tier: 'sector', members: healthSyms },
      { name: 'FINANCE 50', icon: '💰', tier: 'sector', members: finSyms },
    ]
    return defs.filter(d => d.members.length > 0).map(calcIndexStats)
  }, [fmpStocks, indexMembership])

  const isLoading = loading || loadingFmp

  if (isLoading && !indexStats) {
    return (
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AILoading text="HERMES AI INDEX" subText="Tum piyasa verilerini birlestiriyor" />
        </div>
      </div>
    )
  }

  if (!indexStats) {
    return (
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="text-center py-24">
          <div className="text-7xl mb-5 animate-float">💎</div>
          <h3 className="text-xl font-bold text-text-secondary mb-2 gold-shimmer inline-block">HERMES AI INDEX</h3>
          <p className="text-text-quaternary text-sm max-w-md mx-auto mt-2">
            Trade AI taramasi tamamlandiktan sonra aktif olur. Yukaridaki <span className="text-gold-300 font-semibold">Scan</span> butonuna basin.
          </p>
        </div>
      </div>
    )
  }

  const breadthUp = results.filter(r => (r.quote?.changePercent || 0) > 0).length
  const breadthDown = results.filter(r => (r.quote?.changePercent || 0) < 0).length
  const breadthPct = indexStats.n > 0 ? (breadthUp / indexStats.n) * 100 : 50

  const aiConsensus = useMemo(() => {
    if (!indexStats || indexStats.n === 0) return 0
    const fmpMap = new Map<string, FmpStock>()
    for (const s of fmpStocks) fmpMap.set(s.symbol, s)

    let matched = 0
    let total = 0
    for (const r of results) {
      const fmp = fmpMap.get(r.symbol)
      if (!fmp) continue
      total++

      const tekLong = r.hermes.signalType === 'strong_long' || r.hermes.signalType === 'long'
      const tekShort = r.hermes.signalType === 'strong_short' || r.hermes.signalType === 'short'
      const tekNotr = !tekLong && !tekShort

      const fmpGood = fmp.signal === 'STRONG' || fmp.signal === 'GOOD'
      const fmpBad = fmp.signal === 'BAD' || fmp.signal === 'WEAK'
      const fmpNotr = !fmpGood && !fmpBad

      if ((tekLong && fmpGood) || (tekShort && fmpBad) || (tekNotr && fmpNotr)) {
        matched++
      } else if ((tekLong && fmpNotr) || (tekShort && fmpNotr) || (tekNotr && fmpGood) || (tekNotr && fmpBad)) {
        matched += 0.3
      }
    }
    return total > 0 ? (matched / total) * 100 : 0
  }, [results, fmpStocks, indexStats])

  return (
    <div className={`max-w-[1920px] mx-auto px-2 sm:px-4 py-2 sm:py-4 ${mounted ? 'animate-fade-in' : ''}`}>
      {/* ═══ PREMIUM HEADER ═══ */}
      <div className="relative mb-4 stagger-1 bg-surface-0 rounded-2xl border border-stroke-gold p-4 sm:p-5 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #D4B86A 0.5px, transparent 0.5px)`,
          backgroundSize: '24px 24px',
        }} />
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-gold-400/30 to-transparent header-glow-line" />
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-gold-400/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-success-400/[0.02] rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-3xl animate-float relative z-10">💎</span>
              <div className="absolute inset-0 bg-gold-400/20 rounded-full blur-xl animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-wide">
                <span className="text-text-primary">HERMES</span>
                <span className="gold-shimmer ml-1.5">AI INDEX</span>
              </h2>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                Teknik + Temel analiz birlesimi — canli piyasa endeksi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-40 live-dot" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success-400" />
              </span>
              <span className="text-[9px] font-bold text-success-400/60 tracking-wider">LIVE</span>
            </div>
            <span className="text-[10px] px-3 py-1 rounded-full bg-gold-400/8 text-gold-400/50 font-bold border border-stroke-gold animate-border-shimmer tabular-nums">
              {indexStats.n} HISSE
            </span>
            {isLoading && <div className="w-3 h-3 border border-stroke-gold-strong border-t-gold-400 rounded-full animate-spin" />}
          </div>
        </div>
      </div>

      {/* ═══ TICKER TAPE ═══ */}
      <div className="mb-4 stagger-2 rounded-xl overflow-hidden">
        <TickerTape items={indexStats.tickerItems} />
      </div>

      {/* ═══ TOP ROW: Gauge + Direction + Stats ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-2 sm:mb-4">
        {/* Premium Gauge */}
        <div className="stagger-2 bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 lg:p-6 flex items-center justify-center hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <PremiumGauge value={indexStats.marketPulse} label={marketData.fearGreedLabel || 'MARKET PULSE'} />
        </div>

        {/* Direction + Gauges */}
        <div className="stagger-3 bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 lg:p-5 flex flex-col justify-between hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <DirectionBadge direction={indexStats.direction} dirColor={indexStats.dirColor} />
          <div className="text-[10px] text-text-quaternary text-center mt-2 mb-3">
            Long: <span className="text-success-400 font-bold">{indexStats.longPct.toFixed(1)}%</span>
            {' | '}Notr: <span className="text-text-tertiary font-bold">{((indexStats.neutrals / indexStats.n) * 100).toFixed(1)}%</span>
            {' | '}Short: <span className="text-danger-400 font-bold">{indexStats.shortPct.toFixed(1)}%</span>
          </div>
          <div className="space-y-2.5">
            <GaugeBar value={indexStats.avgScore} label="Ort. Teknik Skor" color={indexStats.avgScore <= 40 ? 'text-success-400' : indexStats.avgScore <= 60 ? 'text-text-secondary' : 'text-danger-400'} subLabel="0=Alis baskisi, 100=Satis baskisi" />
            <GaugeBar value={indexStats.avgAiScore} label="Ort. HERMES AI Skor" color={indexStats.avgAiScore >= 60 ? 'text-success-400' : indexStats.avgAiScore >= 40 ? 'text-text-secondary' : 'text-danger-400'} subLabel="0=Kotu, 100=Mukemmel" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 stagger-4">
          <StatCard title="Ort. Degisim" value={`${indexStats.avgChange >= 0 ? '+' : ''}${indexStats.avgChange.toFixed(2)}%`} icon="📈" color={indexStats.avgChange >= 0 ? 'text-success-400' : 'text-danger-400'} />
          <StatCard title="Ort. Risk" value={indexStats.avgRisk.toFixed(0)} icon="🛡️" color={indexStats.avgRisk <= 40 ? 'text-success-400' : indexStats.avgRisk <= 60 ? 'text-gold-300' : 'text-danger-400'} sub={indexStats.avgRisk <= 40 ? 'Dusuk Risk' : indexStats.avgRisk <= 60 ? 'Orta Risk' : 'Yuksek Risk'} />
          <StatCard title="Ort. RSI" value={indexStats.avgRsi.toFixed(1)} icon="📊" color={indexStats.avgRsi < 40 ? 'text-success-400' : indexStats.avgRsi > 60 ? 'text-danger-400' : 'text-text-secondary'} sub={indexStats.avgRsi < 30 ? 'Asiri Satim' : indexStats.avgRsi > 70 ? 'Asiri Alim' : 'Normal'} />
          <StatCard title="Ort. MFI" value={indexStats.avgMfi.toFixed(1)} icon="💰" color={indexStats.avgMfi < 40 ? 'text-success-400' : indexStats.avgMfi > 60 ? 'text-danger-400' : 'text-text-secondary'} sub={indexStats.avgMfi < 20 ? 'Para Girisi' : indexStats.avgMfi > 80 ? 'Para Cikisi' : 'Dengeli'} />
        </div>
      </div>

      {/* ═══ SIGNAL DISTRIBUTION ═══ */}
      <div className="stagger-5 bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 lg:p-5 mb-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">Sinyal Dagilimi</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-success-400 font-bold">{indexStats.longs} Long</span>
            <span className="text-text-tertiary">|</span>
            <span className="text-danger-400 font-bold">{indexStats.shorts} Short</span>
          </div>
        </div>
        <SignalDistBar counts={indexStats.signalCounts} total={indexStats.n} />
      </div>

      {/* ═══ PREMIUM: WALL STREET PULSE + PIYASA ONGORU + AI SKOR DAGILIMI ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-4">
        {/* Wall Street Pulse Mini */}
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">💓</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">Wall Street Nabzi</span>
            {pulseData && <span className={`ml-auto text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${pulseData.marketOpen ? 'bg-success-400/10 text-success-400 border-success-400/30' : 'bg-white/5 text-text-quaternary border-stroke-subtle'}`}>{pulseData.marketOpen ? 'CANLI' : 'KAPALI'}</span>}
          </div>
          {pulseData ? (
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-2">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="5" className="text-white/[0.04]" />
                  <circle cx="40" cy="40" r="32" fill="none"
                    stroke={pulseData.composite >= 60 ? '#3FCAB4' : pulseData.composite <= 40 ? '#F04848' : '#94a3b8'}
                    strokeWidth="5" strokeDasharray={`${(pulseData.composite / 100) * 201} 201`} strokeLinecap="round"
                    className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-black tabular-nums ${pulseData.composite >= 60 ? 'text-success-400' : pulseData.composite <= 40 ? 'text-danger-400' : 'text-text-secondary'}`}>
                    <AnimatedNumber value={pulseData.composite} decimals={0} />
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold ${pulseData.composite >= 60 ? 'text-success-400' : pulseData.composite <= 40 ? 'text-danger-400' : 'text-text-tertiary'}`}>{pulseData.levelLabel}</span>
              <div className="mt-2 w-full space-y-0.5">
                {(pulseData.components || []).filter(c => c.available).slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <span className="text-[8px] text-text-quaternary w-20 truncate">{c.name}</span>
                    <div className="flex-1 h-1 rounded-full bg-surface-3 overflow-hidden">
                      <div className={`h-full rounded-full ${c.value >= 60 ? 'bg-success-400' : c.value >= 40 ? 'bg-slate-500' : 'bg-danger-400'}`} style={{ width: `${c.value}%` }} />
                    </div>
                    <span className="text-[8px] text-text-tertiary font-mono w-5">{c.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-text-quaternary text-xs">Pulse verisi bekleniyor...</div>
          )}
        </div>

        {/* Piyasa Acilis Ongoru */}
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🔮</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">Piyasa Ongoru</span>
          </div>
          {(() => {
            const signals: { label: string; positive: boolean }[] = []
            if (indexStats) {
              signals.push({ label: `Sinyal Dagilimi: ${indexStats.longPct.toFixed(0)}% Long`, positive: indexStats.longPct > 40 })
              signals.push({ label: `Sektor Genisligi: ${indexStats.sectorStats.filter(s => s.avgChange > 0).length}/${indexStats.sectorStats.length} pozitif`, positive: indexStats.sectorStats.filter(s => s.avgChange > 0).length > indexStats.sectorStats.length / 2 })
              signals.push({ label: `AI Konsensus: ${aiConsensus.toFixed(0)}% uyum`, positive: aiConsensus > 40 })
            }
            if (fmpStocks.length > 0) {
              const strongGood = fmpStocks.filter(s => s.signal === 'STRONG' || s.signal === 'GOOD').length
              signals.push({ label: `Temel Analiz: ${Math.round((strongGood / fmpStocks.length) * 100)}% saglikli`, positive: strongGood > fmpStocks.length * 0.3 })
            }
            if (pulseData) {
              signals.push({ label: `Wall Street: ${pulseData.composite} (${pulseData.levelLabel})`, positive: pulseData.composite >= 50 })
            }
            const posCount = signals.filter(s => s.positive).length
            const totalSig = signals.length || 1
            const pct = Math.round((posCount / totalSig) * 100)
            const bias = pct >= 65 ? 'POZITIF BEKLENTI' : pct <= 35 ? 'NEGATIF BEKLENTI' : 'NOTR BEKLENTI'
            const biasColor = pct >= 65 ? 'text-success-400' : pct <= 35 ? 'text-danger-400' : 'text-text-tertiary'
            return (
              <div>
                <div className="flex flex-col items-center mb-3">
                  <div className={`text-4xl font-black tabular-nums ${biasColor}`}>{pct}%</div>
                  <span className={`text-xs font-bold ${biasColor}`}>{bias}</span>
                  <span className="text-[9px] text-text-quaternary mt-0.5">{posCount}/{signals.length} sinyal pozitif</span>
                </div>
                <div className="space-y-1.5">
                  {signals.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className={s.positive ? 'text-success-400' : 'text-danger-400'}>{s.positive ? '▲' : '▼'}</span>
                      <span className="text-text-tertiary">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* HERMES AI Skor Dagilimi */}
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📊</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">AI Skor Dagilimi</span>
          </div>
          {fmpStocks.length > 0 ? (() => {
            const counts = { STRONG: 0, GOOD: 0, NEUTRAL: 0, WEAK: 0, BAD: 0 }
            for (const s of fmpStocks) {
              if (s.signal === 'STRONG') counts.STRONG++
              else if (s.signal === 'GOOD') counts.GOOD++
              else if (s.signal === 'NEUTRAL') counts.NEUTRAL++
              else if (s.signal === 'WEAK') counts.WEAK++
              else if (s.signal === 'BAD') counts.BAD++
            }
            const total = fmpStocks.length || 1
            const bars = [
              { key: 'STRONG', color: '#D4B86A', count: counts.STRONG },
              { key: 'GOOD', color: '#3FCAB4', count: counts.GOOD },
              { key: 'NOTR', color: '#64748b', count: counts.NEUTRAL },
              { key: 'WEAK', color: '#fb923c', count: counts.WEAK },
              { key: 'BAD', color: '#F04848', count: counts.BAD },
            ]
            return (
              <div>
                <div className="flex h-6 rounded-lg overflow-hidden gap-px mb-3">
                  {bars.filter(b => b.count > 0).map(b => (
                    <div key={b.key} className="flex items-center justify-center transition-all duration-700" style={{ flex: b.count, backgroundColor: b.color }}>
                      {(b.count / total * 100) > 5 && <span className="text-[9px] font-bold text-text-primary">{b.count}</span>}
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {bars.map(b => (
                    <div key={b.key} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="text-[10px] text-text-tertiary w-12">{b.key}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(b.count / total) * 100}%`, backgroundColor: b.color }} />
                      </div>
                      <span className="text-[10px] font-mono text-text-tertiary w-12 text-right">{b.count} ({((b.count / total) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-stroke-subtle text-[9px] text-text-quaternary text-center">
                  Tum hisseler — Saglikli: {((counts.STRONG + counts.GOOD) / total * 100).toFixed(0)}% | Risk: {((counts.WEAK + counts.BAD) / total * 100).toFixed(0)}%
                </div>
              </div>
            )
          })() : <div className="text-xs text-text-quaternary py-8 text-center">Veri bekleniyor...</div>}
        </div>
      </div>

      {/* ═══ MARKET BREADTH + AI CONSENSUS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-4">
        {/* Market Breadth */}
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📊</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">Piyasa Genisligi</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-center">
              <div className="text-lg font-black text-success-400 tabular-nums"><AnimatedNumber value={breadthUp} decimals={0} /></div>
              <span className="text-[9px] text-success-400/50">Yukselen</span>
            </div>
            <div className="flex-1 mx-4">
              <div className="h-4 rounded-full bg-surface-3 overflow-hidden flex relative">
                <div className="h-full bg-success-400/40 transition-all duration-1000 relative" style={{ width: `${breadthPct}%` }}>
                  <div className="absolute inset-0 opacity-40" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', backgroundSize: '200% 100%', animation: 'bar-sweep 2.5s linear infinite' }} />
                </div>
                <div className="h-full bg-danger-400/40 flex-1 transition-all duration-1000" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-text-secondary tabular-nums">{breadthPct.toFixed(0)}% / {(100 - breadthPct).toFixed(0)}%</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-danger-400 tabular-nums"><AnimatedNumber value={breadthDown} decimals={0} /></div>
              <span className="text-[9px] text-danger-400/50">Dusen</span>
            </div>
          </div>
          <div className="text-[9px] text-text-quaternary text-center">
            {breadthPct >= 60 ? 'Genisleme bolgesi — cok hisse yukseliyor' : breadthPct <= 40 ? 'Daralma bolgesi — cok hisse dusuyor' : 'Dengeli piyasa'}
          </div>
        </div>

        {/* AI Consensus */}
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🧠</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">AI Konsensus</span>
            <span className="text-[8px] text-text-quaternary ml-auto">Teknik + Temel uyum orani</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="5" className="text-white/[0.04]" />
                <circle cx="40" cy="40" r="32" fill="none"
                  stroke={aiConsensus >= 50 ? '#3FCAB4' : aiConsensus >= 30 ? '#D4B86A' : '#F04848'}
                  strokeWidth="5" strokeDasharray={`${(aiConsensus / 100) * 201} 201`} strokeLinecap="round"
                  className="transition-all duration-1000"
                  style={{ filter: `drop-shadow(0 0 4px ${aiConsensus >= 50 ? 'rgba(98,203,193,0.4)' : aiConsensus >= 30 ? 'rgba(179,148,91,0.4)' : 'rgba(239,68,68,0.4)'})` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-black tabular-nums ${aiConsensus >= 50 ? 'text-success-400' : aiConsensus >= 30 ? 'text-gold-300' : 'text-danger-400'}`}>
                  <AnimatedNumber value={aiConsensus} decimals={0} suffix="%" />
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <GaugeBar value={indexStats.longPct} label="Teknik LONG" color="text-success-400" />
              <GaugeBar value={indexStats.aiStrongCount > 0 ? (indexStats.aiStrongCount / fmpStocks.length) * 100 : 0} label="AI STRONG" color="text-gold-300" />
              <div className="text-[9px] text-text-quaternary">
                {aiConsensus >= 50 ? 'Teknik ve temel analiz buyuk olcude uyumlu' : aiConsensus >= 30 ? 'Kismi uyum — karmasik piyasa' : 'Dusuk uyum — dikkatli olun'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ AI TERMINAL OVERVIEW ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 mb-2 sm:mb-4 stagger-6">
        <StatCard title="AI STRONG" value={indexStats.aiStrongCount} icon="⭐" color="text-gold-300" sub="Temel analiz guclu" />
        <StatCard title="AI BAD" value={indexStats.aiBadCount} icon="⚠️" color="text-danger-400" sub="Temel analiz kotu" />
        <StatCard title="Toplam Mcap" value={formatMcap(indexStats.totalMcap)} icon="🏦" color="text-text-secondary" sub="Tum hisseler" />
        <div className="group relative bg-[#141414] rounded-xl border border-stroke-gold p-3.5 hover:border-stroke-gold transition-all duration-300 overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🎭</span>
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">Fear & Greed</span>
            </div>
            <FearGreedBar value={marketData.fearGreedIndex ?? 50} label={marketData.fearGreedLabel || 'NEUTRAL'} />
          </div>
        </div>
      </div>

      {/* ═══ ENDEKS SKOR KARTLARI — 10 ENDEKS ═══ */}
      {indexScoreCards.length > 0 && (() => {
        const official = indexScoreCards.filter(i => i.tier === 'official')
        const cap = indexScoreCards.filter(i => i.tier === 'cap')
        const sector = indexScoreCards.filter(i => i.tier === 'sector')
        return (
          <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 mb-2 sm:mb-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow stagger-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">📊</span>
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">HERMES AI Endeks Paneli</span>
              <span className="text-[9px] text-text-quaternary">10 endeks puanlamasi</span>
            </div>

            {/* Resmi Endeksler */}
            {official.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-violet-500/25 to-transparent" />
                  <span className="text-[9px] text-info-400 font-bold uppercase tracking-wider">Resmi Endeksler</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-violet-500/25 to-transparent" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  {official.map(idx => <HermesIndexCard key={idx.name} idx={idx} />)}
                </div>
              </>
            )}

            {/* Market Cap */}
            {cap.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-500/25 to-transparent" />
                  <span className="text-[9px] text-info-400 font-bold uppercase tracking-wider">Market Cap Segmentleri</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-blue-500/25 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {cap.map(idx => <HermesIndexCard key={idx.name} idx={idx} compact />)}
                </div>
              </>
            )}

            {/* Sektor */}
            {sector.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-amber-500/25 to-transparent" />
                  <span className="text-[9px] text-gold-400 font-bold uppercase tracking-wider">Sektor Endeksleri</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-amber-500/25 to-transparent" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {sector.map(idx => <HermesIndexCard key={idx.name} idx={idx} compact />)}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ═══ SECTOR HEATMAP ═══ */}
      <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-3 sm:p-4 lg:p-5 mb-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🗺️</span>
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">Sektor Haritasi</span>
          <span className="text-[9px] text-text-tertiary">(Teknik Skor Ortalamasi — dusuk = alis baskisi)</span>
        </div>
        <SectorHeatmap sectorStats={indexStats.sectorStats} />
      </div>

      {/* ═══ TOP MOVERS + STRONGEST SIGNALS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-2 sm:mb-4">
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-4 hover:border-success-400/20 transition-all duration-500 gold-border-glow">
          <TopMovers title="En Cok Yukselenler" items={indexStats.topGainers} color="text-success-400" icon="🟢" />
        </div>
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-4 hover:border-danger-400/30 transition-all duration-500 gold-border-glow">
          <TopMovers title="En Cok Dusenler" items={indexStats.topLosers} color="text-danger-400" icon="🔴" />
        </div>
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-4 hover:border-stroke-gold transition-all duration-500 gold-border-glow">
          <TopMovers title="En Guclu LONG" items={indexStats.topStrongLongs} color="text-gold-300" icon="🏆" />
        </div>
        <div className="bg-surface-1 rounded-2xl border border-stroke-gold p-4 hover:border-orange-500/20 transition-all duration-500 gold-border-glow">
          <TopMovers title="En Guclu SHORT" items={indexStats.topStrongShorts} color="text-warning-400" icon="⚡" />
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="relative rounded-xl border border-gold-400/6 bg-surface-0/50 p-3 mt-2">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold-400/15 to-transparent" />
        <div className="flex items-center justify-between text-[10px] text-text-tertiary">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400/50" />
              Trade AI: <span className="text-text-tertiary font-semibold">{results.length}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400/50" />
              Terminal AI: <span className="text-text-tertiary font-semibold">{fmpStocks.length}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-info-400/50" />
              Sektorler: <span className="text-text-tertiary font-semibold">{indexStats.sectorStats.length}</span>
            </span>
          </div>
          <span className="tabular-nums text-text-quaternary">Son guncelleme: {new Date().toLocaleTimeString('tr-TR')}</span>
        </div>
      </div>
    </div>
  )
}
