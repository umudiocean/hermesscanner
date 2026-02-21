'use client'

// HERMES AI CRYPTO TERMINAL — Tab: KARSILASTIR
// Compare up to 4 coins side by side

import { useState, useEffect } from 'react'
import { GitCompare, X } from 'lucide-react'
import type { CoinDetail, CryptoScore, CryptoScoreBreakdown } from '@/lib/crypto-terminal/coingecko-types'
import { getCryptoScoreColor, CRYPTO_CATEGORY_LABELS, CRYPTO_SCORE_WEIGHTS } from '@/lib/crypto-terminal/coingecko-types'

interface TabCompareProps {
  coinIds: string[]
  onRemoveCoin: (id: string) => void
  onSelectCoin: (id: string) => void
}

interface CoinCompareData {
  detail: CoinDetail
  score: CryptoScore | null
}

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  return `$${p.toFixed(6)}`
}

function formatLarge(v: number): string {
  if (!v) return '-'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

export default function TabCompare({ coinIds, onRemoveCoin, onSelectCoin }: TabCompareProps) {
  const [coinsData, setCoinsData] = useState<Map<string, CoinCompareData>>(new Map())
  const [loading, setLoading] = useState(false)
  const [addInput, setAddInput] = useState('')

  useEffect(() => {
    if (coinIds.length === 0) return
    let cancelled = false

    async function loadAll() {
      const idsToFetch = coinIds.filter(id => !coinsData.has(id))
      if (idsToFetch.length === 0) return

      setLoading(true)
      try {
        const results = await Promise.allSettled(
          idsToFetch.map(async id => {
            const res = await fetch(`/api/crypto-terminal/coin/${id}`)
            if (res.ok) {
              const data = await res.json()
              return { id, detail: data.detail, score: data.score } as { id: string; detail: CoinDetail; score: CryptoScore | null }
            }
            return null
          })
        )
        if (cancelled) return
        setCoinsData(current => {
          const updated = new Map(current)
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
              updated.set(r.value.id, { detail: r.value.detail, score: r.value.score })
            }
          }
          return updated
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAll()

    return () => { cancelled = true }
  }, [coinIds]) // eslint-disable-line react-hooks/exhaustive-deps

  if (coinIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <GitCompare size={48} className="text-white/10 mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Coin Karsilastir</h3>
        <p className="text-white/40 text-sm mb-6">COINLER sekmesindeki coinleri karsilastirmaya ekleyin</p>
        <div className="flex items-center gap-2">
          <input type="text" value={addInput} onChange={e => setAddInput(e.target.value.toLowerCase())}
            onKeyDown={e => { if (e.key === 'Enter' && addInput) { onSelectCoin(addInput); setAddInput('') } }}
            placeholder="Orn: bitcoin, ethereum..." className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40 focus:shadow-md focus:shadow-amber-500/10 transition-all duration-300 w-64" />
          <button onClick={() => { if (addInput) { onSelectCoin(addInput); setAddInput('') } }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-400 hover:to-orange-400 hover:shadow-lg hover:shadow-amber-500/25 hover:scale-[1.03] transition-all duration-300">Ekle</button>
        </div>
      </div>
    )
  }

  const coins = coinIds.map(id => ({ id, data: coinsData.get(id) })).filter(c => c.data)

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Coin Karsilastirma</h3>
        </div>
        {coinIds.length < 4 && (
          <div className="flex items-center gap-1">
            <input type="text" value={addInput} onChange={e => setAddInput(e.target.value.toLowerCase())}
              onKeyDown={e => { if (e.key === 'Enter' && addInput) { onSelectCoin(addInput); setAddInput('') } }}
              placeholder="Coin ekle..." className="w-32 px-2 py-1 text-xs bg-white/[0.04] border border-white/8 rounded-lg text-white placeholder-white/25 focus:outline-none" />
          </div>
        )}
      </div>

      {loading && <div className="text-center py-8 text-white/30">Yukleniyor...</div>}

      <div className={`grid gap-2 sm:gap-3 ${coins.length === 1 ? 'grid-cols-1' : coins.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : coins.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        {coins.map(({ id, data }) => {
          if (!data) return null
          const { detail, score } = data
          const md = detail.market_data
          const price = md?.current_price?.usd ?? 0
          return (
            <div key={id} className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 relative hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 transition-all duration-300">
              <button onClick={() => onRemoveCoin(id)} className="absolute top-2 right-2 p-1 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60">
                <X size={14} />
              </button>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                {detail.image?.small && <img src={detail.image.small} alt={detail.symbol} className="w-8 h-8 rounded-full" />}
                <div>
                  <div className="text-sm font-bold text-white">{detail.name}</div>
                  <div className="text-[10px] text-white/30">{detail.symbol?.toUpperCase()} #{md?.market_cap_rank}</div>
                </div>
              </div>
              <div className="text-base sm:text-lg font-bold text-white tabular-nums mb-1">{formatPrice(price)}</div>
              <div className={`text-xs font-medium mb-2 sm:mb-3 ${(md?.price_change_percentage_24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(md?.price_change_percentage_24h ?? 0) >= 0 ? '+' : ''}{(md?.price_change_percentage_24h ?? 0).toFixed(2)}%
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-white/30">MCap</span><span className="text-white/60">{formatLarge(md?.market_cap?.usd ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-white/30">Hacim</span><span className="text-white/60">{formatLarge(md?.total_volume?.usd ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-white/30">FDV</span><span className="text-white/60">{formatLarge(md?.fully_diluted_valuation?.usd ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-white/30">7g</span><span className={`font-medium ${(md?.price_change_percentage_7d ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(md?.price_change_percentage_7d ?? 0).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-white/30">30g</span><span className={`font-medium ${(md?.price_change_percentage_30d ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(md?.price_change_percentage_30d ?? 0).toFixed(2)}%</span></div>
              </div>
              {score && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-white/30">HERMES AI Skor</span>
                    <span className={`text-sm font-bold ${getCryptoScoreColor(score.level)}`}>{score.total}</span>
                  </div>
                  <div className="space-y-1">
                    {(Object.keys(CRYPTO_SCORE_WEIGHTS) as (keyof CryptoScoreBreakdown)[])
                      .slice()
                      .sort((a, b) => (score.categories[b] ?? 0) - (score.categories[a] ?? 0))
                      .map(key => {
                      const val = score.categories[key]
                      const color = val >= 70 ? 'bg-emerald-400' : val >= 50 ? 'bg-amber-400' : val >= 30 ? 'bg-orange-400' : 'bg-red-400'
                      return (
                        <div key={key} className="flex items-center gap-1">
                          <span className="w-12 text-[8px] text-white/25 truncate">{CRYPTO_CATEGORY_LABELS[key]}</span>
                          <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, val)}%` }} />
                          </div>
                          <span className="w-5 text-[8px] text-right text-white/30">{Math.round(val)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
