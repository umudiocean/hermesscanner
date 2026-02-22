'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab: KARSILASTIRMA (Compare Mode)
// 2-4 hisseyi yan yana karsilastirma
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo } from 'react'
import { StockDetailData, CATEGORY_LABELS, getScoreLevel, getScoreColor } from '@/lib/fmp-terminal/fmp-types'
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

function SymbolSearchInput({ onAdd, existingSymbols, placeholder }: {
  onAdd: (symbol: string) => void
  existingSymbols: string[]
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ symbol: string; name: string }>>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [allStocks, setAllStocks] = useState<Array<{ symbol: string; name: string }>>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/fmp-terminal/stocks')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.stocks) {
          setAllStocks(data.stocks.map((s: { symbol: string; companyName?: string }) => ({
            symbol: s.symbol,
            name: s.companyName || s.symbol,
          })))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!input.trim()) return []
    const q = input.toUpperCase()
    return allStocks
      .filter(s => !existingSymbols.includes(s.symbol))
      .filter(s => s.symbol.startsWith(q) || s.name.toUpperCase().includes(q))
      .slice(0, 8)
  }, [input, allStocks, existingSymbols])

  useEffect(() => {
    setSuggestions(filtered)
    setSelectedIdx(-1)
    setShowDropdown(filtered.length > 0 && input.trim().length > 0)
  }, [filtered, input])

  const handleSelect = (symbol: string) => {
    onAdd(symbol)
    setInput('')
    setShowDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        handleSelect(suggestions[selectedIdx].symbol)
      } else if (input.trim()) {
        handleSelect(input.trim().toUpperCase())
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Orn: AAPL, MSFT...'}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white
                     placeholder-white/30 focus:outline-none focus:border-gold-400/40 focus:shadow-md focus:shadow-gold-400/10 transition-all duration-300 w-48"
        />
        <button
          onClick={() => { if (input.trim()) { handleSelect(input.trim().toUpperCase()) } }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-400 to-amber-500 text-[#0d0d0d] text-sm font-bold hover:from-gold-300 hover:to-amber-400 hover:shadow-lg hover:shadow-gold-400/25 transition-all duration-300"
        >
          Ekle
        </button>
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-[#151520] border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-50">
          {suggestions.map((s, i) => (
            <button
              key={s.symbol}
              onClick={() => handleSelect(s.symbol)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                i === selectedIdx ? 'bg-gold-400/10 text-white' : 'text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <span className="font-mono font-bold text-xs w-12">{s.symbol}</span>
              <span className="text-[11px] text-white/40 truncate">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TabCompare({ symbols, onRemoveSymbol, onSelectSymbol }: TabCompareProps) {
  const [items, setItems] = useState<CompareData[]>([])

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
        <p className="text-white/40 text-sm mb-3 sm:mb-4">Sembol yazin ve ekleyin (max 4 hisse)</p>
        <SymbolSearchInput onAdd={onSelectSymbol} existingSymbols={symbols} />
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Symbol pills + search */}
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
          <SymbolSearchInput onAdd={onSelectSymbol} existingSymbols={symbols} placeholder="+ Ekle" />
        )}
      </div>

      {/* Score Cards */}
      <div className={`grid gap-2 sm:gap-3 ${
        items.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
        items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}>
        {items.map((item) => (
          <div key={item.symbol} className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
            {item.loading ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
                <span className="text-[10px] text-white/20">{item.symbol} yukleniyor...</span>
              </div>
            ) : !item.data ? (
              <div className="h-40 flex flex-col items-center justify-center">
                <span className="text-sm text-white/30">{item.symbol}</span>
                <span className="text-[10px] text-red-400/50 mt-1">Veri yuklenemedi</span>
              </div>
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
              <CompareRow label="Fiyat" values={items.map(i => i.data?.profile?.price)} format="dollar" />
              <CompareRow label="Degisim %" values={items.map(i => i.data?.profile?.changesPercentage)} format="percent" colorize />
              <CompareRow label="P. Degeri" values={items.map(i => i.data?.profile?.mktCap)} format="marketcap" />
              <CompareRow label="P/E" values={items.map(i => i.data?.keyMetrics?.peRatioTTM)} format="ratio" />
              <CompareRow label="P/B" values={items.map(i => i.data?.keyMetrics?.pbRatioTTM)} format="ratio" />
              <CompareRow label="ROE" values={items.map(i => i.data?.keyMetrics?.roeTTM)} format="roePercent" colorize />
              <CompareRow label="Borc/Ozkaynak" values={items.map(i => i.data?.keyMetrics?.debtToEquityTTM)} format="ratio" />
              <CompareRow label="Cari Oran" values={items.map(i => i.data?.keyMetrics?.currentRatioTTM)} format="ratio" />
              <CompareRow label="Temettu" values={items.map(i => i.data?.keyMetrics?.dividendYieldTTM)} format="percent" />
              <CompareRow label="Beta" values={items.map(i => i.data?.profile?.beta)} format="ratio" />
              <CompareRow label="Altman Z" values={items.map(i => i.data?.scores?.altmanZScore)} format="score" />
              <CompareRow label="Piotroski" values={items.map(i => i.data?.scores?.piotroskiScore)} format="score" />

              <tr className="border-b border-white/5">
                <td colSpan={items.length + 1} className="px-2 sm:px-4 py-2 text-[10px] text-violet-400/60 uppercase tracking-wider font-medium bg-white/[0.01]">
                  HERMES AI Skor Kategorileri
                </td>
              </tr>
              {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(key => (
                <CompareRow key={key} label={CATEGORY_LABELS[key]} values={items.map(i => i.data?.fmpScore?.categories?.[key])} format="score" colorize />
              ))}
              <CompareRow label="TOPLAM" values={items.map(i => i.data?.fmpScore?.total)} format="score" colorize bold />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

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
    if (v == null || !isFinite(v)) return '\u2014'
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
            color = v >= 0 ? 'text-hermes-green' : 'text-red-400'
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
