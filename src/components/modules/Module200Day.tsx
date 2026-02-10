'use client'

import { useState, useMemo } from 'react'
import { useScan200DContext } from '../Layout'
import { Scan200DResult } from '@/lib/types'

// ═══════════════════════════════════════════════════════════════════
// 5 GÜN Module - 15dk Timeframe Tarama Ekranı
// 5G VWAP (130 bar) + Z-Score LB=12D (312 bar)
// PF 1.15 | WR 95.7% | 3,018 trade | +$5,549
// ═══════════════════════════════════════════════════════════════════

type SortField = 'score' | 'symbol' | 'price' | 'change' | 'rsi' | 'mfi' | 'marketCap'
type SortDir = 'asc' | 'desc'
type SignalFilter = 'all' | 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'
type SegmentFilter = 'ALL' | 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO'

const SEGMENTS = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO'] as const

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
  if (score <= 15) return 'text-yellow-400'
  if (score <= 40) return 'text-emerald-400'
  if (score < 60) return 'text-slate-300'
  if (score < 85) return 'text-orange-400'
  return 'text-red-400'
}

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
  return `${mc.toFixed(0)}`
}

function exportToCSV(results: Scan200DResult[], filename: string) {
  const headers = ['Symbol', 'Segment', 'Price', 'Change%', 'Score', 'Signal', 'RSI', 'MFI', 'ADX', 'Quality', 'MarketCap']
  const rows = results.map(r => [
    r.symbol, r.segment, r.quote?.price?.toFixed(2) || r.hermes.price.toFixed(2),
    r.quote?.changePercent?.toFixed(2) || '0', r.hermes.score.toFixed(1), r.hermes.signal,
    r.hermes.indicators.rsi.toFixed(1), r.hermes.indicators.mfi.toFixed(1),
    r.hermes.indicators.adx.toFixed(1), r.hermes.multipliers.quality.toFixed(2),
    r.quote?.marketCap || 0,
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative w-16 h-1.5 rounded-full bg-gradient-to-r from-yellow-500 via-slate-500 to-red-500 opacity-40">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg"
        style={{ left: `calc(${Math.min(100, Math.max(0, score))}% - 4px)` }}
      />
    </div>
  )
}

function FilterButton({ active, onClick, children, count, variant = 'default' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count?: number
  variant?: 'default' | 'yellow' | 'green' | 'gray' | 'orange' | 'red'
}) {
  const variants: Record<string, string> = {
    default: active ? 'bg-white/10 border-white/30 text-white' : 'bg-transparent border-white/10 text-white/50 hover:text-white/80',
    yellow: active ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-transparent border-yellow-500/20 text-yellow-500/50 hover:text-yellow-400',
    green: active ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-transparent border-emerald-500/20 text-emerald-500/50 hover:text-emerald-400',
    gray: active ? 'bg-slate-500/20 border-slate-500/50 text-slate-300' : 'bg-transparent border-slate-500/20 text-slate-500/50 hover:text-slate-400',
    orange: active ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-transparent border-orange-500/20 text-orange-500/50 hover:text-orange-400',
    red: active ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-transparent border-red-500/20 text-red-500/50 hover:text-red-400',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${variants[variant]}`}>
      {children}
      {count !== undefined && <span className="opacity-60">({count})</span>}
    </button>
  )
}

function StockRow({ result, expanded, onToggle, onWatchlistToggle, inWatchlist }: {
  result: Scan200DResult; expanded: boolean; onToggle: () => void
  onWatchlistToggle: () => void; inWatchlist: boolean
}) {
  const { hermes, quote, symbol, segment } = result
  const style = getSignalStyle(hermes.signalType)

  return (
    <>
      <tr className="border-b border-white/5 cursor-pointer transition-all hover:bg-white/[0.02] group">
        <td className="px-2 py-3 w-10">
          <button
            onClick={(e) => { e.stopPropagation(); onWatchlistToggle() }}
            className={`p-1 rounded transition-all ${inWatchlist ? 'text-yellow-400' : 'text-white/50 hover:text-white/50'}`}
          >
            {inWatchlist ? '\u2605' : '\u2606'}
          </button>
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-white">{symbol}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/70">{segment}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-right" onClick={onToggle}>
          <span className="font-mono text-white/90">${quote?.price?.toFixed(2) || hermes.price.toFixed(2)}</span>
        </td>
        <td className={`px-3 py-3 text-right font-mono ${(quote?.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`} onClick={onToggle}>
          {quote?.changePercent ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : '-'}
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className={`font-mono font-bold text-lg w-8 ${getScoreColor(hermes.score)}`}>{Math.round(hermes.score)}</span>
            <ScoreBar score={hermes.score} />
          </div>
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
            {hermes.signal}
          </span>
        </td>
        <td className="px-3 py-3 text-right hidden md:table-cell" onClick={onToggle}>
          <span className={`font-mono ${hermes.indicators.rsi > 70 ? 'text-red-400' : hermes.indicators.rsi < 30 ? 'text-emerald-400' : 'text-white/70'}`}>
            {Math.round(hermes.indicators.rsi)}
          </span>
        </td>
        <td className="px-3 py-3 text-right hidden md:table-cell" onClick={onToggle}>
          <span className={`font-mono ${hermes.indicators.mfi > 80 ? 'text-red-400' : hermes.indicators.mfi < 20 ? 'text-emerald-400' : 'text-white/70'}`}>
            {Math.round(hermes.indicators.mfi)}
          </span>
        </td>
        <td className="px-3 py-3 text-right hidden lg:table-cell" onClick={onToggle}>
          <span className="font-mono text-white/50">{formatMarketCap(quote?.marketCap || 0)}</span>
        </td>
        <td className="px-3 py-3 text-center hidden lg:table-cell" onClick={onToggle}>
          <span className={`text-xs ${hermes.multipliers.quality > 0.9 ? 'text-emerald-400' : hermes.multipliers.quality < 0.7 ? 'text-red-400' : 'text-yellow-400'}`}>
            {hermes.multipliers.quality.toFixed(2)}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/5 bg-white/[0.01]">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
              <DetailBlock title="Bilesenler" items={[
                { label: '5G Z-Score (70%)', value: hermes.components.point200d.toFixed(1), color: getScoreColor(hermes.components.point200d) },
                { label: 'MFI (15%)', value: hermes.components.pointMfi.toFixed(1), color: getScoreColor(hermes.components.pointMfi) },
                { label: 'RSI (15%)', value: hermes.components.pointRsi.toFixed(1), color: getScoreColor(hermes.components.pointRsi) },
              ]} />
              <DetailBlock title="Carpanlar" items={[
                { label: 'ATR', value: `x${hermes.multipliers.atrCarpan.toFixed(2)}` },
                { label: 'ADX', value: `x${hermes.multipliers.adxCarpan.toFixed(2)}` },
                { label: 'Kalite', value: `x${hermes.multipliers.quality.toFixed(2)}` },
                { label: 'Raw', value: hermes.rawScore.toFixed(1) },
              ]} />
              <DetailBlock title="Gostergeler" items={[
                { label: 'RSI', value: hermes.indicators.rsi.toFixed(1) },
                { label: 'MFI', value: hermes.indicators.mfi.toFixed(1) },
                { label: 'ADX', value: hermes.indicators.adx.toFixed(1) },
                { label: 'Vol Ratio', value: hermes.indicators.volRatio.toFixed(2) },
              ]} />
              <DetailBlock title="Z-Score" items={[
                { label: '5G Z-Score', value: hermes.zscores.zscore200d.toFixed(2) },
              ]} />
              <DetailBlock title="5G Z-Score Bantlar" items={[
                { label: 'VWAP', value: `$${hermes.bands.vwap200d.toFixed(2)}` },
                { label: 'Ic Ust (Z+1)', value: `$${hermes.bands.upper200d.toFixed(2)}` },
                { label: 'Ic Alt (Z-1)', value: `$${hermes.bands.lower200d.toFixed(2)}` },
                { label: 'Dis Ust (Z+2)', value: `$${hermes.bands.upper50d.toFixed(2)}` },
                { label: 'Dis Alt (Z-2)', value: `$${hermes.bands.lower50d.toFixed(2)}` },
              ]} />
              <DetailBlock title="Veri" items={[
                { label: 'Bar', value: hermes.dataPoints.toString() },
                { label: 'MktCap', value: formatMarketCap(quote?.marketCap || 0) },
                { label: 'Durum', value: hermes.hasEnough200d ? 'TAM' : 'AZ', color: hermes.hasEnough200d ? 'text-emerald-400' : 'text-orange-400' },
              ]} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DetailBlock({ title, items }: { title: string; items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="space-y-2">
      <div className="text-white/70 font-semibold uppercase tracking-wide text-[10px]">{title}</div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex justify-between">
            <span className="text-white/50">{item.label}</span>
            <span className={item.color || 'text-white/80'}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Module200Day() {
  const { results, loading, error, toggleWatchlistItem, isInWatchlist } = useScan200DContext()

  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const filteredResults = useMemo(() => {
    return results
      .filter(r => signalFilter === 'all' || r.hermes.signalType === signalFilter)
      .filter(r => segmentFilter === 'ALL' || r.segment === segmentFilter)
      .filter(r => !searchQuery || r.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        let aVal: number, bVal: number
        switch (sortField) {
          case 'score': aVal = a.hermes.score; bVal = b.hermes.score; break
          case 'symbol': return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
          case 'price': aVal = a.quote?.price || a.hermes.price; bVal = b.quote?.price || b.hermes.price; break
          case 'change': aVal = a.quote?.changePercent || 0; bVal = b.quote?.changePercent || 0; break
          case 'rsi': aVal = a.hermes.indicators.rsi; bVal = b.hermes.indicators.rsi; break
          case 'mfi': aVal = a.hermes.indicators.mfi; bVal = b.hermes.indicators.mfi; break
          case 'marketCap': aVal = a.quote?.marketCap || 0; bVal = b.quote?.marketCap || 0; break
          default: aVal = a.hermes.score; bVal = b.hermes.score
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      })
  }, [results, signalFilter, segmentFilter, searchQuery, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'score' ? 'asc' : 'desc') }
  }

  const signalCounts = useMemo(() => ({
    strong_long: results.filter(r => r.hermes.signalType === 'strong_long').length,
    long: results.filter(r => r.hermes.signalType === 'long').length,
    neutral: results.filter(r => r.hermes.signalType === 'neutral').length,
    short: results.filter(r => r.hermes.signalType === 'short').length,
    strong_short: results.filter(r => r.hermes.signalType === 'strong_short').length,
  }), [results])

  const getSegmentCount = (seg: SegmentFilter) => {
    const base = results.filter(r => signalFilter === 'all' || r.hermes.signalType === signalFilter)
    return seg === 'ALL' ? base.length : base.filter(r => r.segment === seg).length
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-white/50 ml-1">{'\u2195'}</span>
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-4">
      {/* Module Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">15dk Timeframe</span>
        <span className="text-xs text-white/70">5G VWAP + Z-Score Kanal | PF 1.15 | 70/15/15 | 20/80</span>
      </div>

      {/* Filters */}
      <div className="bg-[#0A0A10]/80 rounded-xl border border-white/5 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-white/70 mr-2">Sinyal:</span>
          <FilterButton active={signalFilter === 'all'} onClick={() => setSignalFilter('all')} count={results.length}>Tumu</FilterButton>
          <FilterButton active={signalFilter === 'strong_long'} onClick={() => setSignalFilter('strong_long')} count={signalCounts.strong_long} variant="yellow">Strong Long</FilterButton>
          <FilterButton active={signalFilter === 'long'} onClick={() => setSignalFilter('long')} count={signalCounts.long} variant="green">Long</FilterButton>
          <FilterButton active={signalFilter === 'neutral'} onClick={() => setSignalFilter('neutral')} count={signalCounts.neutral} variant="gray">Notr</FilterButton>
          <FilterButton active={signalFilter === 'short'} onClick={() => setSignalFilter('short')} count={signalCounts.short} variant="orange">Short</FilterButton>
          <FilterButton active={signalFilter === 'strong_short'} onClick={() => setSignalFilter('strong_short')} count={signalCounts.strong_short} variant="red">Strong Short</FilterButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/70 mr-2">Market Cap:</span>
          <FilterButton active={segmentFilter === 'ALL'} onClick={() => setSegmentFilter('ALL')} count={getSegmentCount('ALL')}>Tumu</FilterButton>
          {SEGMENTS.map(seg => (
            <FilterButton key={seg} active={segmentFilter === seg} onClick={() => setSegmentFilter(seg)} count={getSegmentCount(seg)}>{seg}</FilterButton>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              placeholder="Sembol ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 w-36"
            />
            <button
              onClick={() => exportToCSV(filteredResults, 'hermes_5day')}
              disabled={filteredResults.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 flex items-center gap-1.5"
            >
              <span>CSV</span>
            </button>
            <span className="text-xs text-white/70">{filteredResults.length} sonuc</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          Hata: {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0A0A10]/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
              <th className="px-2 py-3 w-10"></th>
              <th className="px-3 py-3 text-left cursor-pointer hover:text-white/80" onClick={() => handleSort('symbol')}>Sembol <SortIcon field="symbol" /></th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80" onClick={() => handleSort('price')}>Fiyat <SortIcon field="price" /></th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80" onClick={() => handleSort('change')}>Degisim <SortIcon field="change" /></th>
              <th className="px-3 py-3 text-left cursor-pointer hover:text-white/80" onClick={() => handleSort('score')}>Skor <SortIcon field="score" /></th>
              <th className="px-3 py-3 text-left">Sinyal</th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden md:table-cell" onClick={() => handleSort('rsi')}>RSI <SortIcon field="rsi" /></th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden md:table-cell" onClick={() => handleSort('mfi')}>MFI <SortIcon field="mfi" /></th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden lg:table-cell" onClick={() => handleSort('marketCap')}>MktCap <SortIcon field="marketCap" /></th>
              <th className="px-3 py-3 text-center hidden lg:table-cell">Kalite</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map(result => (
              <StockRow
                key={result.symbol}
                result={result}
                expanded={expandedRow === result.symbol}
                onToggle={() => setExpandedRow(expandedRow === result.symbol ? null : result.symbol)}
                onWatchlistToggle={() => toggleWatchlistItem(result.symbol)}
                inWatchlist={isInWatchlist(result.symbol)}
              />
            ))}
          </tbody>
        </table>
        {filteredResults.length === 0 && !loading && (
          <div className="text-center py-16 text-white/70">
            {results.length === 0 ? 'Tarama sonucu yok. Yukari TARA butonuna basin.' : 'Filtre kriterlerine uyan sonuc yok.'}
          </div>
        )}
      </div>
    </div>
  )
}
