'use client'

import { useState, useMemo, useRef, useCallback, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEuropeTradeContext } from '../EuropeLayout'
import { ScanResult } from '@/lib/types'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'
import { PriceFlashCell, SignalBadge, ScoreMiniBar } from '../premium-ui'
import { EUROPE_EXCHANGES } from '@/lib/europe-config'

type SortField = 'score' | 'symbol' | 'price' | 'change' | 'signal' | 'rsi' | 'mfi' | 'marketCap' | 'quality' | 'confidence' | 'valuation' | 'targetPrice' | 'floorPrice' | 'riskReward'
type SortDir = 'asc' | 'desc'
type SignalFilter = 'all' | 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'

const SIGNAL_LABELS: Record<string, string> = {
  strong_long: 'STRONG LONG', long: 'LONG', neutral: 'NOTR', short: 'SHORT', strong_short: 'STRONG SHORT',
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

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
  return `${mc.toFixed(0)}`
}

function getValuationStyle(label: string): string {
  if (label === 'COK UCUZ') return 'text-hermes-green bg-hermes-green/15'
  if (label === 'UCUZ') return 'text-hermes-green bg-hermes-green/10'
  if (label === 'NORMAL') return 'text-slate-300 bg-white/[0.04]'
  if (label === 'PAHALI') return 'text-orange-400 bg-orange-500/10'
  if (label === 'COK PAHALI') return 'text-red-400 bg-red-500/10'
  return 'text-white/35 bg-white/[0.03]'
}

function getZoneStyle(zone: string): string {
  switch (zone) {
    case 'BUY_ZONE': return 'text-hermes-green bg-hermes-green/15 border-hermes-green/30'
    case 'ACCUMULATE': return 'text-hermes-green bg-hermes-green/8 border-hermes-green/20'
    case 'NEUTRAL': return 'text-slate-300 bg-white/[0.04] border-white/10'
    case 'DISTRIBUTE': return 'text-orange-400 bg-orange-500/8 border-orange-500/20'
    case 'SELL_ZONE': return 'text-red-400 bg-red-500/15 border-red-500/30'
    default: return 'text-white/35 bg-white/[0.03] border-white/5'
  }
}

const ZONE_LABELS: Record<string, string> = {
  BUY_ZONE: 'ALIS', ACCUMULATE: 'BIRIKTR', NEUTRAL: 'NOTR', DISTRIBUTE: 'DAGIT', SELL_ZONE: 'SATIS',
}

