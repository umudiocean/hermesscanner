'use client'

import { useState, useEffect } from 'react'
import { Calendar, TrendingUp, TrendingDown, AlertTriangle, Scissors, Rocket } from 'lucide-react'

interface CalendarEvent {
  date: string
  symbol?: string
  type: 'earnings' | 'dividend' | 'split' | 'ipo'
  title?: string
  estimate?: number
  actual?: number
  amount?: number
}

const TYPE_CONFIG = {
  earnings: { icon: <TrendingUp size={12} />, label: 'Kazanc', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  dividend: { icon: <TrendingDown size={12} />, label: 'Temettu', color: 'text-hermes-green bg-hermes-green/10 border-hermes-green/25' },
  split: { icon: <Scissors size={12} />, label: 'Bolunme', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  ipo: { icon: <Rocket size={12} />, label: 'Halka Arz', color: 'text-violet-400 bg-violet-500/10 border-violet-500/25' },
}

export default function TabCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/europe-terminal/calendar')
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Calendar size={24} className="text-blue-400 animate-pulse" />
    </div>
  )

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        {['all', 'earnings', 'dividend', 'split', 'ipo'].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
              filter === t ? 'text-blue-300 bg-blue-500/15 border-blue-500/25' : 'text-white/40 bg-white/[0.02] border-white/[0.05] hover:border-white/10'
            }`}>{t === 'all' ? 'Tumu' : t === 'earnings' ? 'Kazanc' : t === 'dividend' ? 'Temettu' : t === 'split' ? 'Bolunme' : 'Halka Arz'}</button>
        ))}
      </div>

      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-white/35 text-sm">Etkinlik bulunamadi</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.slice(0, 50).map((ev, i) => {
              const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.earnings
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <span className="text-[11px] text-white/40 font-mono w-20">{ev.date}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                    {cfg.icon}{cfg.label}
                  </span>
                  <span className="text-sm font-bold text-white">{ev.symbol || ''}</span>
                  <span className="text-xs text-white/40 flex-1 truncate">{ev.title || ''}</span>
                  {ev.estimate != null && <span className="text-[10px] text-white/40 tabular-nums">Tah: {ev.estimate}</span>}
                  {ev.actual != null && <span className="text-[10px] text-hermes-green tabular-nums">Ger: {ev.actual}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
