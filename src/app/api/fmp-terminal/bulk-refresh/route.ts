// ═══════════════════════════════════════════════════════════════════
// FMP Terminal - Bulk Refresh API
// POST /api/fmp-terminal/bulk-refresh
// Fetches all bulk data, calculates V3 scores, saves to cache
// Protected: requires CRON_SECRET or internal header
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'

export const maxDuration = 120 // Allow 2 min for bulk refresh (Vercel Pro)

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Auth check: require CRON_SECRET, internal header, or Vercel cron
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const internalHeader = request.headers.get('x-bulk-refresh')
  const isAuthorized = (cronSecret && authHeader === `Bearer ${cronSecret}`) || internalHeader === '1'

  if (!isAuthorized) {
    logger.warn('Bulk refresh unauthorized attempt', { module: 'bulk-refresh' })
    return NextResponse.json(
      createApiError('Unauthorized', 'Valid authorization required', 'AUTH'),
      { status: 401 }
    )
  }

  try {
    // Trigger the stocks API which handles all scoring internally
    const baseUrl = request.nextUrl.origin
    const res = await fetch(`${baseUrl}/api/fmp-terminal/stocks`, {
      headers: { 'x-bulk-refresh': '1' },
    })

    if (!res.ok) {
      throw new Error(`Stocks API returned ${res.status}`)
    }

    const data = await res.json()
    const count = data.count || 0

    const duration = Date.now() - startTime
    logger.info(`Bulk refresh completed: ${count} scores in ${duration}ms`, { module: 'bulk-refresh', duration })

    return NextResponse.json({
      success: true,
      count,
      timestamp: new Date().toISOString(),
      duration,
    })
  } catch (error) {
    logger.error('Bulk refresh error', { module: 'bulk-refresh', error })
    return NextResponse.json(
      createApiError('Bulk refresh failed', (error as Error).message, 'REFRESH_ERROR'),
      { status: 500 }
    )
  }
}
