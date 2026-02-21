'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calendar, DollarSign, Scissors, Rocket, Clock, AlertTriangle, Info, Filter } from 'lucide-react'

interface CalendarData {
  earnings: { date: string; symbol: string; eps: number | null; epsEstimated: number | null; time: string; revenue: number | null; revenueEstimated: number | null }[]
  dividends: { date: string; symbol: string; dividend: number; adjDividend: number; paymentDate: string; recordDate: string }[]
  splits: { date: string; symbol: string; numerator: number; denominator: number }[]
  ipos: { date: string; company: string; symbol: string; exchange: string; priceRange: string; shares: number | null }[]
}

type EventType = 'earnings' | 'dividends' | 'splits' | 'ipos'

interface TabCalendarProps {
  onSelectSymbol?: (s: string) => void
}

function formatDate(d: string) {
  const dt = new Date(d)
  const days = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt']
  const months = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara']
  return `${days[dt.getUTCDay()]} ${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`
}

function fmtNum(v: number | null | undefined, prefix: string = '') {
  if (v === null || v === undefined) return '--'
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M`
  return `${prefix}${v.toFixed(2)}`
}

export default function TabCalendar({ onSelectSymbol }: TabCalendarProps) {
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<EventType | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/fmp-terminal/calendar?days=14')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const allEvents = useMemo(() => {
    if (!data) return []
    const events: { date: string; type: EventType; symbol: string; detail: string; sub: string }[] = []

    for (const e of (data.earnings || [])) {
      events.push({
        date: e.date, type: 'earnings', symbol: e.symbol,
        detail: `EPS Tahmini: ${fmtNum(e.epsEstimated, '$')} | Gelir Tahmini: ${fmtNum(e.revenueEstimated, '$')}`,
        sub: e.time === 'bmo' ? 'Piyasa Oncesi' : e.time === 'amc' ? 'Piyasa Sonrasi' : 'Gun Ici',
      })
    }
    for (const d of (data.dividends || [])) {
      events.push({
        date: d.date, type: 'dividends', symbol: d.symbol,
        detail: `Temettu: $${d.dividend.toFixed(3)} | Odeme: ${d.paymentDate || '--'}`,
        sub: `Kayit: ${d.recordDate || '--'}`,
      })
    }
    for (const s of (data.splits || [])) {
      events.push({
        date: s.date, type: 'splits', symbol: s.symbol,
        detail: `Oran: ${s.numerator}:${s.denominator}`,
        sub: s.numerator > s.denominator ? 'Ileri Split' : 'Ters Split',
      })
    }
    for (const i of (data.ipos || [])) {
      events.push({
        date: i.date, type: 'ipos', symbol: i.symbol || i.company,
        detail: `${i.company} | Fiyat: ${i.priceRange || '--'}`,
        sub: i.exchange || 'TBD',
      })
    }

    return events
      .filter(e => filter === 'all' || e.type === filter)
      .filter(e => !search || e.symbol.toUpperCase().includes(search.toUpperCase()))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data, filter, search])

  const FILTER_OPTS: { id: EventType | 'all'; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'all', label: 'TUMU', icon: <Calendar size={13} />, color: 'violet' },
    { id: 'earnings', label: 'KAZANC', icon: <DollarSign size={13} />, color: 'amber' },
    { id: 'dividends', label: 'TEMETTU', icon: <DollarSign size={13} />, color: 'emerald' },
    { id: 'splits', label: 'SPLIT', icon: <Scissors size={13} />, color: 'blue' },
    { id: 'ipos', label: 'IPO', icon: <Rocket size={13} />, color: 'rose' },
  ]

  const TYPE_STYLES: Record<EventType, { bg: string; text: string; label: string }> = {
    earnings: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', label: 'KAZANC' },
    dividends: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'TEMETTU' },
    splits: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'SPLIT' },
    ipos: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400', label: 'IPO' },
  }

  if (loading) {
    return (
      <div className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 data-stream pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14" viewBox="0 0 100 100" style={{ animation: 'ring-spin 2s linear infinite' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(179,148,91,0.06)" strokeWidth="2" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#calGold)" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="264" style={{ animation: 'ring-pulse 1.6s ease-in-out infinite' }} />
              <defs><linearGradient id="calGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#C9A96E" /><stop offset="100%" stopColor="#876b3a" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-gold-400/80 text-lg">📅</div>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-white/60">Takvim verileri yukleniyor</p>
            <p className="text-[9px] text-white/20 mt-0.5">Kazanc, temettu, split, IPO</p>
          </div>
          <div className="w-32 h-0.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #876b3a, #C9A96E)' }} />
          </div>
          <div className="flex gap-2">
            {['Kazanc', 'Temettu', 'Split', 'IPO'].map((t, i) => (
              <div key={i} className="px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.04] opacity-0"
                style={{ animation: `card-reveal 0.3s ease-out ${0.4 + i * 0.15}s forwards` }}>
                <span className="text-[8px] text-white/15 font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-4 px-2 sm:px-4 lg:px-6 animate-fade-in">
      {/* Header */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Calendar size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">PIYASA TAKVIMI</h3>
              <p className="text-xs text-white/30">Yaklasan 14 gunluk etkinlikler</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Clock size={12} />
            {allEvents.length} etkinlik
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
          {FILTER_OPTS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${filter === f.id
                  ? 'bg-gradient-to-r from-violet-600/80 to-blue-600/80 text-white'
                  : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.07] hover:text-white/70'}`}
            >
              {f.icon} {f.label}
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Sembol ara..."
            className="ml-auto w-32 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {(['earnings', 'dividends', 'splits', 'ipos'] as EventType[]).map(t => {
            const count = allEvents.filter(e => e.type === t || filter === 'all').length
            const ts = TYPE_STYLES[t]
            return (
              <div key={t} className={`${ts.bg} border rounded-lg px-3 py-2 text-center`}>
                <div className={`text-lg font-bold ${ts.text}`}>
                  {data ? (t === 'earnings' ? data.earnings.length : t === 'dividends' ? data.dividends.length : t === 'splits' ? data.splits.length : data.ipos.length) : 0}
                </div>
                <div className="text-[10px] text-white/30">{ts.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Events List */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-x-auto shadow-xl shadow-black/20">
        {allEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={32} className="text-white/10 mx-auto mb-2" />
            <p className="text-white/25 text-sm">Bu donemde etkinlik bulunamadi</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {allEvents.slice(0, 100).map((ev, i) => {
              const ts = TYPE_STYLES[ev.type]
              return (
                <div key={i}
                  onClick={() => onSelectSymbol?.(ev.symbol)}
                  className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5 hover:bg-violet-500/[0.05] cursor-pointer transition-all min-w-0">
                  <div className="w-14 text-center shrink-0">
                    <div className="text-[11px] text-white/30">{formatDate(ev.date)}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ts.bg} ${ts.text}`}>
                    {ts.label}
                  </span>
                  <span className="text-sm font-bold text-white min-w-[60px]">{ev.symbol}</span>
                  <span className="text-xs text-white/40 flex-1 truncate">{ev.detail}</span>
                  <span className="text-[11px] text-white/20 shrink-0">{ev.sub}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 px-2 sm:px-4 py-2 sm:py-3 bg-violet-500/[0.05] rounded-xl border border-violet-500/10">
        <Info size={14} className="text-violet-400/50 mt-0.5 shrink-0" />
        <p className="text-[12px] text-white/30 leading-relaxed">
          Kazanc takvimleri, temettu tarihleri, hisse split&apos;leri ve yeni IPO&apos;lar canli olarak cekilir.
          BMO = Piyasa Oncesi, AMC = Piyasa Sonrasi.
        </p>
      </div>
    </div>
  )
}
