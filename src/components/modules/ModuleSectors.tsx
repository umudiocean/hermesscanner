'use client'

import { useState, useMemo } from 'react'
import { useScanContext } from '../Layout'
import { ScanResult } from '@/lib/types'

// ═══════════════════════════════════════════════════════════════════
// SEKTÖRLER Module - FMP API sektör verisi ile
// Açık/parlak renkler - Bullish yeşil, Bearish kırmızı
// ═══════════════════════════════════════════════════════════════════

interface SectorData {
  name: string
  stocks: ScanResult[]
  avgScore: number
  strongLongs: number
  longs: number
  neutrals: number
  shorts: number
  strongShorts: number
  avgChange: number
  bullishCount: number
  bearishCount: number
}

function getSignalStyle(signalType: string) {
  const styles: Record<string, { bg: string; text: string }> = {
    strong_long: { bg: 'bg-yellow-400/30', text: 'text-yellow-300' },
    long: { bg: 'bg-emerald-400/30', text: 'text-emerald-300' },
    neutral: { bg: 'bg-slate-400/30', text: 'text-slate-300' },
    short: { bg: 'bg-orange-400/30', text: 'text-orange-300' },
    strong_short: { bg: 'bg-red-400/30', text: 'text-red-300' },
  }
  return styles[signalType] || styles.neutral
}

function getScoreColor(score: number): string {
  if (score <= 15) return 'text-yellow-300'
  if (score <= 40) return 'text-emerald-300'
  if (score < 60) return 'text-slate-200'
  if (score < 85) return 'text-orange-300'
  return 'text-red-300'
}

// Sektör kartı için arkaplan rengi - AÇIK ve NET
function getSectorBackground(avgScore: number): string {
  if (avgScore <= 30) {
    // Çok bullish - parlak yeşil
    return 'from-emerald-500/40 via-emerald-600/20 to-transparent'
  }
  if (avgScore <= 45) {
    // Bullish - yeşil
    return 'from-emerald-500/25 via-emerald-600/10 to-transparent'
  }
  if (avgScore < 55) {
    // Nötr - gri
    return 'from-slate-400/20 via-slate-500/10 to-transparent'
  }
  if (avgScore < 70) {
    // Bearish - kırmızı
    return 'from-red-500/25 via-red-600/10 to-transparent'
  }
  // Çok bearish - parlak kırmızı
  return 'from-red-500/40 via-red-600/20 to-transparent'
}

