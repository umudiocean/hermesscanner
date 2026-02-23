// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Symbol Universe
// 8 Exchanges — dynamically fetched from FMP company-screener
// Fallback to static data/europe-symbols.json
// ═══════════════════════════════════════════════════════════════════

import { Segment } from './types'
import { EuropeExchangeId, EUROPE_EXCHANGES, getExchangeFromSymbol } from './europe-config'

import staticEuropeSymbols from '../../data/europe-symbols.json'
const STATIC_SYMBOLS: string[] = staticEuropeSymbols as string[]

let _dynamicSymbols: string[] | null = null
let _dynamicFetchedAt = 0
const DYNAMIC_TTL = 24 * 60 * 60 * 1000 // 24h

export async function fetchEuropeSymbolsFromFMP(): Promise<string[]> {
  if (_dynamicSymbols && Date.now() - _dynamicFetchedAt < DYNAMIC_TTL) {
    return _dynamicSymbols
  }

  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) return STATIC_SYMBOLS

  const allSymbols: string[] = []
  const exchangeCodes = new Map<string, string>()
  for (const ex of Object.values(EUROPE_EXCHANGES)) {
    exchangeCodes.set(ex.fmpExchange, ex.symbolSuffix)
  }

  const uniqueExchanges = [...new Set(Object.values(EUROPE_EXCHANGES).map(e => e.fmpExchange))]

  const fetches = uniqueExchanges.map(async (exCode) => {
    try {
      const url = `https://financialmodelingprep.com/stable/company-screener?exchange=${exCode}&limit=3000&isActivelyTrading=true`
      const res = await fetch(url, { headers: { apikey: apiKey }, cache: 'no-store' })
      if (!res.ok) return []
      const data = await res.json()
      if (!Array.isArray(data)) return []
      return data
        .filter((d: any) => d.symbol && d.marketCap > 0)
        .sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0))
        .slice(0, 1000)
        .map((d: any) => d.symbol as string)
    } catch {
      return []
    }
  })

  const results = await Promise.allSettled(fetches)
  for (const r of results) {
    if (r.status === 'fulfilled') allSymbols.push(...r.value)
  }

  if (allSymbols.length > 100) {
    _dynamicSymbols = [...new Set(allSymbols)]
    _dynamicFetchedAt = Date.now()
    console.log(`[EU Symbols] Fetched ${_dynamicSymbols.length} symbols from ${uniqueExchanges.length} exchanges`)
    return _dynamicSymbols
  }

  return STATIC_SYMBOLS
}

export function getEuropeSymbols(exchange?: EuropeExchangeId | 'ALL'): string[] {
  const symbols = _dynamicSymbols || STATIC_SYMBOLS
  if (!exchange || exchange === 'ALL') return symbols

  const suffix = EUROPE_EXCHANGES[exchange]?.symbolSuffix
  if (!suffix) return symbols
  return symbols.filter(s => s.endsWith(suffix))
}

export function getEuropeSymbolCount(): number {
  return (_dynamicSymbols || STATIC_SYMBOLS).length
}

export function getEuropeExchangeStats(): Record<string, number> {
  const symbols = _dynamicSymbols || STATIC_SYMBOLS
  const stats: Record<string, number> = { ALL: symbols.length }
  for (const sym of symbols) {
    const ex = getExchangeFromSymbol(sym)
    if (ex) {
      stats[ex] = (stats[ex] || 0) + 1
    }
  }
  return stats
}

export function computeSegmentFromMarketCap(marketCap: number | undefined | null): Segment {
  if (!marketCap || marketCap <= 0) return 'SMALL'
  if (marketCap >= 200_000_000_000) return 'MEGA'
  if (marketCap >= 10_000_000_000) return 'LARGE'
  if (marketCap >= 2_000_000_000) return 'MID'
  if (marketCap >= 300_000_000) return 'SMALL'
  return 'MICRO'
}
