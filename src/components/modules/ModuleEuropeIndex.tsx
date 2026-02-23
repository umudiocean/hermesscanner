'use client'

import { useMemo } from 'react'
import { useEuropeTradeContext } from '../EuropeLayout'
import { EUROPE_EXCHANGES } from '@/lib/europe-config'
import { TrendingUp, TrendingDown, Activity, Globe } from 'lucide-react'

export default function ModuleEuropeIndex() {
  const ctx = useEuropeTradeContext()
  const { results, fmpStocksMap } = ctx

  const stats = useMemo(() => {
    const total = results.length
    const longs = results.filter(r => r.hermes?.signalType === 'strong_long' || r.hermes?.signalType === 'long').length
    const shorts = results.filter(r => r.hermes?.signalType === 'strong_short' || r.hermes?.signalType === 'short').length
    const neutral = total - longs - shorts
    const avgScore = total > 0 ? results.reduce((s, r) => s + (r.hermes?.score ?? 50), 0) / total : 50

    const exchangeStats = Object.values(EUROPE_EXCHANGES).map(ex => {
      const suffix = ex.symbolSuffix
      const exResults = results.filter(r => typeof r.symbol === 'string' && suffix && r.symbol.endsWith(suffix))
      const exLongs = exResults.filter(r => r.hermes?.signalType === 'strong_long' || r.hermes?.signalType === 'long').length
      return {
        id: ex.id, flag: ex.flag, label: ex.shortLabel,
        total: exResults.length, longs: exLongs,
        ratio: exResults.length > 0 ? exLongs / exResults.length : 0,
      }
    }).filter(e => e.total > 0)

    const topMovers = [...results]
      .sort((a, b) => Math.abs(b.quote?.changePercent ?? 0) - Math.abs(a.quote?.changePercent ?? 0))
      .slice(0, 10)

    return { total, longs, shorts, neutral, avgScore, exchangeStats, topMovers }
  }, [results])

  const fmpStats = useMemo(() => {
    const entries = Array.from(fmpStocksMap.values())
    const strong = entries.filter(e => e.signal === 'STRONG' || e.signal === 'GOOD').length
    const weak = entries.filter(e => e.signal === 'WEAK' || e.signal === 'BAD').length
    return { total: entries.length, strong, weak, neutral: entries.length - strong - weak }
  }, [fmpStocksMap])

  const pulseScore = useMemo(() => {
    if (stats.total === 0) return 50
    const longRatio = stats.longs / Math.max(stats.total, 1)
    const fmpRatio = fmpStats.total > 0 ? fmpStats.strong / fmpStats.total : 0.5
    return Math.round(longRatio * 50 + fmpRatio * 50)
  }, [stats, fmpStats])

  return (
    <div className="max-w-[1920px] mx-auto animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center">
          <span className="text-xl">🇪🇺</span>
        </div>
        <div>
          <h2 className="text-sm sm:text-lg font-bold text-white">HERMES <span className="text-blue-400 font-extrabold">AVRUPA ENDEKS</span></h2>
          <p className="text-[10px] text-white/35">Avrupa Piyasa Nabzi • 8 Borsa</p>
        </div>
      </div>

      {/* Pulse Score */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-white/40 font-semibold tracking-wider">AVRUPA PIYASA NABZI</div>
            <div className={`text-4xl font-bold tabular-nums mt-1 ${
              pulseScore >= 65 ? 'text-hermes-green' : pulseScore >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>{pulseScore}</div>
            <div className={`text-sm font-medium ${
              pulseScore >= 65 ? 'text-hermes-green' : pulseScore >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>{pulseScore >= 65 ? 'YUKSELIS' : pulseScore >= 40 ? 'NOTR' : 'DUSUS'}</div>
          </div>
          <Activity size={40} className="text-blue-400/30" />
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000" style={{
            width: `${pulseScore}%`,
            background: pulseScore >= 65 ? 'linear-gradient(90deg, #059669, #62cbc1)' : pulseScore >= 40 ? 'linear-gradient(90deg, #d97706, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #f87171)',
          }} />
        </div>
      </div>

      {/* Signal Distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#151520] rounded-xl border border-hermes-green/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-hermes-green" />
            <span className="text-xs text-hermes-green font-semibold">ALIS SINYALLERI</span>
          </div>
          <div className="text-2xl font-bold text-hermes-green tabular-nums">{stats.longs}</div>
          <div className="text-[10px] text-white/30 mt-1">toplamin %{stats.total > 0 ? ((stats.longs / stats.total) * 100).toFixed(1) : 0}</div>
        </div>
        <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-white/40" />
            <span className="text-xs text-white/40 font-semibold">NOTR</span>
          </div>
          <div className="text-2xl font-bold text-white/60 tabular-nums">{stats.neutral}</div>
          <div className="text-[10px] text-white/30 mt-1">toplamin %{stats.total > 0 ? ((stats.neutral / stats.total) * 100).toFixed(1) : 0}</div>
        </div>
        <div className="bg-[#151520] rounded-xl border border-red-500/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-xs text-red-400 font-semibold">SATIS SINYALLERI</span>
          </div>
          <div className="text-2xl font-bold text-red-400 tabular-nums">{stats.shorts}</div>
          <div className="text-[10px] text-white/30 mt-1">toplamin %{stats.total > 0 ? ((stats.shorts / stats.total) * 100).toFixed(1) : 0}</div>
        </div>
      </div>

      {/* Exchange Breakdown */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-4">
        <div className="text-xs text-white/40 font-semibold tracking-wider mb-3">BORSA DAGILIMI</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.exchangeStats.map(ex => (
            <div key={ex.id} className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{ex.flag}</span>
                <span className="text-[11px] text-white/60 font-semibold">{ex.label}</span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums">{ex.total}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-hermes-green/60 rounded-full" style={{ width: `${ex.ratio * 100}%` }} />
                </div>
                <span className="text-[9px] text-white/40 tabular-nums">{ex.longs}L</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Movers */}
      {stats.topMovers.length > 0 && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-4">
          <div className="text-xs text-white/40 font-semibold tracking-wider mb-3">EN COK HAREKET EDENLER</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {stats.topMovers.map(r => {
              const changePct = r.quote?.changePercent ?? 0
              return (
                <div key={r.symbol} className="bg-white/[0.02] rounded-lg border border-white/[0.05] p-2.5">
                  <div className="text-sm font-bold text-white">{r.symbol}</div>
                  <div className={`flex items-center gap-1 mt-0.5 text-sm font-semibold tabular-nums ${changePct >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                    {changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
