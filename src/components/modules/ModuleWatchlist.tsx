'use client'

import { useState, useMemo } from 'react'
import { useScanContext } from '../Layout'
import { ScanResult } from '@/lib/types'

// ═══════════════════════════════════════════════════════════════════
// WATCHLIST Module - Favori hisseler
// ═══════════════════════════════════════════════════════════════════

function getSignalStyle(signalType: string) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    strong_long: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
    long: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50' },
    neutral: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/50' },
    short: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
    strong_short: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  }
  return styles[signalType] || styles.neutral
}

function getScoreColor(score: number): string {
  if (score <= 20) return 'text-yellow-400'
  if (score <= 40) return 'text-emerald-400'
  if (score < 60) return 'text-slate-300'
  if (score < 80) return 'text-orange-400'
  return 'text-red-400'
}

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
  return `${mc.toFixed(0)}`
}

function WatchlistCard({ result, onRemove }: { result: ScanResult; onRemove: () => void }) {
  const { hermes, quote, symbol, segment } = result
  const style = getSignalStyle(hermes.signalType)
  const changePercent = quote?.changePercent || 0

  return (
    <div className="bg-[#0D0D14] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg text-white">{symbol}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/70">{segment}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/70 font-mono">${quote?.price?.toFixed(2) || hermes.price.toFixed(2)}</span>
            <span className={`text-sm font-mono ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
          title="Watchlist'ten çıkar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`text-3xl font-bold font-mono ${getScoreColor(hermes.score)}`}>
          {Math.round(hermes.score)}
        </div>
        <div className="flex-1">
          <div className="relative w-full h-2 rounded-full bg-gradient-to-r from-yellow-500 via-slate-500 to-red-500 opacity-30">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-white/50"
              style={{ left: `calc(${Math.min(100, Math.max(0, hermes.score))}% - 6px)` }}
            />
          </div>
        </div>
      </div>

      {/* Signal Badge */}
      <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold border ${style.bg} ${style.text} ${style.border} mb-3`}>
        {hermes.signal}
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-white/70 mb-0.5">RSI</div>
          <div className={`font-mono font-semibold ${hermes.indicators.rsi > 70 ? 'text-red-400' : hermes.indicators.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>
            {Math.round(hermes.indicators.rsi)}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-white/70 mb-0.5">MFI</div>
          <div className={`font-mono font-semibold ${hermes.indicators.mfi > 80 ? 'text-red-400' : hermes.indicators.mfi < 20 ? 'text-emerald-400' : 'text-white'}`}>
            {Math.round(hermes.indicators.mfi)}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-white/70 mb-0.5">MktCap</div>
          <div className="font-mono font-semibold text-white">
            {formatMarketCap(quote?.marketCap || 0)}
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <span className="text-white/70">52W:</span>
            <span className={getScoreColor(hermes.components.point52w)}>{Math.round(hermes.components.point52w)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/70">Z:</span>
            <span className="text-white/80">{hermes.zscores.zscore52w.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/70">Kalite:</span>
            <span className={hermes.multipliers.quality > 0.9 ? 'text-emerald-400' : hermes.multipliers.quality < 0.7 ? 'text-red-400' : 'text-yellow-400'}>
              {hermes.multipliers.quality.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ModuleWatchlist() {
  const { results, watchlist, toggleWatchlistItem } = useScanContext()
  const [sortBy, setSortBy] = useState<'symbol' | 'score' | 'change'>('score')

  const watchlistResults = useMemo(() => {
    const filtered = results.filter(r => watchlist.includes(r.symbol))
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'symbol': return a.symbol.localeCompare(b.symbol)
        case 'score': return a.hermes.score - b.hermes.score
        case 'change': return (b.quote?.changePercent || 0) - (a.quote?.changePercent || 0)
        default: return 0
      }
    })
  }, [results, watchlist, sortBy])

  const signalCounts = useMemo(() => ({
    strong_long: watchlistResults.filter(r => r.hermes.signalType === 'strong_long').length,
    long: watchlistResults.filter(r => r.hermes.signalType === 'long').length,
    neutral: watchlistResults.filter(r => r.hermes.signalType === 'neutral').length,
    short: watchlistResults.filter(r => r.hermes.signalType === 'short').length,
    strong_short: watchlistResults.filter(r => r.hermes.signalType === 'strong_short').length,
  }), [watchlistResults])

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">⭐</span>
            Watchlist
          </h2>
          <p className="text-white/70 text-sm mt-1">
            {watchlist.length} hisse takip ediliyor
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Signal Summary */}
          <div className="flex items-center gap-2 text-xs">
            {signalCounts.strong_long > 0 && (
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {signalCounts.strong_long} Strong Long
              </span>
            )}
            {signalCounts.long > 0 && (
              <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {signalCounts.long} Long
              </span>
            )}
            {signalCounts.short > 0 && (
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {signalCounts.short} Short
              </span>
            )}
            {signalCounts.strong_short > 0 && (
              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                {signalCounts.strong_short} Strong Short
              </span>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/20"
          >
            <option value="score">Skora Göre</option>
            <option value="symbol">Sembole Göre</option>
            <option value="change">Değişime Göre</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {watchlistResults.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⭐</div>
          <h3 className="text-xl font-semibold text-white mb-2">Watchlist Boş</h3>
          <p className="text-white/70 max-w-md mx-auto">
            Hisseleri takip etmek için 52 HAFTA modülünde hisse satırlarının solundaki yıldız ikonuna tıklayın.
          </p>
        </div>
      )}

      {/* Cards Grid */}
      {watchlistResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {watchlistResults.map(result => (
            <WatchlistCard
              key={result.symbol}
              result={result}
              onRemove={() => toggleWatchlistItem(result.symbol)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
