// ═══════════════════════════════════════════════════════════════════
// HERMES V12 — Trend Context Provider
// Scan sonuçlarından sektör/market/industry trend hesapla
// ═══════════════════════════════════════════════════════════════════

import { TrendContext, ScanResult } from './types'

// ═══════════════════════════════════════════════════════════════════
// TYPES — Trend Dashboard İçin Detaylı Tipler
// ═══════════════════════════════════════════════════════════════════

export interface MarketTrendData {
  breadth: number             // % bullish hisse (Z<0)
  momentum: number            // breadth değişimi
  avgZScore: number           // tüm hisselerin ortalama Z-Score
  medianZScore: number        // medyan Z-Score
  totalStocks: number         // taranmış hisse sayısı
  bullishCount: number        // Z<0 hisse sayısı
  bearishCount: number        // Z>0 hisse sayısı
  strongLongCount: number     // Skor ≤20
  longCount: number           // Skor 21-40
  neutralCount: number        // Skor 41-59
  shortCount: number          // Skor 60-79
  strongShortCount: number    // Skor ≥80
  regime: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish'
  regimeLabel: string
  trendPoint: number          // 0-100, ZA1 formülü (düşük=bullish)
}

export interface SectorTrendItem {
  sector: string
  avgZScore: number           // sektör ortalama Z-Score
  stockCount: number          // sektördeki hisse sayısı
  bullishPct: number          // sektördeki bullish %
  trendPoint: number          // 0-100, ZA1 formülü
  regime: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish'
  regimeLabel: string
  topLongs: Array<{ symbol: string; score: number; zscore: number }>
  topShorts: Array<{ symbol: string; score: number; zscore: number }>
}

export interface IndustryTrendItem {
  industry: string
  sector: string              // hangi sektöre ait
  avgZScore: number
  relative: number            // market ortalamasına göre sapma
  stockCount: number
  bullishPct: number
  trendPoint: number          // 0-100
  regime: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish'
  regimeLabel: string
}

