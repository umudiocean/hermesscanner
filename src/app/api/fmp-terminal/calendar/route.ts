import { NextRequest, NextResponse } from 'next/server'
import {
  fetchEarningsCalendar, fetchDividendCalendar,
  fetchStockSplitCalendar, fetchIPOCalendar,
} from '@/lib/fmp-terminal/fmp-bulk-client'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'

import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`fmp-calendar:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || new Date().toISOString().split('T')[0]
    const rawDays = Number(searchParams.get('days') || '14')
    const daysAhead = Math.max(1, Math.min(90, Math.floor(rawDays))) // Validate range
    const to = searchParams.get('to') || new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

    const [earnings, dividends, splits, ipos] = await Promise.allSettled([
      fetchEarningsCalendar(from, to),
      fetchDividendCalendar(from, to),
      fetchStockSplitCalendar(from, to),
      fetchIPOCalendar(from, to),
    ])

    const safe = <T>(r: PromiseSettledResult<T[]>): T[] =>
      r.status === 'fulfilled' ? r.value || [] : []

    return NextResponse.json({
      earnings: safe(earnings),
      dividends: safe(dividends),
      splits: safe(splits),
      ipos: safe(ipos),
      from,
      to,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Calendar API error', { module: 'api/calendar', error })
    return NextResponse.json(
      createApiError('Calendar data fetch failed', String(error), 'FETCH_ERROR'),
      { status: 500 }
    )
  }
}
