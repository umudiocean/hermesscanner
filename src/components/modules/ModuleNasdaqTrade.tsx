'use client'

import { useState, useMemo, useRef, useCallback, memo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useNasdaqTradeContext } from '../Layout'
import { ScanResult } from '@/lib/types'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'
import { PriceFlashCell, SignalBadge, ScoreMiniBar } from '../premium-ui'
import SystemFreshnessBadge from '../SystemFreshnessBadge'
import LegalDisclaimerStrip from '../LegalDisclaimerStrip'

// ═══════════════════════════════════════════════════════════════════
// TRADE AI Module — V16 Pure Z-Score (V377_Z144)
// VWAP 377g | Z-Score LB=144 | 3 Sinyal (LONG / BEKLE / SHORT)
// Skor: 0-34 LONG | 35-91 BEKLE | 92-100 SHORT
// ═══════════════════════════════════════════════════════════════════

type SortField = 'score' | 'symbol' | 'price' | 'change' | 'signal' | 'rsi' | 'mfi' | 'marketCap' | 'quality' | 'confidence' | 'valuation' | 'targetPrice' | 'floorPrice' | 'riskReward'
type SortDir = 'asc' | 'desc'
type SignalFilter = 'all' | 'long' | 'neutral' | 'short'
type SegmentFilter = 'ALL' | 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO'

const SEGMENTS = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO'] as const

const SIGNAL_LABELS: Record<string, string> = {
  long: 'LONG',
  neutral: 'BEKLE',
  short: 'SHORT',
  strong_long: 'LONG',
  strong_short: 'SHORT',
}

function getSignalLabel(signalType: string): string {
  return SIGNAL_LABELS[signalType] || 'BEKLE'
}

function getSignalStyle(signalType: string) {
  const mapped = signalType === 'strong_long' ? 'long' : signalType === 'strong_short' ? 'short' : signalType
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    long: { bg: 'bg-success-400/15', text: 'text-success-400', border: 'border-success-400/40' },
    neutral: { bg: 'bg-surface-3', text: 'text-text-secondary', border: 'border-stroke' },
    short: { bg: 'bg-danger-400/15', text: 'text-danger-400', border: 'border-danger-400/40' },
  }
  return styles[mapped] || styles.neutral
}

function getScoreColor(score: number): string {
  if (score <= 34) return 'text-success-400'
  if (score <= 91) return 'text-text-secondary'
  return 'text-danger-400'
}

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
  return `${mc.toFixed(0)}`
}

