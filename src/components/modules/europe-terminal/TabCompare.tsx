'use client'

import { useState, useEffect } from 'react'
import { GitCompare, X, AlertTriangle } from 'lucide-react'

interface CompareStock {
  symbol: string
  companyName: string
  price: number
  changePercent: number
  marketCap: number
  pe: number
  roe: number
  debtEquity: number
  dividendYield: number
  signalScore: number
  signal: string
  exchange: string
  currency: string
}

export default function TabCompare({ symbols, onRemoveSymbol, onSelectSymbol }: {
  symbols: string[]
  onRemoveSymbol: (s: string) => void
  onSelectSymbol: (s: string) => void
}) {
  const [stocks, setStocks] = useState<CompareStock[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (symbols.length === 0) return
    setLoading(true)
    Promise.all(
      symbols.map(s =>
        fetch(`/api/europe-terminal/stock/${encodeURIComponent(s)}`)
          .then(r => r.json())
          .then(d => ({ symbol: s, ...d.profile, ...d.ratios, ...d.score }))
          .catch(() => null)
      )
    ).then(results => {
      setStocks(results.filter(Boolean) as CompareStock[])
      setLoading(false)
    })
  }, [symbols])

  if (symbols.length === 0) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center">
      <GitCompare size={32} className="text-blue-400/30 mb-3" />
      <p className="text-white/40 text-sm">Karsilastirmak icin hisse ekleyin (maks 4)</p>
      <p className="text-white/25 text-xs mt-1">Hisse detay sayfasindan + Karsilastir butonuna tiklayin</p>
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <GitCompare size={16} className="text-blue-400" />
        <span className="text-xs text-white/40 font-semibold tracking-wider">KARSILASTIRILIYOR</span>
        {symbols.map(s => (
          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300">
            {s}
            <button onClick={() => onRemoveSymbol(s)} className="text-blue-300/50 hover:text-blue-300">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0e0e18]">
                <tr>
                  <th className="px-3 py-2 text-[11px] text-white/50 font-semibold text-left">Metrik</th>
                  {stocks.map(s => (
                    <th key={s.symbol} className="px-3 py-2 text-sm text-white font-bold text-center">{s.symbol}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Fiyat', key: 'price', fmt: (v: number) => v?.toFixed(2) },
                  { label: 'Degisim %', key: 'changePercent', fmt: (v: number) => v ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : 'N/A' },
                  { label: 'Piyasa Degeri', key: 'marketCap', fmt: (v: number) => v ? `${(v / 1e9).toFixed(1)}B` : 'N/A' },
                  { label: 'F/K', key: 'pe', fmt: (v: number) => v?.toFixed(1) || 'N/A' },
                  { label: 'ROE', key: 'roe', fmt: (v: number) => v ? `${v.toFixed(1)}%` : 'N/A' },
                  { label: 'Borc/Oz', key: 'debtEquity', fmt: (v: number) => v?.toFixed(2) || 'N/A' },
                  { label: 'Temettu', key: 'dividendYield', fmt: (v: number) => v ? `${v.toFixed(2)}%` : 'N/A' },
                  { label: 'HERMES Skor', key: 'signalScore', fmt: (v: number) => v?.toString() || 'N/A' },
                  { label: 'Sinyal', key: 'signal', fmt: (v: string) => v || 'N/A' },
                ].map(row => (
                  <tr key={row.label} className="border-t border-white/[0.04]">
                    <td className="px-3 py-2 text-xs text-white/50 font-medium">{row.label}</td>
                    {stocks.map(s => (
                      <td key={s.symbol} className="px-3 py-2 text-sm text-white/70 text-center tabular-nums">
                        {row.fmt((s as unknown as Record<string, unknown>)[row.key] as never)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
