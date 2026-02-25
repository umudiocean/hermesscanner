// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner — Europe Cron Refresh
// 3x/day: 09:05 CET (open+5), 13:15 CET (mid), 17:35 CET (close+5)
// Triggers /api/europe-scan to rescan all Europe symbols
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/monitor/cron-auth'
import { sentinelLog } from '@/lib/logger/sentinel-log'
import { providerMonitor } from '@/lib/monitor/provider-monitor'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startAt = Date.now()

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const scanRes = await fetch(`${appUrl}/api/europe-scan`, {
      headers: {
        'x-vercel-cron': '1',
        'authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
      },
      signal: AbortSignal.timeout(280000),
    })

    if (!scanRes.ok) {
      throw new Error(`Europe scan returned ${scanRes.status}`)
    }

    const result = await scanRes.json()
    await providerMonitor.recordDataFetch('europeScan')
    await providerMonitor.recordSuccess('fmp')

    const durationMs = Date.now() - startAt
    sentinelLog.info('CRON_EUROPE_REFRESH_OK', {
      durationMs,
      scanned: result?.summary?.scannedSymbols ?? 0,
      total: result?.summary?.totalSymbols ?? 0,
    })

    return NextResponse.json({
      ran: true,
      durationMs,
      scanned: result?.summary?.scannedSymbols ?? 0,
    })
  } catch (err) {
    const durationMs = Date.now() - startAt
    sentinelLog.error('CRON_EUROPE_REFRESH_FAILED', {
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    })
    await providerMonitor.recordError('fmp', 0)
    return NextResponse.json({ ran: false, error: 'Europe refresh failed' }, { status: 500 })
  }
}
