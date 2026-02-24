// HERMES_FIX: CRON_REFRESH_STOCKS_v1 — Scheduled stocks data refresh
// Schedule: every 60 min (Vercel cron, market hours only)
// Purpose: Trigger NASDAQ scan refresh, record freshness for SLA

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/monitor/cron-auth'
import { sentinelLog } from '@/lib/logger/sentinel-log'
import { providerMonitor } from '@/lib/monitor/provider-monitor'
import { getNowET } from '@/lib/scheduler/marketHours'
import type { UniverseTier } from '@/lib/symbols'
import { isRedisAvailable, isRedisRequired } from '@/lib/cache/redis-client'

export const maxDuration = 300

function pickUniverseTierForHour(etHour: number): UniverseTier {
  // Open + pre-close cycles keep full universe fresh.
  if (etHour === 9 || etHour === 15) return 'ALL'
  // Rotate to keep API usage controlled while preserving coverage.
  if (etHour % 3 === 0) return 'COLD'
  if (etHour % 2 === 0) return 'WARM'
  return 'HOT'
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startAt = Date.now()

  try {
    if (isRedisRequired() && !isRedisAvailable()) {
      sentinelLog.error('CRON_STOCKS_REFRESH_FAILED', { reason: 'REDIS_REQUIRED_UNAVAILABLE' })
      return NextResponse.json({ ran: false, error: 'Redis required but unavailable' }, { status: 503 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const etNow = getNowET()
    const universe = pickUniverseTierForHour(etNow.getHours())

    const scanRes = await fetch(`${appUrl}/api/cron?universe=${universe}`, {
      headers: {
        'x-vercel-cron': '1',
        'authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
      },
      signal: AbortSignal.timeout(290000),
    })

    if (!scanRes.ok) {
      throw new Error(`Scan cron returned ${scanRes.status}`)
    }

    const result = await scanRes.json()
    await providerMonitor.recordDataFetch('scan')
    await providerMonitor.recordSuccess('fmp')

    const durationMs = Date.now() - startAt
    sentinelLog.info('CRON_STOCKS_REFRESH_OK', {
      durationMs,
      scanResult: result?.status ?? 'unknown',
      universe,
    })

    return NextResponse.json({ ran: true, durationMs, universe })
  } catch (err) {
    const durationMs = Date.now() - startAt
    sentinelLog.error('CRON_STOCKS_REFRESH_FAILED', {
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    })
    await providerMonitor.recordError('fmp', 0)
    return NextResponse.json({ ran: false, error: 'Stocks refresh failed' }, { status: 500 })
  }
}
