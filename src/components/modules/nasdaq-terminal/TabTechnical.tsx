'use client'

import { useState, useEffect } from 'react'
import { Activity, TrendingUp, TrendingDown, Minus, Zap, BarChart3, AlertTriangle, Info } from 'lucide-react'
import type { TechnicalSummary, TechnicalDataPoint } from '@/lib/fmp-terminal/fmp-types'

interface TabTechnicalProps {
  symbol: string
  onSelectSymbol?: (s: string) => void
}

interface TechData {
  symbol: string
  summary: TechnicalSummary
  history: {
    rsi: TechnicalDataPoint[]
    sma50: TechnicalDataPoint[]
    sma200: TechnicalDataPoint[]
    ema20: TechnicalDataPoint[]
    adx: TechnicalDataPoint[]
  }
}

const fmt = (v: number | null, d: number = 2) => v !== null ? v.toFixed(d) : '--'

function GaugeBar({ value, min, max, zones, label, tip }: {
  value: number | null, min: number, max: number,
  zones: { from: number, to: number, color: string }[],
  label: string, tip: string
}) {
  const pct = value !== null ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 50
  return (
    <div className="group relative">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-text-secondary flex items-center gap-1">
          {label}
          <span className="hidden group-hover:inline text-[10px] text-text-tertiary font-normal ml-1">{tip}</span>
        </span>
        <span className="text-sm font-bold text-white tabular-nums">{value !== null ? value.toFixed(1) : '--'}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-3">
        {zones.map((z, i) => {
          const left = ((z.from - min) / (max - min)) * 100
          const width = ((z.to - z.from) / (max - min)) * 100
          return <div key={i} className={`absolute top-0 h-full ${z.color}`} style={{ left: `${left}%`, width: `${width}%` }} />
        })}
        {value !== null && (
          <div className="absolute top-0 h-full w-1 bg-white shadow-lg shadow-white/50 rounded-full transition-all duration-700"
            style={{ left: `${pct}%` }} />
        )}
      </div>
    </div>
  )
}

