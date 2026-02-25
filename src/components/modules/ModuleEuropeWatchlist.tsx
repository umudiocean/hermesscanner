'use client'

import { useMemo, useState, useCallback } from 'react'
import { useEuropeTradeContext } from '../EuropeLayout'
import { Star, Download, ChevronUp, ChevronDown } from 'lucide-react'
import { EUROPE_EXCHANGES } from '@/lib/europe-config'
import { PriceFlashCell, ScoreMiniBar } from '../premium-ui'
import SystemFreshnessBadge from '../SystemFreshnessBadge'
import { useSignalRenderGuard } from '@/lib/hooks/useSignalRenderGuard'
import LegalDisclaimerStrip from '../LegalDisclaimerStrip'
import { useCanDownloadCSV } from '@/lib/hooks/useFeatureFlags'
import { CSV_HEADERS, REVISION_TOOLTIPS } from './shared/revision-contract'

export default function ModuleEuropeWatchlist() {
  const ctx = useEuropeTradeContext()
  const renderGuard = useSignalRenderGuard()
  const canCSV = useCanDownloadCSV()
  const { watchlist, results, fmpStocksMap, toggleWatchlistItem } = ctx
  const [sortField, setSortField] = useState<'symbol' | 'price' | 'change' | 'trade' | 'ai' | 'rev30' | 'rev90'>('symbol')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const watchlistData = useMemo(() => {
    const list = watchlist.map(symbol => {
      const scan = results.find(r => r.symbol === symbol)
      const fmp = fmpStocksMap.get(symbol)
      const exConfig = Object.values(EUROPE_EXCHANGES).find(e => typeof symbol === 'string' && e.symbolSuffix && symbol.endsWith(e.symbolSuffix))
      return { symbol, scan, fmp, exchange: exConfig }
    }).filter(w => w.scan || w.fmp)

    list.sort((a, b) => {
      const aPrice = a.scan?.quote?.price ?? a.scan?.hermes?.price ?? 0
      const bPrice = b.scan?.quote?.price ?? b.scan?.hermes?.price ?? 0
      const aChange = a.scan?.quote?.changePercent ?? 0
      const bChange = b.scan?.quote?.changePercent ?? 0
      const aTrade = a.scan?.hermes?.score ?? 0
      const bTrade = b.scan?.hermes?.score ?? 0
      const aAi = a.fmp?.valuationScore ?? 0
      const bAi = b.fmp?.valuationScore ?? 0
      const aRev30 = (a.fmp as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d ?? 0
      const bRev30 = (b.fmp as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d ?? 0
      const aRev90 = (a.fmp as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d ?? 0
      const bRev90 = (b.fmp as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d ?? 0

      let diff = 0
      switch (sortField) {
        case 'symbol': diff = a.symbol.localeCompare(b.symbol); break
        case 'price': diff = aPrice - bPrice; break
        case 'change': diff = aChange - bChange; break
        case 'trade': diff = aTrade - bTrade; break
        case 'ai': diff = aAi - bAi; break
        case 'rev30': diff = aRev30 - bRev30; break
        case 'rev90': diff = aRev90 - bRev90; break
      }
      return sortDir === 'asc' ? diff : -diff
    })

    return list
  }, [watchlist, results, fmpStocksMap, sortField, sortDir])

  const handleSort = useCallback((field: 'symbol' | 'price' | 'change' | 'trade' | 'ai' | 'rev30' | 'rev90') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortField(field)
    setSortDir(field === 'symbol' ? 'asc' : 'desc')
  }, [sortField])

  const downloadCSV = useCallback(() => {
    if (watchlistData.length === 0) return
    const header = CSV_HEADERS.europeWatchlist
    const rows = watchlistData.map(w => {
      const price = w.scan?.quote?.price ?? w.scan?.hermes?.price ?? 0
      const changePct = w.scan?.quote?.changePercent ?? 0
      const tradeScore = w.scan?.hermes?.score ?? 0
      const rev30 = (w.fmp as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d ?? 0
      const rev90 = (w.fmp as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d ?? 0
      return [
        w.symbol,
        w.exchange?.shortLabel || '',
        price.toFixed(2),
        changePct.toFixed(2),
        tradeScore.toFixed(2),
        w.fmp?.signal || '',
        w.fmp?.valuationScore ?? '',
        rev30.toFixed(2),
        rev90.toFixed(2),
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.download = `hermes_europe_watchlist_${ts}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [watchlistData])

  if (watchlist.length === 0) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center animate-fade-in">
      <Star size={36} className="text-blue-400/30 mb-3" />
      <p className="text-white/50 text-sm">Avrupa takip listeniz bos</p>
      <p className="text-white/30 text-xs mt-1">Trade AI veya Terminal sekmelerinden yildiz ikonuyla hisse ekleyin</p>
    </div>
  )

  return (
    <div className="max-w-[1920px] mx-auto animate-fade-in space-y-3">
      <div className="flex items-center gap-3">
        <Star size={18} className="text-amber-400" fill="currentColor" />
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white">AVRUPA <span className="text-blue-400 font-extrabold">TAKIP LISTESI</span></h2>
          <p className="text-[10px] text-white/35">{watchlist.length} hisse takip ediliyor</p>
        </div>
        <div className="ml-auto">
          <SystemFreshnessBadge compact />
        </div>
        {canCSV && (
          <button
            onClick={downloadCSV}
            disabled={watchlistData.length === 0 || renderGuard.blocked}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border bg-blue-500/10 border-blue-500/25 text-blue-300 hover:bg-blue-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Download size={12} className="inline mr-1" />CSV
          </button>
        )}
      </div>
      <LegalDisclaimerStrip compact />

      {renderGuard.blocked && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs font-bold text-red-300">WATCHLIST AI SIGNAL MASKED (SYSTEM DOWN)</p>
          <p className="text-[10px] text-red-200/80 mt-1">
            Reason: {renderGuard.reason} | ScanAge: {renderGuard.scanAgeMin ?? 'n/a'}m | QuoteAge: {renderGuard.quoteAgeMin ?? 'n/a'}m
          </p>
        </div>
      )}
      {!renderGuard.blocked && renderGuard.staleWarning && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-bold text-amber-300">FRESHNESS WARNING</p>
          <p className="text-[10px] text-amber-200/80 mt-1">
            Scan verisi guncel olmayabilir. ScanAge: {renderGuard.scanAgeMin ?? 'n/a'}m | QuoteAge: {renderGuard.quoteAgeMin ?? 'n/a'}m
          </p>
        </div>
      )}

      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#0e0e18]">
              <tr className="border-b border-white/[0.08]">
                <th className="px-2 py-2 text-[10px] text-white/50 font-semibold text-left cursor-pointer" onClick={() => handleSort('symbol')}>
                  <span className="inline-flex items-center gap-0.5">SEMBOL {sortField === 'symbol' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-left">BORSA</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right cursor-pointer" onClick={() => handleSort('price')}>
                  <span className="inline-flex items-center gap-0.5">FIYAT {sortField === 'price' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right cursor-pointer" onClick={() => handleSort('change')}>
                  <span className="inline-flex items-center gap-0.5">DEG% {sortField === 'change' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right cursor-pointer" onClick={() => handleSort('trade')}>
                  <span className="inline-flex items-center gap-0.5">TRADE SKOR {sortField === 'trade' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">AI SINYAL</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right cursor-pointer" onClick={() => handleSort('ai')}>
                  <span className="inline-flex items-center gap-0.5">AI SKOR {sortField === 'ai' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right cursor-pointer" onClick={() => handleSort('rev30')} title={REVISION_TOOLTIPS.rev30}>
                  <span className="inline-flex items-center gap-0.5">REV30 {sortField === 'rev30' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right cursor-pointer" onClick={() => handleSort('rev90')} title={REVISION_TOOLTIPS.rev90}>
                  <span className="inline-flex items-center gap-0.5">REV90 {sortField === 'rev90' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-center">CIKAR</th>
              </tr>
            </thead>
            <tbody>
              {watchlistData.map((w, idx) => {
                const price = w.scan?.quote?.price ?? w.scan?.hermes?.price ?? 0
                const changePct = w.scan?.quote?.changePercent ?? 0
                const tradeScore = w.scan?.hermes?.score ?? 0

                return (
                  <tr key={w.symbol} className={`border-b border-white/[0.03] hover:bg-blue-500/[0.04] transition-colors ${idx % 2 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="px-2 py-2"><span className="text-sm font-bold text-white">{w.symbol}</span></td>
                    <td className="px-1 py-2">
                      <span className="text-[10px] text-white/40">
                        {w.exchange ? `${w.exchange.flag} ${w.exchange.shortLabel}` : ''}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <PriceFlashCell price={price} className="text-sm text-white/80" />
                    </td>
                    <td className="px-1 py-2 text-right">
                      {w.scan ? (
                        <span className={`text-xs tabular-nums font-semibold ${changePct >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                        </span>
                      ) : <span className="text-white/30">{'\u2014'}</span>}
                    </td>
                    <td className="px-1 py-2 text-right">
                      {w.scan ? <ScoreMiniBar value={tradeScore} maxWidth={36} /> : <span className="text-white/30">{'\u2014'}</span>}
                    </td>
                    <td className="px-1 py-2 text-right">
                      {!renderGuard.blocked && w.fmp?.signal ? (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          w.fmp.signal === 'STRONG' ? 'text-amber-400 bg-amber-500/15' :
                          w.fmp.signal === 'GOOD' ? 'text-hermes-green bg-hermes-green/15' :
                          w.fmp.signal === 'WEAK' ? 'text-orange-400 bg-orange-500/15' :
                          w.fmp.signal === 'BAD' ? 'text-red-400 bg-red-500/15' :
                          'text-white/40 bg-white/[0.04]'
                        }`}>{w.fmp.signal}</span>
                      ) : <span className="text-white/30">{'\u2014'}</span>}
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-xs text-white/50 tabular-nums">{renderGuard.blocked ? '\u2014' : (w.fmp?.valuationScore ?? '\u2014')}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      {renderGuard.blocked ? (
                        <span className="text-white/30">{'\u2014'}</span>
                      ) : (() => {
                        const v = (w.fmp as { analystEpsRevision30d?: number } | undefined)?.analystEpsRevision30d || 0
                        return (
                          <span className={`text-[10px] tabular-nums ${v > 0 ? 'text-hermes-green/80' : v < 0 ? 'text-red-400/80' : 'text-white/35'}`}>
                            {v !== 0 ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '\u2014'}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-1 py-2 text-right">
                      {renderGuard.blocked ? (
                        <span className="text-white/30">{'\u2014'}</span>
                      ) : (() => {
                        const v = (w.fmp as { analystEpsRevision90d?: number } | undefined)?.analystEpsRevision90d || 0
                        return (
                          <span className={`text-[10px] tabular-nums ${v > 0 ? 'text-hermes-green/70' : v < 0 ? 'text-red-400/70' : 'text-white/35'}`}>
                            {v !== 0 ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '\u2014'}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-1 py-2 text-center">
                      <button onClick={() => toggleWatchlistItem(w.symbol)}
                        className="text-amber-400 hover:text-red-400 transition-colors p-1">
                        <Star size={14} fill="currentColor" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {watchlistData.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-white/30 text-sm">
                  Takip listenizdeki hisseler icin veri yok — tarama devam ediyor olabilir
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
