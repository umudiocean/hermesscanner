// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner — Bootstrap Endpoint
// Ilk agir yukleme: Tum 2197 hisse icin 3 yillik 15dk veri cekilir
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
  const pending = allSymbols.filter(s => !completedSet.has(s))

  if (pending.length === 0) {
    await setBootstrapProgress({
      completed: total,
      total,
      lastSymbol: allSymbols[allSymbols.length - 1] || '',
      startedAt: new Date().toISOString(),
      status: 'complete',
    })
    return NextResponse.json({
      status: 'complete',
      message: `All ${total} symbols already bootstrapped`,
      completed: total,
      total,
    })
  }

  logger.info(`Bootstrap starting: ${pending.length} pending of ${total} total`, { module: 'bootstrap' })

  await setBootstrapProgress({
    completed: completedSet.size,
    total,
    lastSymbol: '',
    startedAt: new Date().toISOString(),
    status: 'running',
  })

  const startTime = Date.now()
  let processed = 0
  let errors = 0
  let timedOut = false
  const newlyCompleted: string[] = []
  const queue = [...pending]

  async function processSymbol(symbol: string): Promise<boolean> {
    try {
      const bars = await getHistorical15Min(symbol)
      if (bars && bars.length > 0) {
        await setBarCache(symbol, bars)
        return true
      }
      return false
    } catch (err) {
      logger.debug(`Bootstrap error: ${symbol}`, { module: 'bootstrap', symbol, error: err })
      return false
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

      const ok = await processSymbol(symbol)
      processed++

      if (ok) {
        completedSet.add(symbol)
        newlyCompleted.push(symbol)
      } else {
        errors++
      }

      if (newlyCompleted.length % CHECKPOINT_INTERVAL === 0 && newlyCompleted.length > 0) {
        const allCompleted = Array.from(completedSet)
        await setBootstrapCheckpoint(allCompleted)
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

  const allCompleted = Array.from(completedSet)
  await setBootstrapCheckpoint(allCompleted)

  const isComplete = completedSet.size >= total
  await setBootstrapProgress({
    completed: completedSet.size,
    total,
    lastSymbol: newlyCompleted[newlyCompleted.length - 1] || '',
    startedAt: new Date().toISOString(),
    status: isComplete ? 'complete' : 'partial',
  })

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  logger.info(`Bootstrap batch: ${processed} done, ${errors} err, ${completedSet.size}/${total} total, ${elapsed}s${timedOut ? ' (time limit)' : ''}`, { module: 'bootstrap' })

  return NextResponse.json({
    status: isComplete ? 'complete' : 'partial',
    processed,
    errors,
    completed: completedSet.size,
    total,
    remaining: total - completedSet.size,
    timedOut,
    elapsed,
    message: isComplete
      ? `Bootstrap complete! All ${total} symbols cached in Redis.`
      : `Batch done. ${completedSet.size}/${total} complete (${elapsed}s). Call again to continue.`,
  })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { getBootstrapProgress, getBarCacheCount } = await import('@/lib/cache/redis-cache')
  const progress = await getBootstrapProgress()
  const barCount = await getBarCacheCount()

  return NextResponse.json({
    progress: progress || { completed: 0, total: 0, status: 'not_started' },
    barCacheCount: barCount,
    timestamp: new Date().toISOString(),
  })
}
