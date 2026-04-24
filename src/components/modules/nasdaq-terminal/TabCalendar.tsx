'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar, DollarSign, Scissors, Rocket, Clock, Info, Search, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Star, ArrowUpRight, ArrowDownRight, Zap, AlertTriangle } from 'lucide-react'

interface CalendarData {
  earnings: { date: string; symbol: string; eps: number | null; epsEstimated: number | null; time: string; revenue: number | null; revenueEstimated: number | null }[]
  dividends: { date: string; symbol: string; dividend: number; adjDividend: number; paymentDate: string; recordDate: string }[]
  splits: { date: string; symbol: string; numerator: number; denominator: number }[]
  ipos: { date: string; company: string; symbol: string; exchange: string; priceRange: string; shares: number | null }[]
}

type EventType = 'earnings' | 'dividends' | 'splits' | 'ipos'
type TimeRange = 'this_week' | 'next_week' | 'all'

interface TabCalendarProps {
  onSelectSymbol?: (s: string) => void
}

const MEGA_CAPS = new Set(['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.A', 'BRK.B', 'JPM', 'V', 'JNJ', 'WMT', 'MA', 'PG', 'XOM', 'HD', 'CVX', 'LLY', 'ABBV', 'MRK', 'PEP', 'KO', 'AVGO', 'COST', 'TMO', 'MCD', 'CSCO', 'ACN', 'ABT', 'DHR', 'NEE', 'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'QCOM', 'IBM', 'BA', 'GS', 'MS', 'UNH', 'DIS', 'NKE', 'PYPL', 'LOW', 'TXN', 'CAT'])

function formatDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const days = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt']
  const months = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}

function formatFullDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const days = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi']
  const months = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik']
  return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]}`
}

function fmtNum(v: number | null | undefined, prefix: string = '') {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${prefix}${(v / 1e3).toFixed(1)}K`
  return `${prefix}${v.toFixed(2)}`
}

function getDateLabel(dateStr: string): { label: string; isToday: boolean; isPast: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  date.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return { label: 'BUGUN', isToday: true, isPast: false }
  if (diff === 1) return { label: 'YARIN', isToday: false, isPast: false }
  if (diff === -1) return { label: 'DUN', isToday: false, isPast: true }
  if (diff < 0) return { label: formatFullDate(dateStr), isToday: false, isPast: true }
  return { label: formatFullDate(dateStr), isToday: false, isPast: false }
}

function getWeekRange(offset: number): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)
  return { start: monday, end: friday }
}

interface EventItem {
  date: string
  type: EventType
  symbol: string
  detail: string
  sub: string
  isMega: boolean
  eps?: number | null
  epsEstimated?: number | null
  revenue?: number | null
  revenueEstimated?: number | null
  time?: string
  dividend?: number
  numerator?: number
  denominator?: number
  company?: string
  priceRange?: string
  exchange?: string
}

