'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { useEuropeTradeContext } from '../EuropeLayout'
import { ScanResult } from '@/lib/types'
import { PriceFlashCell, ScoreMiniBar } from '../premium-ui'
import { EUROPE_EXCHANGES } from '@/lib/europe-config'

type SortField = 'score' | 'symbol' | 'price' | 'change' | 'signal' | 'rsi' | 'mfi' | 'marketCap'
type SortDir = 'asc' | 'desc'
type SignalFilter = 'all' | 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'

const SIGNAL_LABELS: Record<string, string> = {
  strong_long: 'GUCLU ALIS', long: 'ALIS', neutral: 'NOTR', short: 'SATIS', strong_short: 'GUCLU SATIS',
}

function getSignalLabel(signalType: string): string { return SIGNAL_LABELS[signalType] || 'NOTR' }

function getSignalStyle(signalType: string) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    strong_long: { bg: 'bg-blue-400/15', text: 'text-blue-300', border: 'border-blue-400/40' },
    long: { bg: 'bg-hermes-green/15', text: 'text-hermes-green', border: 'border-hermes-green/40' },
    neutral: { bg: 'bg-white/[0.06]', text: 'text-white/60', border: 'border-white/10' },
    short: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/40' },
    strong_short: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/40' },
  }
  return styles[signalType] || styles.neutral
}

function getScoreColor(score: number): string {
  if (score <= 20) return 'text-blue-300'
  if (score <= 30) return 'text-hermes-green'
  if (score < 70) return 'text-white/60'
  if (score < 90) return 'text-orange-400'
  return 'text-red-400'
}

