'use client'
// ═══════════════════════════════════════════════════════════════════
// WALL STREET NABZI — 12 Bilesenli Composite Index (6 AI Konsensus)
// Overview: Gauge + Breakdown + Breadth + Smart Money + Earnings + Squeeze
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Activity, TrendingUp, TrendingDown, Shield, AlertTriangle,
  ChevronDown, ChevronUp, BarChart3, Zap, Brain, DollarSign,
  Building2, Target, PieChart, ArrowUpRight, ArrowDownRight,
  Eye, Globe, RefreshCw
} from 'lucide-react'
import { PulseData, PulseLevel, getPulseLevelColor } from '@/lib/wall-street-pulse/pulse-types'

// ─── Radial Gauge SVG ─────────────────────────────────────────────

function RadialGauge({ value, size = 220 }: { value: number; size?: number }) {
  const radius = (size - 20) / 2
  const cx = size / 2
  const cy = size / 2
  const startAngle = -210
  const endAngle = 30
  const totalAngle = endAngle - startAngle
  const valueAngle = startAngle + (value / 100) * totalAngle
  const strokeWidth = 14

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  function describeArc(start: number, end: number) {
    const s = polarToCartesian(start)
    const e = polarToCartesian(end)
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const level: PulseLevel = value <= 20 ? 'EXTREME_FEAR' : value <= 40 ? 'FEAR' : value <= 60 ? 'NEUTRAL' : value <= 80 ? 'GREED' : 'EXTREME_GREED'
  const color = getPulseLevelColor(level)
  const labelMap: Record<PulseLevel, string> = {
    EXTREME_FEAR: 'ASIRI KORKU', FEAR: 'KORKU', NEUTRAL: 'NOTR', GREED: 'HIRS', EXTREME_GREED: 'ASIRI HIRS'
  }

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.75}`}>
        {/* BG arc */}
        <path d={describeArc(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* 5 color zones */}
        <path d={describeArc(-210, -162)} fill="none" stroke="#dc2626" strokeWidth={strokeWidth - 4} strokeLinecap="round" opacity={0.3} />
        <path d={describeArc(-162, -114)} fill="none" stroke="#f87171" strokeWidth={strokeWidth - 4} strokeLinecap="round" opacity={0.3} />
        <path d={describeArc(-114, -66)} fill="none" stroke="#94a3b8" strokeWidth={strokeWidth - 4} strokeLinecap="round" opacity={0.3} />
        <path d={describeArc(-66, -18)} fill="none" stroke="#62cbc1" strokeWidth={strokeWidth - 4} strokeLinecap="round" opacity={0.3} />
        <path d={describeArc(-18, 30)} fill="none" stroke="#B3945B" strokeWidth={strokeWidth - 4} strokeLinecap="round" opacity={0.3} />
        {/* Value arc */}
        {value > 0 && (
          <path d={describeArc(startAngle, valueAngle)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" className="transition-all duration-1000" />
        )}
        {/* Center text */}
        <text x={cx} y={cy - 15} textAnchor="middle" fill={color} fontSize={size * 0.18} fontWeight="bold" className="tabular-nums transition-all duration-700">{value}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={size * 0.055} fontWeight="600" letterSpacing="0.1em">{labelMap[level]}</text>
      </svg>
    </div>
  )
}

// ─── Component Bar ────────────────────────────────────────────────

function ComponentBar({ name, value, weight, icon, available }: { name: string; value: number; weight: number; icon: React.ReactNode; available: boolean }) {
  const color = !available ? 'bg-white/10' : value >= 70 ? 'bg-success-400' : value >= 50 ? 'bg-gold-400' : value >= 30 ? 'bg-warning-400' : 'bg-danger-400'
  const textColor = !available ? 'text-text-quaternary' : value >= 70 ? 'text-success-400' : value >= 50 ? 'text-gold-300' : value >= 30 ? 'text-warning-400' : 'text-danger-400'

  return (
    <div className={`flex items-center gap-2 py-1 ${!available ? 'opacity-40' : ''}`}>
      <span className="text-text-tertiary w-5 shrink-0">{icon}</span>
      <span className="text-[11px] text-text-secondary w-28 truncate">{name}</span>
      <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${available ? value : 0}%` }} />
      </div>
      <span className={`text-[11px] font-mono w-8 text-right ${textColor}`}>{available ? value.toFixed(0) : '--'}</span>
      <span className="text-[9px] text-text-quaternary w-8 text-right">{(weight * 100).toFixed(0)}%</span>
    </div>
  )
}

