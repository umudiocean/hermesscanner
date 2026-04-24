'use client'

// ═══════════════════════════════════════════════════════════════════
// NASDAQ WATCHLIST Module — Ortak Bilgi ve Sinyal Hazinesi
// 3 sinyal sutunu: Terminal AI | Trade AI | AI Signal
// Hisse arama + CSV indirme + tum sutunlar siralanabilir
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNasdaqTradeContext } from '../Layout'
import { ScanResult } from '@/lib/types'
import { Star, Trash2, Download, Search, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import { PriceFlashCell } from '../premium-ui'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'
import SystemFreshnessBadge from '../SystemFreshnessBadge'
import { useSignalRenderGuard } from '@/lib/hooks/useSignalRenderGuard'
import LegalDisclaimerStrip from '../LegalDisclaimerStrip'
import { CSV_HEADERS, REVISION_TOOLTIPS } from './shared/revision-contract'

type TerminalSignal = 'STRONG' | 'GOOD' | 'NEUTRAL' | 'WEAK' | 'BAD'
type TradeSignal = 'LONG' | 'BEKLE' | 'SHORT'
type AISignal = 'CONFLUENCE BUY' | 'ALPHA LONG' | 'HERMES LONG' | 'HERMES SHORT' | 'ALPHA SHORT' | 'CONFLUENCE SELL' | '-'

type SortField = 'symbol' | 'segment' | 'price' | 'change' | 'score' | 'terminalSignal' | 'tradeSignal' | 'aiSignal' |
  'rsi' | 'mfi' | 'marketCap' | 'point52w' | 'zscore' | 'quality' | 'confidence' | 'valuation' | 'rev30' | 'rev90'
type SortDir = 'asc' | 'desc'

const TRADE_SIGNAL_LABELS: Record<string, string> = {
  long: 'LONG',
  neutral: 'BEKLE',
  short: 'SHORT',
  strong_long: 'LONG',
  strong_short: 'SHORT',
}

const TERMINAL_SIGNAL_RANK: Record<string, number> = { 'STRONG': 0, 'GOOD': 1, 'NEUTRAL': 2, 'WEAK': 3, 'BAD': 4 }
const TRADE_SIGNAL_RANK: Record<string, number> = { 'LONG': 0, 'BEKLE': 1, 'SHORT': 2 }
const AI_SIGNAL_RANK: Record<string, number> = {
  'CONFLUENCE BUY': 0, 'ALPHA LONG': 1, 'HERMES LONG': 2, '-': 3,
  'HERMES SHORT': 4, 'ALPHA SHORT': 5, 'CONFLUENCE SELL': 6,
}

function getTradeSignal(score: number): TradeSignal {
  if (score <= 34) return 'LONG'
  if (score >= 92) return 'SHORT'
  return 'BEKLE'
}

function matchAISignal(tradeSignalType: string, terminalLevel: string, riskScore?: number): AISignal {
  if (tradeSignalType === 'strong_long' || tradeSignalType === 'long') {
    if ((terminalLevel === 'STRONG' || terminalLevel === 'GOOD') && riskScore !== undefined && riskScore <= 35) {
      return 'CONFLUENCE BUY'
    }
    if (terminalLevel === 'STRONG') return 'ALPHA LONG'
    if (terminalLevel === 'GOOD' || terminalLevel === 'NEUTRAL') return 'HERMES LONG'
  }
  if (tradeSignalType === 'strong_short' || tradeSignalType === 'short') {
    if ((terminalLevel === 'BAD' || terminalLevel === 'WEAK') && riskScore !== undefined && riskScore >= 65) {
      return 'CONFLUENCE SELL'
    }
    if (terminalLevel === 'BAD') return 'ALPHA SHORT'
    if (terminalLevel === 'WEAK' || terminalLevel === 'NEUTRAL') return 'HERMES SHORT'
  }
  return '-'
}

function getScoreColor(score: number): string {
  if (score <= 20) return 'text-gold-300'
  if (score <= 30) return 'text-success-400'
  if (score < 70) return 'text-text-secondary'
  if (score < 90) return 'text-warning-400'
  return 'text-danger-400'
}

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`
  return `$${mc.toFixed(0)}`
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative w-14 h-1.5 rounded-full bg-gradient-to-r from-gold-400 via-white/20 to-red-500 opacity-40">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-gold-300 rounded-full shadow-lg shadow-gold-400/30"
        style={{ left: `calc(${Math.min(100, Math.max(0, score))}% - 4px)` }}
      />
    </div>
  )
}

export default function ModuleNasdaqWatchlist() {
  const { results, watchlist, toggleWatchlistItem, fmpStocksMap } = useNasdaqTradeContext()
  const renderGuard = useSignalRenderGuard()
  const canCSV = useCanDownloadCSV()
  const [sortField, setSortField] = useState<SortField>('aiSignal')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const watchlistResults = useMemo(() => {
    const upperWatchlist = watchlist.map(s => s.toUpperCase())
    const filtered = results.filter(r => upperWatchlist.includes(r.symbol.toUpperCase()))
    return filtered.sort((a, b) => {
      let aVal: number | string = 0, bVal: number | string = 0
      const fmpA = fmpStocksMap.get(a.symbol)
      const fmpB = fmpStocksMap.get(b.symbol)
      switch (sortField) {
        case 'symbol': return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
        case 'segment': return sortDir === 'asc' ? a.segment.localeCompare(b.segment) : b.segment.localeCompare(a.segment)
        case 'price': aVal = a.quote?.price || a.hermes.price; bVal = b.quote?.price || b.hermes.price; break
        case 'change': aVal = a.quote?.changePercent || 0; bVal = b.quote?.changePercent || 0; break
        case 'score': aVal = a.hermes.score; bVal = b.hermes.score; break
        case 'terminalSignal': aVal = TERMINAL_SIGNAL_RANK[fmpA?.signal || 'NEUTRAL'] ?? 2; bVal = TERMINAL_SIGNAL_RANK[fmpB?.signal || 'NEUTRAL'] ?? 2; break
        case 'tradeSignal': aVal = TRADE_SIGNAL_RANK[getTradeSignal(a.hermes.score)]; bVal = TRADE_SIGNAL_RANK[getTradeSignal(b.hermes.score)]; break
        case 'aiSignal': {
          const aiA = matchAISignal(a.hermes.signalType, fmpA?.signal || 'NEUTRAL', fmpA?.riskScore)
          const aiB = matchAISignal(b.hermes.signalType, fmpB?.signal || 'NEUTRAL', fmpB?.riskScore)
          aVal = AI_SIGNAL_RANK[aiA] ?? 3; bVal = AI_SIGNAL_RANK[aiB] ?? 3; break
        }
        case 'rsi': aVal = a.hermes.indicators.rsi; bVal = b.hermes.indicators.rsi; break
        case 'mfi': aVal = a.hermes.indicators.mfi; bVal = b.hermes.indicators.mfi; break
        case 'marketCap': aVal = a.quote?.marketCap || 0; bVal = b.quote?.marketCap || 0; break
        case 'point52w': aVal = a.hermes.components.point52w; bVal = b.hermes.components.point52w; break
        case 'zscore': aVal = a.hermes.zscores.zscore52w; bVal = b.hermes.zscores.zscore52w; break
        case 'quality': aVal = a.hermes.multipliers.quality; bVal = b.hermes.multipliers.quality; break
        case 'confidence': aVal = fmpA?.confidence || 0; bVal = fmpB?.confidence || 0; break
        case 'rev30': aVal = (fmpA as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d || 0; bVal = (fmpB as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d || 0; break
        case 'rev90': aVal = (fmpA as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d || 0; bVal = (fmpB as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d || 0; break
        case 'valuation': {
          const vr: Record<string, number> = { 'COK UCUZ': 0, 'UCUZ': 1, 'NORMAL': 2, 'PAHALI': 3, 'COK PAHALI': 4 }
          aVal = vr[fmpA?.valuationLabel || 'NORMAL'] ?? 2; bVal = vr[fmpB?.valuationLabel || 'NORMAL'] ?? 2; break
        }
        default: aVal = a.hermes.score; bVal = b.hermes.score
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })
  }, [results, watchlist, sortField, sortDir, fmpStocksMap])

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return field }
      setSortDir(field === 'score' || field === 'aiSignal' ? 'asc' : 'desc')
      return field
    })
  }, [])

  useEffect(() => {
    if (!showSearch || searchQuery.length < 1) {
      setSearchResults([])
      return
    }
    const q = searchQuery.trim()
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nasdaq-terminal/search?q=${encodeURIComponent(q)}&limit=15`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const syms = (data.results || []).map((r: { symbol: string }) => r.symbol)
        setSearchResults(syms)
      } catch {
        if (cancelled) return
        setSearchResults([])
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [searchQuery, showSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addToWatchlist = useCallback((symbol: string) => {
    if (watchlist.includes(symbol)) return
    toggleWatchlistItem(symbol)
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }, [watchlist, toggleWatchlistItem])

  const downloadCSV = useCallback(() => {
    if (watchlistResults.length === 0) return
    const headers = CSV_HEADERS.nasdaqWatchlist
    const rows = watchlistResults.map(r => {
      const fmp = fmpStocksMap.get(r.symbol)
      const aiSig = matchAISignal(r.hermes.signalType, fmp?.signal || 'NEUTRAL', fmp?.riskScore)
      return [
        r.symbol, r.segment,
        (r.quote?.price || r.hermes.price).toFixed(2),
        (r.quote?.changePercent || 0).toFixed(2),
        fmp?.signal || 'NEUTRAL',
        TRADE_SIGNAL_LABELS[r.hermes.signalType] || 'NOTR',
        aiSig,
        r.hermes.score.toFixed(1),
        r.hermes.indicators.rsi.toFixed(1),
        r.hermes.indicators.mfi.toFixed(1),
        fmp?.confidence || '',
        ((fmp as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d ?? 0).toFixed(2),
        ((fmp as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d ?? 0).toFixed(2),
        fmp?.valuationLabel || '',
        fmp?.riskScore ?? '',
        r.quote?.marketCap || 0,
        r.hermes.components.point52w.toFixed(0),
        r.hermes.zscores.zscore52w.toFixed(2),
      ].join(',')
    })
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `hermes_nasdaq_watchlist_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }, [watchlistResults, fmpStocksMap])

  function WTH({ field, children, title }: { field: SortField; children: React.ReactNode; title?: string }) {
    const active = sortField === field
    return (
      <th
        onClick={() => handleSort(field)}
        title={title}
        className={`px-2 py-3 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors
          ${active ? 'text-gold-300' : 'text-text-tertiary hover:text-text-secondary'}`}
      >
        <span className="inline-flex items-center gap-0.5">
          {children}
          {active && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
        </span>
      </th>
    )
  }

  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2 sm:mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Star size={20} className="text-[#0d0d0d]" fill="currentColor" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">NASDAQ <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">WATCHLIST</span></h2>
            <p className="text-[10px] text-text-tertiary">{watchlistResults.length} hisse — ortak bilgi ve sinyal hazinesi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SystemFreshnessBadge compact />
          <div ref={searchRef} className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-stroke-gold-strong text-gold-300 hover:from-amber-500/25 hover:border-stroke-gold-strong transition-all"
            >
              <Plus size={12} className="inline mr-1" />Hisse Ekle
            </button>
            {showSearch && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-surface-3 border border-stroke rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-stroke-subtle">
                  <div className="flex items-center gap-2 bg-surface-3 rounded-lg px-2.5 py-1.5">
                    <Search size={13} className="text-text-tertiary flex-shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Sembol ara (AAPL, MSFT...)"
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-text-tertiary"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {searchQuery.length >= 1 && searchResults.length === 0 && (
                    <div className="p-3 text-center text-[10px] text-text-tertiary">Sonuc bulunamadi</div>
                  )}
                  {searchResults.map(sym => {
                    const added = watchlist.includes(sym)
                    return (
                      <button
                        key={sym}
                        onClick={() => !added && addToWatchlist(sym)}
                        disabled={added}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                          added ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-3 cursor-pointer'
                        }`}
                      >
                        <span className="font-mono font-bold text-white">{sym}</span>
                        {added ? <Star size={11} className="text-gold-400" fill="#f59e0b" /> : <Plus size={11} className="text-text-tertiary" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {watchlistResults.length > 0 && canCSV && (
            <button onClick={downloadCSV} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-3 text-text-tertiary border border-white/8 hover:bg-surface-3 hover:text-text-secondary transition-all">
              <Download size={12} className="inline mr-1" />CSV
            </button>
          )}
        </div>
      </div>
      <div className="mb-2">
        <LegalDisclaimerStrip compact />
      </div>

      {/* Only show warning during market hours if blocked */}
      {renderGuard.blocked && renderGuard.marketOpen && (
        <div className="mb-3 rounded-xl border border-danger-400/30 bg-danger-400/10 p-3">
          <p className="text-xs font-bold text-danger-300">SYSTEM DOWN (MARKET HOURS)</p>
          <p className="text-[10px] text-red-200/80 mt-1">
            ScanAge: {renderGuard.scanAgeMin ?? 'n/a'}m | System will auto-recover
          </p>
        </div>
      )}

      {watchlistResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
          <Star size={40} className="text-text-quaternary mb-4" />
          {watchlist.length > 0 && results.length === 0 ? (
            <>
              <h3 className="text-base sm:text-lg font-semibold text-text-secondary mb-2">Tarama Bekleniyor</h3>
              <p className="text-sm text-text-quaternary max-w-md">
                {watchlist.length} hisse izleme listenizde. Trade AI taramasi tamamlandiginda veriler burada gorunecek.
              </p>
            </>
          ) : watchlist.length > 0 ? (
            <>
              <h3 className="text-base sm:text-lg font-semibold text-text-secondary mb-2">Veri Eslesmesi Bekleniyor</h3>
              <p className="text-sm text-text-quaternary max-w-md">
                {watchlist.length} hisse izleme listenizde ama tarama sonuclarinda bulunamadi.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-base sm:text-lg font-semibold text-text-secondary mb-2">Izleme Listesi Bos</h3>
              <p className="text-sm text-text-quaternary max-w-md">
                Hisse eklemek icin TRADE AI modulunde yildiza tiklayin veya ustteki &quot;Hisse Ekle&quot; butonuyla arama yapin.
              </p>
            </>
          )}
        </div>
      )}

      {watchlistResults.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stroke-gold bg-surface-3">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1 z-10">
              <tr>
                <th className="py-2 px-2 w-8"></th>
                <WTH field="symbol">Sembol</WTH>
                <WTH field="price">Fiyat</WTH>
                <WTH field="change">Degisim</WTH>
                <WTH field="terminalSignal">Terminal AI</WTH>
                <WTH field="tradeSignal">Trade AI</WTH>
                <WTH field="aiSignal">AI Signal</WTH>
                <WTH field="score">Skor</WTH>
                <WTH field="confidence">Guven</WTH>
                <WTH field="rev30" title={REVISION_TOOLTIPS.rev30}>Rev30</WTH>
                <WTH field="rev90" title={REVISION_TOOLTIPS.rev90}>Rev90</WTH>
                <WTH field="valuation">Fiyatlama</WTH>
                <WTH field="rsi">RSI</WTH>
                <WTH field="mfi">MFI</WTH>
                <WTH field="marketCap">MCap</WTH>
                <WTH field="point52w">52W</WTH>
                <WTH field="zscore">Z</WTH>
                <WTH field="quality">Kalite</WTH>
                <th className="py-2 px-2 text-right text-[9px] text-text-tertiary uppercase tracking-wider hidden xl:table-cell" title="Hedef Fiyat">Hedef</th>
                <th className="py-2 px-2 text-right text-[9px] text-text-tertiary uppercase tracking-wider hidden xl:table-cell" title="Dip Fiyat">Dip</th>
                <th className="py-2 px-2 text-center text-[9px] text-text-tertiary uppercase tracking-wider hidden xl:table-cell" title="Risk/Odul">R:R</th>
              </tr>
            </thead>
            <tbody>
              {watchlistResults.map(result => {
                const fmp = fmpStocksMap.get(result.symbol)
                const terminalSignal = (fmp?.signal || 'NEUTRAL') as TerminalSignal
                const tradeSignal = getTradeSignal(result.hermes.score)
                const aiSignal = renderGuard.blocked
                  ? '-'
                  : matchAISignal(result.hermes.signalType, terminalSignal, fmp?.riskScore)
                const changePercent = result.quote?.changePercent || 0

                return (
                  <tr key={result.symbol} className="border-b border-white/[0.03] hover:bg-gold-500/[0.03] transition-colors group">
                    <td className="px-2 py-2.5">
                      <button onClick={() => toggleWatchlistItem(result.symbol)} className="text-text-quaternary hover:text-danger-400 p-0.5 transition-colors" title="Listeden cikar">
                        <Trash2 size={12} />
                      </button>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-white text-[11px]">{result.symbol}</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-gold-400/10 text-gold-400/70">{result.segment}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <PriceFlashCell price={result.quote?.price || result.hermes.price} className="text-[11px] font-semibold text-white" />
                    </td>
                    <td className={`px-2 py-2.5 text-right text-[11px] font-medium tabular-nums ${changePercent >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                      {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        terminalSignal === 'STRONG' ? 'text-gold-300 bg-gold-500/15 border-stroke-gold-strong' :
                        terminalSignal === 'GOOD' ? 'text-success-400 bg-success-400/10 border-success-400/25' :
                        terminalSignal === 'WEAK' ? 'text-warning-400 bg-orange-500/10 border-orange-500/25' :
                        terminalSignal === 'BAD' ? 'text-danger-400 bg-danger-400/10 border-danger-400/30' :
                        'text-text-tertiary bg-surface-2 border-stroke-subtle'
                      }`}>{terminalSignal}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        tradeSignal === 'LONG' ? 'text-success-400 bg-success-400/15 border-success-400/30' :
                        tradeSignal === 'SHORT' ? 'text-danger-400 bg-danger-400/15 border-danger-400/30' :
                        'text-text-tertiary bg-surface-2 border-stroke-subtle'
                      }`}>{tradeSignal}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        aiSignal === 'CONFLUENCE BUY' ? 'text-info-400 bg-info-400/15 border-info-400/30' :
                        aiSignal === 'ALPHA LONG' ? 'text-gold-300 bg-gold-500/15 border-stroke-gold-strong' :
                        aiSignal === 'HERMES LONG' ? 'text-success-400 bg-success-400/10 border-success-400/25' :
                        aiSignal === 'HERMES SHORT' ? 'text-danger-400 bg-danger-400/10 border-danger-400/30' :
                        aiSignal === 'ALPHA SHORT' ? 'text-danger-400 bg-red-600/15 border-red-600/30' :
                        aiSignal === 'CONFLUENCE SELL' ? 'text-fuchsia-400 bg-fuchsia-600/15 border-fuchsia-600/30' :
                        'text-text-tertiary bg-transparent border-transparent'
                      }`}>{aiSignal}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-sm w-7 ${getScoreColor(result.hermes.score)}`}>{Math.round(result.hermes.score)}</span>
                        <ScoreBar score={result.hermes.score} />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold tabular-nums ${(fmp?.confidence || 0) >= 70 ? 'text-gold-400' : (fmp?.confidence || 0) >= 50 ? 'text-text-secondary' : 'text-text-quaternary'}`}>
                        {fmp?.confidence ? `%${Math.round(fmp.confidence)}` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {(() => {
                        const v = (fmp as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d || 0
                        return (
                          <span className={`text-[10px] tabular-nums ${v > 0 ? 'text-success-400/80' : v < 0 ? 'text-danger-400/80' : 'text-text-quaternary'}`}>
                            {v !== 0 ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—'}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {(() => {
                        const v = (fmp as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d || 0
                        return (
                          <span className={`text-[10px] tabular-nums ${v > 0 ? 'text-success-400/70' : v < 0 ? 'text-danger-400/70' : 'text-text-quaternary'}`}>
                            {v !== 0 ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—'}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        fmp?.valuationLabel === 'COK UCUZ' ? 'text-success-400 bg-success-400/15' :
                        fmp?.valuationLabel === 'UCUZ' ? 'text-success-400 bg-success-400/10' :
                        fmp?.valuationLabel === 'PAHALI' ? 'text-warning-400 bg-orange-500/10' :
                        fmp?.valuationLabel === 'COK PAHALI' ? 'text-danger-400 bg-danger-400/10' :
                        'text-text-tertiary bg-surface-3'
                      }`}>{fmp?.valuationLabel || '—'}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span className={`text-[11px] font-mono ${result.hermes.indicators.rsi >= 70 ? 'text-danger-400' : result.hermes.indicators.rsi <= 30 ? 'text-success-400' : 'text-text-secondary'}`}>
                        {Math.round(result.hermes.indicators.rsi)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span className={`text-[11px] font-mono ${result.hermes.indicators.mfi >= 80 ? 'text-danger-400' : result.hermes.indicators.mfi <= 20 ? 'text-success-400' : 'text-text-secondary'}`}>
                        {Math.round(result.hermes.indicators.mfi)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[11px] text-text-secondary tabular-nums">{formatMarketCap(result.quote?.marketCap || 0)}</td>
                    <td className="px-2 py-2.5 text-right">
                      <span className={`text-[11px] font-mono ${getScoreColor(result.hermes.components.point52w)}`}>{Math.round(result.hermes.components.point52w)}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[11px] font-mono text-text-secondary">{result.hermes.zscores.zscore52w.toFixed(2)}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[10px] ${result.hermes.multipliers.quality > 0.9 ? 'text-success-400' : result.hermes.multipliers.quality < 0.7 ? 'text-danger-400' : 'text-gold-300'}`}>
                        {result.hermes.multipliers.quality.toFixed(2)}
                      </span>
                    </td>
                    {(() => {
                      const pt = result.priceTarget
                      const p = result.quote?.price || result.hermes.price
                      const tgt = pt?.targetPrice || fmp?.priceTarget || 0
                      const flr = pt?.floorPrice || fmp?.yearLow || 0
                      const tgtPct = tgt > 0 && p > 0 ? ((tgt - p) / p) * 100 : 0
                      const flrPct = flr > 0 && p > 0 ? ((p - flr) / p) * 100 : 0
                      const rr = flrPct > 0.01 ? Math.abs(tgtPct) / flrPct : 0
                      return (
                        <>
                          <td className="px-2 py-2.5 text-right hidden xl:table-cell">
                            {tgt > 0 ? (
                              <span className={`text-[11px] font-mono font-semibold ${tgtPct >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                                ${tgt.toFixed(2)}
                              </span>
                            ) : <span className="text-text-tertiary text-[10px]">{'\u2014'}</span>}
                          </td>
                          <td className="px-2 py-2.5 text-right hidden xl:table-cell">
                            {flr > 0 ? (
                              <span className="text-[11px] font-mono text-danger-400/80">${flr.toFixed(2)}</span>
                            ) : <span className="text-text-tertiary text-[10px]">{'\u2014'}</span>}
                          </td>
                          <td className="px-2 py-2.5 text-center hidden xl:table-cell">
                            {rr > 0 ? (
                              <span className={`text-[11px] font-mono font-bold ${rr >= 2 ? 'text-success-400' : rr >= 1 ? 'text-gold-300' : 'text-danger-400'}`}>
                                {rr.toFixed(1)}
                              </span>
                            ) : <span className="text-text-tertiary text-[10px]">{'\u2014'}</span>}
                          </td>
                        </>
                      )
                    })()}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
