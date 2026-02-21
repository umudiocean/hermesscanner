// ==================================================================
// HERMES Scanner - Hisse Evreni
// Kaynak: data/symbols.json (2197 hisse — yatirim fonlari cikarildi)
// NASDAQ Terminal AI, Trade AI, AI Signals, Watchlist - bu liste
// ==================================================================

import { Segment } from './types'

// JSON'dan yukle - add_mega_large_to_symbols.py ile guncellenir
import allSymbolsData from '../../data/symbols.json'
const ALL_SYMBOLS: string[] = allSymbolsData as string[]

export const SEGMENTS: Record<Exclude<Segment, 'ALL'>, string[]> = {
  MEGA: [],
  LARGE: [],
  MID: [],
  SMALL: ALL_SYMBOLS,
  MICRO: [],
}

/**
 * Segment bazli veya tum sembolleri dondur
 */
export function getSymbols(segment: Segment): string[] {
  if (segment === 'ALL') {
    return [
      ...SEGMENTS.MEGA,
      ...SEGMENTS.LARGE,
      ...SEGMENTS.MID,
      ...SEGMENTS.SMALL,
    ]
  }
  return SEGMENTS[segment] || []
}

/**
 * Market cap bazli dinamik segment hesapla
 * MEGA: > $200B | LARGE: $10B-$200B | MID: $2B-$10B | SMALL: $300M-$2B | MICRO: < $300M
 */
export function computeSegmentFromMarketCap(marketCap: number | undefined | null): Segment {
  if (!marketCap || marketCap <= 0) return 'SMALL'
  if (marketCap >= 200_000_000_000) return 'MEGA'
  if (marketCap >= 10_000_000_000) return 'LARGE'
  if (marketCap >= 2_000_000_000) return 'MID'
  if (marketCap >= 300_000_000) return 'SMALL'
  return 'MICRO'
}

/**
 * Bir sembolun segmentini bul (statik fallback — marketCap yoksa)
 * @deprecated Prefer computeSegmentFromMarketCap() with live quote data
 */
export function getSegment(symbol: string): string {
  for (const [seg, symbols] of Object.entries(SEGMENTS)) {
    if (symbols.includes(symbol)) return seg
  }
  return 'UNKNOWN'
}

/**
 * Toplam hisse sayisi
 */
export function getTotalSymbolCount(): number {
  return Object.values(SEGMENTS).reduce((sum, arr) => sum + arr.length, 0)
}

/**
 * Segment istatistikleri
 */
export function getSegmentStats(): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const [seg, symbols] of Object.entries(SEGMENTS)) {
    stats[seg] = symbols.length
  }
  stats['ALL'] = getTotalSymbolCount()
  return stats
}

export const getCleanSymbolCount = getTotalSymbolCount
export const getCleanSymbols = getSymbols
export const getCleanSegmentStats = getSegmentStats
