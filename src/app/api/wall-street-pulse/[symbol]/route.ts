// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL — Wall Street Pulse Endpoint
// Congressional trades, insider sentiment, hedge fund activity via Quiver
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { fetchWallStreetPulse } from '@/lib/quiver-client'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`wall-street-pulse:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const params = await context.params
  const symbol = params.symbol?.toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
  }

  try {
    const data = await fetchWallStreetPulse(symbol)

    if (!data) {
      // Return empty structure if Quiver API unavailable
      return NextResponse.json({
        congressional: {
          recentTrades: 0,
          netBuysSells: 0,
          lastTradeDate: null,
        },
        insiderSentiment: {
          recentTrades: 0,
          netValue: 0,
          bullishRatio: 0.5,
        },
        hedgeFunds: {
          holders: 0,
          totalValue: 0,
          recentActivity: 'NEUTRAL',
        },
        available: false,
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      })
    }

    return NextResponse.json({
      ...data,
      available: true,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch Wall Street Pulse', message: error.message },
      { status: 500 }
    )
  }
}