export interface TrendDashboardData {
  timestamp: number
  market: MarketTrendData
  sectors: SectorTrendItem[]
  industries: IndustryTrendItem[]
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function zsToTrendPoint(avgZ: number, div: number = 1.0): number {
  // ZA1 formülü: 50 + 50 * tanh(avgZ / div)
  // Negatif Z = bullish → düşük puan
  // Pozitif Z = bearish → yüksek puan
  return Math.max(0, Math.min(100, 50 + 50 * Math.tanh(avgZ / div)))
}

function trendRegime(trendPoint: number): { regime: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish'; label: string } {
  if (trendPoint <= 20) return { regime: 'strong_bullish', label: 'Güçlü Yükseliş' }
  if (trendPoint <= 40) return { regime: 'bullish', label: 'Yükseliş' }
  if (trendPoint <= 60) return { regime: 'neutral', label: 'Nötr' }
  if (trendPoint <= 80) return { regime: 'bearish', label: 'Düşüş' }
  return { regime: 'strong_bearish', label: 'Güçlü Düşüş' }
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ═══════════════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════════════

// Cache: Son scan'dan hesaplanan trend verisi
let cachedTrend: {
  timestamp: number
  marketBreadth: number
  marketMomentum: number
  sectorTrend: Map<string, { avgZScore: number }>
  industryTrend: Map<string, { relative: number }>
} | null = null

// Detaylı dashboard cache
let cachedDashboard: TrendDashboardData | null = null

// Önceki breadth (momentum hesabı için)
let prevMarketBreadth: number | null = null

/**
 * Scan sonuçlarından trend context hesapla ve cache'le
 * Her scan sonrasında çağrılır
 */
export function updateTrendFromScanResults(
  results: ScanResult[],
  profileMap: Map<string, { sector: string; industry: string }>
): void {
  if (results.length < 10) return  // yetersiz veri

  // 1) Market Breadth: Z-Score < 0 olan hisselerin yüzdesi
  const withZScore = results.filter(r => r.hermes.hasEnough52w && r.hermes.zscores.zscore52w !== 0)
  const bullishCount = withZScore.filter(r => r.hermes.zscores.zscore52w < 0).length
  const bearishCount = withZScore.length - bullishCount
  const marketBreadth = withZScore.length > 0 ? (bullishCount / withZScore.length) * 100 : 50

  // Momentum: breadth değişimi
  const marketMomentum = prevMarketBreadth !== null ? marketBreadth - prevMarketBreadth : 0
  prevMarketBreadth = marketBreadth

  // Sinyal dağılımı
  let sLong = 0, longs = 0, neutrals = 0, shorts = 0, sShort = 0
  for (const r of withZScore) {
    const sc = r.hermes.score
    if (sc <= 20) sLong++
    else if (sc <= 40) longs++
    else if (sc <= 59) neutrals++
    else if (sc <= 79) shorts++
    else sShort++
  }

  // Market Z-Score istatistikleri
  const allZ = withZScore.map(r => r.hermes.zscores.zscore52w)
  const avgZ = allZ.length > 0 ? allZ.reduce((a, b) => a + b, 0) / allZ.length : 0
  const medZ = median(allZ)
  const marketTrendPoint = zsToTrendPoint(avgZ, 1.0)
  const marketRegime = trendRegime(marketTrendPoint)

  // 2) Sektör trend
  const sectorMap = new Map<string, { zscores: number[]; results: ScanResult[] }>()
  for (const r of results) {
    if (!r.hermes.hasEnough52w) continue
    const profile = profileMap.get(r.symbol)
    if (!profile) continue
    const sector = profile.sector
    if (!sectorMap.has(sector)) sectorMap.set(sector, { zscores: [], results: [] })
    const entry = sectorMap.get(sector)!
    entry.zscores.push(r.hermes.zscores.zscore52w)
    entry.results.push(r)
  }

  const sectorTrend = new Map<string, { avgZScore: number }>()
  const sectorItems: SectorTrendItem[] = []
  for (const [sector, data] of sectorMap) {
    const avg = data.zscores.reduce((a, b) => a + b, 0) / data.zscores.length
    sectorTrend.set(sector, { avgZScore: avg })

    const bullPct = data.zscores.filter(z => z < 0).length / data.zscores.length * 100
    const tp = zsToTrendPoint(avg, 1.0)
    const reg = trendRegime(tp)

    // Top LONG/SHORT sinyalleri
    const sorted = [...data.results].sort((a, b) => a.hermes.score - b.hermes.score)
    const topLongs = sorted.slice(0, 3).filter(r => r.hermes.score <= 40).map(r => ({
      symbol: r.symbol, score: Math.round(r.hermes.score), zscore: +r.hermes.zscores.zscore52w.toFixed(2)
    }))
    const topShorts = sorted.slice(-3).reverse().filter(r => r.hermes.score >= 60).map(r => ({
      symbol: r.symbol, score: Math.round(r.hermes.score), zscore: +r.hermes.zscores.zscore52w.toFixed(2)
    }))

    sectorItems.push({
      sector,
      avgZScore: +avg.toFixed(3),
      stockCount: data.zscores.length,
      bullishPct: +bullPct.toFixed(1),
      trendPoint: +tp.toFixed(1),
      regime: reg.regime,
      regimeLabel: reg.label,
      topLongs,
      topShorts,
    })
  }
  // Sektörleri trendPoint'e göre sırala (en bullish önce)
  sectorItems.sort((a, b) => a.trendPoint - b.trendPoint)

  // 3) Industry trend
  const industryMap = new Map<string, { zscores: number[]; sector: string }>()
  for (const r of results) {
    if (!r.hermes.hasEnough52w) continue
    const profile = profileMap.get(r.symbol)
    if (!profile) continue
    const industry = profile.industry
    if (!industryMap.has(industry)) industryMap.set(industry, { zscores: [], sector: profile.sector })
    industryMap.get(industry)!.zscores.push(r.hermes.zscores.zscore52w)
  }

  const industryTrend = new Map<string, { relative: number }>()
  const industryItems: IndustryTrendItem[] = []
  for (const [industry, data] of industryMap) {
    const indAvg = data.zscores.reduce((a, b) => a + b, 0) / data.zscores.length
    const rel = indAvg - avgZ
    industryTrend.set(industry, { relative: rel })

    const bullPct = data.zscores.filter(z => z < 0).length / data.zscores.length * 100
    const tp = zsToTrendPoint(indAvg, 1.0)
    const reg = trendRegime(tp)

    industryItems.push({
      industry,
      sector: data.sector,
      avgZScore: +indAvg.toFixed(3),
      relative: +rel.toFixed(3),
      stockCount: data.zscores.length,
      bullishPct: +bullPct.toFixed(1),
      trendPoint: +tp.toFixed(1),
      regime: reg.regime,
      regimeLabel: reg.label,
    })
  }
  industryItems.sort((a, b) => a.trendPoint - b.trendPoint)

  // Cache güncelle
  cachedTrend = {
    timestamp: Date.now(),
    marketBreadth,
    marketMomentum,
    sectorTrend,
    industryTrend,
  }

  cachedDashboard = {
    timestamp: Date.now(),
    market: {
      breadth: +marketBreadth.toFixed(1),
      momentum: +marketMomentum.toFixed(2),
      avgZScore: +avgZ.toFixed(3),
      medianZScore: +medZ.toFixed(3),
      totalStocks: withZScore.length,
      bullishCount,
      bearishCount,
      strongLongCount: sLong,
      longCount: longs,
      neutralCount: neutrals,
      shortCount: shorts,
      strongShortCount: sShort,
      regime: marketRegime.regime,
      regimeLabel: marketRegime.label,
      trendPoint: +marketTrendPoint.toFixed(1),
    },
    sectors: sectorItems,
    industries: industryItems,
  }

  console.log(`[TREND] Updated: breadth=${marketBreadth.toFixed(1)}%, momentum=${marketMomentum.toFixed(2)}, ${sectorTrend.size} sectors, ${industryTrend.size} industries`)
}

/**
 * Belirli bir sembol için TrendContext döndür
 */
export function getTrendContext(
  symbol: string,
  sector: string,
  industry: string
): TrendContext | undefined {
  if (!cachedTrend) return undefined

  const sectorData = cachedTrend.sectorTrend.get(sector)
  const industryData = cachedTrend.industryTrend.get(industry)

  return {
    marketBreadth: cachedTrend.marketBreadth,
    marketMomentum: cachedTrend.marketMomentum,
    sectorAvgZScore: sectorData?.avgZScore ?? 0,
    industryRelative: industryData?.relative ?? 0,
  }
}

/**
 * Trend Dashboard Verisi — UI modülü için
 */
export function getTrendDashboard(): TrendDashboardData | null {
  return cachedDashboard
}

/**
 * Trend cache mevcut mu?
 */
export function hasTrendCache(): boolean {
  return cachedTrend !== null
}

/**
 * Cache yaşını döndür (ms)
 */
export function getTrendCacheAge(): number {
  return cachedTrend ? Date.now() - cachedTrend.timestamp : Infinity
}
