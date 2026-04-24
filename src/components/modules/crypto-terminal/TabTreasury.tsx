'use client'

// HERMES AI CRYPTO TERMINAL — Tab: HAZINE
// Public company BTC/ETH holdings

import { useState, useEffect } from 'react'
import { Wallet } from 'lucide-react'

interface TreasuryCompany {
  name: string; symbol: string; country: string
  total_holdings: number; total_entry_value_usd: number
  total_current_value_usd: number; percentage_of_total_supply: number
}
interface TreasuryData {
  total_holdings: number; total_value_usd: number
  market_cap_dominance: number; companies: TreasuryCompany[]
}

function formatLarge(v: number): string {
  if (!v) return '-'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

export default function TabTreasury() {
  const [btc, setBtc] = useState<TreasuryData | null>(null)
  const [eth, setEth] = useState<TreasuryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeAsset, setActiveAsset] = useState<'btc' | 'eth'>('btc')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/crypto-terminal/treasury')
        if (!res.ok) throw new Error('Hazine verisi yuklenemedi')
        const data = await res.json()
        setBtc(data.bitcoin)
        setEth(data.ethereum)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hazine verisi yuklenemedi')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-surface-2 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
      <p className="text-sm text-red-400 mb-2">{error}</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-surface-3 text-text-secondary text-xs hover:bg-surface-3 transition-all">Yenile</button>
    </div>
  )

  const data = activeAsset === 'btc' ? btc : eth

  return (
    <div className="space-y-2 sm:space-y-4 animate-fade-in">
      {/* Asset Toggle */}
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Kurumsal Kripto Holdingleri</h3>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setActiveAsset('btc')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 border ${activeAsset === 'btc' ? 'bg-gradient-to-r from-amber-500/15 to-amber-600/8 text-amber-300 border-amber-500/35 shadow-sm shadow-amber-500/10 scale-[1.02]' : 'text-text-tertiary border-stroke-subtle hover:text-amber-300/80 hover:border-amber-500/20 hover:shadow-sm hover:shadow-amber-500/5'}`}>
            Bitcoin
          </button>
          <button onClick={() => setActiveAsset('eth')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 border ${activeAsset === 'eth' ? 'bg-gradient-to-r from-blue-500/15 to-blue-600/8 text-blue-300 border-blue-500/35 shadow-sm shadow-blue-500/10 scale-[1.02]' : 'text-text-tertiary border-stroke-subtle hover:text-blue-300/80 hover:border-blue-500/20 hover:shadow-sm hover:shadow-blue-500/5'}`}>
            Ethereum
          </button>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-amber-500/20 hover:shadow-md hover:shadow-amber-500/5 transition-all duration-300">
            <span className="text-[10px] text-text-tertiary uppercase">Toplam Holding</span>
            <div className="text-base font-bold text-white tabular-nums mt-0.5">
              {data.total_holdings?.toLocaleString()} {activeAsset.toUpperCase()}
            </div>
          </div>
          <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
            <span className="text-[10px] text-text-tertiary uppercase">Toplam Deger</span>
            <div className="text-base font-bold text-white tabular-nums mt-0.5">{formatLarge(data.total_value_usd)}</div>
          </div>
          <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
            <span className="text-[10px] text-text-tertiary uppercase">MCap Hakimiyeti</span>
            <div className="text-base font-bold text-white tabular-nums mt-0.5">{data.market_cap_dominance?.toFixed(2)}%</div>
          </div>
        </div>
      )}

      {/* Companies Table */}
      {data?.companies && (
        <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-3 sm:p-4 hover:border-stroke transition-all duration-300">
          <h4 className="text-xs font-bold text-text-tertiary uppercase mb-2 sm:mb-3">Sirketler</h4>

          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {data.companies.map((c) => (
              <div key={`${c.name}-${c.symbol}`} className="p-2 rounded-lg bg-surface-2 border border-stroke-subtle">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{c.name} <span className="text-text-tertiary">({c.symbol})</span></span>
                  <span className="text-[10px] text-text-tertiary">{c.country}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-tertiary">{c.total_holdings?.toLocaleString()} {activeAsset.toUpperCase()}</span>
                  <span className="text-text-tertiary">{formatLarge(c.total_current_value_usd)}</span>
                  <span className={`font-medium ${c.total_current_value_usd >= c.total_entry_value_usd ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c.total_entry_value_usd > 0 ? `${(((c.total_current_value_usd / c.total_entry_value_usd) - 1) * 100).toFixed(0)}%` : '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-text-tertiary uppercase">
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Sirket</th>
                  <th className="px-2 py-2 text-right">Holding</th>
                  <th className="px-2 py-2 text-right">Giris Degeri</th>
                  <th className="px-2 py-2 text-right">Mevcut Deger</th>
                  <th className="px-2 py-2 text-right">K/Z%</th>
                  <th className="px-2 py-2 text-right">Arz%</th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((c, i) => {
                  const pnl = c.total_entry_value_usd > 0 ? ((c.total_current_value_usd / c.total_entry_value_usd) - 1) * 100 : 0
                  return (
                    <tr key={`${c.name}-${c.symbol}`} className="border-b border-white/[0.03] hover:bg-surface-2">
                      <td className="px-2 py-2 text-xs text-text-tertiary">{i + 1}</td>
                      <td className="px-2 py-2">
                        <span className="text-xs font-bold text-white">{c.name}</span>
                        <span className="text-[10px] text-text-tertiary ml-1">({c.symbol})</span>
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-text-secondary tabular-nums">{c.total_holdings?.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right text-xs text-text-tertiary tabular-nums">{formatLarge(c.total_entry_value_usd)}</td>
                      <td className="px-2 py-2 text-right text-xs text-white font-medium tabular-nums">{formatLarge(c.total_current_value_usd)}</td>
                      <td className={`px-2 py-2 text-right text-xs font-medium tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}%
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-text-tertiary tabular-nums">{c.percentage_of_total_supply?.toFixed(3)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