// ─── Breadth Panel ────────────────────────────────────────────────

function BreadthPanel({ data }: { data: PulseData }) {
  const b = data?.breadth
  if (!b || b.total === 0) return <div className="text-text-quaternary text-xs py-4">Breadth verisi yok</div>

  const advPct = ((b.advancing / b.total) * 100).toFixed(1)
  const decPct = ((b.declining / b.total) * 100).toFixed(1)
  const midPct = (((b.aboveMidpointPct ?? 0)) * 100).toFixed(1)
  const adRatio = b.advanceDeclineRatio ?? 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MiniMetric label="Yukselen" value={`${b.advancing ?? 0}`} sub={`${advPct}%`} color="text-success-400" />
      <MiniMetric label="Dusen" value={`${b.declining ?? 0}`} sub={`${decPct}%`} color="text-danger-400" />
      <MiniMetric label="52H Zirve" value={`${b.newHighs ?? 0}`} sub={`yakin`} color="text-gold-300" />
      <MiniMetric label="52H Dip" value={`${b.newLows ?? 0}`} sub={`yakin`} color="text-danger-400" />
      <MiniMetric label="A/D Orani" value={adRatio.toFixed(2)} sub="" color={adRatio > 1 ? 'text-success-400' : 'text-danger-400'} />
      <MiniMetric label="Orta Nokta Ustu" value={`${midPct}%`} sub={`${b.aboveMidpoint ?? 0} hisse`} color={(b.aboveMidpointPct ?? 0) > 0.5 ? 'text-success-400' : 'text-danger-400'} />
      <MiniMetric label="Toplam" value={`${b.total}`} sub="hisse" color="text-text-secondary" />
      <MiniMetric label="Degismez" value={`${b.unchanged ?? 0}`} sub="" color="text-text-tertiary" />

      {/* Stacked bar */}
      <div className="col-span-2 lg:col-span-4 mt-1">
        <div className="h-4 rounded-full overflow-hidden flex bg-surface-3">
          <div className="bg-success-400/80 transition-all duration-500" style={{ width: `${advPct}%` }} />
          <div className="bg-white/10 transition-all duration-500" style={{ width: `${b.total > 0 ? ((b.unchanged / b.total) * 100) : 0}%` }} />
          <div className="bg-danger-400/80 transition-all duration-500" style={{ width: `${decPct}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[9px]">
          <span className="text-success-400">Yukselen {advPct}%</span>
          <span className="text-danger-400">Dusen {decPct}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Smart Money Panel ────────────────────────────────────────────

function SmartMoneyPanel({ data }: { data: PulseData }) {
  const sm = data?.smartMoney
  if (!sm) return <div className="text-text-quaternary text-xs py-4">Smart Money verisi yok</div>
  const iRatio = sm.insiderRatio ?? 50
  const cRatio = sm.congressRatio ?? 50
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <MiniMetric label="Insider Alis" value={`${sm.insiderNetBuys ?? 0}`} sub="islem" color="text-success-400" />
      <MiniMetric label="Insider Satis" value={`${sm.insiderNetSells ?? 0}`} sub="islem" color="text-danger-400" />
      <MiniMetric label="Insider Oran" value={`${iRatio.toFixed(0)}%`} sub="alis" color={iRatio > 50 ? 'text-success-400' : 'text-danger-400'} />
      <MiniMetric label="Kongre Alis" value={`${sm.congressBuys ?? 0}`} sub="" color="text-success-400" />
      <MiniMetric label="Kongre Satis" value={`${sm.congressSells ?? 0}`} sub="" color="text-danger-400" />
      <MiniMetric label="Kongre Oran" value={`${cRatio.toFixed(0)}%`} sub="alis" color={cRatio > 50 ? 'text-success-400' : 'text-danger-400'} />
    </div>
  )
}

// ─── Earnings Panel ───────────────────────────────────────────────

function EarningsPanel({ data }: { data: PulseData }) {
  const e = data?.earnings
  if (!e) return <div className="text-text-quaternary text-xs py-4">Kazanc verisi yok</div>
  const beatRate = e.beatRate ?? 50
  const avgSurp = e.avgSurprise ?? 0
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MiniMetric label="Beat" value={`${e.beatCount ?? 0}`} sub={`${beatRate.toFixed(0)}%`} color="text-success-400" />
      <MiniMetric label="Miss" value={`${e.missCount ?? 0}`} sub="" color="text-danger-400" />
      <MiniMetric label="Ort. Surpriz" value={`${avgSurp > 0 ? '+' : ''}${avgSurp.toFixed(1)}%`} sub="" color={avgSurp > 0 ? 'text-success-400' : 'text-danger-400'} />
      <MiniMetric label="Trend" value={e.trend === 'improving' ? 'Iyilesiyor' : e.trend === 'declining' ? 'Kotulesyor' : 'Sabit'} sub="" color={e.trend === 'improving' ? 'text-success-400' : e.trend === 'declining' ? 'text-danger-400' : 'text-text-tertiary'} />
    </div>
  )
}

// ─── Short Squeeze Panel ──────────────────────────────────────────

function SqueezePanel({ data, onSelectSymbol }: { data: PulseData; onSelectSymbol?: (s: string) => void }) {
  const list = data.shortSqueeze || []
  if (list.length === 0) return <div className="text-text-quaternary text-xs py-4">Squeeze adayi yok</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-text-tertiary border-b border-stroke-subtle">
            <th className="text-left py-1.5 px-1">Sembol</th>
            <th className="text-right py-1.5 px-1">Short %</th>
            <th className="text-right py-1.5 px-1">Degisim</th>
            <th className="text-right py-1.5 px-1">Hacim Spike</th>
            <th className="text-right py-1.5 px-1">Skor</th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 15).map(s => (
            <tr key={s.symbol} className="border-b border-white/[0.03] hover:bg-surface-2 cursor-pointer" onClick={() => onSelectSymbol?.(s.symbol)}>
              <td className="py-1.5 px-1 font-mono text-gold-300">{s.symbol}</td>
              <td className="py-1.5 px-1 text-right text-warning-400">{(s.shortFloat ?? 0).toFixed(1)}%</td>
              <td className={`py-1.5 px-1 text-right ${(s.dayChange ?? 0) > 0 ? 'text-success-400' : 'text-danger-400'}`}>{(s.dayChange ?? 0) > 0 ? '+' : ''}{(s.dayChange ?? 0).toFixed(2)}%</td>
              <td className={`py-1.5 px-1 text-right ${(s.volumeSpike ?? 0) > 2 ? 'text-gold-300' : 'text-text-tertiary'}`}>{(s.volumeSpike ?? 0).toFixed(1)}x</td>
              <td className="py-1.5 px-1 text-right">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${s.squeezeScore >= 60 ? 'bg-danger-400/20 text-danger-300' : s.squeezeScore >= 40 ? 'bg-warning-400/15 text-orange-300' : 'bg-white/5 text-text-tertiary'}`}>
                  {s.squeezeScore}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Collapse Section ─────────────────────────────────────────────

function CollapseSection({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-stroke-subtle rounded-xl overflow-hidden transition-all duration-300">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors">
        <span className="text-gold-300">{icon}</span>
        <span className="text-sm font-semibold text-text-primary flex-1 text-left">{title}</span>
        {open ? <ChevronUp size={14} className="text-text-quaternary" /> : <ChevronDown size={14} className="text-text-quaternary" />}
      </button>
      {open && <div className="px-4 py-3 bg-surface-1/50">{children}</div>}
    </div>
  )
}

// ─── Mini Metric Card ─────────────────────────────────────────────

function MiniMetric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-surface-2 rounded-lg px-3 py-2">
      <div className="text-[9px] text-text-quaternary uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-base font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-text-quaternary">{sub}</div>}
    </div>
  )
}

