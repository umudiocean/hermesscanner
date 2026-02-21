'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab 6: KARSILASTIRMA (Compare Mode)
// 2-4 hisseyi yan yana karşılaştırma
// Radar chart, metrik tablosu, skor karşılaştırması
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { StockDetailData, FMPScore, CATEGORY_LABELS, FMP_SCORE_WEIGHTS, getScoreLevel, getScoreColor } from '@/lib/fmp-terminal/fmp-types'
import ScoreGauge from './ScoreGauge'

interface TabCompareProps {
  symbols: string[]
  onRemoveSymbol: (symbol: string) => void
  onSelectSymbol: (symbol: string) => void
}

interface CompareData {
  symbol: string
  data: StockDetailData | null
  loading: boolean
}

export default function TabCompare({ symbols, onRemoveSymbol, onSelectSymbol }: TabCompareProps) {
  const [items, setItems] = useState<CompareData[]>([])
  const [addInput, setAddInput] = useState('')

  useEffect(() => {
    const fetchAll = async () => {
      const results: CompareData[] = symbols.map(s => ({ symbol: s, data: null, loading: true }))
      setItems(results)

      await Promise.allSettled(
        symbols.map(async (symbol, idx) => {
          try {
            const res = await fetch(`/api/fmp-terminal/stock/${symbol}`)
            if (res.ok) {
              const data = await res.json()
              setItems(prev => prev.map((item, i) => i === idx ? { ...item, data, loading: false } : item))
            } else {
              setItems(prev => prev.map((item, i) => i === idx ? { ...item, loading: false } : item))
            }
          } catch {
            setItems(prev => prev.map((item, i) => i === idx ? { ...item, loading: false } : item))
          }
        })
      )
    }

    if (symbols.length > 0) fetchAll()
    else setItems([])
  }, [symbols])

  if (symbols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <span className="text-4xl sm:text-5xl mb-3 sm:mb-4">⚖️</span>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Karsilastirma Modu</h3>
        <p className="text-white/40 text-sm mb-3 sm:mb-4">Hisse Profili sekmesinden hisseleri karsilastirmaya ekleyin</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={addInput}
            onChange={e => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter' && addInput) {
                onSelectSymbol(addInput)
                setAddInput('')
              }
            }}
            placeholder="Sembol ekle..."
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white
                       placeholder-white/30 focus:outline-none focus:border-violet-500/40 w-40"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Symbol pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {symbols.map(s => (
          <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
            <span className="text-xs font-medium text-white">{s}</span>
            <button
              onClick={() => onRemoveSymbol(s)}
              className="text-white/30 hover:text-red-400 transition-colors text-xs ml-1"
            >
              ✕
            </button>
          </div>
        ))}
        {symbols.length < 4 && (
          <input
            type="text"
            value={addInput}
            onChange={e => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter' && addInput) {
                onSelectSymbol(addInput)
                setAddInput('')
              }
            }}
            placeholder="+ Ekle"
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-dashed border-white/10 text-xs text-white
                       placeholder-white/30 focus:outline-none focus:border-violet-500/40 w-20"
          />
        )}
      </div>

      {/* Score Cards */}
      <div className={`grid gap-2 sm:gap-3 ${
        items.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
        items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}>
        {items.map((item, i) => (
          <div key={item.symbol} className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
            {item.loading ? (
              <div className="h-40 animate-pulse bg-white/5 rounded-lg" />
            ) : (
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{item.symbol}</span>
                  {item.data?.profile?.companyName && (
                    <span className="text-[10px] text-white/30 truncate max-w-[100px]">
                      {item.data.profile.companyName}
                    </span>
                  )}
                </div>
                <ScoreGauge score={item.data?.fmpScore ?? null} size="md" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Metrics Comparison Table */}
      <div className="bg-[#0F0F15] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] text-white/30 uppercase tracking-wider w-32 sm:w-40">
                  Metrik
                </th>
                {items.map(item => (
                  <th key={item.symbol} className="text-right px-3 py-2.5 text-xs text-white font-medium">
                    {item.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price */}
              <CompareRow
                label="Fiyat"
                values={items.map(i => i.data?.profile?.price)}
                format="dollar"
              />
              <CompareRow
                label="Değişim %"
                values={items.map(i => i.data?.profile?.changesPercentage)}
                format="percent"
                colorize
              />
              <CompareRow
                label="P. Değeri"
                values={items.map(i => i.data?.profile?.mktCap)}
                format="marketcap"
              />
              <CompareRow label="P/E" values={items.map(i => i.data?.keyMetrics?.peRatioTTM)} format="ratio" />
              <CompareRow label="P/B" values={items.map(i => i.data?.keyMetrics?.pbRatioTTM)} format="ratio" />
              <CompareRow label="ROE" values={items.map(i => i.data?.keyMetrics?.roeTTM)} format="roePercent" colorize />
              <CompareRow label="Borç/Özkaynak" values={items.map(i => i.data?.keyMetrics?.debtToEquityTTM)} format="ratio" />
              <CompareRow label="Cari Oran" values={items.map(i => i.data?.keyMetrics?.currentRatioTTM)} format="ratio" />
              <CompareRow label="Temettü" values={items.map(i => i.data?.keyMetrics?.dividendYieldTTM)} format="percent" />
              <CompareRow label="Beta" values={items.map(i => i.data?.profile?.beta)} format="ratio" />
              <CompareRow label="Altman Z" values={items.map(i => i.data?.scores?.altmanZScore)} format="score" />
              <CompareRow label="Piotroski" values={items.map(i => i.data?.scores?.piotroskiScore)} format="score" />

              {/* HERMES AI Score Categories */}
              <tr className="border-b border-white/5">
                <td colSpan={items.length + 1} className="px-2 sm:px-4 py-2 text-[10px] text-violet-400/60 uppercase tracking-wider font-medium bg-white/[0.01]">
                  HERMES AI Skor Kategorileri
                </td>
              </tr>
              {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(key => (
                <CompareRow
                  key={key}
                  label={CATEGORY_LABELS[key]}
                  values={items.map(i => i.data?.fmpScore?.categories?.[key])}
                  format="score"
                  colorize
                />
              ))}
              <CompareRow
                label="TOPLAM"
                values={items.map(i => i.data?.fmpScore?.total)}
                format="score"
                colorize
                bold
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Compare Row ───────────────────────────────────────────────────

function CompareRow({
  label, values, format, colorize, bold
}: {
  label: string
  values: (number | undefined | null)[]
  format: 'dollar' | 'percent' | 'ratio' | 'score' | 'marketcap' | 'roePercent'
  colorize?: boolean
  bold?: boolean
}) {
  const formatVal = (v: number | undefined | null): string => {
    if (v == null || !isFinite(v)) return '—'
    switch (format) {
      case 'dollar': return `$${v.toFixed(2)}`
      case 'percent': return `${v.toFixed(2)}%`
      case 'roePercent': return `${(v * 100).toFixed(1)}%`
      case 'ratio': return v.toFixed(2)
      case 'score': return v.toFixed(1)
      case 'marketcap':
        if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
        return `$${(v / 1e6).toFixed(0)}M`
    }
  }

  // Best value (highest for most metrics)
  const cleanValues = values.map(v => (v != null && isFinite(v)) ? v : null)
  const best = cleanValues.reduce<number | null>((acc, val) => {
    if (val == null) return acc
    if (acc == null) return val
    return val > acc ? val : acc
  }, null)

  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.02]">
      <td className={`px-2 sm:px-4 py-1.5 text-xs text-white/50 ${bold ? 'font-bold' : ''}`}>{label}</td>
      {values.map((v, i) => {
        const isTopValue = v != null && v === best && cleanValues.filter(cv => cv === best).length === 1
        let color = 'text-white/70'
        if (colorize && v != null && isFinite(v)) {
          if (format === 'percent' || format === 'roePercent') {
            color = v >= 0 ? 'text-emerald-400' : 'text-red-400'
          } else if (format === 'score') {
            const level = getScoreLevel(v)
            color = getScoreColor(level)
          }
        }

        return (
          <td key={i} className={`px-3 py-1.5 text-right text-xs tabular-nums ${color} ${bold ? 'font-bold' : ''}`}>
            {formatVal(v)}
            {isTopValue && <span className="ml-1 text-yellow-400 text-[8px]">★</span>}
          </td>
        )
      })}
    </tr>
  )
}