function fmtCap(v: number): string {
  if (!v || !isFinite(v)) return '\u2014'
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`
  return v.toLocaleString()
}

export default function ModuleEuropeTrade() {
  const ctx = useEuropeTradeContext()
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all')
  const [search, setSearch] = useState('')

  const results = ctx.results

  const filtered = useMemo(() => {
    let arr = [...results]
    if (search) {
      const q = search.toLowerCase()
      arr = arr.filter(r => r.symbol.toLowerCase().includes(q))
    }
    if (signalFilter !== 'all') arr = arr.filter(r => r.hermes.signalType === signalFilter)
    arr.sort((a, b) => {
      let aV: number, bV: number
      switch (sortField) {
        case 'score': aV = a.hermes.score ?? 0; bV = b.hermes.score ?? 0; break
        case 'price': aV = a.quote?.price ?? a.hermes.price ?? 0; bV = b.quote?.price ?? b.hermes.price ?? 0; break
        case 'change': aV = a.quote?.changePercent ?? 0; bV = b.quote?.changePercent ?? 0; break
        case 'rsi': aV = a.hermes.indicators.rsi ?? 0; bV = b.hermes.indicators.rsi ?? 0; break
        case 'mfi': aV = a.hermes.indicators.mfi ?? 0; bV = b.hermes.indicators.mfi ?? 0; break
        case 'marketCap': aV = a.quote?.marketCap ?? 0; bV = b.quote?.marketCap ?? 0; break
        default: aV = a.hermes.score ?? 0; bV = b.hermes.score ?? 0
      }
      return sortDir === 'asc' ? aV - bV : bV - aV
    })
    return arr
  }, [results, search, signalFilter, sortField, sortDir])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'score' ? 'asc' : 'desc') }
  }, [sortField])

  const signalCounts = useMemo(() => {
    const c: Record<string, number> = { all: results.length }
    for (const r of results) {
      const st = r.hermes.signalType
      c[st] = (c[st] || 0) + 1
    }
    return c
  }, [results])

  if (ctx.loading && results.length === 0) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="w-16 h-16 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      <p className="text-sm text-white/50 mt-4">Avrupa piyasalari taraniyor...</p>
      <p className="text-xs text-white/30 mt-1">{ctx.progress}</p>
    </div>
  )

  return (
    <div className="max-w-[1920px] mx-auto animate-fade-in space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">🇪🇺</span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">AVRUPA TRADE <span className="text-blue-400 font-extrabold">AI</span></h2>
            <p className="text-[10px] text-white/35">V377 Z-Score Ortalamaya Donus • {results.length} sinyal</p>
          </div>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
          placeholder="Ara..."
          className="w-32 sm:w-40 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/30" />
      </div>

      {/* Signal Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'strong_long', 'long', 'neutral', 'short', 'strong_short'] as const).map(f => {
          const label = f === 'all' ? 'Tumu' : getSignalLabel(f)
          const style = f === 'all' ? { bg: 'bg-white/[0.04]', text: 'text-white/60', border: 'border-white/[0.08]' } : getSignalStyle(f)
          const count = signalCounts[f] || 0
          return (
            <button key={f} onClick={() => setSignalFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                signalFilter === f ? `${style.bg} ${style.text} ${style.border} ring-1 ring-blue-400/15` : 'text-white/35 bg-white/[0.02] border-white/[0.04] hover:border-white/10'
              }`}>
              <span>{label}</span>
              <span className="text-[10px] opacity-60 tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0e0e18] z-10">
              <tr className="border-b border-white/[0.08]">
                <SortTh field="symbol" label="SEMBOL" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortTh field="signal" label="SINYAL" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortTh field="score" label="SKOR" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh field="price" label="FIYAT" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh field="change" label="DEG%" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh field="rsi" label="RSI" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh field="mfi" label="MFI" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh field="marketCap" label="P.DEG" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <th className="px-1 py-2 text-[10px] text-white/40 font-semibold text-left">BORSA</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const signalType = r.hermes.signalType
                const style = getSignalStyle(signalType)
                const exConfig = Object.values(EUROPE_EXCHANGES).find(e => typeof r.symbol === 'string' && e.symbolSuffix && r.symbol.endsWith(e.symbolSuffix))
                const price = r.quote?.price ?? r.hermes.price ?? 0
                const change = r.quote?.changePercent ?? 0
                const rsi = r.hermes.indicators.rsi
                const mfi = r.hermes.indicators.mfi
                const marketCap = r.quote?.marketCap ?? 0
                return (
                  <tr key={r.symbol} className={`border-b border-white/[0.03] hover:bg-blue-500/[0.04] transition-colors ${idx % 2 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="px-2 py-2">
                      <span className="text-sm font-bold text-white">{r.symbol}</span>
                    </td>
                    <td className="px-1 py-2">
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                        {getSignalLabel(signalType)}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <ScoreMiniBar value={r.hermes.score} maxWidth={36} />
                    </td>
                    <td className="px-1 py-2 text-right">
                      <PriceFlashCell price={price} className="text-sm text-white/90 font-medium" />
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-xs tabular-nums font-semibold ${change >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-xs tabular-nums ${(rsi ?? 0) <= 30 ? 'text-hermes-green' : (rsi ?? 0) >= 70 ? 'text-red-400' : 'text-white/50'}`}>
                        {rsi != null ? rsi.toFixed(0) : '\u2014'}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-xs text-white/50 tabular-nums">{mfi != null ? mfi.toFixed(0) : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-xs text-white/50 tabular-nums">{fmtCap(marketCap)}</span>
                    </td>
                    <td className="px-1 py-2">
                      <span className="text-[10px] text-white/40">
                        {exConfig ? `${exConfig.flag} ${exConfig.shortLabel}` : ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-white/35 text-sm">Sinyal bulunamadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-center text-xs text-white/30 py-1">
        {filtered.length} / {results.length} sinyal gosteriliyor
      </div>
    </div>
  )
}

function SortTh({ field, label, current, dir, onSort, align = 'left' }: {
  field: SortField; label: string; current: SortField; dir: SortDir; onSort: (f: SortField) => void; align?: string
}) {
  return (
    <th onClick={() => onSort(field)}
      className={`px-1 py-2 text-[10px] text-white/50 font-semibold cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {label}
      {current === field ? <span className="text-blue-400 ml-0.5">{dir === 'asc' ? '\u25B2' : '\u25BC'}</span> : <span className="text-white/25 ml-0.5">{'\u25BC'}</span>}
    </th>
  )
}
