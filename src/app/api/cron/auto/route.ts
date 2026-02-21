// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner — Auto Bootstrap + Scan Cron
// Her 6 saatte calisir. Bootstrap tamamlanmamissa bootstrap devam eder,
// tamamlanmissa force scan yapar.
// Vercel Cron tarafindan tetiklenir — tamamen otomatik, admin mudalesi yok.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getBootstrapProgress } from '@/lib/cache/redis-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'
import logger from '@/lib/logger'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const vercelCron = request.headers.get('x-vercel-cron')
  const isAuthorized = (cronSecret && authHeader === `Bearer ${cronSecret}`) || vercelCron === '1'

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isRedisAvailable()) {
    return NextResponse.json({ error: 'Redis unavailable' }, { status: 503 })
  }

  const progress = await getBootstrapProgress()
  const bootstrapComplete = !!(progress && progress.status === 'complete')

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'

  if (!bootstrapComplete) {
    logger.info('Auto-cron: Bootstrap not complete — triggering bootstrap batch', { module: 'auto-cron' })

    try {
      const res = await fetch(`${baseUrl}/api/cron/bootstrap`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()

      return NextResponse.json({
        action: 'bootstrap',
        status: data.status,
        completed: data.completed,
        skipped: data.skipped,
        total: data.total,
        remaining: data.remaining,
        message: data.message,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      logger.error('Auto-cron: Bootstrap trigger failed', { module: 'auto-cron', error: err })
      return NextResponse.json({
        action: 'bootstrap',
        status: 'error',
        message: (err as Error).message,
      }, { status: 500 })
    }
  }

  // Bootstrap complete — run a force scan
  logger.info('Auto-cron: Bootstrap complete — triggering force scan', { module: 'auto-cron' })

  try {
    const res = await fetch(`${baseUrl}/api/cron?force=1`, {
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    })
    const data = await res.json()

    return NextResponse.json({
      action: 'scan',
      status: data.status,
      totalScanned: data.totalScanned,
      mode: data.mode,
      duration: data.duration,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('Auto-cron: Scan trigger failed', { module: 'auto-cron', error: err })
    return NextResponse.json({
      action: 'scan',
      status: 'error',
      message: (err as Error).message,
    }, { status: 500 })
  }
}
