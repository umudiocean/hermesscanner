'use client'

import { useMemo } from 'react'
import { useEuropeTradeContext } from '../EuropeLayout'
import { Star } from 'lucide-react'
import { EUROPE_EXCHANGES } from '@/lib/europe-config'
import { PriceFlashCell, ScoreMiniBar } from '../premium-ui'

export default function ModuleEuropeWatchlist() {
  const ctx = useEuropeTradeContext()
  const { watchlist, results, fmpStocksMap, toggleWatchlistItem } = ctx

  const watchlistData = useMemo(() => {
    return watchlist.map(symbol => {
      const scan = results.find(r => r.symbol === symbol)
      const fmp = fmpStocksMap.get(symbol)
      const exConfig = Object.values(EUROPE_EXCHANGES).find(e => typeof symbol === 'string' && e.symbolSuffix && symbol.endsWith(e.symbolSuffix))
      return { symbol, scan, fmp, exchange: exConfig }
    }).filter(w => w.scan || w.fmp)
  }, [watchlist, results, fmpStocksMap])

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
      </div>

      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#0e0e18]">
              <tr className="border-b border-white/[0.08]">
                <th className="px-2 py-2 text-[10px] text-white/50 font-semibold text-left">SEMBOL</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-left">BORSA</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">FIYAT</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">DEG%</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">TRADE SKOR</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">AI SINYAL</th>
                <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">AI SKOR</th>
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
                      {w.fmp?.signal ? (
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
                      <span className="text-xs text-white/50 tabular-nums">{w.fmp?.valuationScore ?? '\u2014'}</span>
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
                <tr><td colSpan={8} className="px-4 py-6 text-center text-white/30 text-sm">
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
