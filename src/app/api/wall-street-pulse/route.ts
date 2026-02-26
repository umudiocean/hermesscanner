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
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const PULSE_CACHE_TTL = 5 * 60 * 1000 // 5 min

type TerminalStockLite = {
  symbol: string
  sector?: string
  shortFloat?: number
  categories?: {
    smartMoney?: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const LOG = '[Pulse API]'
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`pulse:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

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
    terminalStocksData,
    ratingsData,
    earningsData,
    treasuryData,
    sectorData,
    senateTrades,
    houseTrades,
    vixValue,
    putCallRatio,
    quiverCongressData,
    quiverOffExData,
    insiderAggData,
  ] = await Promise.allSettled([
    fetchStockQuotes(),
    fetchTerminalStocksSnapshot(),
    fetchAnalystConsensus(),
    fetchEarningsSurprises(),
    fetchTreasuryRates(),
    fetchSectorPerformance(),
    fetchCongressTradesAll('senate'),
    fetchCongressTradesAll('house'),
    fetchVIXValue(),
    fetchPutCallRatio(),
    fetchQuiverCongressLive(),
    fetchQuiverOffExchange(),
    fetchInsiderAggregateFromFMP(),
  ])

  const stocks = getResult<StockQuote[]>(stocksData, [])
  const terminalStocks = getResult<TerminalStockLite[]>(terminalStocksData, [])
  const ratings = getResult<AnalystConsensus[]>(ratingsData, [])
  const earnings = getResult<EarningsSurprise[]>(earningsData, [])
  const treasury = getResult<TreasuryRate[]>(treasuryData, [])
  const sectors = getResult<SectorPerf[]>(sectorData, [])
  const senate = getResult<CongressTrade[]>(senateTrades, [])
  const house = getResult<CongressTrade[]>(houseTrades, [])
  const vix = getResult<number | null>(vixValue, null)
  const pc = getResult<number | null>(putCallRatio, null)
  const quiverCongress = getResult<CongressTrade[]>(quiverCongressData, [])
  const offExchangeData = getResult<QuiverOffExchangeRaw[]>(quiverOffExData, [])
  const insiderStats = getResult<InsiderStat[]>(insiderAggData, [])

  const institutionalDelta = computeInstitutionalDeltaFromDPI(offExchangeData)

  logger.info(`${LOG} Data: ${stocks.length} stocks, terminal=${terminalStocks.length}, ratings=${ratings.length}, earnings=${earnings.length}, VIX=${vix}, P/C=${pc}, quiverCongress=${quiverCongress.length}, offExchange=${offExchangeData.length}, insider=${insiderStats.length}`)

  // Enrich quote universe with sector/shortFloat from Hermes AI stocks snapshot
  const terminalBySymbol = new Map(terminalStocks.map(s => [s.symbol, s]))
  for (const q of stocks) {
    const t = terminalBySymbol.get(q.symbol)
    if (!t) continue
    if (q.sector == null && t.sector) q.sector = t.sector
    if (q.shortFloat == null && typeof t.shortFloat === 'number') q.shortFloat = t.shortFloat
  }

  // Congressional: prioritize Quiver live data over FMP
  const congressAll: CongressTrade[] = quiverCongress.length > 0
    ? quiverCongress
    : [
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
    institutionalDelta,
    marketOpen: isMarketOpen,
  }

  return calculatePulse(inputs)
}

async function fetchTerminalStocksSnapshot(): Promise<TerminalStockLite[]> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/fmp-terminal/stocks`, {
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
      },
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json() as { stocks?: TerminalStockLite[] }
    return Array.isArray(json.stocks) ? json.stocks : []
  } catch (error) {
    logger.warn('[Pulse] terminal stocks snapshot fetch failed', { module: 'pulseRoute', error: (error as Error).message })
    return []
  }
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
      } catch (error) {
        logger.warn('[Pulse] batch-quote sub-batch failed', {
          module: 'pulseRoute',
          endpoint: '/batch-quote',
          error: (error as Error).message,
        })
      }
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
  } catch (error) {
    logger.warn('[Pulse] analyst consensus fetch failed', { module: 'pulseRoute', error: (error as Error).message })
    return []
  }
}

async function fetchEarningsSurprises(): Promise<EarningsSurprise[]> {
  try {
    const year = new Date().getFullYear()
    return await fmpApiFetch<EarningsSurprise[]>('/earnings-surprises-bulk', { year: String(year) })
  } catch (error) {
    logger.warn('[Pulse] earnings surprises fetch failed', { module: 'pulseRoute', error: (error as Error).message })
    return []
  }
}

