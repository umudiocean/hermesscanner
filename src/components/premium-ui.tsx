'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Premium UI Components (6 AI Konsensus)
// All sprint components in one file for zero-import-overhead
// ═══════════════════════════════════════════════════════════════════

// ─── usePrevious — tracks previous value for flash detection ─────
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value })
  return ref.current
}

// ─── PriceFlashCell — flashes green/red on price change ──────────
export const PriceFlashCell = memo(function PriceFlashCell({
  price, className = ''
}: { price: number; className?: string }) {
  const prev = usePrevious(price)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (prev === undefined || prev === price) return
    setFlash(price > prev ? 'up' : 'down')
    const t = setTimeout(() => setFlash(null), 500)
    return () => clearTimeout(t)
  }, [price, prev])

  return (
    <span className={`tabular-nums transition-colors ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''} ${className}`}>
      ${price.toFixed(2)}
    </span>
  )
})

// ─── PremiumGauge — 3-layer SVG arc gauge w/ animated counter ────
export function PremiumGauge({ value, size = 140, label, sublabel }: {
  value: number; size?: number; label?: string; sublabel?: string
}) {
  const [animVal, setAnimVal] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true }
    const start = animVal
    const end = Math.min(100, Math.max(0, value))
    const dur = 1200
    const t0 = performance.now()
    let raf = 0
    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setAnimVal(start + (end - start) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const r = 56
  const circ = 2 * Math.PI * r
  const arc = (animVal / 100) * circ * 0.75
  const getColor = (v: number) => {
    if (v <= 20) return { stroke: '#EF4444', glow: 'rgba(239,68,68,0.5)', text: 'EXTREME FEAR' }
    if (v <= 35) return { stroke: '#fb923c', glow: 'rgba(251,146,60,0.4)', text: 'FEAR' }
    if (v <= 50) return { stroke: '#94a3b8', glow: 'rgba(148,163,184,0.25)', text: 'NEUTRAL' }
    if (v <= 65) return { stroke: '#62CBC1', glow: 'rgba(98,203,193,0.4)', text: 'GREED' }
    return { stroke: '#B3945B', glow: 'rgba(179,148,91,0.5)', text: 'EXTREME GREED' }
  }
  const c = getColor(animVal)

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <div className="absolute inset-[-16px] rounded-full" style={{
        background: `radial-gradient(circle, ${c.glow}, transparent 65%)`,
        animation: 'radial-pulse 3s ease-in-out infinite',
      }} />
      <svg className="w-full h-full" viewBox="0 0 128 128" style={{ filter: `drop-shadow(0 0 12px ${c.glow})` }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.stroke} stopOpacity="1" />
            <stop offset="100%" stopColor={c.stroke} stopOpacity="0.4" />
          </linearGradient>
          <filter id="gaugeGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Track */}
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} transform="rotate(-225 64 64)" />
        {/* Glow layer (behind) */}
        <circle cx="64" cy="64" r={r} fill="none" stroke={c.stroke} strokeWidth="9" strokeOpacity="0.15"
          strokeLinecap="round" strokeDasharray={`${arc} ${circ - arc}`} transform="rotate(-225 64 64)"
          filter="url(#gaugeGlow)" />
        {/* Value arc */}
        <circle cx="64" cy="64" r={r} fill="none" stroke="url(#gaugeGrad)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${arc} ${circ - arc}`} transform="rotate(-225 64 64)" />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map(v => {
          const a = ((v / 100) * 270 - 135) * Math.PI / 180
          return <line key={v} x1={64 + 49 * Math.cos(a)} y1={64 + 49 * Math.sin(a)}
            x2={64 + 53 * Math.cos(a)} y2={64 + 53 * Math.sin(a)}
            stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tabular-nums" style={{ color: c.stroke }}>{Math.round(animVal)}</span>
        <span className="text-[9px] font-bold tracking-wider mt-0.5" style={{ color: c.stroke }}>
          {label || c.text}
        </span>
      </div>
      {sublabel && <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mt-1">{sublabel}</span>}
    </div>
  )
}

