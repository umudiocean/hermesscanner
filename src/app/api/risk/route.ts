// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Market Risk API
// GET /api/risk            → Current regime, VIX, drawdown state
// POST /api/risk/reset     → Reset daily drawdown (called at session open)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getMarketRisk, serializeRiskState, resetDailyDrawdown } from '@/lib/risk/market-risk-engine'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`risk:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('force') === '1'

    const state = await getMarketRisk(forceRefresh)

    return NextResponse.json(serializeRiskState(state), {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Risk engine failed', message: (err as Error).message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`risk:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json().catch(() => ({}))

    if (body.action === 'reset_drawdown') {
      resetDailyDrawdown()
      const state = await getMarketRisk(true)
      return NextResponse.json({ ...serializeRiskState(state), message: 'Drawdown reset' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Risk API error', message: (err as Error).message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
