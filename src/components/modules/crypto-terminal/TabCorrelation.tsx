'use client'

// HERMES AI CRYPTO TERMINAL — Tab: KORELASYON MATRISI (K16)
// Correlation matrix between top cryptocurrencies using 7d sparkline data

import { useState, useEffect, useMemo } from 'react'
import { Grid3X3 } from 'lucide-react'

interface CorrelationCoin {
  id: string
  symbol: string
  sparkline: number[]
}

interface TabCorrelationProps {
  onSelectCoin: (id: string) => void
}

function calculateCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 3) return 0
  const n = a.length
  const meanA = a.reduce((s, v) => s + v) / n
  const meanB = b.reduce((s, v) => s + v) / n

  let cov = 0, varA = 0, varB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }

  const denom = Math.sqrt(varA * varB)
  return denom === 0 ? 0 : cov / denom
}

function getCorrelationColor(r: number): string {
  if (r > 0.7) return 'bg-emerald-500'
  if (r > 0.4) return 'bg-emerald-500/60'
  if (r > 0.1) return 'bg-emerald-500/30'
  if (r > -0.1) return 'bg-white/5'
  if (r > -0.4) return 'bg-red-500/30'
  if (r > -0.7) return 'bg-red-500/60'
  return 'bg-red-500'
}

function getCorrelationText(r: number): string {
  if (r > 0.7) return 'text-white'
  if (r > 0.4) return 'text-emerald-200'
  if (r > -0.4) return 'text-text-tertiary'
  if (r > -0.7) return 'text-red-200'
  return 'text-white'
}

export default function TabCorrelation({ onSelectCoin }: TabCorrelationProps) {
  const [coins, setCoins] = useState<CorrelationCoin[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(15)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/crypto-terminal/coins?limit=1000')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        const rawCoins = data.coins || []

        const corCoins: CorrelationCoin[] = rawCoins
          .filter((c: any) => c.sparkline7d?.length > 10)
          .map((c: any) => ({
            id: c.id,
            symbol: c.symbol?.toUpperCase() || '',
            sparkline: c.sparkline7d,
          }))

        setCoins(corCoins)
      } catch {
        setCoins([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const displayCoins = coins.slice(0, count)

  const matrix = useMemo(() => {
    const n = displayCoins.length
    const corr: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          corr[i][j] = 1
        } else {
          const r = calculateCorrelation(displayCoins[i].sparkline, displayCoins[j].sparkline)
          corr[i][j] = r
          corr[j][i] = r
        }
      }
    }
    return corr
  }, [displayCoins])

  return (
    <div className="space-y-2 sm:space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white">KORELASYON MATRISI</h3>
          <span className="text-[10px] text-text-tertiary">7 gunluk fiyat korelasyonu</span>
        </div>
        <div className="flex items-center gap-1">
          {[10, 20, 50].map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${
                count === n ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/8 text-amber-300 border-amber-500/35 shadow-sm shadow-amber-500/10 scale-[1.02]' : 'text-text-tertiary hover:text-amber-200/80 border-stroke-subtle hover:border-amber-500/20 hover:shadow-sm hover:shadow-amber-500/5'
              }`}
            >
              Top {n}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 sm:gap-2 justify-center text-[9px]">
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-red-500" /><span className="text-text-tertiary">-1.0</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-red-500/40" /><span className="text-text-tertiary">-0.5</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-white/10" /><span className="text-text-tertiary">0</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-emerald-500/40" /><span className="text-text-tertiary">+0.5</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-emerald-500" /><span className="text-text-tertiary">+1.0</span></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="bg-surface-1 rounded-2xl border border-stroke-subtle p-2 sm:p-3 inline-block min-w-full">
            <table className="border-separate border-spacing-0.5">
              <thead>
                <tr>
                  <th className="w-12" />
                  {displayCoins.map(c => (
                    <th key={c.id} className="text-[8px] text-text-tertiary font-medium px-0.5 pb-1 text-center w-10" style={{ writingMode: 'vertical-rl' }}>
                      {c.symbol}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayCoins.map((row, i) => (
                  <tr key={row.id}>
                    <td className="text-[9px] text-text-tertiary font-medium pr-2 text-right whitespace-nowrap">
                      <button onClick={() => onSelectCoin(row.id)} className="hover:text-amber-400 transition-colors">
                        {row.symbol}
                      </button>
                    </td>
                    {displayCoins.map((col, j) => {
                      const r = matrix[i]?.[j] ?? 0
                      const cellSize = count > 30 ? 'w-5 h-4' : count > 15 ? 'w-7 h-6' : 'w-8 h-7 sm:w-10 sm:h-8'
                      const textSize = count > 30 ? 'text-[5px]' : count > 15 ? 'text-[6px]' : 'text-[7px] sm:text-[8px]'
                      return (
                        <td key={col.id}>
                          <div
                            className={`${cellSize} rounded flex items-center justify-center cursor-default ${getCorrelationColor(r)}`}
                            title={`${row.symbol} / ${col.symbol}: ${r.toFixed(2)}`}
                          >
                            <span className={`${textSize} font-mono font-medium ${getCorrelationText(r)}`}>
                              {i === j ? '' : count > 30 ? '' : r.toFixed(2)}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interpretation */}
      <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-2 sm:p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
        <h4 className="text-[10px] font-bold text-text-tertiary mb-1.5">YORUM</h4>
        <p className="text-[10px] text-text-quaternary leading-relaxed">
          Yuksek pozitif korelasyon (yeYil): Coinler birlikte hareket ediyor — ceslilendirme faydasi dusuk.
          Negatif korelasyon (kirmizi): Coinler zit hareket ediyor — hedge potansiyeli yuksek.
          Sifira yakin: Bagimsiz hareket — en iyi cesitlendirme.
        </p>
      </div>
    </div>
  )
}
