// ═══════════════════════════════════════════════════════════════════
// WALL STREET PULSE — Composite Pulse Index API
// GET /api/wall-street-pulse
// Returns: 12-component composite score (0-100) + breadth + smart money + earnings + squeeze
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCached, CACHE_TTL } from '@/lib/fmp-terminal/fmp-cache'
import { fmpApiFetch } from '@/lib/api/fmpClient'
import {
  calculatePulse,
  PulseInputs,
  StockQuote,
  InsiderStat,
  CongressTrade,
  AnalystConsensus,
  EarningsSurprise,
  TreasuryRate,
  SectorPerf,
} from '@/lib/wall-street-pulse/pulse-engine'
import { PulseData } from '@/lib/wall-street-pulse/pulse-types'
import { fetchVIXValue, fetchPutCallRatio } from '@/lib/wall-street-pulse/external-sources'
import logger from '@/lib/logger'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const PULSE_CACHE_TTL = 5 * 60 * 1000 // 5 min

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const LOG = '[Pulse API]'

  try {
    const data = await getCached<PulseData>('wall_street_pulse', PULSE_CACHE_TTL, async () => {
      return await computePulseData()
    })

    const duration = Date.now() - startTime
    logger.info(`${LOG} Response in ${duration}ms, composite=${data.composite}`)

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Pulse-Score': String(data.composite),
        'X-Pulse-Level': data.level,
      }
    })
  } catch (error) {
    logger.error(`${LOG} Error: ${(error as Error).message}`)
    return NextResponse.json(
      { error: 'Failed to compute Wall Street Pulse', message: (error as Error).message },
      { status: 500 }
    )
  }
}

async function computePulseData(): Promise<PulseData> {
  const LOG = '[Pulse Compute]'

  // Parallel data fetching — maximize speed, minimize serial deps
  const [
    stocksData,
    ratingsData,
    earningsData,
    treasuryData,
    sectorData,
    senateTrades,
    houseTrades,
    vixValue,
    putCallRatio,
  ] = await Promise.allSettled([
    fetchStockQuotes(),
    fetchAnalystConsensus(),
    fetchEarningsSurprises(),
    fetchTreasuryRates(),
    fetchSectorPerformance(),
    fetchCongressTradesAll('senate'),
    fetchCongressTradesAll('house'),
    fetchVIXValue(),
    fetchPutCallRatio(),
  ])

  const stocks = getResult<StockQuote[]>(stocksData, [])
  const ratings = getResult<AnalystConsensus[]>(ratingsData, [])
  const earnings = getResult<EarningsSurprise[]>(earningsData, [])
  const treasury = getResult<TreasuryRate[]>(treasuryData, [])
  const sectors = getResult<SectorPerf[]>(sectorData, [])
  const senate = getResult<CongressTrade[]>(senateTrades, [])
  const house = getResult<CongressTrade[]>(houseTrades, [])
  const vix = getResult<number | null>(vixValue, null)
  const pc = getResult<number | null>(putCallRatio, null)

  logger.info(`${LOG} Data: ${stocks.length} stocks, ${ratings.length} ratings, ${earnings.length} earnings, VIX=${vix}, P/C=${pc}`)

  // Insider stats — aggregate from stocks that have shortFloat data
  const insiderStats: InsiderStat[] = []

  const congressAll: CongressTrade[] = [
    ...senate.map(t => ({ type: t.type, amount: t.amount })),
    ...house.map(t => ({ type: t.type, amount: t.amount })),
  ]

  const isMarketOpen = checkMarketOpen()

  const inputs: PulseInputs = {
    stocks,
    insiderStats,
    congressTrades: congressAll,
    analystConsensus: ratings,
    earningsSurprises: earnings,
    treasuryRates: treasury,
    sectorPerformance: sectors,
    vixValue: vix,
    putCallRatio: pc,
    institutionalDelta: 0,
    marketOpen: isMarketOpen,
  }

  return calculatePulse(inputs)
}

// ─── Data Fetchers ──────────────────────────────────────────────

async function fetchStockQuotes(): Promise<StockQuote[]> {
  try {
    const { getSymbols } = await import('@/lib/symbols')
    const symbols = getSymbols('ALL')
    const quotes: StockQuote[] = []
    const batchSize = 100

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      try {
        const data = await fmpApiFetch<Record<string, unknown>[]>('/batch-quote', { symbols: batch.join(',') })
        if (Array.isArray(data)) {
          for (const s of data) {
            quotes.push({
              symbol: String(s.symbol || ''),
              price: Number(s.price) || 0,
              changesPercentage: Number(s.changesPercentage) || 0,
              volume: Number(s.volume) || 0,
              avgVolume: Number(s.avgVolume) || 0,
              yearHigh: Number(s.yearHigh) || 0,
              yearLow: Number(s.yearLow) || 0,
              marketCap: Number(s.marketCap) || 0,
              beta: s.beta != null ? Number(s.beta) : undefined,
              sector: undefined,
              shortFloat: undefined,
            })
          }
        }
      } catch { /* skip batch on error */ }
    }
    return quotes
  } catch (e) {
    logger.error(`[Pulse] fetchStockQuotes failed: ${(e as Error).message}`)
    return []
  }
}

async function fetchAnalystConsensus(): Promise<AnalystConsensus[]> {
  try {
    return await fmpApiFetch<AnalystConsensus[]>('/upgrades-downgrades-consensus-bulk')
  } catch { return [] }
}

async function fetchEarningsSurprises(): Promise<EarningsSurprise[]> {
  try {
    const year = new Date().getFullYear()
    return await fmpApiFetch<EarningsSurprise[]>('/earnings-surprises-bulk', { year: String(year) })
  } catch { return [] }
}

async function fetchTreasuryRates(): Promise<TreasuryRate[]> {
  try {
    return await fmpApiFetch<TreasuryRate[]>('/treasury-rates', { limit: '5' })
  } catch { return [] }
}

async function fetchSectorPerformance(): Promise<SectorPerf[]> {
  try {
    const today = new Date()
    let d = new Date(today)
    for (let i = 0; i < 5; i++) {
      const day = d.getDay()
      if (day === 0) d.setDate(d.getDate() - 2)
      else if (day === 6) d.setDate(d.getDate() - 1)
      const dateStr = d.toISOString().slice(0, 10)
      const data = await fmpApiFetch<SectorPerf[]>('/sector-performance-snapshot', { date: dateStr })
      if (data && data.length > 0) return data
      d.setDate(d.getDate() - 1)
    }
    return []
  } catch { return [] }
}

async function fetchCongressTradesAll(chamber: 'senate' | 'house'): Promise<CongressTrade[]> {
  try {
    const endpoint = chamber === 'senate' ? '/senate-trades' : '/house-trades'
    return await fmpApiFetch<CongressTrade[]>(endpoint, { limit: '50' })
  } catch { return [] }
}

// ─── Helpers ────────────────────────────────────────────────────

function getResult<T>(settled: PromiseSettledResult<T>, fallback: T): T {
  return settled.status === 'fulfilled' ? settled.value : fallback
}

function checkMarketOpen(): boolean {
  const now = new Date()
  const et = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false })
  const parts = et.formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  const totalMin = hour * 60 + minute
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now)
  if (day === 'Sat' || day === 'Sun') return false
  return totalMin >= 570 && totalMin <= 960 // 9:30-16:00
}
