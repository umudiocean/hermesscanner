// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Market Dashboard API
// GET /api/europe-terminal/market
// European indexes, sectors, gainers/losers, Fear & Greed
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketDashboard } from '@/lib/fmp-terminal/fmp-bulk-client'
import { EUROPE_EXCHANGES, getEuropeMarketStatus } from '@/lib/europe-config'
import { fmpApiFetch } from '@/lib/api/fmpClient'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import logger from '@/lib/logger'

export const maxDuration = 60

export async function GET(_request: NextRequest) {
  const start = Date.now()
  const ip = getClientIP(_request)
  const { allowed, retryAfterMs } = await checkRateLimit(`eu-market:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const marketStatus = getEuropeMarketStatus()

    // Fetch EU index quotes
    const indexSymbols = Object.values(EUROPE_EXCHANGES)
      .map(ex => ex.indexSymbol)
      .filter(Boolean)
      .join(',')

    let indexes: Array<{ symbol: string; name: string; price: number; change: number; changePercent: number }> = []
    try {
      const data = await fmpApiFetch<Array<{
        symbol: string; name: string; price: number; change: number; changesPercentage: number
      }>>('/batch-quote', { symbols: indexSymbols })
      if (Array.isArray(data)) {
        indexes = data.map(q => ({
          symbol: q.symbol,
          name: Object.values(EUROPE_EXCHANGES).find(ex => ex.indexSymbol === q.symbol)?.indexName || q.name || q.symbol,
          price: q.price || 0,
          change: q.change || 0,
          changePercent: q.changesPercentage || 0,
        }))
      }
    } catch (error) {
      logger.warn('[EU Market] index quote fetch failed', {
        module: 'europeMarketRoute',
        endpoint: '/api/europe-terminal/market',
        error: (error as Error).message,
      })
    }

    // Reuse NASDAQ market dashboard for sectors/gainers/losers (global data)
    const globalDashboard = await fetchMarketDashboard()

    const duration = Date.now() - start
    return NextResponse.json({
      marketStatus,
      indexes,
      sectors: globalDashboard.sectorPerformance || [],
      gainers: globalDashboard.topGainers || [],
      losers: globalDashboard.topLosers || [],
      actives: globalDashboard.mostActive || [],
      fearGreedIndex: globalDashboard.fearGreedIndex || 50,
      fearGreedLabel: globalDashboard.fearGreedLabel || 'NEUTRAL',
      timestamp: new Date().toISOString(),
      durationMs: duration,
    })
  } catch (error) {
    logger.error('[EU Market] fetch failed', {
      module: 'europeMarketRoute',
      endpoint: '/api/europe-terminal/market',
      duration: Date.now() - start,
      error: (error as Error).message,
    })
    return NextResponse.json({ error: 'Failed', message: (error as Error).message }, { status: 500 })
  }
}