function SectorCard({ sector, onClick, selected }: { sector: SectorData; onClick: () => void; selected: boolean }) {
  const bgGradient = getSectorBackground(sector.avgScore)
  const isBullish = sector.avgScore <= 45
  const isBearish = sector.avgScore >= 55

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl ${
        selected 
          ? 'border-white/40 ring-2 ring-white/30 shadow-lg' 
          : isBullish 
            ? 'border-emerald-500/30 hover:border-emerald-400/50' 
            : isBearish 
              ? 'border-red-500/30 hover:border-red-400/50' 
              : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient}`} />
      <div className="absolute inset-0 bg-[#0D0D14]/60" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white text-lg">{sector.name}</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${
            isBullish ? 'bg-emerald-500/30 text-emerald-300' : isBearish ? 'bg-red-500/30 text-red-300' : 'bg-slate-500/30 text-slate-300'
          }`}>
            {sector.stocks.length} hisse
          </span>
        </div>

        {/* Avg Score - Büyük */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-4xl font-bold font-mono ${getScoreColor(sector.avgScore)}`}>
            {Math.round(sector.avgScore)}
          </div>
          <div className="flex-1">
            <div className="text-xs text-white/50 mb-1.5">Ortalama Skor</div>
            <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-slate-400 to-red-400 opacity-50 relative">
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg ${
                  isBullish ? 'bg-emerald-400 shadow-emerald-400/50' : isBearish ? 'bg-red-400 shadow-red-400/50' : 'bg-white shadow-white/50'
                }`}
                style={{ left: `calc(${Math.min(100, Math.max(0, sector.avgScore))}% - 6px)` }}
              />
            </div>
          </div>
        </div>

        {/* Signal Distribution Bar */}
        <div className="flex items-center gap-0.5 mb-3 h-3 rounded-full overflow-hidden">
          {sector.strongLongs > 0 && (
            <div className="h-full bg-yellow-400" style={{ flex: sector.strongLongs }} title={`Strong Long: ${sector.strongLongs}`} />
          )}
          {sector.longs > 0 && (
            <div className="h-full bg-emerald-400" style={{ flex: sector.longs }} title={`Long: ${sector.longs}`} />
          )}
          {sector.neutrals > 0 && (
            <div className="h-full bg-slate-400" style={{ flex: sector.neutrals }} title={`Nötr: ${sector.neutrals}`} />
          )}
          {sector.shorts > 0 && (
            <div className="h-full bg-orange-400" style={{ flex: sector.shorts }} title={`Short: ${sector.shorts}`} />
          )}
          {sector.strongShorts > 0 && (
            <div className="h-full bg-red-400" style={{ flex: sector.strongShorts }} title={`Strong Short: ${sector.strongShorts}`} />
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="text-yellow-300 font-semibold">{sector.strongLongs}</span>
            <span className="text-emerald-300 font-semibold">{sector.longs}</span>
            <span className="text-slate-300">{sector.neutrals}</span>
            <span className="text-orange-300 font-semibold">{sector.shorts}</span>
            <span className="text-red-300 font-semibold">{sector.strongShorts}</span>
          </div>
          <span className={`font-mono font-semibold ${sector.avgChange >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {sector.avgChange >= 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function SectorDetail({ sector, onClose, onAddToWatchlist, isInWatchlist }: {
  sector: SectorData; onClose: () => void
  onAddToWatchlist: (symbol: string) => void; isInWatchlist: (symbol: string) => boolean
}) {
  const [sortBy, setSortBy] = useState<'score' | 'change' | 'symbol'>('score')
  const isBullish = sector.avgScore <= 45
  const isBearish = sector.avgScore >= 55

  const sortedStocks = useMemo(() => {
    return [...sector.stocks].sort((a, b) => {
      switch (sortBy) {
        case 'score': return a.hermes.score - b.hermes.score
        case 'change': return (b.quote?.changePercent || 0) - (a.quote?.changePercent || 0)
        case 'symbol': return a.symbol.localeCompare(b.symbol)
        default: return 0
      }
    })
  }, [sector.stocks, sortBy])

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isBullish ? 'border-emerald-500/30 bg-emerald-950/30' : isBearish ? 'border-red-500/30 bg-red-950/30' : 'border-white/10 bg-[#0D0D14]'
    }`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b flex items-center justify-between ${
        isBullish ? 'border-emerald-500/20 bg-emerald-500/10' : isBearish ? 'border-red-500/20 bg-red-500/10' : 'border-white/5'
      }`}>
        <div>
          <h3 className="text-xl font-bold text-white">{sector.name}</h3>
          <p className="text-sm text-white/50 mt-0.5">{sector.stocks.length} hisse • Ort: {Math.round(sector.avgScore)}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
          >
            <option value="score">Skora Göre</option>
            <option value="change">Değişime Göre</option>
            <option value="symbol">Sembole Göre</option>
          </select>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-5 py-3 border-b border-white/5 grid grid-cols-5 gap-4 text-center">
        <div className="bg-yellow-500/20 rounded-lg p-2">
          <div className="text-yellow-300 font-bold text-xl">{sector.strongLongs}</div>
          <div className="text-yellow-300/70 text-xs">Strong Long</div>
        </div>
        <div className="bg-emerald-500/20 rounded-lg p-2">
          <div className="text-emerald-300 font-bold text-xl">{sector.longs}</div>
          <div className="text-emerald-300/70 text-xs">Long</div>
        </div>
        <div className="bg-slate-500/20 rounded-lg p-2">
          <div className="text-slate-200 font-bold text-xl">{sector.neutrals}</div>
          <div className="text-slate-300/70 text-xs">Nötr</div>
        </div>
        <div className="bg-orange-500/20 rounded-lg p-2">
          <div className="text-orange-300 font-bold text-xl">{sector.shorts}</div>
          <div className="text-orange-300/70 text-xs">Short</div>
        </div>
        <div className="bg-red-500/20 rounded-lg p-2">
          <div className="text-red-300 font-bold text-xl">{sector.strongShorts}</div>
          <div className="text-red-300/70 text-xs">Strong Short</div>
        </div>
      </div>

      {/* Stock List */}
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#0D0D14]/90 backdrop-blur">
            <tr className="text-xs text-white/50 border-b border-white/5">
              <th className="px-4 py-2.5 text-left w-10"></th>
              <th className="px-4 py-2.5 text-left">Sembol</th>
              <th className="px-4 py-2.5 text-right">Fiyat</th>
              <th className="px-4 py-2.5 text-right">Değişim</th>
              <th className="px-4 py-2.5 text-center">Skor</th>
              <th className="px-4 py-2.5 text-left">Sinyal</th>
            </tr>
          </thead>
          <tbody>
            {sortedStocks.map(stock => {
              const style = getSignalStyle(stock.hermes.signalType)
              const inWatchlist = isInWatchlist(stock.symbol)
              return (
                <tr key={stock.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => onAddToWatchlist(stock.symbol)}
                      className={`p-1 rounded transition-all ${inWatchlist ? 'text-yellow-400' : 'text-white/60 hover:text-white/60'}`}
                    >
                      {inWatchlist ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-semibold text-white">{stock.symbol}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-mono text-white/80">${stock.quote?.price?.toFixed(2) || stock.hermes.price.toFixed(2)}</span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${(stock.quote?.changePercent || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {stock.quote?.changePercent ? `${stock.quote.changePercent >= 0 ? '+' : ''}${stock.quote.changePercent.toFixed(2)}%` : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-mono font-bold text-lg ${getScoreColor(stock.hermes.score)}`}>
                      {Math.round(stock.hermes.score)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${style.bg} ${style.text}`}>
                      {stock.hermes.signal}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ModuleSectors() {
  const { results, sectorMap, toggleWatchlistItem, isInWatchlist } = useScanContext()
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'stocks'>('score')

  const sectorData = useMemo(() => {
    const sectorGroups = new Map<string, ScanResult[]>()

    // Her hisseyi sektörüne göre grupla (FMP'den gelen veri)
    for (const result of results) {
      const sector = sectorMap.get(result.symbol) || 'Other'
      if (!sectorGroups.has(sector)) sectorGroups.set(sector, [])
      sectorGroups.get(sector)!.push(result)
    }

    // Sektör verilerini hesapla
    const sectors: SectorData[] = []
    for (const [name, stocks] of sectorGroups) {
      const avgScore = stocks.reduce((sum, s) => sum + s.hermes.score, 0) / stocks.length
      const avgChange = stocks.reduce((sum, s) => sum + (s.quote?.changePercent || 0), 0) / stocks.length
      
      const strongLongs = stocks.filter(s => s.hermes.signalType === 'strong_long').length
      const longs = stocks.filter(s => s.hermes.signalType === 'long').length
      const neutrals = stocks.filter(s => s.hermes.signalType === 'neutral').length
      const shorts = stocks.filter(s => s.hermes.signalType === 'short').length
      const strongShorts = stocks.filter(s => s.hermes.signalType === 'strong_short').length

      sectors.push({
        name,
        stocks,
        avgScore,
        strongLongs,
        longs,
        neutrals,
        shorts,
        strongShorts,
        avgChange,
        bullishCount: strongLongs + longs,
        bearishCount: shorts + strongShorts,
      })
    }

    // Sırala
    switch (sortBy) {
      case 'name':
        sectors.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'score':
        sectors.sort((a, b) => a.avgScore - b.avgScore)
        break
      case 'stocks':
        sectors.sort((a, b) => b.stocks.length - a.stocks.length)
        break
    }

    return sectors
  }, [results, sectorMap, sortBy])

  const selectedSectorData = selectedSector 
    ? sectorData.find(s => s.name === selectedSector) 
    : null

  const overallStats = useMemo(() => {
    const bullish = sectorData.filter(s => s.avgScore <= 45).length
    const neutral = sectorData.filter(s => s.avgScore > 45 && s.avgScore < 55).length
    const bearish = sectorData.filter(s => s.avgScore >= 55).length
    return { bullish, neutral, bearish, total: sectorData.length }
  }, [sectorData])

  const hasSectorData = sectorMap.size > 0

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🏭</span>
            Sektörler
          </h2>
          <p className="text-white/50 text-sm mt-1">
            {sectorData.length} sektör • {results.length} hisse
            {!hasSectorData && sectorData.length > 0 && (
              <span className="text-yellow-400 ml-2">(Sektör verisi yükleniyor...)</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Overall Sentiment */}
          <div className="flex items-center gap-2">
            <span className="text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 font-semibold">
              {overallStats.bullish} Bullish
            </span>
            <span className="text-slate-300 px-3 py-1.5 rounded-lg bg-slate-500/20 border border-slate-500/30">
              {overallStats.neutral} Nötr
            </span>
            <span className="text-red-300 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 font-semibold">
              {overallStats.bearish} Bearish
            </span>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none"
          >
            <option value="score">Skora Göre</option>
            <option value="name">İsme Göre</option>
            <option value="stocks">Hisse Sayısına Göre</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sector Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sectorData.map(sector => (
              <SectorCard
                key={sector.name}
                sector={sector}
                onClick={() => setSelectedSector(selectedSector === sector.name ? null : sector.name)}
                selected={selectedSector === sector.name}
              />
            ))}
          </div>

          {sectorData.length === 0 && (
            <div className="text-center py-16 text-white/70">
              Veri yok. Yukarıdan TARA butonuna basın.
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedSectorData && (
          <div className="w-[550px] flex-shrink-0">
            <SectorDetail
              sector={selectedSectorData}
              onClose={() => setSelectedSector(null)}
              onAddToWatchlist={toggleWatchlistItem}
              isInWatchlist={isInWatchlist}
            />
          </div>
        )}
      </div>
    </div>
  )
}