function exportToCSV(results: ScanResult[], filename: string, fmpMap?: Map<string, { confidence: number; valuationScore: number; valuationLabel: string }>) {
  const headers = ['Symbol', 'Segment', 'Price', 'Change%', 'Score', 'Signal', 'RSI', 'MFI', 'Quality', 'Z-Score', 'VWAP52W', 'MarketCap', 'Guven%', 'Fiyatlama']
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

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative w-16 h-1.5 rounded-full bg-gradient-to-r from-gold-400 via-white/20 to-red-500 opacity-40">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-gold-300 rounded-full shadow-lg shadow-gold-400/30"
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
    default: active ? 'bg-gold-400/10 border-stroke-gold-strong text-gold-300' : 'bg-transparent border-stroke-gold text-text-tertiary hover:text-text-secondary',
    yellow: active ? 'bg-gold-400/15 border-stroke-gold-strong text-gold-300' : 'bg-transparent border-stroke-gold text-gold-400/40 hover:text-gold-300',
    green: active ? 'bg-success-400/15 border-success-400/40 text-success-400' : 'bg-transparent border-success-400/15 text-success-400/40 hover:text-success-400',
    gray: active ? 'bg-surface-3 border-stroke text-text-secondary' : 'bg-transparent border-white/8 text-text-tertiary hover:text-text-secondary',
    orange: active ? 'bg-warning-400/15 border-orange-500/40 text-warning-400' : 'bg-transparent border-orange-500/15 text-warning-500/40 hover:text-warning-400',
    red: active ? 'bg-danger-400/15 border-danger-400/40 text-danger-400' : 'bg-transparent border-red-500/15 text-danger-400/40 hover:text-danger-400',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${variants[variant]}`}>
      {children}
      {count !== undefined && (
        <span className={`font-bold tabular-nums ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function getValuationStyle(label: string): string {
  if (label === 'COK UCUZ') return 'text-success-400 bg-success-400/15'
  if (label === 'UCUZ') return 'text-success-400 bg-success-400/10'
  if (label === 'NORMAL') return 'text-text-secondary bg-surface-3'
  if (label === 'PAHALI') return 'text-warning-400 bg-orange-500/10'
  if (label === 'COK PAHALI') return 'text-danger-400 bg-danger-400/10'
  return 'text-text-quaternary bg-surface-2'
}

function getZoneStyle(zone: string): string {
  switch (zone) {
    case 'BUY_ZONE': return 'text-success-400 bg-success-400/15 border-success-400/30'
    case 'ACCUMULATE': return 'text-success-400 bg-success-400/8 border-success-400/20'
    case 'NEUTRAL': return 'text-text-secondary bg-surface-3 border-stroke'
    case 'DISTRIBUTE': return 'text-warning-400 bg-orange-500/8 border-orange-500/20'
    case 'SELL_ZONE': return 'text-danger-400 bg-danger-400/15 border-danger-400/30'
    default: return 'text-text-quaternary bg-surface-2 border-white/5'
  }
}

const ZONE_LABELS: Record<string, string> = {
  BUY_ZONE: 'ALIS',
  ACCUMULATE: 'BIRIKTR',
  NEUTRAL: 'NOTR',
  DISTRIBUTE: 'DAGIT',
  SELL_ZONE: 'SATIS',
}

const StockRow = memo(function StockRow({ result, expanded, onToggle, onWatchlistToggle, inWatchlist, fmpData }: {
  result: ScanResult; expanded: boolean; onToggle: () => void
  onWatchlistToggle: () => void; inWatchlist: boolean; fmpData?: { confidence: number; valuationScore: number; valuationLabel: string; priceTarget?: number; yearHigh?: number; yearLow?: number }
}) {
  const { hermes, quote, symbol, segment } = result
  const style = getSignalStyle(hermes.signalType)
  const confidence = fmpData?.confidence || 0
  const valuationLabel = fmpData?.valuationLabel || ''
  const price = quote?.price || hermes.price || 0
  const fmpTarget = fmpData?.priceTarget || 0
  const fmpYearLow = fmpData?.yearLow || 0

  return (
    <>
      <tr className={`border-b border-gold-400/5 cursor-pointer premium-row group ${
        (hermes.signalType === 'long' || hermes.signalType === 'strong_long') ? 'row-glow-long' :
        (hermes.signalType === 'short' || hermes.signalType === 'strong_short') ? 'row-glow-short' : ''
      }`}>
        <td className="px-2 py-3 w-10">
          <button
            onClick={(e) => { e.stopPropagation(); onWatchlistToggle() }}
            className={`p-1 rounded transition-all ${inWatchlist ? 'text-gold-300' : 'text-text-tertiary hover:text-gold-400/50'}`}
          >
            {inWatchlist ? '★' : '☆'}
          </button>
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-text-primary">{symbol}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-400/8 text-gold-400/50">{segment}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-right" onClick={onToggle}>
          <PriceFlashCell price={quote?.price || hermes.price} className="font-mono text-text-primary text-sm" />
        </td>
        <td className={`px-3 py-3 text-right font-mono ${(quote?.changePercent ?? 0) >= 0 ? 'text-success-400' : 'text-danger-400'}`} onClick={onToggle}>
          {quote?.changePercent ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : '-'}
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <ScoreMiniBar value={hermes.score} maxWidth={56} />
        </td>
        <td className="px-3 py-3" onClick={onToggle}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <SignalBadge type={hermes.signalType as 'long' | 'neutral' | 'short' | 'strong_long' | 'strong_short'} label={getSignalLabel(hermes.signalType)} />
            {hermes.score >= 35 && hermes.score <= 40 && (
              <span className="px-1 py-0.5 rounded text-[9px] bg-success-400/10 text-success-400/80 border border-success-400/20" title="Skor LONG bolgelerine yaklastigi">↓L</span>
            )}
            {hermes.score >= 87 && hermes.score <= 91 && (
              <span className="px-1 py-0.5 rounded text-[9px] bg-danger-400/10 text-danger-400/80 border border-danger-400/30" title="Skor SHORT bolgelerine yaklastigi">↑S</span>
            )}
            {hermes.delay?.waitingForConfirm && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-gold-400/15 text-gold-300 border border-stroke-gold-strong">
                {hermes.delay.barsRemaining} bar
              </span>
            )}
            {hermes.delay?.confirmed && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-success-400/15 text-success-400 border border-success-400/30">
                ✓
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-right hidden md:table-cell" onClick={onToggle}>
          <span className={`font-mono ${hermes.indicators.rsi >= 70 ? 'text-danger-400' : hermes.indicators.rsi <= 30 ? 'text-success-400' : 'text-text-secondary'}`}>
            {Math.round(hermes.indicators.rsi)}
          </span>
        </td>
        <td className="px-3 py-3 text-right hidden md:table-cell" onClick={onToggle}>
          <span className={`font-mono ${hermes.indicators.mfi >= 75 ? 'text-danger-400' : hermes.indicators.mfi <= 25 ? 'text-success-400' : 'text-text-secondary'}`}>
            {Math.round(hermes.indicators.mfi)}
          </span>
        </td>
        <td className="px-3 py-3 text-right hidden lg:table-cell" onClick={onToggle}>
          <span className="font-mono text-text-secondary">{formatMarketCap(quote?.marketCap || 0)}</span>
        </td>
        <td className="px-3 py-3 text-center hidden lg:table-cell" onClick={onToggle}>
          <span className={`text-[11px] tabular-nums font-medium ${
            confidence >= 70 ? 'text-success-400/60' : confidence >= 50 ? 'text-gold-400/60' : 'text-text-quaternary'
          }`}>{confidence > 0 ? `${confidence}%` : '—'}</span>
        </td>
        <td className="px-3 py-3 text-center hidden lg:table-cell" onClick={onToggle}>
          {valuationLabel ? (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${getValuationStyle(valuationLabel)}`}>
              {valuationLabel}
            </span>
          ) : <span className="text-text-tertiary text-[10px]">—</span>}
        </td>
        <td className="px-3 py-3 text-center hidden lg:table-cell" onClick={onToggle}>
          <span className={`text-xs ${hermes.multipliers.quality > 0.9 ? 'text-success-400' : hermes.multipliers.quality < 0.7 ? 'text-danger-400' : 'text-gold-300'}`}>
            {hermes.multipliers.quality.toFixed(2)}
          </span>
        </td>
        {/* Target / Floor / R:R / Zone — scan priceTarget varsa onu kullan, yoksa FMP analist target + 52W low */}
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
                    <span className={`font-mono text-xs font-semibold ${tgtPct >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                      ${tgt.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-text-tertiary">{tgtPct >= 0 ? '+' : ''}{tgtPct.toFixed(1)}%</span>
                  </div>
                ) : <span className="text-text-tertiary text-[10px]">{'\u2014'}</span>}
              </td>
              <td className="px-3 py-3 text-right hidden xl:table-cell" onClick={onToggle}>
                {flr > 0 ? (
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-xs text-danger-400/80">${flr.toFixed(2)}</span>
                    <span className="text-[10px] text-text-tertiary">-{flrPct.toFixed(1)}%</span>
                  </div>
                ) : <span className="text-text-tertiary text-[10px]">{'\u2014'}</span>}
              </td>
              <td className="px-3 py-3 text-center hidden xl:table-cell" onClick={onToggle}>
                {rr > 0 ? (
                  <span className={`font-mono text-xs font-bold ${rr >= 2 ? 'text-success-400' : rr >= 1 ? 'text-gold-300' : 'text-danger-400'}`}>
                    {rr.toFixed(1)}
                  </span>
                ) : <span className="text-text-tertiary text-[10px]">{'\u2014'}</span>}
              </td>
              <td className="px-3 py-3 text-center hidden xl:table-cell" onClick={onToggle}>
                {zone ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap border ${getZoneStyle(zone)}`}>
                    {ZONE_LABELS[zone] || zone}
                  </span>
                ) : <span className="text-text-tertiary text-[10px]">{'\u2014'}</span>}
              </td>
            </>
          )
        })()}
      </tr>
      {expanded && (
        <tr className="border-b border-gold-400/5 bg-surface-3/30">
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
              <DetailBlock title="52W Z-Score" items={[
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
                { label: 'Durum', value: hermes.hasEnough52w ? 'TAM' : 'KISMI', color: hermes.hasEnough52w ? 'text-success-400' : 'text-warning-400' },
                { label: 'Delay', value: hermes.delay ? (hermes.delay.confirmed ? 'CONFIRMED' : `${hermes.delay.barsRemaining} bar bekle`) : '-', 
                  color: hermes.delay?.confirmed ? 'text-success-400' : hermes.delay?.waitingForConfirm ? 'text-gold-300' : 'text-text-tertiary' },
              ]} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
})

function DetailBlock({ title, items }: { title: string; items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="space-y-2">
      <div className="text-gold-400/70 font-semibold uppercase tracking-wide text-[10px]">{title}</div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex justify-between">
            <span className="text-text-tertiary">{item.label}</span>
            <span className={item.color || 'text-text-secondary'}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ROW_HEIGHT = 48
const EXPANDED_ROW_HEIGHT = 240

export default function ModuleNasdaqTrade() {
  const { results, loading, error, toggleWatchlistItem, isInWatchlist, fmpStocksMap } = useNasdaqTradeContext()
  const canCSV = useCanDownloadCSV()

  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL')
  const [valuationFilter, setValuationFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const filteredResults = useMemo(() => {
    return results
      .filter(r => {
        if (signalFilter === 'all') return true
        if (signalFilter === 'long') return r.hermes.signalType === 'long' || r.hermes.signalType === 'strong_long'
        if (signalFilter === 'short') return r.hermes.signalType === 'short' || r.hermes.signalType === 'strong_short'
        return r.hermes.signalType === signalFilter
      })
      .filter(r => segmentFilter === 'ALL' || r.segment === segmentFilter)
      .filter(r => valuationFilter === 'all' || fmpStocksMap.get(r.symbol)?.valuationLabel === valuationFilter)
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
          case 'confidence': aVal = fmpStocksMap.get(a.symbol)?.confidence || 0; bVal = fmpStocksMap.get(b.symbol)?.confidence || 0; break
          case 'valuation': aVal = fmpStocksMap.get(a.symbol)?.valuationScore || 0; bVal = fmpStocksMap.get(b.symbol)?.valuationScore || 0; break
          case 'targetPrice': {
            const aFmp = fmpStocksMap.get(a.symbol)
            const bFmp = fmpStocksMap.get(b.symbol)
            aVal = a.priceTarget?.targetPct || (aFmp?.priceTarget && (a.quote?.price || a.hermes.price) > 0 ? ((aFmp.priceTarget - (a.quote?.price || a.hermes.price)) / (a.quote?.price || a.hermes.price)) * 100 : 0)
            bVal = b.priceTarget?.targetPct || (bFmp?.priceTarget && (b.quote?.price || b.hermes.price) > 0 ? ((bFmp.priceTarget - (b.quote?.price || b.hermes.price)) / (b.quote?.price || b.hermes.price)) * 100 : 0)
            break
          }
          case 'floorPrice': {
            const aFmp2 = fmpStocksMap.get(a.symbol)
            const bFmp2 = fmpStocksMap.get(b.symbol)
            aVal = a.priceTarget?.floorPct || (aFmp2?.yearLow && (a.quote?.price || a.hermes.price) > 0 ? (((a.quote?.price || a.hermes.price) - aFmp2.yearLow) / (a.quote?.price || a.hermes.price)) * 100 : 0)
            bVal = b.priceTarget?.floorPct || (bFmp2?.yearLow && (b.quote?.price || b.hermes.price) > 0 ? (((b.quote?.price || b.hermes.price) - bFmp2.yearLow) / (b.quote?.price || b.hermes.price)) * 100 : 0)
            break
          }
          case 'riskReward': aVal = a.priceTarget?.riskReward || 0; bVal = b.priceTarget?.riskReward || 0; break
          default: aVal = a.hermes.score; bVal = b.hermes.score
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      })
  }, [results, signalFilter, segmentFilter, valuationFilter, searchQuery, sortField, sortDir, fmpStocksMap])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'score' ? 'asc' : 'desc') }
  }

  const signalCounts = useMemo(() => ({
    long: results.filter(r => r.hermes.signalType === 'long' || r.hermes.signalType === 'strong_long').length,
    neutral: results.filter(r => r.hermes.signalType === 'neutral').length,
    short: results.filter(r => r.hermes.signalType === 'short' || r.hermes.signalType === 'strong_short').length,
  }), [results])

  const getSegmentCount = (seg: SegmentFilter) => {
    const base = results.filter(r => {
      if (signalFilter === 'all') return true
      if (signalFilter === 'long') return r.hermes.signalType === 'long' || r.hermes.signalType === 'strong_long'
      if (signalFilter === 'short') return r.hermes.signalType === 'short' || r.hermes.signalType === 'strong_short'
      return r.hermes.signalType === signalFilter
    })
    return seg === 'ALL' ? base.length : base.filter(r => r.segment === seg).length
  }

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
    if (sortField !== field) return <span className="text-text-tertiary ml-1">↕</span>
    return <span className="text-gold-300 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
      <div className="flex justify-end mb-2">
        <SystemFreshnessBadge />
      </div>
      <div className="mb-2">
        <LegalDisclaimerStrip compact />
      </div>
      {/* Filters — Yatay simetrik layout */}
      <div className="glass-card rounded-xl p-3 sm:p-4 mb-2 sm:mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Sinyal */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gold-400/50 w-16 shrink-0">Sinyal</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterButton active={signalFilter === 'all'} onClick={() => setSignalFilter('all')} count={results.length}>Tumu</FilterButton>
              <FilterButton active={signalFilter === 'long'} onClick={() => setSignalFilter('long')} variant="green" count={signalCounts.long}>Long</FilterButton>
              <FilterButton active={signalFilter === 'neutral'} onClick={() => setSignalFilter('neutral')} variant="gray" count={signalCounts.neutral}>Bekle</FilterButton>
              <FilterButton active={signalFilter === 'short'} onClick={() => setSignalFilter('short')} variant="red" count={signalCounts.short}>Short</FilterButton>
            </div>
          </div>
          <div className="hidden lg:block w-px h-8 bg-surface-3 shrink-0" />
          {/* Market Cap */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gold-400/50 w-16 shrink-0">Market Cap</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterButton active={segmentFilter === 'ALL'} onClick={() => setSegmentFilter('ALL')} count={getSegmentCount('ALL')}>Tumu</FilterButton>
              {SEGMENTS.map(seg => (
                <FilterButton key={seg} active={segmentFilter === seg} onClick={() => setSegmentFilter(seg)} count={getSegmentCount(seg)}>{seg}</FilterButton>
              ))}
            </div>
          </div>
          <div className="hidden lg:block w-px h-8 bg-surface-3 shrink-0" />
          {/* Fiyatlama */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gold-400/50 w-16 shrink-0">Fiyatlama</span>
            <div className="flex flex-wrap items-center gap-1.5">
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
            </div>
          </div>
          {/* Arama + CSV + sayac — sagda */}
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="Sembol ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-surface-3/50 border border-stroke-gold rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-stroke-gold w-32"
            />
            {canCSV && (
              <button
                onClick={() => exportToCSV(filteredResults, 'hermes_52week', fmpStocksMap)}
                disabled={filteredResults.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gold-400/8 hover:bg-gold-400/15 text-gold-400/60 hover:text-gold-300 border border-stroke-gold flex items-center gap-1.5"
              >
                CSV
              </button>
            )}
            <span className="text-xs text-text-secondary tabular-nums whitespace-nowrap">
              <span className="font-bold text-gold-300">{filteredResults.length}</span>
              <span className="text-text-tertiary"> / {results.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="text-sm text-gold-400 bg-gold-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
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
            <thead className="sticky top-0 z-10 bg-midnight/95 backdrop-blur-sm">
              <tr className="border-b border-stroke-gold text-text-tertiary text-xs uppercase tracking-wider">
                <th className="px-2 py-3 w-10"></th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-text-primary" onClick={() => handleSort('symbol')}>Sembol <SortIcon field="symbol" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('price')}>Fiyat <SortIcon field="price" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('change')}>Degisim <SortIcon field="change" /></th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-text-primary" onClick={() => handleSort('score')}>Skor <SortIcon field="score" /></th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-text-primary" onClick={() => handleSort('signal')}>Sinyal <SortIcon field="signal" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-text-primary hidden md:table-cell" onClick={() => handleSort('rsi')}>RSI <SortIcon field="rsi" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-text-primary hidden md:table-cell" onClick={() => handleSort('mfi')}>MFI <SortIcon field="mfi" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-text-primary hidden lg:table-cell" onClick={() => handleSort('marketCap')}>MktCap <SortIcon field="marketCap" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-text-primary hidden lg:table-cell" onClick={() => handleSort('confidence')} title="Temel analiz veri tamligi (Confidence %)">Guven <SortIcon field="confidence" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-text-primary hidden lg:table-cell" onClick={() => handleSort('valuation')} title="Fiyatlama seviyesi (COK UCUZ -> COK PAHALI)">Fiyatlama <SortIcon field="valuation" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-text-primary hidden lg:table-cell" onClick={() => handleSort('quality')}>Kalite <SortIcon field="quality" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-text-primary hidden xl:table-cell" onClick={() => handleSort('targetPrice')} title="Hedef Fiyat (VWAP+Analist+DCF)">Hedef <SortIcon field="targetPrice" /></th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-text-primary hidden xl:table-cell" onClick={() => handleSort('floorPrice')} title="Dip Fiyat (Destek seviyeleri)">Dip <SortIcon field="floorPrice" /></th>
                <th className="px-3 py-3 text-center cursor-pointer hover:text-text-primary hidden xl:table-cell" onClick={() => handleSort('riskReward')} title="Risk/Odul Orani (>1 = olumlu)">R:R <SortIcon field="riskReward" /></th>
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
                    onWatchlistToggle={() => toggleWatchlistItem(result.symbol)}
                    inWatchlist={isInWatchlist(result.symbol)}
                    fmpData={fmpStocksMap.get(result.symbol)}
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
          {filteredResults.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-stroke-gold flex items-center justify-center animate-empty-float">
                  <span className="text-3xl">{results.length === 0 ? '🔍' : '🎯'}</span>
                </div>
                <div className="absolute inset-[-24px]" style={{ animation: 'orbit 8s linear infinite' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-gold-400/30 absolute top-0 left-1/2 -translate-x-1/2" />
                </div>
              </div>
              <p className="text-sm text-text-tertiary font-medium">
                {results.length === 0 ? 'Tarama sonucu yok' : 'Filtre kriterlerine uyan sonuc yok'}
              </p>
              <p className="text-[11px] text-text-tertiary mt-1">
                {results.length === 0 ? 'Yukaridan TARA butonuna basin' : 'Filtre ayarlarini degistirin'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
