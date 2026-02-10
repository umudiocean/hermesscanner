'use client'

import { useState, useMemo } from 'react'
import { useScanContext } from '../Layout'
import { ScanResult } from '@/lib/types'

// ═══════════════════════════════════════════════════════════════════
// HEATMAP Module - Tüm hisselerin grid görünümü
// ═══════════════════════════════════════════════════════════════════

type ViewMode = 'score' | 'change' | 'rsi' | 'mfi'
type SegmentFilter = 'ALL' | 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO'

const SEGMENTS = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO'] as const

function getScoreBackground(score: number): string {
  // 0-20: Sarı/Altın (Strong Long)
  // 21-40: Yeşil (Long)
  // 41-59: Gri (Nötr)
  // 60-79: Turuncu (Short)
  // 80-100: Kırmızı (Strong Short)
  
  if (score <= 20) {
    const intensity = 1 - (score / 20)
    return `rgba(234, 179, 8, ${0.4 + intensity * 0.4})`
  }
  if (score <= 40) {
    const intensity = 1 - ((score - 21) / 19)
    return `rgba(16, 185, 129, ${0.3 + intensity * 0.4})`
  }
  if (score < 60) {
    return 'rgba(100, 116, 139, 0.2)'
  }
  if (score < 80) {
    const intensity = (score - 60) / 19
    return `rgba(249, 115, 22, ${0.3 + intensity * 0.4})`
  }
  const intensity = (score - 80) / 20
  return `rgba(239, 68, 68, ${0.4 + intensity * 0.4})`
}

function getChangeBackground(change: number): string {
  if (change > 5) return 'rgba(16, 185, 129, 0.7)'
  if (change > 2) return 'rgba(16, 185, 129, 0.5)'
  if (change > 0) return 'rgba(16, 185, 129, 0.3)'
  if (change > -2) return 'rgba(239, 68, 68, 0.3)'
  if (change > -5) return 'rgba(239, 68, 68, 0.5)'
  return 'rgba(239, 68, 68, 0.7)'
}

function getRsiBackground(rsi: number): string {
  if (rsi < 30) return 'rgba(16, 185, 129, 0.5)'
  if (rsi < 40) return 'rgba(16, 185, 129, 0.3)'
  if (rsi > 70) return 'rgba(239, 68, 68, 0.5)'
  if (rsi > 60) return 'rgba(239, 68, 68, 0.3)'
  return 'rgba(100, 116, 139, 0.2)'
}

function getMfiBackground(mfi: number): string {
  if (mfi < 20) return 'rgba(16, 185, 129, 0.5)'
  if (mfi < 30) return 'rgba(16, 185, 129, 0.3)'
  if (mfi > 80) return 'rgba(239, 68, 68, 0.5)'
  if (mfi > 70) return 'rgba(239, 68, 68, 0.3)'
  return 'rgba(100, 116, 139, 0.2)'
}

function HeatmapCell({ result, viewMode, size, onClick, isSelected }: {
  result: ScanResult; viewMode: ViewMode; size: 'sm' | 'md' | 'lg'
  onClick: () => void; isSelected: boolean
}) {
  const { hermes, quote, symbol } = result
  const changePercent = quote?.changePercent || 0
  
  let bg: string
  let value: string
  
  switch (viewMode) {
    case 'score':
      bg = getScoreBackground(hermes.score)
      value = Math.round(hermes.score).toString()
      break
    case 'change':
      bg = getChangeBackground(changePercent)
      value = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`
      break
    case 'rsi':
      bg = getRsiBackground(hermes.indicators.rsi)
      value = Math.round(hermes.indicators.rsi).toString()
      break
    case 'mfi':
      bg = getMfiBackground(hermes.indicators.mfi)
      value = Math.round(hermes.indicators.mfi).toString()
      break
  }

  const sizeClasses = {
    sm: 'w-14 h-14 text-[10px]',
    md: 'w-20 h-20 text-xs',
    lg: 'w-28 h-28 text-sm',
  }

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses[size]} rounded cursor-pointer transition-all hover:scale-105 hover:z-10 flex flex-col items-center justify-center ${
        isSelected ? 'ring-2 ring-white shadow-lg' : ''
      }`}
      style={{ backgroundColor: bg }}
      title={`${symbol}: Score ${Math.round(hermes.score)}, Change ${changePercent.toFixed(2)}%`}
    >
      <span className="font-mono font-bold text-white truncate max-w-full px-1">{symbol}</span>
      <span className="text-white/70">{value}</span>
    </div>
  )
}

