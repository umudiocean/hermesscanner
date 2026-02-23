'use client'

// HERMES AI CRYPTO TERMINAL — Tab: KARSILASTIR
// Compare up to 4 coins side by side

import { useState, useEffect, useRef, useMemo } from 'react'
import { GitCompare, X } from 'lucide-react'
import type { CoinDetail, CryptoScore, CryptoScoreBreakdown } from '@/lib/crypto-terminal/coingecko-types'
// HERMES_FIX: CLIENT_BUNDLE_WEIGHTS 2026-02-19 — Removed CRYPTO_SCORE_WEIGHTS import (proprietary IP)
import { getCryptoScoreColor, CRYPTO_CATEGORY_LABELS, CRYPTO_CATEGORY_KEYS } from '@/lib/crypto-terminal/coingecko-types'

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

function CoinSearchInput({ onAdd, existingIds, placeholder }: {
  onAdd: (coinId: string) => void
  existingIds: string[]
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ id: string; symbol: string; name: string }>>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [allCoins, setAllCoins] = useState<Array<{ id: string; symbol: string; name: string }>>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/crypto-terminal/search?q=_init')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.coins) {
          setAllCoins(data.coins.slice(0, 500).map((c: { id: string; symbol: string; name: string }) => ({
            id: c.id, symbol: c.symbol, name: c.name,
          })))
        }
      })
      .catch(() => {})

    fetch('/api/crypto-terminal/coins?page=1&per_page=250')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.coins) {
          setAllCoins(prev => {
            const existingIds = new Set(prev.map(c => c.id))
            const newCoins = data.coins
              .filter((c: { id: string }) => !existingIds.has(c.id))
              .map((c: { id: string; symbol: string; name: string }) => ({
                id: c.id, symbol: c.symbol, name: c.name,
              }))
            return [...prev, ...newCoins]
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!input.trim()) return []
    const q = input.toLowerCase()
    return allCoins
      .filter(c => !existingIds.includes(c.id))
      .filter(c => c.id.includes(q) || c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [input, allCoins, existingIds])

  useEffect(() => {
    setSuggestions(filtered)
    setSelectedIdx(-1)
    setShowDropdown(filtered.length > 0 && input.trim().length > 0)
  }, [filtered, input])

  const handleSelect = (coinId: string) => {
    onAdd(coinId)
    setInput('')
    setShowDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        handleSelect(suggestions[selectedIdx].id)
      } else if (input.trim()) {
        handleSelect(input.trim().toLowerCase())
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Orn: bitcoin, ethereum...'}
          className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40 focus:shadow-md focus:shadow-amber-500/10 transition-all duration-300 w-64"
        />
        <button
          onClick={() => { if (input.trim()) { handleSelect(input.trim().toLowerCase()) } }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-400 hover:to-orange-400 hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300"
        >
          Ekle
        </button>
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-y-auto bg-[#151520] border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-50">
          {suggestions.map((c, i) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                i === selectedIdx ? 'bg-amber-500/10 text-white' : 'text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <span className="font-mono font-bold text-xs w-12 uppercase">{c.symbol}</span>
              <span className="text-[11px] text-white/50 truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TabCompare({ coinIds, onRemoveCoin, onSelectCoin }: TabCompareProps) {
  const [coinsData, setCoinsData] = useState<Map<string, CoinCompareData>>(new Map())
  const [loading, setLoading] = useState(false)

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
        <p className="text-white/50 text-sm mb-6">Coin ismi veya sembol yazin (max 4 coin)</p>
        <CoinSearchInput onAdd={onSelectCoin} existingIds={coinIds} />
      </div>
    )
  }

  const coins = coinIds.map(id => ({ id, data: coinsData.get(id) }))

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Coin Karsilastirma</h3>
        </div>
        {coinIds.length < 4 && (
          <CoinSearchInput onAdd={onSelectCoin} existingIds={coinIds} placeholder="+ Coin ekle" />
        )}
      </div>

      {/* Coin pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {coinIds.map(id => (
          <div key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
            <span className="text-xs font-medium text-white">{id}</span>
            <button onClick={() => onRemoveCoin(id)} className="text-white/40 hover:text-red-400 transition-colors text-xs ml-1">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-white/40">
            <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            <span>Coin verileri yukleniyor...</span>
          </div>
        </div>
      )}

      <div className={`grid gap-2 sm:gap-3 ${coins.length === 1 ? 'grid-cols-1' : coins.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : coins.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        {coins.map(({ id, data }) => {
          if (!data) {
            return (
              <div key={id} className="bg-[#151520] rounded-2xl border border-white/[0.06] p-4">
                <div className="h-40 flex flex-col items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                      <span className="text-[10px] text-white/40">{id} yukleniyor...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-white/40">{id}</span>
                      <span className="text-[10px] text-red-400/50">Veri yuklenemedi</span>
                    </>
                  )}
                </div>
              </div>
            )
          }
          const { detail, score } = data
          const md = detail.market_data
          const price = md?.current_price?.usd ?? 0
          return (
            <div key={id} className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 relative hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 transition-all duration-300">
              <button onClick={() => onRemoveCoin(id)} className="absolute top-2 right-2 p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/60">
                <X size={14} />
              </button>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                {detail.image?.small && <img src={detail.image.small} alt={detail.symbol} className="w-8 h-8 rounded-full" />}
                <div>
                  <div className="text-sm font-bold text-white">{detail.name}</div>
                  <div className="text-[10px] text-white/40">{detail.symbol?.toUpperCase()} #{md?.market_cap_rank}</div>
                </div>
              </div>
              <div className="text-base sm:text-lg font-bold text-white tabular-nums mb-1">{formatPrice(price)}</div>
              <div className={`text-xs font-medium mb-2 sm:mb-3 ${(md?.price_change_percentage_24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(md?.price_change_percentage_24h ?? 0) >= 0 ? '+' : ''}{(md?.price_change_percentage_24h ?? 0).toFixed(2)}%
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-white/40">MCap</span><span className="text-white/60">{formatLarge(md?.market_cap?.usd ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Hacim</span><span className="text-white/60">{formatLarge(md?.total_volume?.usd ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">FDV</span><span className="text-white/60">{formatLarge(md?.fully_diluted_valuation?.usd ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">7g</span><span className={`font-medium ${(md?.price_change_percentage_7d ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(md?.price_change_percentage_7d ?? 0).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-white/40">30g</span><span className={`font-medium ${(md?.price_change_percentage_30d ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(md?.price_change_percentage_30d ?? 0).toFixed(2)}%</span></div>
              </div>
              {score && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-white/40">HERMES AI Skor</span>
                    <span className={`text-sm font-bold ${getCryptoScoreColor(score.level)}`}>{score.total}</span>
                  </div>
                  <div className="space-y-1">
                    {CRYPTO_CATEGORY_KEYS
                      .slice()
                      .sort((a, b) => (score.categories[b] ?? 0) - (score.categories[a] ?? 0))
                      .map(key => {
                      const val = score.categories[key]
                      const color = val >= 70 ? 'bg-emerald-400' : val >= 50 ? 'bg-amber-400' : val >= 30 ? 'bg-orange-400' : 'bg-red-400'
                      return (
                        <div key={key} className="flex items-center gap-1">
                          <span className="w-12 text-[8px] text-white/35 truncate">{CRYPTO_CATEGORY_LABELS[key]}</span>
                          <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, val)}%` }} />
                          </div>
                          <span className="w-5 text-[8px] text-right text-white/40">{Math.round(val)}</span>
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