function ComponentHealthPanel({ data }: { data: PulseData }) {
  const rows = (data.components || []).map((c) => {
    const fallback = c.id === 'vix' && c.rawValue == null
    const status = !c.available ? 'BEKLEME' : fallback ? 'PROXY' : 'AKTIF'
    const statusColor =
      status === 'AKTIF'
        ? 'text-success-400'
        : status === 'PROXY'
          ? 'text-gold-300'
          : 'text-text-tertiary'
    return { ...c, status, statusColor }
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-text-tertiary border-b border-stroke-subtle">
            <th className="text-left py-1.5 px-1">Bilesen</th>
            <th className="text-left py-1.5 px-1">Kaynak</th>
            <th className="text-right py-1.5 px-1">Skor</th>
            <th className="text-right py-1.5 px-1">Agirlik</th>
            <th className="text-right py-1.5 px-1">Durum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.03]">
              <td className="py-1.5 px-1 text-text-primary">{r.name}</td>
              <td className="py-1.5 px-1 text-text-tertiary">{r.source}</td>
              <td className="py-1.5 px-1 text-right text-text-secondary tabular-nums">{r.available ? r.value.toFixed(0) : '--'}</td>
              <td className="py-1.5 px-1 text-right text-text-tertiary tabular-nums">{Math.round(r.weight * 100)}%</td>
              <td className={`py-1.5 px-1 text-right font-medium ${r.statusColor}`}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Component Icon Map ───────────────────────────────────────────

function getComponentIcon(id: string) {
  const size = 12
  const map: Record<string, React.ReactNode> = {
    breadth: <BarChart3 size={size} />,
    highLow: <TrendingUp size={size} />,
    vix: <Activity size={size} />,
    treasurySpread: <DollarSign size={size} />,
    insider: <Eye size={size} />,
    congressional: <Building2 size={size} />,
    analyst: <Target size={size} />,
    earnings: <Zap size={size} />,
    sectorRotation: <PieChart size={size} />,
    shortInterest: <AlertTriangle size={size} />,
    putCall: <Shield size={size} />,
    institutional: <Globe size={size} />,
  }
  return map[id] || <Brain size={size} />
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TabPulse({ onSelectSymbol }: { onSelectSymbol?: (s: string) => void }) {
  const [pulse, setPulse] = useState<PulseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchPulse = useCallback(async () => {
    try {
      const res = await fetch('/api/wall-street-pulse')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PulseData = await res.json()
      setPulse(data)
      setError(null)
      setLastUpdate(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPulse()
    const interval = setInterval(fetchPulse, 60 * 1000) // 1dk poll
    return () => clearInterval(interval)
  }, [fetchPulse])

  // Sort components by weight descending
  const sorted = useMemo(() => {
    if (!pulse) return []
    return [...pulse.components].sort((a, b) => b.weight - a.weight)
  }, [pulse])

  const availableCount = useMemo(() => pulse?.components.filter(c => c.available).length || 0, [pulse])

  if (loading) return <PulseLoadingSkeleton />
  if (error) return <div className="text-center py-12 text-danger-400/60"><AlertTriangle className="mx-auto mb-2" size={24} /><p className="text-sm">Pulse yuklenemedi: {error}</p><button onClick={fetchPulse} className="mt-3 px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-medium hover:from-violet-500 hover:to-blue-500 transition-all">Tekrar Dene</button></div>
  if (!pulse) return null

  const safeComposite = typeof pulse.composite === 'number' && !isNaN(pulse.composite) ? pulse.composite : 50

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Hero: Gauge + Breakdown ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Gauge */}
        <div className="bg-surface-1 rounded-2xl border border-stroke-subtle p-4 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-gold-300" />
            <span className="text-xs font-semibold text-gold-300 tracking-wider">WALL STREET NABZI</span>
          </div>
          <RadialGauge value={safeComposite} size={220} />
          <div className="flex items-center gap-2 mt-2 text-[10px] text-text-quaternary">
            <span>{availableCount}/12 bilesen aktif</span>
            <span>•</span>
            <span>{lastUpdate}</span>
            {!pulse.marketOpen && <><span>•</span><span className="text-warning-400/60">Kapali — son kapanis verileri</span></>}
            <button onClick={fetchPulse} className="text-text-quaternary hover:text-text-tertiary transition-colors ml-1"><RefreshCw size={10} /></button>
          </div>
          {pulse.marketOpen && <span className="mt-1 text-[9px] px-2 py-0.5 rounded-full bg-success-400/10 text-success-400 border border-success-400/30">MARKET OPEN</span>}
          {!pulse.marketOpen && <span className="mt-1 text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-text-quaternary border border-stroke-subtle">MARKET CLOSED</span>}
        </div>

        {/* Component Breakdown */}
        <div className="bg-surface-1 rounded-2xl border border-stroke-subtle p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-info-400" />
            <span className="text-xs font-semibold text-text-secondary tracking-wider">BILESEN DAGILIMI</span>
          </div>
          <div className="space-y-0.5">
            {sorted.filter(c => c.available).map(c => (
              <ComponentBar key={c.id} name={c.name} value={c.value} weight={c.weight} icon={getComponentIcon(c.id)} available={c.available} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Stats Row ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <QuickStat label="A/D Orani" value={(pulse.breadth?.advanceDeclineRatio ?? 0).toFixed(2)} good={(pulse.breadth?.advanceDeclineRatio ?? 0) > 1} icon={<BarChart3 size={14} />} />
        <QuickStat label="52H Zirve/Dip" value={`${pulse.breadth?.newHighs ?? 0}/${pulse.breadth?.newLows ?? 0}`} good={(pulse.breadth?.newHighs ?? 0) > (pulse.breadth?.newLows ?? 0)} icon={<TrendingUp size={14} />} />
        <QuickStat label="Kazanc Beat" value={`${(pulse.earnings?.beatRate ?? 50).toFixed(0)}%`} good={(pulse.earnings?.beatRate ?? 50) > 60} icon={<Zap size={14} />} />
        <QuickStat label="Squeeze Aday" value={`${pulse.shortSqueeze?.length ?? 0}`} good={false} icon={<AlertTriangle size={14} />} />
      </div>

      {/* ── Collapse Panels ──────────────────────────────── */}
      <div className="space-y-2">
        <CollapseSection title="Piyasa Genisligi (Breadth)" icon={<BarChart3 size={14} />} defaultOpen={true}>
          <BreadthPanel data={pulse} />
        </CollapseSection>

        <CollapseSection title="Akilli Para (Smart Money)" icon={<Eye size={14} />}>
          <SmartMoneyPanel data={pulse} />
        </CollapseSection>

        <CollapseSection title="Kazanc Nabzi (Earnings Pulse)" icon={<Zap size={14} />}>
          <EarningsPanel data={pulse} />
        </CollapseSection>

        <CollapseSection title="Short Squeeze Radar" icon={<AlertTriangle size={14} />}>
          <SqueezePanel data={pulse} onSelectSymbol={onSelectSymbol} />
        </CollapseSection>

        <CollapseSection title="Bilesen Saglik Paneli" icon={<Activity size={14} />}>
          <ComponentHealthPanel data={pulse} />
        </CollapseSection>

        <CollapseSection title="Ongoru Zekasi (V4 Model)" icon={<Shield size={14} />} defaultOpen={true}>
          <ForecastIntelligence data={pulse} />
        </CollapseSection>
      </div>
    </div>
  )
}

// ─── Forecast Intelligence (V4 Model) ─────────────────────────────

function ForecastIntelligence({ data }: { data: PulseData }) {
  const composite = data.composite
  const fc = data.forecast

  if (!fc) return <div className="text-text-quaternary text-xs py-4">Ongoru verisi hesaplaniyor...</div>

  const specials = fc.specialSignals || []
  const regime = fc.regime || 'NORMAL'
  const isGolden = fc.isGoldenSignal

  const biasColor = fc.bias === 'POZITIF' ? 'text-success-400' : fc.bias === 'NEGATIF' ? 'text-danger-400' : 'text-text-tertiary'

  const vixComp = data.components.find(c => c.id === 'vix')
  const vixRaw = vixComp?.rawValue

  const regimeConfig: Record<string, { label: string; color: string; bg: string; desc: string }> = {
    EXTREME: { label: 'EXTREME VOL', color: 'text-danger-400', bg: 'bg-danger-400/10 border-danger-400/30', desc: 'Yuksek volatilite — mean reversion agirligi arttirildi' },
    HIGH_VOL: { label: 'HIGH VOL', color: 'text-warning-400', bg: 'bg-orange-500/10 border-orange-500/20', desc: 'Yukari volatilite — makro agirligi yukseldi' },
    LOW_VOL: { label: 'LOW VOL', color: 'text-info-400', bg: 'bg-info-400/10 border-info-400/30', desc: 'Dusuk volatilite — momentum agirligi arttirildi' },
    NORMAL: { label: 'NORMAL', color: 'text-text-tertiary', bg: 'bg-surface-2 border-stroke-subtle', desc: 'Standart piyasa kosullari — dengeli agirliklar' },
  }
  const rc = regimeConfig[regime]

  return (
    <div className="space-y-3">
      {/* Regime + Forecast Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Market Regime */}
        <div className={`rounded-xl border p-3 ${rc.bg}`}>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={12} className={rc.color} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">PIYASA REJIMI</span>
          </div>
          <div className={`text-lg font-bold ${rc.color}`}>{rc.label}</div>
          <div className="text-[10px] text-text-quaternary mt-0.5">{rc.desc}</div>
          {vixRaw != null && (
            <div className="text-[10px] text-text-quaternary mt-1 font-mono">VIX: {vixRaw.toFixed(1)}</div>
          )}
        </div>

        {/* Forecast Summary */}
        <div className={`rounded-xl border p-3 ${isGolden ? 'bg-gold-400/[0.06] border-stroke-gold-strong signal-fire-gold' : composite >= 65 ? 'bg-success-400/[0.04] border-success-400/30' : composite <= 35 ? 'bg-danger-400/[0.04] border-danger-400/30' : 'bg-surface-2 border-stroke-subtle'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-gold-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">ONGORU</span>
            {isGolden && (
              <span className="badge-enter px-1.5 py-0.5 rounded-full bg-gold-400/20 border border-stroke-gold-strong text-[9px] font-bold text-gold-300 combo-pulse">GOLDEN</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-black tabular-nums ${biasColor}`}>{fc.bias}</div>
            <div>
              <div className="text-[10px] text-text-tertiary">Composite: {composite}/100 {fc.boostApplied !== 0 && <span className={fc.boostApplied > 0 ? 'text-success-400' : 'text-danger-400'}>(+{fc.boostApplied})</span>}</div>
              <div className="text-[9px] text-text-quaternary">{specials.length} ozel sinyal | Guven: %{fc.confidence}</div>
            </div>
          </div>
          {isGolden && (
            <div className="mt-2 text-[9px] text-gold-300/60">
              Backtest: 3+ sinyal combo — 1G hit %68.8, 3G hit %81.2
            </div>
          )}
        </div>
      </div>

      {/* Special Signals */}
      {specials.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target size={12} className="text-gold-300" />
            <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">OZEL SINYALLER</span>
            <span className="text-[9px] text-text-quaternary ml-auto">{specials.length} aktif</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {specials.map((s, i) => (
              <div
                key={i}
                className={`badge-enter flex items-start gap-2 rounded-lg border px-3 py-2 ${
                  s.type === 'bullish' ? 'bg-success-400/[0.06] border-success-400/30' :
                  s.type === 'bearish' ? 'bg-danger-400/[0.06] border-danger-400/30' :
                  'bg-surface-2 border-stroke-subtle'
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className={`shrink-0 mt-0.5 ${s.type === 'bullish' ? 'text-success-400' : s.type === 'bearish' ? 'text-danger-400' : 'text-info-400'}`}>
                  {s.type === 'bullish' ? <ArrowUpRight size={12} /> : s.type === 'bearish' ? <ArrowDownRight size={12} /> : <Activity size={12} />}
                </span>
                <div className="min-w-0">
                  <span className={`text-[11px] font-bold ${s.type === 'bullish' ? 'text-success-400' : s.type === 'bearish' ? 'text-danger-400' : 'text-info-400'}`}>{s.label}</span>
                  <div className="text-[9px] text-text-quaternary mt-0.5">{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backtest Performance Footer */}
      <div className="rounded-lg bg-surface-2 border border-stroke-subtle p-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Shield size={10} className="text-text-quaternary" />
          <span className="text-[9px] font-semibold text-text-quaternary uppercase tracking-wider">V4 BACKTEST PERFORMANSI (10 YIL)</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[9px] text-text-quaternary">Genel Hit</div>
            <div className="text-[11px] font-bold text-text-tertiary tabular-nums">%59.1</div>
          </div>
          <div>
            <div className="text-[9px] text-text-quaternary">Golden 1G</div>
            <div className="text-[11px] font-bold text-success-400 tabular-nums">%68.8</div>
          </div>
          <div>
            <div className="text-[9px] text-text-quaternary">Golden 3G</div>
            <div className="text-[11px] font-bold text-success-400 tabular-nums">%81.2</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Stat Card ──────────────────────────────────────────────

function QuickStat({ label, value, good, icon }: { label: string; value: string; good: boolean; icon: React.ReactNode }) {
  return (
    <div className="bg-surface-1 rounded-xl border border-stroke-subtle p-3 flex items-center gap-3">
      <span className={good ? 'text-success-400' : 'text-danger-400'}>{icon}</span>
      <div>
        <div className="text-[9px] text-text-quaternary uppercase tracking-wider">{label}</div>
        <div className={`text-sm font-bold tabular-nums ${good ? 'text-success-400' : 'text-danger-400'}`}>{value}</div>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────

function PulseLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="bg-surface-2 rounded-2xl h-72 flex items-center justify-center">
          <div className="w-40 h-40 rounded-full border-4 border-stroke-subtle flex items-center justify-center">
            <div className="text-3xl text-text-quaternary font-bold">--</div>
          </div>
        </div>
        <div className="bg-surface-2 rounded-2xl p-4 space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-3 bg-surface-3 rounded" />
              <div className="w-24 h-3 bg-surface-3 rounded" />
              <div className="flex-1 h-2 bg-surface-3 rounded-full" />
              <div className="w-8 h-3 bg-surface-3 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-surface-2 rounded-xl h-16" />)}
      </div>
    </div>
  )
}