function StockDetail({ result, onClose }: { result: ScanResult; onClose: () => void }) {
  const { hermes, quote, symbol, segment } = result
  const changePercent = quote?.changePercent || 0

  const getSignalColor = (signal: string) => {
    const colors: Record<string, string> = {
      strong_long: 'text-yellow-400',
      long: 'text-emerald-400',
      neutral: 'text-slate-400',
      short: 'text-orange-400',
      strong_short: 'text-red-400',
    }
    return colors[signal] || 'text-slate-400'
  }

  return (
    <div className="bg-[#0D0D14] rounded-xl border border-white/10 p-5 w-80">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xl text-white">{symbol}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">{segment}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/70 font-mono">${quote?.price?.toFixed(2) || hermes.price.toFixed(2)}</span>
            <span className={`text-sm font-mono ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className={`text-4xl font-bold font-mono ${getSignalColor(hermes.signalType)}`}>
          {Math.round(hermes.score)}
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${getSignalColor(hermes.signalType)} bg-white/5`}>
          {hermes.signal}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/70 text-xs mb-1">RSI</div>
          <div className={`font-mono font-semibold ${hermes.indicators.rsi > 70 ? 'text-red-400' : hermes.indicators.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>
            {Math.round(hermes.indicators.rsi)}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/70 text-xs mb-1">MFI</div>
          <div className={`font-mono font-semibold ${hermes.indicators.mfi > 80 ? 'text-red-400' : hermes.indicators.mfi < 20 ? 'text-emerald-400' : 'text-white'}`}>
            {Math.round(hermes.indicators.mfi)}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/70 text-xs mb-1">ADX</div>
          <div className="font-mono font-semibold text-white">
            {Math.round(hermes.indicators.adx)}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/70 text-xs mb-1">Kalite</div>
          <div className={`font-mono font-semibold ${hermes.multipliers.quality > 0.9 ? 'text-emerald-400' : hermes.multipliers.quality < 0.7 ? 'text-red-400' : 'text-yellow-400'}`}>
            {hermes.multipliers.quality.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div>
            <div className="text-white/70">52W (70%)</div>
            <div className="font-mono text-white">{Math.round(hermes.components.point52w)}</div>
          </div>
          <div>
            <div className="text-white/70">MFI (15%)</div>
            <div className="font-mono text-white">{Math.round(hermes.components.pointMfi)}</div>
          </div>
          <div>
            <div className="text-white/70">RSI (15%)</div>
            <div className="font-mono text-white">{Math.round(hermes.components.pointRsi)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ModuleHeatmap() {
  const { results } = useScanContext()
  
  const [viewMode, setViewMode] = useState<ViewMode>('score')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL')
  const [cellSize, setCellSize] = useState<'sm' | 'md' | 'lg'>('md')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  const filteredResults = useMemo(() => {
    let filtered = results
    if (segmentFilter !== 'ALL') {
      filtered = filtered.filter(r => r.segment === segmentFilter)
    }
    
    // Skora göre sırala
    return filtered.sort((a, b) => a.hermes.score - b.hermes.score)
  }, [results, segmentFilter])

  const selectedResult = selectedSymbol 
    ? results.find(r => r.symbol === selectedSymbol) 
    : null

  const stats = useMemo(() => {
    const strongLongs = filteredResults.filter(r => r.hermes.signalType === 'strong_long').length
    const longs = filteredResults.filter(r => r.hermes.signalType === 'long').length
    const neutrals = filteredResults.filter(r => r.hermes.signalType === 'neutral').length
    const shorts = filteredResults.filter(r => r.hermes.signalType === 'short').length
    const strongShorts = filteredResults.filter(r => r.hermes.signalType === 'strong_short').length
    return { strongLongs, longs, neutrals, shorts, strongShorts }
  }, [filteredResults])

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🗺️</span>
            Heatmap
          </h2>
          <p className="text-white/70 text-sm mt-1">
            {filteredResults.length} hisse • Renk: {viewMode === 'score' ? 'Skor' : viewMode === 'change' ? 'Değişim' : viewMode === 'rsi' ? 'RSI' : 'MFI'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">{stats.strongLongs}</span>
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">{stats.longs}</span>
            <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-400">{stats.neutrals}</span>
            <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400">{stats.shorts}</span>
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">{stats.strongShorts}</span>
          </div>

          {/* View Mode */}
          <select
            value={viewMode}
            onChange={e => setViewMode(e.target.value as ViewMode)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/20"
          >
            <option value="score">Skor</option>
            <option value="change">Değişim %</option>
            <option value="rsi">RSI</option>
            <option value="mfi">MFI</option>
          </select>

          {/* Cell Size */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {(['sm', 'md', 'lg'] as const).map(size => (
              <button
                key={size}
                onClick={() => setCellSize(size)}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  cellSize === size ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Segment Filter */}
          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value as SegmentFilter)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/20"
          >
            <option value="ALL">Tümü</option>
            {SEGMENTS.map(seg => (
              <option key={seg} value={seg}>{seg}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[#0A0A10]/80 rounded-xl border border-white/5 p-3 mb-4">
        <div className="flex items-center justify-center gap-8 text-xs">
          {viewMode === 'score' ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(234, 179, 8, 0.7)' }} />
                <span className="text-white/60">Strong Long (0-20)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.6)' }} />
                <span className="text-white/60">Long (21-40)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(100, 116, 139, 0.3)' }} />
                <span className="text-white/60">Nötr (41-59)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(249, 115, 22, 0.6)' }} />
                <span className="text-white/60">Short (60-79)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.7)' }} />
                <span className="text-white/60">Strong Short (80-100)</span>
              </div>
            </>
          ) : viewMode === 'change' ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.7)' }} />
                <span className="text-white/60">+5%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }} />
                <span className="text-white/60">0% - 5%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }} />
                <span className="text-white/60">-5% - 0%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.7)' }} />
                <span className="text-white/60">-5%</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.5)' }} />
                <span className="text-white/60">Oversold (&lt;30)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(100, 116, 139, 0.2)' }} />
                <span className="text-white/60">Nötr</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.5)' }} />
                <span className="text-white/60">Overbought (&gt;70)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4">
        {/* Heatmap Grid */}
        <div className="flex-1 bg-[#0A0A10]/50 rounded-xl border border-white/5 p-4 overflow-auto max-h-[calc(100vh-280px)]">
          <div className="flex flex-wrap gap-1">
            {filteredResults.map(result => (
              <HeatmapCell
                key={result.symbol}
                result={result}
                viewMode={viewMode}
                size={cellSize}
                onClick={() => setSelectedSymbol(selectedSymbol === result.symbol ? null : result.symbol)}
                isSelected={selectedSymbol === result.symbol}
              />
            ))}
          </div>
          
          {filteredResults.length === 0 && (
            <div className="text-center py-16 text-white/70">
              Veri yok. Yukarıdan TARA butonuna basın.
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedResult && (
          <div className="flex-shrink-0">
            <StockDetail 
              result={selectedResult} 
              onClose={() => setSelectedSymbol(null)} 
            />
          </div>
        )}
      </div>
    </div>
  )
}
