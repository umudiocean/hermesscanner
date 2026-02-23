// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner — Bootstrap Endpoint
// Ilk agir yukleme: Tum 2064 trade-ready hisse icin 3 yillik 15dk veri cekilir
// Redis'e yazilir. Saatler surebilir. Admin panelden tetiklenir.
// Checkpoint destegi: kesilirse kaldigindan devam eder.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCleanSymbols } from '@/lib/symbols'
import { getHistorical15Min } from '@/lib/fmp-client'
import {
  setBarCache,
  getBootstrapCheckpoint,
  setBootstrapCheckpoint,
  setBootstrapProgress,
  getBootstrapSkipped,
  setBootstrapSkipped,
} from '@/lib/cache/redis-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'
import logger from '@/lib/logger'

export const maxDuration = 300 // Vercel Pro: 5 min max per invocation

const CONCURRENCY = 3
const CHECKPOINT_INTERVAL = 10 // Save checkpoint every N symbols
const DELAY_BETWEEN_SYMBOLS_MS = 50
const TIME_LIMIT_MS = 250_000 // Stop at 250s to leave 50s buffer for cleanup + response

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isRedisAvailable()) {
    return NextResponse.json({ error: 'Redis unavailable — bootstrap requires Redis' }, { status: 503 })
  }

  const allSymbols = getCleanSymbols('ALL')
  const total = allSymbols.length

  const checkpoint = await getBootstrapCheckpoint()
  const completedSet = new Set(checkpoint || [])
  const skippedArr = await getBootstrapSkipped()
  const skippedSet = new Set(skippedArr || [])
  const doneSet = new Set([...completedSet, ...skippedSet])
  const pending = allSymbols.filter(s => !doneSet.has(s))

  if (pending.length === 0) {
    await setBootstrapProgress({
      completed: completedSet.size,
      total,
      lastSymbol: '',
      startedAt: new Date().toISOString(),
      status: 'complete',
    })
    return NextResponse.json({
      status: 'complete',
      message: `Bootstrap complete! ${completedSet.size} cached, ${skippedSet.size} skipped (no data).`,
      completed: completedSet.size,
      skipped: skippedSet.size,
      total,
    })
  }

  logger.info(`Bootstrap starting: ${pending.length} pending, ${completedSet.size} done, ${skippedSet.size} skipped`, { module: 'bootstrap' })

  await setBootstrapProgress({
    completed: completedSet.size,
    total,
    lastSymbol: '',
    startedAt: new Date().toISOString(),
    status: 'running',
  })

  const startTime = Date.now()
  let processed = 0
  let batchErrors = 0
  let timedOut = false
  const newlyCompleted: string[] = []
  const queue = [...pending]

  async function processSymbol(symbol: string): Promise<'ok' | 'fail'> {
    try {
      const bars = await getHistorical15Min(symbol)
      if (bars && bars.length > 0) {
        await setBarCache(symbol, bars)
        return 'ok'
      }
      return 'fail'
    } catch (err) {
      logger.debug(`Bootstrap error: ${symbol}`, { module: 'bootstrap', symbol, error: err })
      return 'fail'
    }
  }

  async function worker() {
    while (queue.length > 0) {
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        timedOut = true
        break
      }

      const symbol = queue.shift()
      if (!symbol) break

      const result = await processSymbol(symbol)
      processed++

      if (result === 'ok') {
        completedSet.add(symbol)
        newlyCompleted.push(symbol)
      } else {
        batchErrors++
        skippedSet.add(symbol)
      }

      if (processed % CHECKPOINT_INTERVAL === 0) {
        await setBootstrapCheckpoint(Array.from(completedSet))
        await setBootstrapSkipped(Array.from(skippedSet))
        await setBootstrapProgress({
          completed: completedSet.size,
          total,
          lastSymbol: symbol,
          startedAt: new Date().toISOString(),
          status: 'running',
        })
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SYMBOLS_MS))
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)

  await setBootstrapCheckpoint(Array.from(completedSet))
  await setBootstrapSkipped(Array.from(skippedSet))

  const allDone = completedSet.size + skippedSet.size >= total
  await setBootstrapProgress({
    completed: completedSet.size,
    total,
    lastSymbol: newlyCompleted[newlyCompleted.length - 1] || '',
    startedAt: new Date().toISOString(),
    status: allDone ? 'complete' : 'partial',
  })

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  logger.info(`Bootstrap batch: ${processed} proc, ${batchErrors} err, ${completedSet.size} cached, ${skippedSet.size} skipped, ${elapsed}s${timedOut ? ' (time limit)' : ''}`, { module: 'bootstrap' })

  // Auto-trigger first scan when bootstrap completes
  if (allDone) {
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXTAUTH_URL || 'http://localhost:3000'
      logger.info('Bootstrap complete — auto-triggering first cron scan', { module: 'bootstrap' })
      fetch(`${baseUrl}/api/cron?force=1`, {
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
        },
      }).catch(err => {
        logger.warn(`Auto-scan trigger failed: ${err}`, { module: 'bootstrap' })
      })
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    status: allDone ? 'complete' : 'partial',
    processed,
    errors: batchErrors,
    completed: completedSet.size,
    skipped: skippedSet.size,
    total,
    remaining: total - completedSet.size - skippedSet.size,
    timedOut,
    elapsed,
    message: allDone
      ? `Bootstrap complete! ${completedSet.size} cached, ${skippedSet.size} skipped.`
      : `Batch done. ${completedSet.size}+${skippedSet.size}/${total} (${elapsed}s). Call again to continue.`,
  })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { getBootstrapProgress, getBarCacheCount, getBootstrapSkipped, getBootstrapCheckpoint: getChk } = await import('@/lib/cache/redis-cache')
  const progress = await getBootstrapProgress()
  const barCount = await getBarCacheCount()
  const skipped = await getBootstrapSkipped()
  const completed = await getChk()

  const allSymbols = getCleanSymbols('ALL')
  const completedSet = new Set(completed || [])
  const skippedSet = new Set(skipped || [])
  const missing = allSymbols.filter(s => !completedSet.has(s) && !skippedSet.has(s))

  return NextResponse.json({
    progress: progress || { completed: 0, total: 0, status: 'not_started' },
    barCacheCount: barCount,
    skipped: skipped || [],
    skippedCount: skippedSet.size,
    completedCount: completedSet.size,
    missing,
    missingCount: missing.length,
    timestamp: new Date().toISOString(),
  })
}