async function fetchTreasuryRates(): Promise<TreasuryRate[]> {
  try {
    return await fmpApiFetch<TreasuryRate[]>('/treasury-rates', { limit: '5' })
  } catch (error) {
    logger.warn('[Pulse] treasury rates fetch failed', { module: 'pulseRoute', error: (error as Error).message })
    return []
  }
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
  } catch (error) {
    logger.warn('[Pulse] sector performance fetch failed', { module: 'pulseRoute', error: (error as Error).message })
    return []
  }
}

async function fetchCongressTradesAll(chamber: 'senate' | 'house'): Promise<CongressTrade[]> {
  try {
    const endpoint = chamber === 'senate' ? '/senate-trades' : '/house-trades'
    return await fmpApiFetch<CongressTrade[]>(endpoint, { limit: '50' })
  } catch (error) {
    logger.warn('[Pulse] congress trades fetch failed', { module: 'pulseRoute', chamber, error: (error as Error).message })
    return []
  }
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

// ─── Quiver Live Congress Trades ──────────────────────────────────

interface QuiverCongressRaw {
  Representative?: string
  ReportDate?: string
  TransactionDate?: string
  Ticker?: string
  Transaction?: string
  Range?: string
  House?: string
}

async function fetchQuiverCongressLive(): Promise<CongressTrade[]> {
  const apiKey = process.env.QUIVER_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch('https://api.quiverquant.com/beta/live/congresstrading', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data: QuiverCongressRaw[] = await res.json()
    if (!Array.isArray(data)) return []
    // Last 90 days
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    return data
      .filter(t => (t.TransactionDate || t.ReportDate || '') >= cutoff)
      .map(t => ({
        type: t.Transaction || '',
        amount: t.Range || '',
      }))
  } catch (e) {
    logger.warn('[Pulse] Quiver congress live failed', { error: (e as Error).message })
    return []
  }
}

// ─── Quiver Off-Exchange (Short Volume / DPI) ──────────────────────

interface QuiverOffExchangeRaw {
  Ticker?: string
  Date?: string
  OTC_Short?: number
  OTC_Total?: number
  DPI?: number
}

async function fetchQuiverOffExchange(): Promise<QuiverOffExchangeRaw[]> {
  const apiKey = process.env.QUIVER_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch('https://api.quiverquant.com/beta/live/offexchange', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data: QuiverOffExchangeRaw[] = await res.json()
    return Array.isArray(data) ? data : []
  } catch (e) {
    logger.warn('[Pulse] Quiver off-exchange failed', { error: (e as Error).message })
    return []
  }
}

function computeInstitutionalDeltaFromDPI(data: QuiverOffExchangeRaw[]): number {
  if (!data || data.length === 0) return 0
  // DPI (Dark Pool Indicator): OTC_Short / OTC_Total
  // High DPI (>0.55) = institutional selling pressure (bearish)
  // Low DPI (<0.45) = institutional buying (bullish)
  const dpis = data.filter(d => typeof d.DPI === 'number' && d.DPI > 0).map(d => d.DPI!)
  if (dpis.length === 0) return 0
  const avgDPI = dpis.reduce((a, b) => a + b, 0) / dpis.length
  // Invert: DPI 0.55 = -1 (bearish), DPI 0.45 = +1 (bullish), 0.50 = 0
  return Math.max(-1, Math.min(1, (0.50 - avgDPI) * 20))
}

// ─── FMP Insider Trading Aggregate ────────────────────────────────

async function fetchInsiderAggregateFromFMP(): Promise<InsiderStat[]> {
  try {
    // Use top 20 most liquid stocks for aggregate insider sentiment
    const topSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH',
      'XOM', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'CVX', 'MRK', 'ABBV', 'PEP']
    let totalBuys = 0, totalSells = 0
    const results = await Promise.allSettled(
      topSymbols.map(async (sym) => {
        try {
          const data = await fmpApiFetch<Record<string, unknown>[]>('/insider-trading/statistics', { symbol: sym })
          if (!Array.isArray(data) || data.length === 0) return null
          // Aggregate last 12 months of insider trades
          let buys = 0, sells = 0
          for (const row of data.slice(0, 4)) {
            buys += Number(row.totalBought || row.purchases || 0)
            sells += Number(row.totalSold || row.sales || 0)
          }
          return { buys, sells }
        } catch { return null }
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        totalBuys += r.value.buys
        totalSells += r.value.sells
      }
    }
    if (totalBuys + totalSells === 0) return []
    return [{
      symbol: 'MARKET',
      purchases: totalBuys,
      sales: totalSells,
      totalBought: totalBuys,
      totalSold: totalSells,
    }]
  } catch (e) {
    logger.warn('[Pulse] FMP insider aggregate failed', { error: (e as Error).message })
    return []
  }
}