// ─── FearGreedBar — premium gradient with white indicator ────────
export function FearGreedBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  const barLabel = label || (
    clamped <= 20 ? 'ASIRI KORKU' : clamped <= 40 ? 'KORKU' : clamped <= 60 ? 'NOTR' : clamped <= 80 ? 'ACGOZLULUK' : 'ASIRI ACGOZLULUK'
  )
  const barColor = clamped <= 25 ? 'text-red-400' : clamped <= 45 ? 'text-orange-400' : clamped <= 55 ? 'text-slate-300' : clamped <= 75 ? 'text-hermes-green' : 'text-hermes-green'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xl font-black tabular-nums ${barColor}`}>{Math.round(value)}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            clamped <= 25 ? 'text-red-400 bg-red-500/15' : clamped <= 45 ? 'text-orange-400 bg-orange-500/15' :
            clamped <= 55 ? 'text-slate-300 bg-white/[0.06]' : clamped <= 75 ? 'text-hermes-green bg-hermes-green/15' :
            'text-hermes-green bg-hermes-green/20'
          }`}>{barLabel}</span>
        </div>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{
        background: 'linear-gradient(90deg, #dc2626 0%, #f97316 25%, #94a3b8 50%, #62cbc1 75%, #62cbc1 100%)',
      }}>
        <div className="absolute top-0 h-full w-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-700 ease-out"
          style={{ left: `calc(${clamped}% - 3px)` }} />
      </div>
      <div className="flex justify-between mt-1 px-0.5">
        {['Asiri Korku', 'Korku', 'Notr', 'Acgozluluk', 'Asiri Acgozluluk'].map((t, i) => (
          <span key={i} className="text-[8px] text-white/25">{t}</span>
        ))}
      </div>
    </div>
  )
}

// ─── AILoading — neural bouncing dots ────────────────────────────
export function AILoading({ text = 'Neural Core analiz ediyor', subText }: { text?: string; subText?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gold-400 ai-dot-1" />
          <div className="w-3 h-3 rounded-full bg-gold-400 ai-dot-2" />
          <div className="w-3 h-3 rounded-full bg-gold-400 ai-dot-3" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm text-white/50 font-medium gold-shimmer">{text}</p>
        {subText && <p className="text-xs text-white/25 mt-1">{subText}</p>}
        <p className="text-[10px] text-white/15 mt-2 tracking-widest">HERMES AI NEURAL CORE</p>
      </div>
    </div>
  )
}

// ─── AuroraBackground — ambient gradient blobs ───────────────────
export function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-blob-1" />
      <div className="aurora-blob-2" />
      <div className="aurora-blob-3" />
    </div>
  )
}

// ─── NeuralGrid — subtle SVG dot pattern ─────────────────────────
export function NeuralGrid() {
  return <div className="neural-grid" aria-hidden="true" />
}

