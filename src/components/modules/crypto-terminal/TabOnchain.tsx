'use client'

// HERMES AI CRYPTO TERMINAL — Tab: ON-CHAIN
// GeckoTerminal DEX pools, trending pools, newly listed

import { useState, useEffect } from 'react'
import { Flame, Clock } from 'lucide-react'

interface TabOnchainProps {
  onSelectCoin: (id: string) => void
}

interface TrendingPool {
  id: string
  attributes: {
    name: string
    base_token_price_usd: string
    volume_usd: { h24: string }
    price_change_percentage: { h24: string }
    reserve_in_usd: string
  }
}

interface TrendingPoolsData {
  data: TrendingPool[]
}

interface NewCoinEntry {
  id: string
  symbol: string
  name: string
  activated_at: number
}

const NETWORKS = [
  { id: '', label: 'Tumu' },
  { id: 'eth', label: 'Ethereum' },
  { id: 'bsc', label: 'BNB Chain' },
  { id: 'polygon_pos', label: 'Polygon' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'base', label: 'Base' },
  { id: 'solana', label: 'Solana' },
  { id: 'avalanche', label: 'Avalanche' },
]

export default function TabOnchain({ onSelectCoin }: TabOnchainProps) {
  const [trendingPools, setTrendingPools] = useState<TrendingPoolsData | null>(null)
  const [newlyListed, setNewlyListed] = useState<NewCoinEntry[]>([])
  const [network, setNetwork] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const url = network ? `/api/crypto-terminal/onchain?network=${network}` : '/api/crypto-terminal/onchain'
        const res = await fetch(url)
        if (!res.ok) throw new Error('On-chain verisi yuklenemedi')
        const data = await res.json()
        setTrendingPools(data.trendingPools)
        setNewlyListed(data.newlyListed || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'On-chain verisi yuklenemedi')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [network])

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-white/[0.02] rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
      <p className="text-sm text-red-400 mb-2">{error}</p>
      <button onClick={() => setNetwork(network)} className="px-4 py-2 rounded-xl bg-white/[0.04] text-white/60 text-xs hover:bg-white/[0.08] transition-all">Tekrar Dene</button>
    </div>
  )

  return (
    <div className="space-y-2 sm:space-y-4 animate-fade-in">
      {/* Network Filter */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
        {NETWORKS.map(n => (
          <button
            key={n.id}
            onClick={() => setNetwork(n.id)}
            className={`group px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all duration-300 border ${
              network === n.id ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/8 text-amber-300 border-amber-500/35 shadow-sm shadow-amber-500/10 scale-[1.02]' : 'text-white/50 hover:text-amber-200/80 border-white/[0.04] hover:border-amber-500/20 hover:shadow-sm hover:shadow-amber-500/5'
            }`}
          >{n.label}</button>
        ))}
      </div>

      {/* Trending Pools */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <Flame size={16} className="text-orange-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Trend DEX Havuzlari</h3>
        </div>
        {trendingPools?.data ? (
          <div className="space-y-1">
            {trendingPools.data.slice(0, 20).map((pool, i) => (
              <div key={pool.id || i} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-5">{i + 1}</span>
                  <div>
                    <span className="text-xs font-bold text-white">{pool.attributes?.name || 'Pool'}</span>
                    <span className="text-[10px] text-white/40 ml-1">${parseFloat(pool.attributes?.base_token_price_usd || '0').toFixed(4)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-white/40">TVL: ${(parseFloat(pool.attributes?.reserve_in_usd || '0') / 1e6).toFixed(1)}M</span>
                  <span className="text-white/40">24s: ${(parseFloat(pool.attributes?.volume_usd?.h24 || '0') / 1e6).toFixed(1)}M</span>
                  <span className={`font-medium ${parseFloat(pool.attributes?.price_change_percentage?.h24 || '0') >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {parseFloat(pool.attributes?.price_change_percentage?.h24 || '0').toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/40">Trend havuz verisi bekleniyor...</p>
        )}
      </div>

      {/* Newly Listed */}
      {newlyListed.length > 0 && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Clock size={16} className="text-violet-400" />
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Yeni Listelenen Coinler</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {newlyListed.slice(0, 20).map(coin => (
              <button
                key={coin.id}
                onClick={() => onSelectCoin(coin.id)}
                className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-violet-500/20 hover:shadow-sm hover:shadow-violet-500/5 hover:scale-[1.02] transition-all duration-300 text-left"
              >
                <div className="text-xs font-bold text-white">{coin.symbol?.toUpperCase()}</div>
                <div className="text-[10px] text-white/40 truncate">{coin.name}</div>
                {coin.activated_at && (
                  <div className="text-[9px] text-violet-400/60 mt-0.5">
                    {new Date(coin.activated_at * 1000).toLocaleDateString('tr-TR')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