function SignalBadge({ type, label }: { type: string, label: string }) {
  const styles: Record<string, string> = {
    'STRONG_UP': 'text-success-400 bg-success-400/15 border-success-400/30',
    'UP': 'text-success-400 bg-success-400/10 border-success-400/20',
    'NEUTRAL': 'text-text-secondary bg-surface-3 border-stroke',
    'DOWN': 'text-warning-400 bg-orange-500/10 border-orange-500/20',
    'STRONG_DOWN': 'text-danger-400 bg-danger-400/15 border-danger-400/30',
    'OVERSOLD': 'text-success-400 bg-success-400/12 border-success-400/25',
    'OVERBOUGHT': 'text-danger-400 bg-danger-400/12 border-danger-400/30',
  }
  const icons: Record<string, React.ReactNode> = {
    'STRONG_UP': <TrendingUp size={14} />,
    'UP': <TrendingUp size={14} />,
    'NEUTRAL': <Minus size={14} />,
    'DOWN': <TrendingDown size={14} />,
    'STRONG_DOWN': <TrendingDown size={14} />,
    'OVERSOLD': <Zap size={14} />,
    'OVERBOUGHT': <AlertTriangle size={14} />,
  }
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-lg border ${styles[type] || styles.NEUTRAL}`}>
      {icons[type] || <Minus size={14} />}
      {label}
    </span>
  )
}

export default function TabTechnical({ symbol }: TabTechnicalProps) {
  const [data, setData] = useState<TechData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    fetch(`/api/fmp-terminal/technical/${symbol}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [symbol])

  if (!symbol) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <Activity size={48} className="text-text-quaternary mx-auto mb-3" />
          <p className="text-text-tertiary text-base">Teknik analiz icin bir hisse secin</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 data-stream pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14" viewBox="0 0 100 100" style={{ animation: 'ring-spin 2s linear infinite' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(179,148,91,0.06)" strokeWidth="2" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#techGold)" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="264" style={{ animation: 'ring-pulse 1.6s ease-in-out infinite' }} />
              <defs><linearGradient id="techGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#DCC273" /><stop offset="100%" stopColor="#8E7536" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-gold-400/80 text-lg">📊</div>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-text-secondary">Teknik gostergeler</p>
            <p className="text-[9px] text-text-tertiary mt-0.5">RSI, SMA, ADX, Williams%R</p>
          </div>
          <div className="w-32 h-0.5 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #8E7536, #DCC273)' }} />
          </div>
          <div className="flex gap-2">
            {['RSI', 'SMA', 'ADX', 'EMA'].map((t, i) => (
              <div key={i} className="px-2 py-1 rounded-md bg-surface-2 border border-stroke-subtle opacity-0"
                style={{ animation: `card-reveal 0.3s ease-out ${0.4 + i * 0.15}s forwards` }}>
                <span className="text-[8px] text-text-quaternary font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data?.summary) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={32} className="text-danger-400/50 mx-auto mb-2" />
        <p className="text-danger-400/70 text-sm">{error || 'Veri alinamadi'}</p>
      </div>
    )
  }

  const s = data.summary
  const TREND_LABELS: Record<string, string> = {
    'STRONG_UP': 'GUCLU YUKSELIS',
    'UP': 'YUKSELIS',
    'NEUTRAL': 'YATAY',
    'DOWN': 'DUSUS',
    'STRONG_DOWN': 'GUCLU DUSUS',
  }
  const RSI_LABELS: Record<string, string> = {
    'OVERSOLD': 'ASIRI SATIM (AL FIRSATI)',
    'NEUTRAL': 'NOTR BOLGE',
    'OVERBOUGHT': 'ASIRI ALIM (SAT FIRSATI)',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-5 shadow-glass">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{data.symbol} <span className="text-text-tertiary text-sm font-normal">Teknik Analiz</span></h3>
              <p className="text-xs text-text-tertiary">Hermes AI Technical Indicators - Canli veri</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignalBadge type={s.trendStrength} label={TREND_LABELS[s.trendStrength] || 'NOTR'} />
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">RSI (14)</div>
            <div className="text-lg font-bold text-white tabular-nums">{fmt(s.rsi14, 1)}</div>
            <SignalBadge type={s.rsiSignal} label={RSI_LABELS[s.rsiSignal] || 'NOTR'} />
          </div>
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">SMA CROSSOVER</div>
            <div className="text-lg font-bold text-white">{s.goldenCross ? 'GOLDEN CROSS' : 'DEATH CROSS'}</div>
            <div className="text-xs text-text-tertiary mt-1">
              SMA50: {fmt(s.sma50)} | SMA200: {fmt(s.sma200)}
            </div>
          </div>
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">TREND GUCU (ADX)</div>
            <div className="text-lg font-bold text-white tabular-nums">{fmt(s.adx14, 1)}</div>
            <span className={`text-xs ${(s.adx14 ?? 0) > 25 ? 'text-info-400' : 'text-text-tertiary'}`}>
              {(s.adx14 ?? 0) > 25 ? 'Guclu Trend' : (s.adx14 ?? 0) > 20 ? 'Orta Trend' : 'Zayif/Yatay'}
            </span>
          </div>
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">EMA (20)</div>
            <div className="text-lg font-bold text-white tabular-nums">${fmt(s.ema20)}</div>
            <span className={`text-xs ${s.priceAboveEma20 ? 'text-success-400' : 'text-danger-400'}`}>
              Fiyat {s.priceAboveEma20 ? 'ustunde' : 'altinda'}
            </span>
          </div>
        </div>
      </div>

      {/* Gauge Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-5 shadow-glass space-y-5">
          <h4 className="text-sm font-bold text-text-secondary flex items-center gap-1.5">
            <BarChart3 size={14} /> OSILATÖRLER
          </h4>
          <GaugeBar
            value={s.rsi14} min={0} max={100} label="RSI (14)"
            tip="30 alti = asiri satim (al), 70 ustu = asiri alim (sat)"
            zones={[
              { from: 0, to: 30, color: 'bg-success-400/30' },
              { from: 30, to: 70, color: 'bg-surface-3' },
              { from: 70, to: 100, color: 'bg-danger-400/30' },
            ]}
          />
          <GaugeBar
            value={s.williams14} min={-100} max={0} label="Williams %R (14)"
            tip="-80 alti = asiri satim, -20 ustu = asiri alim"
            zones={[
              { from: -100, to: -80, color: 'bg-success-400/30' },
              { from: -80, to: -20, color: 'bg-surface-3' },
              { from: -20, to: 0, color: 'bg-danger-400/30' },
            ]}
          />
          <GaugeBar
            value={s.adx14} min={0} max={60} label="ADX (14) - Trend Gucu"
            tip="0-20 zayif, 20-25 orta, 25+ guclu trend"
            zones={[
              { from: 0, to: 20, color: 'bg-slate-500/20' },
              { from: 20, to: 25, color: 'bg-gold-500/20' },
              { from: 25, to: 60, color: 'bg-info-400/30' },
            ]}
          />
        </div>

        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-5 shadow-glass space-y-5">
          <h4 className="text-sm font-bold text-text-secondary flex items-center gap-1.5">
            <TrendingUp size={14} /> HAREKETLI ORTALAMALAR
          </h4>
          <div className="space-y-3">
            {[
              { label: 'EMA 20', value: s.ema20, desc: 'Kisa vadeli trend' },
              { label: 'SMA 50', value: s.sma50, desc: 'Orta vadeli trend' },
              { label: 'SMA 200', value: s.sma200, desc: 'Uzun vadeli trend' },
              { label: 'DEMA 20', value: s.dema20, desc: 'Cift ustel ortalama' },
              { label: 'TEMA 20', value: s.tema20, desc: 'Uclu ustel ortalama' },
            ].map(ma => (
              <div key={ma.label} className="flex items-center justify-between py-1.5 border-b border-stroke-subtle">
                <div>
                  <span className="text-sm font-semibold text-text-secondary">{ma.label}</span>
                  <span className="text-[11px] text-text-quaternary ml-2">{ma.desc}</span>
                </div>
                <span className="text-sm font-bold text-white tabular-nums">${fmt(ma.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-xl bg-surface-2 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary mb-1">VOLATILITE (Std Dev 20)</div>
            <div className="text-base font-bold text-white tabular-nums">{fmt(s.stdDev20, 4)}</div>
          </div>
        </div>
      </div>

      {/* RSI History Mini Chart */}
      {data.history.rsi.length > 0 && (
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-5 shadow-glass">
          <h4 className="text-sm font-bold text-text-secondary mb-3 flex items-center gap-1.5">
            <Activity size={14} /> SON 30 GUN RSI TRENDI
          </h4>
          <div className="flex items-end gap-[2px] h-20">
            {data.history.rsi.slice(0, 30).reverse().map((point, i) => {
              const rsiVal = Number(point.rsi ?? 50)
              const h = (rsiVal / 100) * 100
              let color = 'bg-white/20'
              if (rsiVal < 30) color = 'bg-success-400/60'
              else if (rsiVal > 70) color = 'bg-danger-400/60'
              else color = 'bg-info-400/40'
              return (
                <div key={i} className="flex-1 flex flex-col justify-end" title={`${point.date}: RSI ${rsiVal.toFixed(1)}`}>
                  <div className={`${color} rounded-t-sm transition-all duration-300`} style={{ height: `${h}%` }} />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-text-tertiary">{data.history.rsi[Math.min(29, data.history.rsi.length - 1)]?.date || ''}</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-success-400/50">--- 30 (asiri satim)</span>
              <span className="text-[10px] text-danger-400/50">--- 70 (asiri alim)</span>
            </div>
            <span className="text-[10px] text-text-tertiary">{data.history.rsi[0]?.date || ''}</span>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 px-4 py-3 bg-info-400/[0.05] rounded-xl border border-violet-500/10">
        <Info size={14} className="text-info-400/50 mt-0.5 shrink-0" />
        <p className="text-[12px] text-text-tertiary leading-relaxed">
          Teknik gostergeler gunluk verilerle hesaplanir. RSI asiri alim/satim, SMA crossover trend yonu,
          ADX trend gucu, Williams %R momentum gosterir. Golden Cross (SMA50 &gt; SMA200) = yukselis trendi.
        </p>
      </div>
    </div>
  )
}
