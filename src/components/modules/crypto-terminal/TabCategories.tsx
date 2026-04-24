'use client'

// HERMES AI CRYPTO TERMINAL — Tab: KATEGORILER
// Crypto categories (DeFi, Layer 1, Meme, Gaming, etc.)

import { useState, useEffect, useMemo } from 'react'
import { PieChart, Search } from 'lucide-react'
import { CoinCategory } from '@/lib/crypto-terminal/coingecko-types'

interface TabCategoriesProps {
  onSelectCoin: (id: string) => void
}

function formatLarge(v: number): string {
  if (!v) return '-'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

export default function TabCategories({ onSelectCoin }: TabCategoriesProps) {
  const [categories, setCategories] = useState<CoinCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/crypto-terminal/categories')
        if (!res.ok) throw new Error('Kategori verisi yuklenemedi')
        const data = await res.json()
        setCategories(data.categories || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return categories
    const q = search.toLowerCase()
    return categories.filter(c => c.name.toLowerCase().includes(q))
  }, [categories, search])

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="h-28 bg-surface-2 rounded-2xl animate-pulse" />
      ))}
    </div>
  )
  if (error) return <div className="text-center py-20 text-text-tertiary">{error}</div>

  return (
    <div className="space-y-2 sm:space-y-3 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PieChart size={16} className="text-info-400" />
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Kripto Kategorileri</h3>
          <span className="text-[10px] text-text-tertiary">{filtered.length}</span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-quaternary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ara..."
            className="w-40 pl-8 pr-3 py-1.5 text-xs bg-surface-3 border border-white/8 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-stroke-gold-strong focus:shadow-md focus:shadow-amber-500/10 transition-all duration-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        {filtered.slice(0, 30).map(cat => {
          const isPos = (cat.market_cap_change_24h ?? 0) >= 0
          return (
            <div key={cat.id} className="group bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 hover:border-stroke hover:shadow-lg hover:shadow-black/20 hover:scale-[1.01] transition-all duration-300">
              <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                  <span className="text-[10px] text-text-quaternary">{formatLarge(cat.market_cap)} Piyasa Deg.</span>
                </div>
                <span className={`text-xs font-medium tabular-nums ${isPos ? 'text-success-400' : 'text-danger-400'}`}>
                  {isPos ? '+' : ''}{(cat.market_cap_change_24h ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                <span>24s Hacim: {formatLarge(cat.volume_24h)}</span>
              </div>
              {cat.top_3_coins && cat.top_3_coins.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {cat.top_3_coins.slice(0, 3).map((img, i) => (
                    <img key={i} src={img} alt="" className="w-4 h-4 rounded-full" loading="lazy" />
                  ))}
                  <span className="text-[9px] text-text-tertiary ml-1">Top 3</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
