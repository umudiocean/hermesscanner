// ═══════════════════════════════════════════════════════════════════
// FMP Terminal - Market Dashboard API
// GET /api/fmp-terminal/market
// Returns market dashboard data (indexes, sectors, gainers, etc.)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketDashboard } from '@/lib/fmp-terminal/fmp-bulk-client'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import logger from '@/lib/logger'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`fmp-market:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const data = await fetchMarketDashboard()

    const duration = Date.now() - startTime
    logger.info('[FMP Terminal /market] fetch success', {
      module: 'fmpMarketRoute',
      endpoint: '/api/fmp-terminal/market',
      duration,
    })

    return NextResponse.json(data, {
      headers: {
        'X-Hermes-Market-Duration-Ms': String(duration),
      },
    })
  } catch (error) {
    logger.error('[FMP Terminal /market] fetch failed', {
      module: 'fmpMarketRoute',
      endpoint: '/api/fmp-terminal/market',
      duration: Date.now() - startTime,
      error: (error as Error).message,
    })
    return NextResponse.json(
      {
        error: 'Failed to fetch market dashboard',
        message: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
