'use client'

import { useState, useEffect } from 'react'
import { Globe, TrendingUp, TrendingDown, BarChart3, AlertTriangle } from 'lucide-react'
import { EUROPE_EXCHANGES, type EuropeExchangeId } from '@/lib/europe-config'

interface MarketData {
  indexes: Array<{ symbol: string; name: string; price: number; change: number; changesPercentage: number }>
  fearGreedIndex: number
  fearGreedLabel: string
  sectors: Array<{ sector: string; changesPercentage: number }>
  gainers: Array<{ symbol: string; name: string; price: number; changesPercentage: number }>
  losers: Array<{ symbol: string; name: string; price: number; changesPercentage: number }>
  actives: Array<{ symbol: string; name: string; price: number; volume: number }>
  marketStatus: Record<string, { isOpen: boolean; label: string }>
}

export default function TabMarket({ onSelectSymbol, onExchangeClick }: { onSelectSymbol: (s: string) => void; onExchangeClick?: (exId: EuropeExchangeId) => void }) {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/europe-terminal/market')
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Globe size={24} className="text-blue-400 animate-pulse" />
        <p className="text-sm text-white/50">Avrupa piyasalari yukleniyor...</p>
      </div>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <AlertTriangle size={24} className="text-red-400/50" />
        <p className="text-white/45">{error || 'No data'}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Exchange Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {Object.values(EUROPE_EXCHANGES).map(ex => {
          const status = data.marketStatus?.[ex.id]
          const isOpen = status?.isOpen
          return (
            <button key={ex.id} type="button" onClick={() => onExchangeClick?.(ex.id)}
              className={`w-full relative bg-[#151520] rounded-xl border p-3 text-center transition-all duration-300 hover:scale-[1.02] hover:border-violet-500/20 hover:shadow-lg hover:shadow-violet-500/5 cursor-pointer ${
                isOpen ? 'border-hermes-green/20 shadow-sm shadow-hermes-green/5' : 'border-white/[0.06]'
              }`}>
              <img src={`https://flagcdn.com/w80/${ex.country.toLowerCase()}.png`} alt={ex.country} className="w-10 h-7 object-cover rounded mb-1.5 drop-shadow-lg mx-auto" title={`${ex.country} - ${ex.name}`} />
              <div className="text-[11px] text-white/70 font-bold tracking-wide">{ex.country} {ex.shortLabel}</div>
              <div className="text-[9px] text-white/40 mt-0.5">{ex.name}</div>
              <div className={`flex items-center justify-center gap-1 mt-1.5 ${isOpen ? 'text-hermes-green' : 'text-white/30'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-hermes-green animate-pulse' : 'bg-white/20'}`} />
                <span className="text-[9px] font-bold tracking-wider">{isOpen ? 'ACIK' : 'KAPALI'}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Indexes */}
      {data.indexes?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.indexes.map(idx => (
            <div key={idx.symbol} className="bg-[#151520] rounded-xl border border-white/[0.06] p-3">
              <div className="text-[10px] text-white/40 font-medium">{idx.name}</div>
              <div className="text-lg font-bold text-white mt-0.5 tabular-nums">{idx.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div className={`flex items-center gap-1 mt-0.5 text-sm font-semibold ${idx.changesPercentage >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                {idx.changesPercentage >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {idx.changesPercentage >= 0 ? '+' : ''}{idx.changesPercentage?.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fear & Greed + Sectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Fear & Greed */}
        <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
          <div className="text-xs text-white/40 font-semibold mb-3 tracking-wider">FEAR & GREED INDEX</div>
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold tabular-nums ${
              data.fearGreedIndex >= 70 ? 'text-hermes-green' : data.fearGreedIndex >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>{data.fearGreedIndex || 50}</div>
            <div className={`text-sm font-semibold ${
              data.fearGreedIndex >= 70 ? 'text-hermes-green' : data.fearGreedIndex >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>{data.fearGreedLabel || 'NEUTRAL'}</div>
          </div>
          <div className="mt-3 h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${data.fearGreedIndex || 50}%`,
              background: `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)`,
            }} />
          </div>
        </div>

        {/* Sector Performance */}
        {data.sectors?.length > 0 && (
          <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
            <div className="text-xs text-white/40 font-semibold mb-3 tracking-wider">SEKTOR PERFORMANSI</div>
            <div className="space-y-1.5">
              {data.sectors.slice(0, 8).map(s => (
                <div key={s.sector} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-24 truncate">{s.sector}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.changesPercentage >= 0 ? 'bg-hermes-green/60' : 'bg-red-400/60'}`}
                      style={{ width: `${Math.min(Math.abs(s.changesPercentage || 0) * 10, 100)}%` }} />
                  </div>
                  <span className={`text-[10px] tabular-nums font-medium w-12 text-right ${s.changesPercentage >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                    {s.changesPercentage >= 0 ? '+' : ''}{s.changesPercentage?.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gainers & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Gainers */}
        <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-hermes-green" />
            <span className="text-xs text-white/40 font-semibold tracking-wider">EN COK YUKSELENLER</span>
          </div>
          <div className="space-y-1">
            {(data.gainers || []).slice(0, 8).map(g => (
              <div key={g.symbol} onClick={() => onSelectSymbol(g.symbol)}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors">
                <div>
                  <span className="text-sm font-bold text-white">{g.symbol}</span>
                  <span className="text-[10px] text-white/40 ml-2 truncate">{g.name?.slice(0, 20)}</span>
                </div>
                <span className="text-sm font-semibold text-hermes-green tabular-nums">+{g.changesPercentage?.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Losers */}
        <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-xs text-white/40 font-semibold tracking-wider">EN COK DUSENLER</span>
          </div>
          <div className="space-y-1">
            {(data.losers || []).slice(0, 8).map(l => (
              <div key={l.symbol} onClick={() => onSelectSymbol(l.symbol)}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors">
                <div>
                  <span className="text-sm font-bold text-white">{l.symbol}</span>
                  <span className="text-[10px] text-white/40 ml-2 truncate">{l.name?.slice(0, 20)}</span>
                </div>
                <span className="text-sm font-semibold text-red-400 tabular-nums">{l.changesPercentage?.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
