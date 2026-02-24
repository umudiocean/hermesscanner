// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Calendar API (Earnings, Dividends, Splits, IPOs)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { fetchEarningsCalendar, fetchDividendCalendar, fetchStockSplitCalendar, fetchIPOCalendar } from '@/lib/fmp-terminal/fmp-bulk-client'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 60

export async function GET(_request: NextRequest) {
  const ip = getClientIP(_request)
  const { allowed, retryAfterMs } = await checkRateLimit(`eu-calendar:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const today = new Date()
    const from = today.toISOString().slice(0, 10)
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + 14)
    const to = futureDate.toISOString().slice(0, 10)

    const [earnings, dividends, splits, ipos] = await Promise.allSettled([
      fetchEarningsCalendar(from, to),
      fetchDividendCalendar(from, to),
      fetchStockSplitCalendar(from, to),
      fetchIPOCalendar(from, to),
    ])
    const val = <T>(r: PromiseSettledResult<T>, d: T): T => r.status === 'fulfilled' ? r.value : d
    return NextResponse.json({
      earnings: val(earnings, []), dividends: val(dividends, []),
      splits: val(splits, []), ipos: val(ipos, []),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed', message: (error as Error).message }, { status: 500 })
  }
}
