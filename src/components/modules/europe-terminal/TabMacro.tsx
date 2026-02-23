'use client'

import { useState, useEffect } from 'react'
import { Globe2, TrendingUp, TrendingDown, AlertTriangle, Newspaper } from 'lucide-react'

interface MacroData {
  economicEvents: Array<{ date: string; event: string; country: string; actual?: string; estimate?: string; previous?: string; impact?: string }>
  articles: Array<{ title: string; date: string; site: string; link: string; text?: string }>
}

export default function TabMacro() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [countryFilter, setCountryFilter] = useState('all')

  useEffect(() => {
    fetch('/api/europe-terminal/macro')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Globe2 size={24} className="text-blue-400 animate-pulse" />
    </div>
  )

  const events = data?.economicEvents || []
  const articles = data?.articles || []
  const countries = ['all', ...new Set(events.map(e => e.country).filter(Boolean))]
  const filtered = countryFilter === 'all' ? events : events.filter(e => e.country === countryFilter)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Country Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {countries.slice(0, 10).map(c => (
          <button key={c} onClick={() => setCountryFilter(c)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
              countryFilter === c ? 'text-blue-300 bg-blue-500/15 border-blue-500/25' : 'text-white/40 bg-white/[0.02] border-white/[0.05] hover:border-white/10'
            }`}>{c === 'all' ? 'Tum Ulkeler' : c}</button>
        ))}
      </div>

      {/* Economic Events */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Globe2 size={14} className="text-blue-400" />
            <span className="text-xs text-white/50 font-semibold tracking-wider">EKONOMIK TAKVIM (Avrupa)</span>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-white/35 text-sm">Ekonomik etkinlik bulunamadi</div>
        ) : (
          <div className="divide-y divide-white/[0.04] max-h-[50vh] overflow-y-auto">
            {filtered.slice(0, 50).map((ev, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.02] transition-colors">
                <span className="text-[10px] text-white/35 font-mono w-16 shrink-0">{ev.date?.split(' ')[0] || ''}</span>
                <span className="text-[10px] text-white/40 font-semibold w-6 shrink-0">{ev.country}</span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  ev.impact === 'High' ? 'bg-red-400' : ev.impact === 'Medium' ? 'bg-amber-400' : 'bg-white/20'
                }`} />
                <span className="text-xs text-white/70 flex-1 truncate">{ev.event}</span>
                <span className="text-[10px] text-white/40 tabular-nums w-12 text-right">{ev.actual || '\u2014'}</span>
                <span className="text-[10px] text-white/30 tabular-nums w-12 text-right">{ev.estimate || '\u2014'}</span>
                <span className="text-[10px] text-white/20 tabular-nums w-12 text-right">{ev.previous || '\u2014'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Market Articles */}
      {articles.length > 0 && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Newspaper size={14} className="text-blue-400" />
              <span className="text-xs text-white/50 font-semibold tracking-wider">PIYASA HABERLERI</span>
            </div>
          </div>
          <div className="divide-y divide-white/[0.04] max-h-[40vh] overflow-y-auto">
            {articles.slice(0, 20).map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
                className="block px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm text-white/70 line-clamp-1">{a.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-white/30">{a.date?.split(' ')[0]}</span>
                  <span className="text-[10px] text-blue-400/60">{a.site}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