function exportToCSV(results: ScanResult[], filename: string, fmpMap?: Map<string, { confidence: number; valuationScore: number; valuationLabel: string }>) {
  const headers = ['Symbol', 'Segment', 'Price', 'Change%', 'Score', 'Signal', 'RSI', 'MFI', 'Quality', 'Z-Score', 'VWAP', 'MarketCap', 'Guven%', 'Fiyatlama']
  const rows = results.map(r => {
    const fmp = fmpMap?.get(r.symbol)
    return [
      r.symbol, r.segment, r.quote?.price?.toFixed(2) || r.hermes.price.toFixed(2),
      r.quote?.changePercent?.toFixed(2) || '0', r.hermes.score.toFixed(1), getSignalLabel(r.hermes.signalType),
      r.hermes.indicators.rsi.toFixed(1), r.hermes.indicators.mfi.toFixed(1),
      r.hermes.multipliers.quality.toFixed(2),
      r.hermes.zscores.zscore52w.toFixed(2), r.hermes.bands.vwap52w.toFixed(2),
      r.quote?.marketCap || 0,
      fmp?.confidence || '',
      fmp?.valuationLabel || '',
    ]
  })
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

function FilterButton({ active, onClick, children, count, variant = 'default' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count?: number
  variant?: 'default' | 'yellow' | 'green' | 'gray' | 'orange' | 'red'
}) {
  const variants: Record<string, string> = {
    default: active ? 'bg-blue-400/10 border-blue-400/30 text-blue-300' : 'bg-transparent border-blue-400/8 text-white/50 hover:text-white/60',
    yellow: active ? 'bg-blue-400/15 border-blue-400/40 text-blue-300' : 'bg-transparent border-blue-400/10 text-blue-400/40 hover:text-blue-300',
    green: active ? 'bg-hermes-green/15 border-hermes-green/40 text-hermes-green' : 'bg-transparent border-hermes-green/15 text-hermes-green/40 hover:text-hermes-green',
    gray: active ? 'bg-white/[0.06] border-white/15 text-white/60' : 'bg-transparent border-white/8 text-white/40 hover:text-white/60',
    orange: active ? 'bg-orange-500/15 border-orange-500/40 text-orange-400' : 'bg-transparent border-orange-500/15 text-orange-500/40 hover:text-orange-400',
    red: active ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-transparent border-red-500/15 text-red-500/40 hover:text-red-400',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${variants[variant]}`}>
      {children}
      {count !== undefined && (
        <span className={`font-bold tabular-nums ${active ? 'text-white/90' : 'text-white/60'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function DetailBlock({ title, items }: { title: string; items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="space-y-2">
      <div className="text-blue-400/70 font-semibold uppercase tracking-wide text-[10px]">{title}</div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex justify-between">
            <span className="text-white/45">{item.label}</span>
            <span className={item.color || 'text-white/70'}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function getExchangeInfo(symbol: string) {
  return Object.values(EUROPE_EXCHANGES).find(e => e.symbolSuffix && symbol.endsWith(e.symbolSuffix))
}

const StockRow = memo(function StockRow({ result, expanded, onToggle, onWatchlistToggle, inWatchlist, fmpData }: {
  result: ScanResult; expanded: boolean; onToggle: () => void
  onWatchlistToggle: () => void; inWatchlist: boolean
  fmpData?: { confidence: number; valuationScore: number; valuationLabel: string; priceTarget?: number; yearHigh?: number; yearLow?: number }
}) {
  const { hermes, quote, symbol } = result
  const confidence = fmpData?.confidence || 0
  const valuationLabel = fmpData?.valuationLabel || ''
  const price = quote?.price || hermes.price || 0
  const fmpTarget = fmpData?.priceTarget || 0
  const fmpYearLow = fmpData?.yearLow || 0
  const exConfig = getExchangeInfo(symbol)

  return (
    <>
      <tr className={`border-b border-blue-400/5 cursor-pointer premium-row group ${
        hermes.signalType === 'strong_long' ? 'row-glow-strong-long' :
        hermes.signalType === 'long' ? 'row-glow-long' :
        hermes.signalType === 'strong_short' ? 'row-glow-strong-short' :
        hermes.signalType === 'short' ? 'row-glow-short' : ''
      }`}>
        <td className="px-2 py-3 w-10">
          <button
            onClick={(e) => { e.stopPropagation(); onWatchlistToggle() }}
            className={`p-1 rounded transition-all ${inWatchlist ? 'text-blue-300' : 'text-white/40 hover:text-blue-400/50'}`}
          >
            {inWatchlist ? '\u2605' : '\u2606'}
          </button>
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-white/90">{symbol}</span>
            {exConfig && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/8 text-blue-400/50">
                {exConfig.flag} {exConfig.shortLabel}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-right" onClick={onToggle}>
          <PriceFlashCell price={quote?.price || hermes.price} className="font-mono text-white/90 text-sm" />
        </td>
        <td className={`px-3 py-3 text-right font-mono ${(quote?.changePercent ?? 0) >= 0 ? 'text-hermes-green' : 'text-red-400'}`} onClick={onToggle}>
          {quote?.changePercent ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : '-'}
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <ScoreMiniBar value={hermes.score} maxWidth={56} />
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <div className="flex items-center gap-1.5">
            <SignalBadge type={hermes.signalType as 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'} label={getSignalLabel(hermes.signalType)} />
            {hermes.delay?.waitingForConfirm && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-400/15 text-blue-300 border border-blue-400/30">
                {hermes.delay.barsRemaining} bar
              </span>
            )}
            {hermes.delay?.confirmed && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-hermes-green/15 text-hermes-green border border-hermes-green/30">
                {'\u2713'}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-right hidden md:table-cell" onClick={onToggle}>
          <span className={`font-mono ${hermes.indicators.rsi >= 70 ? 'text-red-400' : hermes.indicators.rsi <= 30 ? 'text-hermes-green' : 'text-white/60'}`}>
            {Math.round(hermes.indicators.rsi)}
          </span>
        </td>
        <td className="px-3 py-3 text-right hidden md:table-cell" onClick={onToggle}>
          <span className={`font-mono ${hermes.indicators.mfi >= 75 ? 'text-red-400' : hermes.indicators.mfi <= 25 ? 'text-hermes-green' : 'text-white/60'}`}>
            {Math.round(hermes.indicators.mfi)}
          </span>
        </td>
        <td className="px-3 py-3 text-right hidden lg:table-cell" onClick={onToggle}>
          <span className="font-mono text-white/60">{formatMarketCap(quote?.marketCap || 0)}</span>
        </td>
        <td className="px-3 py-3 text-center hidden lg:table-cell" onClick={onToggle}>
          <span className={`text-[11px] tabular-nums font-medium ${
            confidence >= 70 ? 'text-hermes-green/60' : confidence >= 50 ? 'text-amber-400/60' : 'text-white/35'
          }`}>{confidence > 0 ? `${confidence}%` : '\u2014'}</span>
        </td>
        <td className="px-3 py-3 text-center hidden lg:table-cell" onClick={onToggle}>
          {valuationLabel ? (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${getValuationStyle(valuationLabel)}`}>
              {valuationLabel}
            </span>
          ) : <span className="text-white/40 text-[10px]">{'\u2014'}</span>}
        </td>
        <td className="px-3 py-3 text-center hidden lg:table-cell" onClick={onToggle}>
          <span className={`text-xs ${hermes.multipliers.quality > 0.9 ? 'text-hermes-green' : hermes.multipliers.quality < 0.7 ? 'text-red-400' : 'text-blue-300'}`}>
            {hermes.multipliers.quality.toFixed(2)}
          </span>
        </td>
        {(() => {
          const pt = result.priceTarget
          const tgt = pt?.targetPrice || fmpTarget
          const flr = pt?.floorPrice || fmpYearLow
          const tgtPct = tgt > 0 && price > 0 ? ((tgt - price) / price) * 100 : 0
          const flrPct = flr > 0 && price > 0 ? ((price - flr) / price) * 100 : 0
          const rr = flrPct > 0.01 ? Math.abs(tgtPct) / flrPct : 0
          const hasData = tgt > 0 || flr > 0

          const zone = pt?.zone || (hasData && price > 0 && tgt > 0 && flr > 0 ? (() => {
            const range = tgt - flr
            if (range <= 0) return 'NEUTRAL' as const
            const pos = (price - flr) / range
            if (pos <= 0.15) return 'BUY_ZONE' as const
            if (pos <= 0.35) return 'ACCUMULATE' as const
            if (pos <= 0.65) return 'NEUTRAL' as const
            if (pos <= 0.85) return 'DISTRIBUTE' as const
            return 'SELL_ZONE' as const
          })() : undefined)

          return (
            <>
              <td className="px-3 py-3 text-right hidden xl:table-cell" onClick={onToggle}>
                {tgt > 0 ? (
                  <div className="flex flex-col items-end">
                    <span className={`font-mono text-xs font-semibold ${tgtPct >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                      ${tgt.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-white/40">{tgtPct >= 0 ? '+' : ''}{tgtPct.toFixed(1)}%</span>
                  </div>
                ) : <span className="text-white/40 text-[10px]">{'\u2014'}</span>}
              </td>
              <td className="px-3 py-3 text-right hidden xl:table-cell" onClick={onToggle}>
                {flr > 0 ? (
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-xs text-red-400/80">${flr.toFixed(2)}</span>
                    <span className="text-[10px] text-white/40">-{flrPct.toFixed(1)}%</span>
                  </div>
                ) : <span className="text-white/40 text-[10px]">{'\u2014'}</span>}
              </td>
              <td className="px-3 py-3 text-center hidden xl:table-cell" onClick={onToggle}>
                {rr > 0 ? (
                  <span className={`font-mono text-xs font-bold ${rr >= 2 ? 'text-hermes-green' : rr >= 1 ? 'text-blue-300' : 'text-red-400'}`}>
                    {rr.toFixed(1)}
                  </span>
                ) : <span className="text-white/40 text-[10px]">{'\u2014'}</span>}
              </td>
              <td className="px-3 py-3 text-center hidden xl:table-cell" onClick={onToggle}>
                {zone ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap border ${getZoneStyle(zone)}`}>
                    {ZONE_LABELS[zone] || zone}
                  </span>
                ) : <span className="text-white/40 text-[10px]">{'\u2014'}</span>}
              </td>
            </>
          )
        })()}
      </tr>
      {expanded && (
        <tr className="border-b border-blue-400/5 bg-[#0e0e18]/50">
          <td colSpan={16} className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4 text-xs">
              <DetailBlock title="Bilesenler (70/15/15)" items={[
                { label: '52W Z-Score (70%)', value: hermes.components.point52w.toFixed(1), color: getScoreColor(hermes.components.point52w) },
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
                { label: 'Z-Score', value: hermes.zscores.zscore52w.toFixed(2) },
                { label: 'VWAP', value: `$${hermes.bands.vwap52w.toFixed(2)}` },
              ]} />
              <DetailBlock title="Bantlar (Z-Score)" items={[
                { label: 'Dis Ust (Z=+2)', value: `$${hermes.bands.upperOuter.toFixed(2)}` },
                { label: 'Ic Ust (Z=+1)', value: `$${hermes.bands.upperInner.toFixed(2)}` },
                { label: 'Ic Alt (Z=-1)', value: `$${hermes.bands.lowerInner.toFixed(2)}` },
                { label: 'Dis Alt (Z=-2)', value: `$${hermes.bands.lowerOuter.toFixed(2)}` },
              ]} />
              <DetailBlock title="Veri Durumu" items={[
                { label: 'Bar', value: hermes.dataPoints.toString() },
                { label: 'MktCap', value: formatMarketCap(quote?.marketCap || 0) },
                { label: 'Durum', value: hermes.hasEnough52w ? 'TAM' : 'KISMI', color: hermes.hasEnough52w ? 'text-hermes-green' : 'text-orange-400' },
                { label: 'Borsa', value: getExchangeInfo(symbol)?.shortLabel || '-' },
              ]} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
})

const ROW_HEIGHT = 48
const EXPANDED_ROW_HEIGHT = 240

export default function ModuleEuropeTrade() {
  const ctx = useEuropeTradeContext()
  const canCSV = useCanDownloadCSV()

  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all')
  const [valuationFilter, setValuationFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const results = ctx.results

  const filteredResults = useMemo(() => {
    return results
      .filter(r => signalFilter === 'all' || r.hermes.signalType === signalFilter)
      .filter(r => valuationFilter === 'all' || ctx.fmpStocksMap.get(r.symbol)?.valuationLabel === valuationFilter)
      .filter(r => !searchQuery || r.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        let aVal: number, bVal: number
        switch (sortField) {
          case 'score': aVal = a.hermes.score; bVal = b.hermes.score; break
          case 'symbol': return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
          case 'price': aVal = a.quote?.price || a.hermes.price; bVal = b.quote?.price || b.hermes.price; break
          case 'change': aVal = a.quote?.changePercent || 0; bVal = b.quote?.changePercent || 0; break
          case 'signal': aVal = a.hermes.score; bVal = b.hermes.score; break
          case 'rsi': aVal = a.hermes.indicators.rsi; bVal = b.hermes.indicators.rsi; break
          case 'mfi': aVal = a.hermes.indicators.mfi; bVal = b.hermes.indicators.mfi; break
          case 'marketCap': aVal = a.quote?.marketCap || 0; bVal = b.quote?.marketCap || 0; break
          case 'quality': aVal = a.hermes.multipliers.quality; bVal = b.hermes.multipliers.quality; break
          case 'confidence': aVal = ctx.fmpStocksMap.get(a.symbol)?.confidence || 0; bVal = ctx.fmpStocksMap.get(b.symbol)?.confidence || 0; break
          case 'valuation': aVal = ctx.fmpStocksMap.get(a.symbol)?.valuationScore || 0; bVal = ctx.fmpStocksMap.get(b.symbol)?.valuationScore || 0; break
          case 'targetPrice': {
            const aFmp = ctx.fmpStocksMap.get(a.symbol)
            const bFmp = ctx.fmpStocksMap.get(b.symbol)
            aVal = a.priceTarget?.targetPct || (aFmp?.priceTarget && (a.quote?.price || a.hermes.price) > 0 ? ((aFmp.priceTarget - (a.quote?.price || a.hermes.price)) / (a.quote?.price || a.hermes.price)) * 100 : 0)
            bVal = b.priceTarget?.targetPct || (bFmp?.priceTarget && (b.quote?.price || b.hermes.price) > 0 ? ((bFmp.priceTarget - (b.quote?.price || b.hermes.price)) / (b.quote?.price || b.hermes.price)) * 100 : 0)
            break
          }
          case 'floorPrice': {
            const aFmp2 = ctx.fmpStocksMap.get(a.symbol)
            const bFmp2 = ctx.fmpStocksMap.get(b.symbol)
            aVal = a.priceTarget?.floorPct || (aFmp2?.yearLow && (a.quote?.price || a.hermes.price) > 0 ? (((a.quote?.price || a.hermes.price) - aFmp2.yearLow) / (a.quote?.price || a.hermes.price)) * 100 : 0)
            bVal = b.priceTarget?.floorPct || (bFmp2?.yearLow && (b.quote?.price || b.hermes.price) > 0 ? (((b.quote?.price || b.hermes.price) - bFmp2.yearLow) / (b.quote?.price || b.hermes.price)) * 100 : 0)
            break
          }
          case 'riskReward': aVal = a.priceTarget?.riskReward || 0; bVal = b.priceTarget?.riskReward || 0; break
          default: aVal = a.hermes.score; bVal = b.hermes.score
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      })
  }, [results, signalFilter, valuationFilter, searchQuery, sortField, sortDir, ctx.fmpStocksMap])

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

  const estimateSize = useCallback((index: number) => {
    const item = filteredResults[index]
    if (!item) return ROW_HEIGHT
    return expandedRow === item.symbol ? ROW_HEIGHT + EXPANDED_ROW_HEIGHT : ROW_HEIGHT
  }, [filteredResults, expandedRow])

  const virtualizer = useVirtualizer({
    count: filteredResults.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize,
    overscan: 15,
    getItemKey: (index) => filteredResults[index]?.symbol ?? index,
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-white/40 ml-1">{'\u2195'}</span>
    return <span className="text-blue-300 ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  if (ctx.loading && results.length === 0) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="w-16 h-16 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      <p className="text-sm text-white/50 mt-4">Avrupa piyasalari taraniyor...</p>
      <p className="text-xs text-white/30 mt-1">{ctx.progress}</p>
    </div>
  )

  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
      {/* Filters */}
      <div className="glass-card rounded-xl p-2 sm:p-4 mb-2 sm:mb-4">
        <div className="space-y-2">
          {/* Signal Row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400/50 w-20 shrink-0 text-right">Sinyal:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterButton active={signalFilter === 'all'} onClick={() => setSignalFilter('all')} count={results.length}>Tumu</FilterButton>
              <FilterButton active={signalFilter === 'strong_long'} onClick={() => setSignalFilter('strong_long')} variant="yellow" count={signalCounts.strong_long}>Strong Long</FilterButton>
              <FilterButton active={signalFilter === 'long'} onClick={() => setSignalFilter('long')} variant="green" count={signalCounts.long}>Long</FilterButton>
              <FilterButton active={signalFilter === 'neutral'} onClick={() => setSignalFilter('neutral')} variant="gray" count={signalCounts.neutral}>Notr</FilterButton>
              <FilterButton active={signalFilter === 'short'} onClick={() => setSignalFilter('short')} variant="orange" count={signalCounts.short}>Short</FilterButton>
              <FilterButton active={signalFilter === 'strong_short'} onClick={() => setSignalFilter('strong_short')} variant="red" count={signalCounts.strong_short}>Strong Short</FilterButton>
            </div>
          </div>
          {/* Valuation + Search Row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400/50 w-20 shrink-0 text-right">Fiyatlama:</span>
            <div className="flex flex-wrap items-center gap-1.5 flex-1">
              {[
                { key: 'all', label: 'Tumu', variant: 'default' as const },
                { key: 'COK UCUZ', label: 'Cok Ucuz', variant: 'green' as const },
                { key: 'UCUZ', label: 'Ucuz', variant: 'green' as const },
                { key: 'NORMAL', label: 'Normal', variant: 'gray' as const },
                { key: 'PAHALI', label: 'Pahali', variant: 'orange' as const },
                { key: 'COK PAHALI', label: 'Cok Pahali', variant: 'red' as const },
              ].map(f => (
                <FilterButton key={f.key} active={valuationFilter === f.key} onClick={() => setValuationFilter(f.key)} variant={f.variant}>{f.label}</FilterButton>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Sembol ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value.toUpperCase())}
                  className="bg-[#0e0e18]/50 border border-blue-400/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-400/25 w-36"
                />
                {canCSV && (
                  <button
                    onClick={() => exportToCSV(filteredResults, 'hermes_europe', ctx.fmpStocksMap)}
                    disabled={filteredResults.length === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-400/8 hover:bg-blue-400/15 text-blue-400/60 hover:text-blue-300 border border-blue-400/15 flex items-center gap-1.5"
                  >
                    CSV
                  </button>
                )}
                <span className="text-xs text-white/60 tabular-nums">
                  <span className="font-bold text-blue-300">{filteredResults.length}</span>
                  <span className="text-white/40"> / {results.length}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {ctx.error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          Hata: {ctx.error}
        </div>
      )}

      {/* Virtualized Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="overflow-auto"
          style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '400px' }}
        >
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[#0c0c14]/95 backdrop-blur-sm">
              <tr className="border-b border-blue-400/10 text-white/45 text-xs uppercase tracking-wider">
                <th className="px-2 py-3 w-10"></th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-white/80" onClick={() => handleSort('symbol')}>Sembol <SortIcon field="symbol" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80" onClick={() => handleSort('price')}>Fiyat <SortIcon field="price" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80" onClick={() => handleSort('change')}>Degisim <SortIcon field="change" /></th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-white/80" onClick={() => handleSort('score')}>Skor <SortIcon field="score" /></th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-white/80" onClick={() => handleSort('signal')}>Sinyal <SortIcon field="signal" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden md:table-cell" onClick={() => handleSort('rsi')}>RSI <SortIcon field="rsi" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden md:table-cell" onClick={() => handleSort('mfi')}>MFI <SortIcon field="mfi" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden lg:table-cell" onClick={() => handleSort('marketCap')}>MktCap <SortIcon field="marketCap" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-white/80 hidden lg:table-cell" onClick={() => handleSort('confidence')} title="Temel analiz veri tamligi (Confidence %)">Guven <SortIcon field="confidence" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-white/80 hidden lg:table-cell" onClick={() => handleSort('valuation')} title="Fiyatlama seviyesi (COK UCUZ -> COK PAHALI)">Fiyatlama <SortIcon field="valuation" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-white/80 hidden lg:table-cell" onClick={() => handleSort('quality')}>Kalite <SortIcon field="quality" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden xl:table-cell" onClick={() => handleSort('targetPrice')} title="Hedef Fiyat">Hedef <SortIcon field="targetPrice" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-white/80 hidden xl:table-cell" onClick={() => handleSort('floorPrice')} title="Dip Fiyat">Dip <SortIcon field="floorPrice" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-white/80 hidden xl:table-cell" onClick={() => handleSort('riskReward')} title="Risk/Odul Orani">R:R <SortIcon field="riskReward" /></th>
                <th className="px-3 py-3 text-center hidden xl:table-cell" title="Fiyat Bolgesi">Bolge</th>
              </tr>
            </thead>
            <tbody>
              {virtualizer.getVirtualItems().length > 0 && (
                <tr style={{ height: virtualizer.getVirtualItems()[0].start }}>
                  <td colSpan={16} />
                </tr>
              )}
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const result = filteredResults[virtualRow.index]
                if (!result) return null
                return (
                  <StockRow
                    key={result.symbol}
                    result={result}
                    expanded={expandedRow === result.symbol}
                    onToggle={() => setExpandedRow(expandedRow === result.symbol ? null : result.symbol)}
                    onWatchlistToggle={() => ctx.toggleWatchlistItem(result.symbol)}
                    inWatchlist={ctx.isInWatchlist(result.symbol)}
                    fmpData={ctx.fmpStocksMap.get(result.symbol)}
                  />
                )
              })}
              {virtualizer.getVirtualItems().length > 0 && (
                <tr style={{ height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end ?? 0) }}>
                  <td colSpan={16} />
                </tr>
              )}
            </tbody>
          </table>
          {filteredResults.length === 0 && !ctx.loading && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-blue-400/10 flex items-center justify-center animate-empty-float">
                  <span className="text-3xl">{results.length === 0 ? '\uD83D\uDD0D' : '\uD83C\uDFAF'}</span>
                </div>
              </div>
              <p className="text-sm text-white/50 font-medium">
                {results.length === 0 ? 'Tarama sonucu yok' : 'Filtre kriterlerine uyan sonuc yok'}
              </p>
              <p className="text-[11px] text-white/40 mt-1">
                {results.length === 0 ? 'Yukaridan TARA butonuna basin' : 'Filtre ayarlarini degistirin'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
