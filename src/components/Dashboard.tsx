'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ScanResult, ScanSummary, Segment } from '@/lib/types'

// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner Dashboard v2
// Modern UI, Filter buttons, Excel export
// ═══════════════════════════════════════════════════════════════════

const SEGMENTS: { key: Segment; label: string; count: number }[] = [
  { key: 'MEGA', label: 'MEGA', count: 70 },
  { key: 'LARGE', label: 'LARGE', count: 954 },
  { key: 'MID', label: 'MID', count: 875 },
  { key: 'SMALL', label: 'SMALL', count: 836 },
  { key: 'MICRO', label: 'MICRO', count: 42 },
]

const SCAN_CHUNK_SIZE = 100
const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000 // 15 dakika

type SortField = 'score' | 'symbol' | 'price' | 'change' | 'rsi' | 'mfi' | 'marketCap'
type SortDir = 'asc' | 'desc'
type SignalFilter = 'all' | 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'
type SegmentFilter = 'ALL' | Segment

interface ScanState {
  results: ScanResult[]
  summary: ScanSummary | null
  loading: boolean
  error: string | null
  progress: string
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function getSignalStyle(signalType: string): { bg: string; text: string; border: string } {
  switch (signalType) {
    case 'strong_long': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' }
    case 'long': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50' }
    case 'neutral': return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/50' }
    case 'short': return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' }
    case 'strong_short': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' }
    default: return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/50' }
  }
}

function getScoreColor(score: number): string {
  if (score <= 20) return 'text-yellow-400'
  if (score <= 40) return 'text-emerald-400'
  if (score < 60) return 'text-slate-300'
  if (score < 80) return 'text-orange-400'
  return 'text-red-400'
}

function formatMarketCap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
  return `${mc.toFixed(0)}`
}

