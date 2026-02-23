'use client'

import { useState, useMemo } from 'react'
import { useEuropeTradeContext } from '../EuropeLayout'
import { ScanResult } from '@/lib/types'
import { EUROPE_EXCHANGES } from '@/lib/europe-config'

type SignalType = 'CONFLUENCE_BUY' | 'ALPHA_LONG' | 'HERMES_LONG' | 'HERMES_SHORT' | 'ALPHA_SHORT' | 'CONFLUENCE_SELL'

interface CrossSignal {
  type: SignalType
  symbol: string
  tradeSignal: string
  tradeScore: number
  fmpSignal?: string
  fmpScore?: number
  riskScore?: number
  price: number
  change: number
  exchange?: string
}

const SIGNAL_CONFIG: Record<SignalType, { label: string; color: string; bg: string; border: string; direction: 'LONG' | 'SHORT' }> = {
  CONFLUENCE_BUY: { label: 'KONSENSUS ALIS', color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30', direction: 'LONG' },
  ALPHA_LONG: { label: 'ALFA ALIS', color: 'text-hermes-green', bg: 'bg-hermes-green/15', border: 'border-hermes-green/30', direction: 'LONG' },
  HERMES_LONG: { label: 'HERMES ALIS', color: 'text-hermes-green/80', bg: 'bg-hermes-green/10', border: 'border-hermes-green/20', direction: 'LONG' },
  HERMES_SHORT: { label: 'HERMES SATIS', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', direction: 'SHORT' },
  ALPHA_SHORT: { label: 'ALFA SATIS', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', direction: 'SHORT' },
  CONFLUENCE_SELL: { label: 'KONSENSUS SATIS', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/40', direction: 'SHORT' },
}

function matchSignal(r: ScanResult, fmpLookup: Map<string, { signal: string; fmpScore: number; riskScore: number }>): CrossSignal | null {
  const fmp = fmpLookup.get(r.symbol)
  const signalType = r.hermes.signalType
  const isLong = signalType === 'strong_long' || signalType === 'long'
  const isShort = signalType === 'strong_short' || signalType === 'short'
  const fmpStrong = fmp && (fmp.signal === 'STRONG' || fmp.signal === 'GOOD')
  const fmpWeak = fmp && (fmp.signal === 'WEAK' || fmp.signal === 'BAD')

  let type: SignalType | null = null
  if (isLong && fmpStrong && fmp && fmp.riskScore <= 35) type = 'CONFLUENCE_BUY'
  else if (isLong && fmpStrong) type = 'ALPHA_LONG'
  else if (isLong && fmp && (fmp.signal === 'GOOD' || fmp.signal === 'NEUTRAL')) type = 'HERMES_LONG'
  else if (isShort && fmpWeak && fmp && fmp.riskScore >= 65) type = 'CONFLUENCE_SELL'
  else if (isShort && fmpWeak) type = 'ALPHA_SHORT'
  else if (isShort && fmp && (fmp.signal === 'WEAK' || fmp.signal === 'NEUTRAL')) type = 'HERMES_SHORT'

  if (!type) return null

  const exConfig = Object.values(EUROPE_EXCHANGES).find(e => typeof r.symbol === 'string' && e.symbolSuffix && r.symbol.endsWith(e.symbolSuffix))
  return {
    type, symbol: r.symbol, tradeSignal: signalType, tradeScore: r.hermes.score,
    fmpSignal: fmp?.signal, fmpScore: fmp?.fmpScore, riskScore: fmp?.riskScore,
    price: r.quote?.price ?? r.hermes.price, change: r.quote?.changePercent ?? 0, exchange: exConfig?.shortLabel,
  }
}

export default function ModuleEuropeSignals() {
  const ctx = useEuropeTradeContext()
  const [activeFilter, setActiveFilter] = useState<SignalType | 'all'>('all')

  const signals = useMemo(() => {
    const all: CrossSignal[] = []
    for (const r of ctx.results) {
      const fmpItem = ctx.fmpStocksMap.get(r.symbol)
      const fmpLookup = new Map<string, { signal: string; fmpScore: number; riskScore: number }>()
      if (fmpItem) fmpLookup.set(r.symbol, { signal: fmpItem.signal || 'NEUTRAL', fmpScore: fmpItem.valuationScore ?? 50, riskScore: fmpItem.riskScore ?? 50 })
      const sig = matchSignal(r, fmpLookup)
      if (sig) all.push(sig)
    }
    return all
  }, [ctx.results, ctx.fmpStocksMap])

  const filtered = activeFilter === 'all' ? signals : signals.filter(s => s.type === activeFilter)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: signals.length }
    for (const s of signals) c[s.type] = (c[s.type] || 0) + 1
    return c
  }, [signals])

  if (ctx.loading && ctx.results.length === 0) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="w-14 h-14 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      <p className="text-sm text-white/50 mt-4">Capraz sinyaller analiz ediliyor...</p>
    </div>
  )

  return (
    <div className="max-w-[1920px] mx-auto animate-fade-in space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">⚡</span>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white">AVRUPA AI <span className="text-blue-400 font-extrabold">SINYALLER</span></h2>
          <p className="text-[10px] text-white/35">Trade AI + Terminal AI Capraz Sinyaller • {signals.length} sinyal</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setActiveFilter('all')}
          className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-all ${
            activeFilter === 'all' ? 'text-blue-300 bg-blue-500/15 border-blue-500/25 ring-1 ring-blue-400/15' : 'text-white/40 bg-white/[0.02] border-white/[0.05]'
          }`}>Tumu ({counts.all || 0})</button>
        {(Object.entries(SIGNAL_CONFIG) as [SignalType, typeof SIGNAL_CONFIG[SignalType]][]).map(([key, cfg]) => (
          <button key={key} onClick={() => setActiveFilter(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-all ${
              activeFilter === key ? `${cfg.color} ${cfg.bg} ${cfg.border} ring-1 ring-white/10` : 'text-white/35 bg-white/[0.02] border-white/[0.04]'
            }`}>{cfg.label} ({counts[key] || 0})</button>
        ))}
      </div>

      {/* Signal Cards */}
      {filtered.length === 0 ? (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-8 text-center">
          <p className="text-white/40 text-sm">Capraz sinyal tespit edilemedi</p>
          <p className="text-white/25 text-xs mt-1">Sinyaller icin hem Trade AI hem Terminal AI verisi gereklidir</p>
        </div>
      ) : (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#0e0e18] z-10">
                <tr className="border-b border-white/[0.08]">
                  <th className="px-2 py-2 text-[10px] text-white/50 font-semibold text-left">SINYAL</th>
                  <th className="px-2 py-2 text-[10px] text-white/50 font-semibold text-left">SEMBOL</th>
                  <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-left">BORSA</th>
                  <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">FIYAT</th>
                  <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">DEG%</th>
                  <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">TRADE</th>
                  <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">AI SKOR</th>
                  <th className="px-1 py-2 text-[10px] text-white/50 font-semibold text-right">RISK</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, idx) => {
                  const cfg = SIGNAL_CONFIG[sig.type]
                  return (
                    <tr key={`${sig.symbol}-${idx}`} className={`border-b border-white/[0.03] hover:bg-blue-500/[0.04] transition-colors ${idx % 2 ? 'bg-white/[0.01]' : ''}`}>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-2 py-2"><span className="text-sm font-bold text-white">{sig.symbol}</span></td>
                      <td className="px-1 py-2"><span className="text-[10px] text-white/40">{sig.exchange || ''}</span></td>
                      <td className="px-1 py-2 text-right"><span className="text-sm text-white/80 tabular-nums">{sig.price?.toFixed(2)}</span></td>
                      <td className="px-1 py-2 text-right">
                        <span className={`text-xs tabular-nums font-semibold ${sig.change >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                          {sig.change >= 0 ? '+' : ''}{sig.change?.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right"><span className="text-xs text-white/50 tabular-nums">{sig.tradeScore}</span></td>
                      <td className="px-1 py-2 text-right"><span className="text-xs text-white/50 tabular-nums">{sig.fmpScore || '\u2014'}</span></td>
                      <td className="px-1 py-2 text-right">
                        <span className={`text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full ${
                          (sig.riskScore || 50) <= 30 ? 'text-hermes-green bg-hermes-green/10' :
                          (sig.riskScore || 50) <= 60 ? 'text-amber-400 bg-amber-500/10' :
                          'text-red-400 bg-red-500/10'
                        }`}>{sig.riskScore || '\u2014'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