// ─── EmptyState — premium empty with orbiting particles ──────────
export function EmptyState({ icon = '💎', title, description, actionLabel, onAction }: {
  icon?: string; title: string; description?: string; actionLabel?: string; onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
      <div className="relative mb-6">
        <div className="absolute inset-[-20px] rounded-full bg-gold-400/[0.03] blur-2xl" />
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-[#141414] border border-gold-400/10 flex items-center justify-center animate-empty-float">
            <span className="text-4xl">{icon}</span>
          </div>
          <div className="absolute inset-[-30px]" style={{ animation: 'orbit 8s linear infinite' }}>
            <div className="w-2 h-2 rounded-full bg-gold-400/30 absolute top-0 left-1/2 -translate-x-1/2" />
          </div>
          <div className="absolute inset-[-20px]" style={{ animation: 'orbit 12s linear infinite reverse' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-hermes-green/30 absolute top-0 left-1/2 -translate-x-1/2" />
          </div>
        </div>
      </div>
      <h3 className="text-lg font-bold text-white/60 mb-1">{title}</h3>
      {description && <p className="text-sm text-white/30 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 text-white font-medium text-sm
                     hover:from-gold-500 hover:to-gold-300 shadow-lg shadow-gold-400/20 transition-all duration-200 hover:scale-[1.03]">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ─── SignalBadge — premium badge with glow accent ────────────────
export const SignalBadge = memo(function SignalBadge({ type, label, compact = false }: {
  type: 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'; label: string; compact?: boolean
}) {
  const config: Record<string, { bg: string; text: string; glow: string; border: string; dot: string }> = {
    strong_long: { bg: 'bg-amber-500/15', text: 'text-amber-300', glow: 'badge-glow-gold', border: 'border-l-amber-400/60', dot: 'bg-amber-400' },
    long: { bg: 'bg-hermes-green/15', text: 'text-hermes-green', glow: 'badge-glow-green', border: 'border-l-hermes-green/50', dot: 'bg-hermes-green' },
    neutral: { bg: 'bg-white/[0.05]', text: 'text-slate-400', glow: '', border: 'border-l-white/15', dot: 'bg-slate-500' },
    short: { bg: 'bg-orange-500/15', text: 'text-orange-400', glow: '', border: 'border-l-orange-400/50', dot: 'bg-orange-400' },
    strong_short: { bg: 'bg-red-500/15', text: 'text-red-400', glow: 'badge-glow-red', border: 'border-l-red-400/60', dot: 'bg-red-400' },
  }
  const c = config[type] || config.neutral
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'} 
      font-bold rounded-r-lg border-l-[3px] ${c.bg} ${c.text} ${c.glow} ${c.border} transition-all duration-200 tracking-wide`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {label}
    </span>
  )
})

// ─── ScoreMiniBar — mini gradient bar for score columns ──────────
export const ScoreMiniBar = memo(function ScoreMiniBar({ value, maxWidth = 48 }: { value: number; maxWidth?: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const color = clamped >= 75 ? '#B3945B' : clamped >= 60 ? '#62cbc1' : clamped >= 40 ? '#94a3b8' : clamped >= 25 ? '#fb923c' : '#ef4444'
  const textColor = clamped >= 75 ? 'text-amber-400' : clamped >= 60 ? 'text-hermes-green' : clamped >= 40 ? 'text-white/50' : clamped >= 25 ? 'text-orange-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden" style={{ width: maxWidth }}>
        <div className="h-full rounded-full transition-all duration-700" style={{
          width: `${clamped}%`,
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
      <span className={`text-[12px] tabular-nums font-bold w-6 text-right ${textColor}`}>{Math.round(value)}</span>
    </div>
  )
})

// ─── LiveDot — pulsating connection indicator ────────────────────
export function LiveDot({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-hermes-green/80">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-hermes-green opacity-40 live-dot" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-hermes-green" />
      </span>
      {label}
    </span>
  )
}

// ─── TimeAgo — "Xs once" formatter ───────────────────────────────
export function TimeAgo({ timestamp }: { timestamp: Date | number | string }) {
  const [text, setText] = useState('')
  useEffect(() => {
    function update() {
      const ms = Date.now() - new Date(timestamp).getTime()
      const s = Math.floor(ms / 1000)
      if (s < 60) setText(`${s}s once`)
      else if (s < 3600) setText(`${Math.floor(s / 60)}dk once`)
      else setText(`${Math.floor(s / 3600)}sa once`)
    }
    update()
    const iv = setInterval(update, 10000)
    return () => clearInterval(iv)
  }, [timestamp])
  return <span className="text-[10px] text-white/30 tabular-nums">{text}</span>
}

// ─── TargetFloorBar — mini range bar for Target/Floor/R:R ────────
export const TargetFloorBar = memo(function TargetFloorBar({
  price, target, floor
}: { price: number; target: number; floor: number }) {
  if (!target || !floor || floor >= target) return null
  const range = target - floor
  const pos = ((price - floor) / range) * 100
  const clamped = Math.max(0, Math.min(100, pos))
  return (
    <div className="flex items-center gap-1 w-20">
      <span className="text-[9px] text-red-400/50 tabular-nums">{floor.toFixed(0)}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/40 via-white/10 to-hermes-green/40 rounded-full w-full" />
        <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5)]"
          style={{ left: `calc(${clamped}% - 2px)` }} />
      </div>
      <span className="text-[9px] text-hermes-green/50 tabular-nums">{target.toFixed(0)}</span>
    </div>
  )
})
