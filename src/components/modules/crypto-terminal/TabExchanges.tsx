'use client'

// HERMES AI CRYPTO TERMINAL — Tab: BORSALAR
// Exchange comparison with trust scores and volume

import { useState, useEffect, useMemo } from 'react'
import { Wallet, Search, AlertTriangle } from 'lucide-react'

interface CryptoExchange {
  id: string; name: string; year_established: number | null; country: string | null
  image: string; trust_score: number; trust_score_rank: number
  trade_volume_24h_btc: number; trade_volume_24h_btc_normalized: number
}

function TrustBadge({ score }: { score: number }) {
  if (score >= 9) return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-gradient-to-r from-emerald-500/15 to-emerald-600/8 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">{score}/10</span>
  if (score >= 7) return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-gradient-to-r from-amber-500/15 to-amber-600/8 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10">{score}/10</span>
  if (score >= 5) return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-gradient-to-r from-orange-500/15 to-orange-600/8 text-orange-400 border border-orange-500/30 shadow-sm shadow-orange-500/10">{score}/10</span>
  return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-gradient-to-r from-red-500/15 to-red-600/8 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10">{score}/10</span>
}

export default function TabExchanges() {
  const [exchanges, setExchanges] = useState<CryptoExchange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/crypto-terminal/exchanges')
        if (!res.ok) throw new Error('Borsa verisi yuklenemedi')
        const data = await res.json()
        setExchanges(data.exchanges || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Borsa verisi yuklenemedi')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return exchanges
    const q = search.toLowerCase()
    return exchanges.filter(e => e.name.toLowerCase().includes(q) || (e.country || '').toLowerCase().includes(q))
  }, [exchanges, search])

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-12 bg-white/[0.02] rounded-lg animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
      <AlertTriangle size={32} className="text-red-400/50 mb-3" />
      <p className="text-sm text-red-400">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 rounded-xl bg-white/[0.04] text-white/60 text-xs hover:bg-white/[0.08] transition-all">Yenile</button>
    </div>
  )

  return (
    <div className="space-y-2 sm:space-y-3 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Kripto Borsalari</h3>
          <span className="text-[10px] text-white/40">{filtered.length}</span>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Borsa ara..."
            className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-white/[0.04] border border-white/8 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-amber-500/30 focus:shadow-md focus:shadow-amber-500/10 transition-all duration-300" />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-1.5 sm:space-y-2">
        {filtered.slice(0, 30).map(ex => (
          <div key={ex.id} className="bg-[#151520] rounded-xl border border-white/[0.06] p-2.5 sm:p-3 hover:border-white/[0.12] hover:shadow-md hover:shadow-black/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {ex.image && <img src={ex.image} alt={ex.name} className="w-6 h-6 rounded-full" loading="lazy" />}
                <div>
                  <span className="text-sm font-bold text-white">{ex.name}</span>
                  <span className="text-[10px] text-white/40 ml-1">#{ex.trust_score_rank}</span>
                </div>
              </div>
              <TrustBadge score={ex.trust_score} />
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
              <span>Hacim: {(ex.trade_volume_24h_btc ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTC</span>
              {ex.country && <span>{ex.country}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-[#0c0c14]">
            <tr className="text-[10px] text-white/40 uppercase tracking-wider">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Borsa</th>
              <th className="px-2 py-2 text-center">Guven</th>
              <th className="px-2 py-2 text-right">24s Hacim (BTC)</th>
              <th className="px-2 py-2 text-right">Normalize Hacim</th>
              <th className="px-2 py-2 hidden lg:table-cell">Ulke</th>
              <th className="px-2 py-2 hidden lg:table-cell text-right">Kurulis</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(ex => (
              <tr key={ex.id} className="border-b border-white/[0.03] hover:bg-amber-500/[0.03] transition-colors">
                <td className="px-2 py-2 text-xs text-white/40">{ex.trust_score_rank}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    {ex.image && <img src={ex.image} alt={ex.name} className="w-5 h-5 rounded-full" loading="lazy" />}
                    <span className="text-xs font-bold text-white">{ex.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center"><TrustBadge score={ex.trust_score} /></td>
                <td className="px-2 py-2 text-right text-xs text-white/60 tabular-nums">{(ex.trade_volume_24h_btc ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-2 py-2 text-right text-xs text-white/50 tabular-nums">{(ex.trade_volume_24h_btc_normalized ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-2 py-2 text-xs text-white/40 hidden lg:table-cell">{ex.country || '-'}</td>
                <td className="px-2 py-2 text-xs text-white/40 text-right hidden lg:table-cell">{ex.year_established || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