export default function TabCalendar({ onSelectSymbol }: TabCalendarProps) {
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<EventType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/fmp-terminal/calendar?days=14')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const allEvents = useMemo(() => {
    if (!data) return []
    const events: EventItem[] = []

    for (const e of (data.earnings || [])) {
      events.push({
        date: e.date, type: 'earnings', symbol: e.symbol,
        detail: `EPS Tahmini: ${fmtNum(e.epsEstimated, '$')} | Gelir Tahmini: ${fmtNum(e.revenueEstimated, '$')}`,
        sub: e.time === 'bmo' ? 'Piyasa Oncesi' : e.time === 'amc' ? 'Piyasa Sonrasi' : 'Gun Ici',
        isMega: MEGA_CAPS.has(e.symbol),
        eps: e.eps, epsEstimated: e.epsEstimated, revenue: e.revenue, revenueEstimated: e.revenueEstimated, time: e.time,
      })
    }
    for (const d of (data.dividends || [])) {
      events.push({
        date: d.date, type: 'dividends', symbol: d.symbol,
        detail: `Temettu: $${d.dividend.toFixed(3)} | Odeme: ${d.paymentDate || '—'}`,
        sub: `Kayit: ${d.recordDate || '—'}`,
        isMega: MEGA_CAPS.has(d.symbol), dividend: d.dividend,
      })
    }
    for (const s of (data.splits || [])) {
      events.push({
        date: s.date, type: 'splits', symbol: s.symbol,
        detail: `Oran: ${s.numerator}:${s.denominator}`,
        sub: s.numerator > s.denominator ? 'Ileri Split' : 'Ters Split',
        isMega: MEGA_CAPS.has(s.symbol), numerator: s.numerator, denominator: s.denominator,
      })
    }
    for (const i of (data.ipos || [])) {
      events.push({
        date: i.date, type: 'ipos', symbol: i.symbol || i.company?.substring(0, 6) || '?',
        detail: `${i.company} | Fiyat: ${i.priceRange || '—'}`,
        sub: i.exchange || 'TBD',
        isMega: false, company: i.company, priceRange: i.priceRange, exchange: i.exchange,
      })
    }

    let filtered = events
      .filter(e => filter === 'all' || e.type === filter)
      .filter(e => !search || e.symbol.toUpperCase().includes(search.toUpperCase()))

    if (selectedDate) {
      filtered = filtered.filter(e => e.date === selectedDate)
    }

    if (timeRange !== 'all') {
      const week = getWeekRange(timeRange === 'this_week' ? 0 : 1)
      filtered = filtered.filter(e => {
        const d = new Date(e.date + 'T00:00:00')
        return d >= week.start && d <= week.end
      })
    }

    return filtered.sort((a, b) => a.date.localeCompare(b.date) || (b.isMega ? 1 : 0) - (a.isMega ? 1 : 0))
  }, [data, filter, search, timeRange, selectedDate])

  const dateGroups = useMemo(() => {
    const groups: { date: string; events: EventItem[] }[] = []
    const map = new Map<string, EventItem[]>()
    for (const ev of allEvents) {
      if (!map.has(ev.date)) map.set(ev.date, [])
      map.get(ev.date)!.push(ev)
    }
    for (const [date, events] of map) {
      groups.push({ date, events })
    }
    return groups
  }, [allEvents])

  const miniCalDays = useMemo(() => {
    if (!data) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days: { date: string; count: number; types: Set<EventType>; isToday: boolean; isWeekend: boolean }[] = []
    for (let i = -2; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const ds = d.toISOString().slice(0, 10)
      const dayEvents = allEvents.filter(e => e.date === ds)
      const types = new Set<EventType>()
      dayEvents.forEach(e => types.add(e.type))
      days.push({
        date: ds,
        count: dayEvents.length,
        types,
        isToday: i === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      })
    }
    return days
  }, [data, allEvents])

  const megaEvents = useMemo(() => allEvents.filter(e => e.isMega).slice(0, 8), [allEvents])

  const FILTER_OPTS: { id: EventType | 'all'; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'all', label: 'TUMU', icon: <Calendar size={13} />, count: allEvents.length },
    { id: 'earnings', label: 'KAZANC', icon: <DollarSign size={13} />, count: data?.earnings?.length || 0 },
    { id: 'dividends', label: 'TEMETTU', icon: <DollarSign size={13} />, count: data?.dividends?.length || 0 },
    { id: 'splits', label: 'SPLIT', icon: <Scissors size={13} />, count: data?.splits?.length || 0 },
    { id: 'ipos', label: 'IPO', icon: <Rocket size={13} />, count: data?.ipos?.length || 0 },
  ]

  const TYPE_STYLES: Record<EventType, { bg: string; border: string; text: string; label: string; dot: string }> = {
    earnings: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', label: 'KAZANC', dot: 'bg-amber-400' },
    dividends: { bg: 'bg-success-400/10', border: 'border-success-400/20', text: 'text-success-400', label: 'TEMETTU', dot: 'bg-success-400' },
    splits: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', label: 'SPLIT', dot: 'bg-blue-400' },
    ipos: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', label: 'IPO', dot: 'bg-rose-400' },
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
            <p className="text-xs font-semibold text-text-secondary">Takvim verileri yukleniyor</p>
            <p className="text-[9px] text-text-tertiary mt-0.5">Kazanc, temettu, split, IPO</p>
          </div>
          <div className="w-32 h-0.5 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #876b3a, #C9A96E)' }} />
          </div>
          <div className="flex gap-2">
            {['Kazanc', 'Temettu', 'Split', 'IPO'].map((t, i) => (
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

  return (
    <div className="space-y-2 sm:space-y-3 px-2 sm:px-4 lg:px-6 animate-fade-in">

      {/* Mini Calendar Strip + Stats */}
      <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-3 sm:p-4 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/80 to-orange-600/80 flex items-center justify-center shadow-lg shadow-amber-500/15">
              <Calendar size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">PIYASA TAKVIMI</h3>
              <p className="text-[10px] text-text-quaternary">14 gunluk gorunum</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(['this_week', 'next_week', 'all'] as TimeRange[]).map(tr => (
              <button key={tr} onClick={() => { setTimeRange(tr); setSelectedDate(null) }}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all ${
                  timeRange === tr
                    ? 'bg-gold-400/15 text-gold-400 border border-stroke-gold'
                    : 'text-text-quaternary hover:text-text-secondary bg-surface-2 border border-transparent hover:border-stroke-subtle'
                }`}>
                {tr === 'this_week' ? 'Bu Hafta' : tr === 'next_week' ? 'Gelecek Hafta' : 'Tumu'}
              </button>
            ))}
          </div>
        </div>

        {/* Mini Calendar Strip */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
          {miniCalDays.map((day, i) => {
            const dt = new Date(day.date + 'T00:00:00')
            const dayNames = ['P', 'Pt', 'S', 'C', 'Pe', 'Cu', 'Ct']
            const isSelected = selectedDate === day.date
            const hasEvents = day.count > 0
            return (
              <button key={i}
                onClick={() => setSelectedDate(isSelected ? null : day.date)}
                className={`flex-shrink-0 w-10 sm:w-11 flex flex-col items-center py-1.5 rounded-lg transition-all duration-200 ${
                  day.isToday
                    ? 'bg-gold-400/15 border border-stroke-gold-strong shadow-sm shadow-gold-400/10'
                    : isSelected
                      ? 'bg-violet-500/15 border border-violet-500/30'
                      : day.isWeekend
                        ? 'bg-white/[0.01] border border-transparent opacity-40'
                        : hasEvents
                          ? 'bg-surface-2 border border-stroke-subtle hover:border-stroke'
                          : 'bg-white/[0.01] border border-transparent hover:border-stroke-subtle'
                }`}>
                <span className={`text-[8px] font-medium ${day.isToday ? 'text-gold-400' : 'text-text-quaternary'}`}>
                  {dayNames[dt.getDay()]}
                </span>
                <span className={`text-xs font-bold ${day.isToday ? 'text-gold-300' : isSelected ? 'text-violet-300' : 'text-text-secondary'}`}>
                  {dt.getDate()}
                </span>
                {hasEvents && (
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from(day.types).slice(0, 3).map((t, ti) => (
                      <div key={ti} className={`w-1 h-1 rounded-full ${TYPE_STYLES[t].dot}`} />
                    ))}
                  </div>
                )}
                {day.count > 0 && (
                  <span className={`text-[7px] font-bold mt-0.5 ${day.isToday ? 'text-gold-400' : 'text-text-quaternary'}`}>
                    {day.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {(['earnings', 'dividends', 'splits', 'ipos'] as EventType[]).map(t => {
            const ts = TYPE_STYLES[t]
            const count = data ? (t === 'earnings' ? data.earnings.length : t === 'dividends' ? data.dividends.length : t === 'splits' ? data.splits.length : data.ipos.length) : 0
            return (
              <button key={t}
                onClick={() => setFilter(filter === t ? 'all' : t)}
                className={`${ts.bg} border ${ts.border} rounded-xl px-2 py-2 text-center transition-all hover:scale-[1.02] ${
                  filter === t ? 'ring-1 ring-white/10 scale-[1.02]' : ''
                }`}>
                <div className={`text-lg sm:text-xl font-bold ${ts.text} tabular-nums`}>{count}</div>
                <div className="text-[9px] text-text-tertiary font-medium">{ts.label}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              filter === f.id
                ? 'bg-gradient-to-r from-gold-500/20 to-amber-500/15 border border-stroke-gold text-gold-300 shadow-sm shadow-gold-400/10'
                : 'bg-surface-2 border border-stroke-subtle text-text-tertiary hover:bg-surface-3 hover:text-text-secondary'
            }`}>
            {f.icon}
            <span>{f.label}</span>
            <span className={`text-[9px] px-1 py-0 rounded-full ${filter === f.id ? 'bg-gold-400/15 text-gold-400' : 'bg-surface-3 text-text-tertiary'}`}>
              {f.count}
            </span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Sembol ara..."
            className="pl-7 pr-3 py-1.5 w-36 rounded-lg bg-surface-3 border border-stroke-subtle text-xs text-white placeholder-white/15 focus:outline-none focus:border-stroke-gold"
          />
        </div>
        {selectedDate && (
          <button onClick={() => setSelectedDate(null)}
            className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-lg hover:bg-violet-500/20 transition-all">
            {formatDate(selectedDate)} &times;
          </button>
        )}
      </div>

      {/* Mega-Cap Upcoming (featured events) */}
      {megaEvents.length > 0 && filter !== 'dividends' && filter !== 'splits' && (
        <div className="bg-surface-3 rounded-2xl border border-stroke-gold p-3 sm:p-4 shadow-xl shadow-black/20">
          <div className="flex items-center gap-2 mb-2.5">
            <Star size={13} className="text-gold-400" />
            <span className="text-[10px] font-bold text-gold-400/80 uppercase tracking-wider">Onemli Etkinlikler</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {megaEvents.map((ev, i) => {
              const ts = TYPE_STYLES[ev.type]
              const dl = getDateLabel(ev.date)
              return (
                <button key={i}
                  onClick={() => onSelectSymbol?.(ev.symbol)}
                  className="bg-surface-1 rounded-xl border border-stroke-subtle p-2.5 text-left hover:border-stroke-gold hover:bg-gold-400/[0.02] transition-all group/mega">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white group-hover/mega:text-gold-300 transition-colors">{ev.symbol}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${ts.bg} border ${ts.border} ${ts.text}`}>
                      {ts.label}
                    </span>
                  </div>
                  <div className={`text-[9px] font-semibold ${dl.isToday ? 'text-gold-400' : dl.isPast ? 'text-text-tertiary' : 'text-text-tertiary'}`}>
                    {dl.isToday ? 'BUGUN' : dl.label}
                  </div>
                  {ev.type === 'earnings' && ev.time && (
                    <div className="text-[8px] text-text-tertiary mt-0.5">{ev.sub}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Date-Grouped Timeline */}
      <div className="space-y-2">
        {dateGroups.length === 0 ? (
          <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-8 text-center">
            <Calendar size={36} className="text-text-quaternary mx-auto mb-3" />
            <p className="text-text-tertiary text-sm font-medium">Bu donemde etkinlik bulunamadi</p>
            <p className="text-[10px] text-text-quaternary mt-1">Filtre veya tarih secimini degistirmeyi deneyin</p>
          </div>
        ) : dateGroups.map((group, gi) => {
          const dl = getDateLabel(group.date)
          return (
            <div key={group.date} className="bg-surface-3 rounded-2xl border border-stroke-subtle overflow-hidden shadow-xl shadow-black/20"
              style={{ animationDelay: `${gi * 50}ms` }}>

              {/* Date Header */}
              <div className={`flex items-center justify-between px-3 sm:px-4 py-2 border-b ${
                dl.isToday
                  ? 'bg-gold-400/[0.06] border-stroke-gold'
                  : dl.isPast
                    ? 'bg-white/[0.01] border-stroke-subtle'
                    : 'bg-surface-2 border-stroke-subtle'
              }`}>
                <div className="flex items-center gap-2">
                  {dl.isToday && <div className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />}
                  <span className={`text-xs font-bold ${dl.isToday ? 'text-gold-300' : dl.isPast ? 'text-text-quaternary' : 'text-text-secondary'}`}>
                    {dl.label}
                  </span>
                  {dl.isToday && <span className="text-[8px] text-gold-400/50 font-medium ml-1">AKTIF</span>}
                </div>
                <div className="flex items-center gap-2">
                  {group.events.filter(e => e.type === 'earnings').length > 0 && (
                    <span className="text-[8px] text-amber-400/60 bg-amber-500/8 px-1.5 py-0.5 rounded">
                      {group.events.filter(e => e.type === 'earnings').length} Kazanc
                    </span>
                  )}
                  <span className="text-[9px] text-text-tertiary">{group.events.length} etkinlik</span>
                </div>
              </div>

              {/* Events */}
              <div className="divide-y divide-white/[0.03]">
                {group.events.map((ev, ei) => {
                  const ts = TYPE_STYLES[ev.type]
                  const hasBeat = ev.type === 'earnings' && ev.eps !== null && ev.epsEstimated !== null
                  const beat = hasBeat ? (ev.eps! > ev.epsEstimated! ? 'beat' : ev.eps! < ev.epsEstimated! ? 'miss' : 'inline') : null

                  return (
                    <div key={ei}
                      onClick={() => onSelectSymbol?.(ev.symbol)}
                      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 cursor-pointer transition-all duration-200 group/row ${
                        ev.isMega
                          ? 'hover:bg-gold-400/[0.04] bg-gold-400/[0.01]'
                          : 'hover:bg-violet-500/[0.04]'
                      } ${dl.isPast ? 'opacity-60' : ''}`}>

                      {/* Type Badge */}
                      <div className={`w-16 shrink-0 text-center ${ts.bg} border ${ts.border} rounded-lg py-1`}>
                        <span className={`text-[9px] font-bold ${ts.text}`}>{ts.label}</span>
                      </div>

                      {/* Symbol */}
                      <div className="w-16 shrink-0">
                        <div className="flex items-center gap-1">
                          {ev.isMega && <Star size={9} className="text-gold-400/50" />}
                          <span className={`text-sm font-bold ${ev.isMega ? 'text-gold-300' : 'text-white'} group-hover/row:text-gold-300 transition-colors`}>
                            {ev.symbol}
                          </span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        {ev.type === 'earnings' ? (
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-text-quaternary">EPS Th:</span>
                              <span className="text-[11px] font-semibold text-text-secondary tabular-nums">{fmtNum(ev.epsEstimated, '$')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-text-quaternary">Gelir Th:</span>
                              <span className="text-[11px] font-semibold text-text-secondary tabular-nums">{fmtNum(ev.revenueEstimated, '$')}</span>
                            </div>
                            {hasBeat && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                beat === 'beat' ? 'bg-success-400/15 text-success-400 border border-success-400/20'
                                  : beat === 'miss' ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                    : 'bg-surface-3 text-text-tertiary border border-stroke-subtle'
                              }`}>
                                {beat === 'beat' ? 'BEKLENTI USTU' : beat === 'miss' ? 'BEKLENTI ALTI' : 'PARALEL'}
                              </span>
                            )}
                            {ev.eps !== null && (
                              <span className="text-[10px] text-text-tertiary tabular-nums">Gercek: {fmtNum(ev.eps, '$')}</span>
                            )}
                          </div>
                        ) : ev.type === 'dividends' ? (
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-success-400 font-semibold tabular-nums">${ev.dividend?.toFixed(3)}</span>
                            <span className="text-[9px] text-text-tertiary">Odeme: {ev.sub?.replace('Kayit: ', '')}</span>
                          </div>
                        ) : ev.type === 'splits' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-blue-400 font-semibold">{ev.numerator}:{ev.denominator}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                              (ev.numerator || 0) > (ev.denominator || 0)
                                ? 'bg-success-400/10 text-success-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {ev.sub}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-text-tertiary truncate">{ev.company}</span>
                            {ev.priceRange && <span className="text-[10px] text-rose-400 font-medium">{ev.priceRange}</span>}
                            {ev.exchange && <span className="text-[8px] text-text-quaternary bg-surface-2 px-1.5 py-0.5 rounded">{ev.exchange}</span>}
                          </div>
                        )}
                      </div>

                      {/* Time / Sub */}
                      <div className="shrink-0 text-right">
                        {ev.type === 'earnings' && ev.time && (
                          <span className={`text-[9px] font-medium px-2 py-0.5 rounded-md ${
                            ev.time === 'bmo' ? 'bg-amber-500/10 text-amber-400/70' : ev.time === 'amc' ? 'bg-violet-500/10 text-violet-400/70' : 'bg-surface-2 text-text-tertiary'
                          }`}>
                            {ev.time === 'bmo' ? 'BMO' : ev.time === 'amc' ? 'AMC' : 'GIC'}
                          </span>
                        )}
                      </div>

                      {/* Arrow */}
                      <ArrowUpRight size={12} className="text-text-quaternary group-hover/row:text-text-tertiary shrink-0 transition-colors" />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Info */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-gold-400/[0.02] rounded-xl border border-stroke-gold">
        <Info size={13} className="text-gold-400/40 mt-0.5 shrink-0" />
        <p className="text-[11px] text-text-quaternary leading-relaxed">
          Kazanc takvimleri, temettu tarihleri, hisse split&apos;leri ve yeni IPO&apos;lar canli olarak cekilir.
          <span className="text-text-quaternary"> BMO = Piyasa Oncesi, AMC = Piyasa Sonrasi, GIC = Gun Ici.</span>
        </p>
      </div>
    </div>
  )
}
