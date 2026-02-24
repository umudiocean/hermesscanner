// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/chart/[id]
// OHLC candlestick + market chart (price, volume, mcap)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchOHLC, fetchMarketChart } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`crypto-chart:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const days = searchParams.get('days') || '7'
    const type = searchParams.get('type') || 'both' // ohlc, line, both

    const results: { ohlc?: unknown; chart?: unknown } = {}

    if (type === 'ohlc' || type === 'both') {
      results.ohlc = await getCached(
        `crypto-ohlc-${id}-${days}`,
        CRYPTO_CACHE_TTL.CHART,
        () => fetchOHLC(id, days),
      )
    }

    if (type === 'line' || type === 'both') {
      results.chart = await getCached(
        `crypto-chart-${id}-${days}`,
        CRYPTO_CACHE_TTL.CHART,
        () => fetchMarketChart(id, days),
      )
    }

    return NextResponse.json({
      id,
      days,
      ...results,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch chart data', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
