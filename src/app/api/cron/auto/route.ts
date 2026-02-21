// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner — Full Auto Cron (Bootstrap + Scan)
// Her 5 dakikada tetiklenir. Tamamen otomatik, manuel adim yok.
// Bootstrap tamamlanmamissa dongu halinde bootstrap cagirir (4 dk limit).
// Bootstrap tamamlaninca force scan yapar, Redis'e sonuclari yazar.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getBootstrapProgress } from '@/lib/cache/redis-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'
import logger from '@/lib/logger'

export const maxDuration = 300

const BOOTSTRAP_LOOP_LIMIT_MS = 240_000 // 4 min max for bootstrap loop (leave 1 min buffer)

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

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'

  let progress = await getBootstrapProgress()
  let bootstrapComplete = !!(progress && progress.status === 'complete')

  if (!bootstrapComplete) {
    const loopStart = Date.now()
    let batchesRun = 0

    while (!bootstrapComplete && Date.now() - loopStart < BOOTSTRAP_LOOP_LIMIT_MS) {
      batchesRun++
      logger.info('Auto-cron: Bootstrap batch', { module: 'auto-cron', batch: batchesRun })

      try {
        const res = await fetch(`${baseUrl}/api/cron/bootstrap`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
        })
        const data = await res.json()

        if (data.status === 'complete') {
          bootstrapComplete = true
          logger.info('Auto-cron: Bootstrap complete', { module: 'auto-cron', batches: batchesRun })
        }

        if (data.status === 'complete' || data.remaining === 0) break
        if (data.status === 'error') break

        await new Promise(r => setTimeout(r, 2000))
      } catch (err) {
        logger.error('Auto-cron: Bootstrap batch failed', { module: 'auto-cron', error: err })
        break
      }
    }

    progress = await getBootstrapProgress()
    bootstrapComplete = !!(progress && progress.status === 'complete')

    if (!bootstrapComplete) {
      return NextResponse.json({
        action: 'bootstrap',
        status: 'partial',
        batchesRun,
        completed: progress?.completed ?? 0,
        total: progress?.total ?? 0,
        message: `Bootstrap devam ediyor — sonraki cron kaldigindan devam edecek`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Bootstrap complete — run scan (always, so cache is fresh)
  logger.info('Auto-cron: Running scan', { module: 'auto-cron' })

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
    logger.error('Auto-cron: Scan failed', { module: 'auto-cron', error: err })
    return NextResponse.json({
      action: 'scan',
      status: 'error',
      message: (err as Error).message,
    }, { status: 500 })
  }
}