function exportToCSV(results: ScanResult[], filename: string) {
  const headers = [
    'Symbol', 'Segment', 'Price', 'Change%', 'Score', 'Signal',
    'RSI', 'MFI', 'ADX', 'Quality', 'Z-Score', 'VWAP52W', 'MarketCap'
  ]
  
  const rows = results.map(r => [
    r.symbol,
    r.segment,
    r.quote?.price?.toFixed(2) || r.hermes.price.toFixed(2),
    r.quote?.changePercent?.toFixed(2) || '0',
    r.hermes.score.toFixed(1),
    r.hermes.signal,
    r.hermes.indicators.rsi.toFixed(1),
    r.hermes.indicators.mfi.toFixed(1),
    r.hermes.indicators.adx.toFixed(1),
    r.hermes.multipliers.quality.toFixed(2),
    r.hermes.zscores.zscore52w.toFixed(2),
    r.hermes.bands.vwap52w.toFixed(2),
    r.quote?.marketCap || 0,
  ])
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function ScoreBar({ score }: { score: number }) {
  const position = Math.min(100, Math.max(0, score))
  return (
    <div className="relative w-20 h-1.5 rounded-full bg-gradient-to-r from-yellow-500 via-slate-500 to-red-500 opacity-40">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50"
        style={{ left: `calc(${position}% - 4px)` }}
      />
    </div>
  )
}

function FilterButton({ 
  active, 
  onClick, 
  children, 
  count,
  variant = 'default'
}: { 
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  variant?: 'default' | 'yellow' | 'green' | 'gray' | 'orange' | 'red'
}) {
  const variants = {
    default: active ? 'bg-white/10 border-white/30 text-white' : 'bg-transparent border-white/10 text-white/50 hover:text-white/80 hover:border-white/20',
    yellow: active ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-transparent border-yellow-500/20 text-yellow-500/50 hover:text-yellow-400 hover:border-yellow-500/30',
    green: active ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-transparent border-emerald-500/20 text-emerald-500/50 hover:text-emerald-400 hover:border-emerald-500/30',
    gray: active ? 'bg-slate-500/20 border-slate-500/50 text-slate-300' : 'bg-transparent border-slate-500/20 text-slate-500/50 hover:text-slate-400 hover:border-slate-500/30',
    orange: active ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-transparent border-orange-500/20 text-orange-500/50 hover:text-orange-400 hover:border-orange-500/30',
    red: active ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-transparent border-red-500/20 text-red-500/50 hover:text-red-400 hover:border-red-500/30',
  }
  
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${variants[variant]}`}
    >
      {children}
      {count !== undefined && <span className="opacity-60">({count})</span>}
    </button>
  )
}

function StockRow({ result, expanded, onToggle }: {
  result: ScanResult
  expanded: boolean
  onToggle: () => void
}) {
  const { hermes, quote, symbol, segment } = result
  const style = getSignalStyle(hermes.signalType)

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-white/5 cursor-pointer transition-all hover:bg-white/[0.02] group"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-white">{symbol}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/70">{segment}</span>
          </div>
        </td>

        <td className="px-4 py-3 text-right">
          <span className="font-mono text-white/90">${quote?.price?.toFixed(2) || hermes.price.toFixed(2)}</span>
        </td>

        <td className={`px-4 py-3 text-right font-mono ${(quote?.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {quote?.changePercent ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : '-'}
        </td>

        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={`font-mono font-bold text-lg w-8 ${getScoreColor(hermes.score)}`}>
              {Math.round(hermes.score)}
            </span>
            <ScoreBar score={hermes.score} />
          </div>
        </td>

        <td className="px-4 py-3">
          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
            {hermes.signal}
          </span>
        </td>

        <td className="px-4 py-3 text-right hidden md:table-cell">
          <span className={`font-mono ${hermes.indicators.rsi >= 70 ? 'text-red-400' : hermes.indicators.rsi <= 30 ? 'text-emerald-400' : 'text-white/70'}`}>
            {Math.round(hermes.indicators.rsi)}
          </span>
        </td>

        <td className="px-4 py-3 text-right hidden md:table-cell">
          <span className={`font-mono ${hermes.indicators.mfi >= 75 ? 'text-red-400' : hermes.indicators.mfi <= 25 ? 'text-emerald-400' : 'text-white/70'}`}>
            {Math.round(hermes.indicators.mfi)}
          </span>
        </td>

        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <span className="font-mono text-white/50">{formatMarketCap(quote?.marketCap || 0)}</span>
        </td>

        <td className="px-4 py-3 text-center hidden lg:table-cell">
          <span className={`text-xs ${hermes.multipliers.quality > 0.9 ? 'text-emerald-400' : hermes.multipliers.quality < 0.7 ? 'text-red-400' : 'text-yellow-400'}`}>
            {hermes.multipliers.quality.toFixed(2)}
          </span>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-white/5 bg-white/[0.01]">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
              <div className="space-y-2">
                <div className="text-white/70 font-semibold uppercase tracking-wide">Bileşenler (70/15/15)</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">52W Z-Score (70%)</span><span className={getScoreColor(hermes.components.point52w)}>{hermes.components.point52w.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">MFI (15%)</span><span className={getScoreColor(hermes.components.pointMfi)}>{hermes.components.pointMfi.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">RSI (15%)</span><span className={getScoreColor(hermes.components.pointRsi)}>{hermes.components.pointRsi.toFixed(1)}</span></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-white/70 font-semibold uppercase tracking-wide">Çarpanlar</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">ATR</span><span className="text-white/80">x{hermes.multipliers.atrCarpan.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">ADX</span><span className="text-white/80">x{hermes.multipliers.adxCarpan.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Kalite</span><span className="text-white/80">x{hermes.multipliers.quality.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Raw</span><span className="text-white/80">{hermes.rawScore.toFixed(1)}</span></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-white/70 font-semibold uppercase tracking-wide">Göstergeler</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">RSI</span><span className="text-white/80">{hermes.indicators.rsi.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">MFI</span><span className="text-white/80">{hermes.indicators.mfi.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">ADX</span><span className="text-white/80">{hermes.indicators.adx.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Vol Ratio</span><span className="text-white/80">{hermes.indicators.volRatio.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-white/70 font-semibold uppercase tracking-wide">52W Z-Score</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">Z-Score</span><span className="text-white/80">{hermes.zscores.zscore52w.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">VWAP</span><span className="text-white/80">${hermes.bands.vwap52w.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-white/70 font-semibold uppercase tracking-wide">Bantlar (Z-Score)</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">Dış Üst (Z=+2)</span><span className="text-white/80">${hermes.bands.upperOuter.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">İç Üst (Z=+1)</span><span className="text-white/80">${hermes.bands.upperInner.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">İç Alt (Z=-1)</span><span className="text-white/80">${hermes.bands.lowerInner.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Dış Alt (Z=-2)</span><span className="text-white/80">${hermes.bands.lowerOuter.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-white/70 font-semibold uppercase tracking-wide">Veri</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">Bar</span><span className="text-white/80">{hermes.dataPoints}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">MktCap</span><span className="text-white/80">{formatMarketCap(quote?.marketCap || 0)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Durum</span>
                    <span className={hermes.hasEnough52w ? 'text-emerald-400' : 'text-orange-400'}>
                      {hermes.hasEnough52w ? 'TAM' : 'KISMI'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const [scanState, setScanState] = useState<ScanState>({
    results: [],
    summary: null,
    loading: false,
    error: null,
    progress: '',
  })
  
  // Filters
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Sort
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  
  // UI State
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  
  const abortRef = useRef<AbortController | null>(null)

  // ═══════════════════════════════════════════════════════════════
  // SCAN LOGIC
  // ═══════════════════════════════════════════════════════════════

  async function scanChunk(symbols: string[], segment: string, signal: AbortSignal): Promise<ScanResult[]> {
    const res = await fetch(`/api/scan?segment=${segment}&symbols=${symbols.join(',')}`, { signal })
    if (!res.ok) throw new Error(`Scan failed: ${res.statusText}`)
    const data = await res.json()
    return data.allResults || []
  }

  const runScan = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    setScanState(prev => ({ ...prev, loading: true, error: null, progress: 'Hazırlanıyor...' }))

    try {
      const segmentsToScan = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO'] as const
      const allResults: ScanResult[] = []

      for (const seg of segmentsToScan) {
        const symRes = await fetch(`/api/symbols?segment=${seg}`, { signal })
        if (!symRes.ok) throw new Error(`Failed to get symbols for ${seg}`)
        const symData = await symRes.json()
        const segSymbols: string[] = symData.symbols

        if (segSymbols.length === 0) continue

        if (segSymbols.length <= SCAN_CHUNK_SIZE) {
          setScanState(prev => ({ ...prev, progress: `${seg} taranıyor...` }))
          const res = await fetch(`/api/scan?segment=${seg}`, { signal })
          if (!res.ok) throw new Error(`Scan failed for ${seg}`)
          const data = await res.json()
          if (data.allResults) allResults.push(...data.allResults)
          setScanState(prev => ({ ...prev, results: [...allResults] }))
        } else {
          for (let i = 0; i < segSymbols.length; i += SCAN_CHUNK_SIZE) {
            const chunk = segSymbols.slice(i, i + SCAN_CHUNK_SIZE)
            const chunkNum = Math.floor(i / SCAN_CHUNK_SIZE) + 1
            const totalChunks = Math.ceil(segSymbols.length / SCAN_CHUNK_SIZE)

            setScanState(prev => ({
              ...prev,
              progress: `${seg} ${chunkNum}/${totalChunks}`,
            }))

            try {
              const chunkResults = await scanChunk(chunk, seg, signal)
              allResults.push(...chunkResults)
              setScanState(prev => ({ ...prev, results: [...allResults] }))
            } catch (err) {
              if ((err as Error).name === 'AbortError') throw err
            }
          }
        }
      }

      const strongLongs = allResults.filter(r => r.hermes.signalType === 'strong_long')
      const strongShorts = allResults.filter(r => r.hermes.signalType === 'strong_short')

      setLastRefresh(new Date())

      setScanState({
        results: allResults,
        summary: {
          scanId: `scan-${Date.now()}`,
          timestamp: new Date().toISOString(),
          duration: 0,
          totalScanned: allResults.length,
          strongLongs,
          strongShorts,
          longs: allResults.filter(r => r.hermes.signalType === 'long'),
          shorts: allResults.filter(r => r.hermes.signalType === 'short'),
          neutrals: allResults.filter(r => r.hermes.signalType === 'neutral').length,
          errors: 0,
          segment: 'ALL',
        },
        loading: false,
        error: null,
        progress: '',
      })

    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setScanState(prev => ({ ...prev, loading: false, error: (err as Error).message, progress: '' }))
    }
  }, [])

  // Load cached results on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const res = await fetch('/api/scan/latest')
        if (res.ok) {
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            const results = data.results as ScanResult[]
            const strongLongs = results.filter(r => r.hermes.signalType === 'strong_long')
            const strongShorts = results.filter(r => r.hermes.signalType === 'strong_short')
            
            setScanState({
              results,
              summary: {
                scanId: data.scanId || 'cached',
                timestamp: data.timestamp || new Date().toISOString(),
                duration: 0,
                totalScanned: results.length,
                strongLongs,
                strongShorts,
                longs: results.filter(r => r.hermes.signalType === 'long'),
                shorts: results.filter(r => r.hermes.signalType === 'short'),
                neutrals: results.filter(r => r.hermes.signalType === 'neutral').length,
                errors: 0,
                segment: 'ALL',
              },
              loading: false,
              error: null,
              progress: '',
            })
            setLastRefresh(new Date(data.timestamp || Date.now()))
            return
          }
        }
      } catch { /* ignore */ }
      runScan()
    }
    loadInitialData()
  }, [runScan])

  // ═══════════════════════════════════════════════════════════════
  // FILTERING & SORTING
  // ═══════════════════════════════════════════════════════════════

  const filteredResults = scanState.results
    .filter(r => signalFilter === 'all' || r.hermes.signalType === signalFilter)
    .filter(r => segmentFilter === 'ALL' || r.segment === segmentFilter)
    .filter(r => !searchQuery || r.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortField) {
        case 'score': aVal = a.hermes.score; bVal = b.hermes.score; break
        case 'symbol': return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
        case 'price': aVal = a.quote?.price || a.hermes.price; bVal = b.quote?.price || b.hermes.price; break
        case 'change': aVal = a.quote?.changePercent || 0; bVal = b.quote?.changePercent || 0; break
        case 'rsi': aVal = a.hermes.indicators.rsi; bVal = b.hermes.indicators.rsi; break
        case 'mfi': aVal = a.hermes.indicators.mfi; bVal = b.hermes.indicators.mfi; break
        case 'marketCap': aVal = a.quote?.marketCap || 0; bVal = b.quote?.marketCap || 0; break
        default: aVal = a.hermes.score; bVal = b.hermes.score
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'score' ? 'asc' : 'desc')
    }
  }

  // Signal counts
  const signalCounts = {
    strong_long: scanState.results.filter(r => r.hermes.signalType === 'strong_long').length,
    long: scanState.results.filter(r => r.hermes.signalType === 'long').length,
    neutral: scanState.results.filter(r => r.hermes.signalType === 'neutral').length,
    short: scanState.results.filter(r => r.hermes.signalType === 'short').length,
    strong_short: scanState.results.filter(r => r.hermes.signalType === 'strong_short').length,
  }

  // Segment counts (from filtered by signal)
  const getSegmentCount = (seg: Segment | 'ALL') => {
    if (seg === 'ALL') return scanState.results.filter(r => signalFilter === 'all' || r.hermes.signalType === signalFilter).length
    return scanState.results.filter(r => r.segment === seg && (signalFilter === 'all' || r.hermes.signalType === signalFilter)).length
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-white/20 ml-1">↕</span>
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-[#08080C] text-white">
      {/* ═══ HEADER ═══ */}
      <header className="border-b border-white/5 bg-[#0A0A10] sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-orange-500 flex items-center justify-center text-sm font-bold">H</div>
                <div>
                  <h1 className="text-lg font-bold text-white">HERMES Scanner</h1>
                  <p className="text-[10px] text-white/70">NASDAQ • 52W VWAP V6</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {lastRefresh && (
                <span className="text-xs text-white/70">
                  Son: {lastRefresh.toLocaleTimeString('tr-TR')}
                </span>
              )}
              
              <button
                onClick={runScan}
                disabled={scanState.loading}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  scanState.loading
                    ? 'bg-white/5 text-white/70 cursor-wait'
                    : 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-500/20'
                }`}
              >
                {scanState.loading ? scanState.progress || 'Taranıyor...' : 'Tara'}
              </button>

              <button
                onClick={() => exportToCSV(filteredResults, 'hermes_scan')}
                disabled={filteredResults.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ FILTERS ═══ */}
      <div className="border-b border-white/5 bg-[#0A0A10]/80 backdrop-blur-sm sticky top-[73px] z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          {/* Signal Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-white/70 mr-2">Sinyal:</span>
            <FilterButton active={signalFilter === 'all'} onClick={() => setSignalFilter('all')} count={scanState.results.length}>
              Tümü
            </FilterButton>
            <FilterButton active={signalFilter === 'strong_long'} onClick={() => setSignalFilter('strong_long')} count={signalCounts.strong_long} variant="yellow">
              ⭐ Strong Long
            </FilterButton>
            <FilterButton active={signalFilter === 'long'} onClick={() => setSignalFilter('long')} count={signalCounts.long} variant="green">
              Long
            </FilterButton>
            <FilterButton active={signalFilter === 'neutral'} onClick={() => setSignalFilter('neutral')} count={signalCounts.neutral} variant="gray">
              Nötr
            </FilterButton>
            <FilterButton active={signalFilter === 'short'} onClick={() => setSignalFilter('short')} count={signalCounts.short} variant="orange">
              Short
            </FilterButton>
            <FilterButton active={signalFilter === 'strong_short'} onClick={() => setSignalFilter('strong_short')} count={signalCounts.strong_short} variant="red">
              ⭐ Strong Short
            </FilterButton>
          </div>

          {/* Segment Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/70 mr-2">Market Cap:</span>
            <FilterButton active={segmentFilter === 'ALL'} onClick={() => setSegmentFilter('ALL')} count={getSegmentCount('ALL')}>
              Tümü
            </FilterButton>
            {SEGMENTS.map(seg => (
              <FilterButton 
                key={seg.key} 
                active={segmentFilter === seg.key} 
                onClick={() => setSegmentFilter(seg.key)}
                count={getSegmentCount(seg.key)}
              >
                {seg.label}
              </FilterButton>
            ))}
            
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="Sembol ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 w-36"
              />
              <span className="text-xs text-white/70">
                {filteredResults.length} sonuç
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ERROR ═══ */}
      {scanState.error && (
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            Hata: {scanState.error}
          </div>
        </div>
      )}

      {/* ═══ TABLE ═══ */}
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0A0A10]/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left cursor-pointer hover:text-white/80 transition-colors" onClick={() => handleSort('symbol')}>
                  Sembol <SortIcon field="symbol" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-white/80 transition-colors" onClick={() => handleSort('price')}>
                  Fiyat <SortIcon field="price" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-white/80 transition-colors" onClick={() => handleSort('change')}>
                  Değişim <SortIcon field="change" />
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-white/80 transition-colors" onClick={() => handleSort('score')}>
                  Skor <SortIcon field="score" />
                </th>
                <th className="px-4 py-3 text-left">Sinyal</th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-white/80 transition-colors hidden md:table-cell" onClick={() => handleSort('rsi')}>
                  RSI <SortIcon field="rsi" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-white/80 transition-colors hidden md:table-cell" onClick={() => handleSort('mfi')}>
                  MFI <SortIcon field="mfi" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-white/80 transition-colors hidden lg:table-cell" onClick={() => handleSort('marketCap')}>
                  MktCap <SortIcon field="marketCap" />
                </th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">Kalite</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map(result => (
                <StockRow
                  key={result.symbol}
                  result={result}
                  expanded={expandedRow === result.symbol}
                  onToggle={() => setExpandedRow(expandedRow === result.symbol ? null : result.symbol)}
                />
              ))}
            </tbody>
          </table>

          {filteredResults.length === 0 && !scanState.loading && (
            <div className="text-center py-16 text-white/70">
              {scanState.results.length === 0
                ? 'Tarama sonucu yok. Yukarıdan TARA butonuna basın.'
                : 'Filtre kriterlerine uyan sonuç yok.'}
            </div>
          )}
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/5 bg-[#0A0A10] py-4 mt-8">
        <div className="max-w-[1800px] mx-auto px-6 flex items-center justify-between text-xs text-white/60">
            <span>HERMES Institutional NASDAQ Scanner V6</span>
          <span>Skor: 0-20 Strong Long • 21-40 Long • 41-59 Nötr • 60-79 Short • 80-100 Strong Short</span>
        </div>
      </footer>
    </div>
  )
}
