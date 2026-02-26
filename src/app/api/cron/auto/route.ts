// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner — Full Auto Cron (Bootstrap + Scan)
// Her 5 dakikada tetiklenir. Tamamen otomatik, manuel adim yok.
// Bootstrap tamamlanmamissa bootstrap cagirir (4 dk limit).
// Bootstrap tamamlaninca force scan yapar, Redis'e sonuclari yazar.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getBootstrapProgress, getBootstrapCheckpoint, getBootstrapSkipped, getBarCacheCount } from '@/lib/cache/redis-cache'
import { isRedisAvailable, getRedis } from '@/lib/cache/redis-client'
import { getCleanSymbols } from '@/lib/symbols'
import logger from '@/lib/logger'

export const maxDuration = 300

const BOOTSTRAP_LOOP_LIMIT_MS = 240_000

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

  // Record cron run timestamp
  try {
    const r = getRedis()
    if (r) await r.set('cron:auto:lastRunAt', new Date().toISOString(), { ex: 7200 })
  } catch { /* ignore */ }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'

  // Check bootstrap status using MULTIPLE signals (not just progress key which can expire)
  let bootstrapComplete = await isBootstrapComplete()

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

    bootstrapComplete = await isBootstrapComplete()

    if (!bootstrapComplete) {
      const barCount = await getBarCacheCount()
      return NextResponse.json({
        action: 'bootstrap',
        status: 'partial',
        batchesRun,
        barCacheCount: barCount,
        message: `Bootstrap devam ediyor — sonraki cron kaldigindan devam edecek`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Bootstrap complete — run scan
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

async function isBootstrapComplete(): Promise<boolean> {
  // Method 1: Check progress key (can expire)
  const progress = await getBootstrapProgress()
  if (progress?.status === 'complete') return true

  // Method 2: Check actual checkpoint data vs total symbols
  // This is the REAL source of truth — even if progress key expires
  try {
    const allSymbols = getCleanSymbols('ALL')
    const total = allSymbols.length
    
    const [checkpoint, skipped, barCount] = await Promise.all([
      getBootstrapCheckpoint(),
      getBootstrapSkipped(),
      getBarCacheCount(),
    ])

    const completedCount = checkpoint?.length ?? 0
    const skippedCount = skipped?.length ?? 0
    const doneCount = completedCount + skippedCount

    // If 95%+ of symbols are done (checkpoint + skipped), consider bootstrap complete
    if (doneCount >= total * 0.95) {
      logger.info(`Auto-cron: Bootstrap inferred complete from checkpoint (${completedCount} cached + ${skippedCount} skipped / ${total} total, barCache=${barCount})`, { module: 'auto-cron' })
      return true
    }

    // If Redis has enough bar data (regardless of checkpoint), consider complete
    if (barCount >= total * 0.90) {
      logger.info(`Auto-cron: Bootstrap inferred complete from barCache count (${barCount}/${total})`, { module: 'auto-cron' })
      return true
    }
  } catch (err) {
    logger.warn('Auto-cron: Bootstrap check failed', { module: 'auto-cron', error: err })
  }

  return false
}
