'use client'

// HERMES AI CRYPTO TERMINAL — Tab: TUREVLER
// Funding rate heatmap, open interest, derivative exchanges

import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'

interface FundingEntry { rates: number[]; avgRate: number; symbol: string; exchanges: string[] }
interface DerivativeExchange { name: string; id: string; open_interest_btc: number | null; trade_volume_24h_btc: string; number_of_perpetual_pairs: number; number_of_futures_pairs: number; image: string }

export default function TabDerivatives() {
  const [fundingRates, setFundingRates] = useState<FundingEntry[]>([])
  const [exchanges, setExchanges] = useState<DerivativeExchange[]>([])
  const [avgFunding, setAvgFunding] = useState(0)
  const [totalOI, setTotalOI] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/crypto-terminal/derivatives')
        if (!res.ok) throw new Error('Turev verisi yuklenemedi')
        const data = await res.json()
        setFundingRates(data.fundingRates || [])
        setExchanges(data.exchanges || [])
        setAvgFunding(data.avgFundingRate || 0)
        setTotalOI(data.totalOpenInterestBTC || 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Turev verisi yuklenemedi')
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
      <p className="text-sm text-danger-400 mb-2">{error}</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-surface-3 text-text-secondary text-xs hover:bg-surface-3 transition-all">Yenile</button>
    </div>
  )

  return (
    <div className="space-y-2 sm:space-y-4 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-2.5 sm:p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
          <span className="text-[10px] text-text-tertiary uppercase">Toplam OI (BTC)</span>
          <div className="text-base font-bold text-white tabular-nums mt-0.5">{totalOI.toLocaleString()}</div>
        </div>
        <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-success-400/30 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300">
          <span className="text-[10px] text-text-tertiary uppercase">Ort. Funding Rate</span>
          <div className={`text-base font-bold tabular-nums mt-0.5 ${avgFunding >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
            {(avgFunding * 100).toFixed(4)}%
          </div>
        </div>
        <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-2.5 sm:p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
          <span className="text-[10px] text-text-tertiary uppercase">Borsa Sayisi</span>
          <div className="text-base font-bold text-white tabular-nums mt-0.5">{exchanges.length}</div>
        </div>
        <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-2.5 sm:p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
          <span className="text-[10px] text-text-tertiary uppercase">Izlenen Pair</span>
          <div className="text-base font-bold text-white tabular-nums mt-0.5">{fundingRates.length}</div>
        </div>
      </div>

      {/* Funding Rate Heatmap */}
      <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 hover:border-stroke transition-all duration-300">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <Activity size={16} className="text-gold-400" />
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Funding Rate Haritasi</h3>
          <span className="text-[9px] text-text-tertiary ml-auto">Yesil = Short baskisi | Kirmizi = Long baskisi</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
          {fundingRates.slice(0, 50).map(entry => {
            const rate = entry.avgRate * 100
            const absRate = Math.abs(rate)
            const bgColor = rate >= 0.01
              ? 'bg-danger-400'
              : rate >= 0.005
                ? 'bg-danger-400/60'
                : rate >= 0
                  ? 'bg-danger-400/30'
                  : rate >= -0.005
                    ? 'bg-success-400/30'
                    : rate >= -0.01
                      ? 'bg-success-400/60'
                      : 'bg-success-400'
            const intensity = Math.min(1, absRate / 0.03)
            return (
              <div
                key={entry.symbol}
                className={`rounded-lg p-1.5 text-center ${bgColor} hover:ring-1 hover:ring-white/20 transition-all cursor-default`}
                style={{ opacity: 0.4 + intensity * 0.6 }}
                title={`${entry.symbol}: ${rate.toFixed(4)}% (${entry.exchanges.length} borsa)`}
              >
                <div className="text-[9px] font-bold text-white truncate">{entry.symbol}</div>
                <div className="text-[8px] text-text-secondary tabular-nums">{rate.toFixed(3)}%</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Derivative Exchanges */}
      <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 hover:border-stroke transition-all duration-300">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2 sm:mb-3">Turev Borsalari</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-text-tertiary uppercase">
                <th className="px-2 py-2">Borsa</th>
                <th className="px-2 py-2 text-right">OI (BTC)</th>
                <th className="px-2 py-2 text-right">24s Hacim (BTC)</th>
                <th className="px-2 py-2 text-right hidden sm:table-cell">Perpetual</th>
                <th className="px-2 py-2 text-right hidden sm:table-cell">Futures</th>
              </tr>
            </thead>
            <tbody>
              {exchanges.slice(0, 20).map(ex => (
                <tr key={ex.id} className="border-b border-white/[0.03] hover:bg-surface-2">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      {ex.image && <img src={ex.image} alt={ex.name} className="w-4 h-4 rounded-full" loading="lazy" />}
                      <span className="text-xs font-medium text-white">{ex.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-text-secondary tabular-nums">{(ex.open_interest_btc ?? 0).toLocaleString()}</td>
                  <td className="px-2 py-2 text-right text-xs text-text-secondary tabular-nums">{parseFloat(ex.trade_volume_24h_btc || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="px-2 py-2 text-right text-xs text-text-tertiary hidden sm:table-cell">{ex.number_of_perpetual_pairs}</td>
                  <td className="px-2 py-2 text-right text-xs text-text-tertiary hidden sm:table-cell">{ex.number_of_futures_pairs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
