// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Cron Endpoint (Delta Mode)
// Vercel Cron tarafindan her 30dk tetiklenir.
// Redis'teki bar verisini delta (son 2 gun) ile gunceller, skor hesaplar.
// Bootstrap yapilmamissa fallback olarak tam stitching yapar.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCleanSymbols, computeSegmentFromMarketCap } from '@/lib/symbols'
import { getHistorical15MinDelta, getHistorical15Min, getBatchQuotes } from '@/lib/fmp-client'
import { calculateHermes } from '@/lib/hermes-engine'
import { saveScanResults } from '@/lib/scan-store'
import { ScanResult, ScanSummary } from '@/lib/types'
import { getBarCache, setBarCache, getBootstrapProgress } from '@/lib/cache/redis-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'
import { isMarketOpen, getNowET, getETMinutes, acquireRefreshLock, releaseRefreshLock } from '@/lib/scheduler/marketHours'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'

export const maxDuration = 300

const MIN_SCAN_BARS = 6331

function getScanContext(): string {
  const et = getNowET()
  const etTime = getETMinutes(et)

  if (etTime >= 570 && etTime <= 600) return 'ACILIS'
  if (etTime >= 630 && etTime <= 660) return 'ACILISTAN 1 SAAT'
  if (etTime >= 840 && etTime <= 870) return 'KAPANISA 2 SAAT'
  if (etTime >= 930 && etTime <= 960) return 'KAPANISA 30 DAK'

  const h = et.getHours()
  const m = et.getMinutes()
  return `ET ${h}:${String(m).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const vercelCron = request.headers.get('x-vercel-cron')
  const isAuthorized = (cronSecret && authHeader === `Bearer ${cronSecret}`) || vercelCron === '1'

  if (!isAuthorized) {
    logger.warn('Cron unauthorized request', { module: 'cron' })
    return NextResponse.json(createApiError('Unauthorized', 'Invalid credentials', 'AUTH'), { status: 401 })
  }

  if (!isMarketOpen()) {
    logger.info('Cron skipped — market closed', { module: 'cron' })
    return NextResponse.json({
      status: 'skipped',
      reason: 'Market kapali',
      timestamp: new Date().toISOString(),
    })
  }

  const lockAcquired = await acquireRefreshLock()
  if (!lockAcquired) {
    logger.info('Cron skipped — refresh already in progress', { module: 'cron' })
    return NextResponse.json({
      status: 'skipped',
      reason: 'Refresh already in progress',
      timestamp: new Date().toISOString(),
    })
  }

  const context = getScanContext()
  const redisReady = isRedisAvailable()

  // Check if bootstrap has been completed
  let useRedisDeltas = false
  if (redisReady) {
    const progress = await getBootstrapProgress()
    if (progress && progress.status === 'complete') {
      useRedisDeltas = true
    }
  }

  logger.info(`Cron ${context} scan starting (mode: ${useRedisDeltas ? 'DELTA' : 'FULL_STITCH'})`, { module: 'cron' })

  try {
    const allSymbols = getCleanSymbols('ALL')
    const results: ScanResult[] = []
    let totalErrors = 0
    let deltaHits = 0
    let stitchFallbacks = 0

    const quotes = await getBatchQuotes(allSymbols)
    const queue = [...allSymbols]
    const concurrency = useRedisDeltas ? 10 : 10

    async function processSymbol(symbol: string): Promise<ScanResult | null> {
      try {
        let bars: import('@/lib/types').OHLCV[] | null = null

        if (useRedisDeltas) {
          // Delta mode: read existing bars from Redis, fetch only last 2 days
          const existing = await getBarCache(symbol)
          if (existing && existing.length >= MIN_SCAN_BARS) {
            bars = await getHistorical15MinDelta(symbol, existing)
            // Write updated bars back to Redis
            await setBarCache(symbol, bars)
            deltaHits++
          } else {
            // No Redis cache for this symbol — full stitch fallback
            bars = await getHistorical15Min(symbol)
            if (bars && bars.length > 0) {
              await setBarCache(symbol, bars)
            }
            stitchFallbacks++
          }
        } else {
          // Legacy mode: full stitching (no bootstrap done yet)
          bars = await getHistorical15Min(symbol)
        }

        if (!bars || bars.length < MIN_SCAN_BARS) return null

        const quote = quotes.get(symbol)
        const hermes = calculateHermes(bars)
        return {
          symbol,
          segment: computeSegmentFromMarketCap(quote?.marketCap),
          hermes,
          quote: quote ? {
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
          } : undefined,
          timestamp: new Date().toISOString(),
        }
      } catch (err) {
        totalErrors++
        logger.debug(`Cron symbol error: ${symbol}`, { module: 'cron', symbol, error: err })
        return null
      }
    }

    async function worker() {
      while (queue.length > 0) {
        const symbol = queue.shift()
        if (!symbol) break
        const result = await processSymbol(symbol)
        if (result) results.push(result)
        await new Promise(resolve => setTimeout(resolve, useRedisDeltas ? 20 : 50))
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)

    const allStrongLongs = results.filter(r => r.hermes.signalType === 'strong_long')
    const allStrongShorts = results.filter(r => r.hermes.signalType === 'strong_short')
    const totalScanned = results.length

    const summary: ScanSummary = {
      scanId: `cron-ALL-${Date.now()}`,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      totalScanned,
      strongLongs: allStrongLongs,
      strongShorts: allStrongShorts,
      longs: results.filter(r => r.hermes.signalType === 'long'),
      shorts: results.filter(r => r.hermes.signalType === 'short'),
      neutrals: results.filter(r => r.hermes.signalType === 'neutral').length,
      errors: totalErrors,
      segment: 'ALL',
    }

    saveScanResults('ALL', results, summary)

    const duration = Date.now() - startTime
    logger.info(`Cron ${context}: ${totalScanned} scanned (delta: ${deltaHits}, stitch: ${stitchFallbacks}), ${allStrongLongs.length} S.LONG, ${allStrongShorts.length} S.SHORT — ${(duration / 1000).toFixed(1)}s`, { module: 'cron' })

    return NextResponse.json({
      status: 'completed',
      mode: useRedisDeltas ? 'delta' : 'full_stitch',
      context,
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
      totalScanned,
      totalErrors,
      deltaHits,
      stitchFallbacks,
      strongLongs: allStrongLongs.map(r => ({
        symbol: r.symbol,
        score: r.hermes.score,
        price: r.hermes.price,
        segment: r.segment,
      })),
      strongShorts: allStrongShorts.map(r => ({
        symbol: r.symbol,
        score: r.hermes.score,
        price: r.hermes.price,
        segment: r.segment,
      })),
    })

  } catch (error) {
    logger.error('Cron error', { module: 'cron', error })
    return NextResponse.json(
      createApiError('Cron scan failed', (error as Error).message, 'CRON_ERROR'),
      { status: 500 }
    )
  } finally {
    await releaseRefreshLock()
  }
}
