// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Cron Endpoint (Redis-First Scan)
// Vercel Cron tarafindan tetiklenir.
// 3 mod:
//   1) REDIS_SCAN: Bootstrap tamamlanmissa Redis'teki barlardan skor hesaplar (FMP yok)
//   2) DELTA: Market aciksa Redis barlari delta gunceller + skor hesaplar
//   3) FULL_STITCH: Bootstrap yoksa FMP'den tam 15dk veri ceker (yavas, rate-limited)
// force=1 parametresi ile market kapali olsa bile calisir.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getUniverseTierSymbols, computeSegmentFromMarketCap, UniverseTier } from '@/lib/symbols'
import { getHistorical15Min, getHistorical15MinDelta, getBatchQuotes } from '@/lib/fmp-client'
import { calculateHermes } from '@/lib/hermes-engine'
import { saveScanResults, loadLatestScan } from '@/lib/scan-store'
import { ScanResult, ScanSummary, OHLCV } from '@/lib/types'
import {
  getBarCache,
  setBarCache,
  getBootstrapProgress,
  getBootstrapCheckpoint,
  getBootstrapSkipped,
  getBarCacheCount,
  acquireRefreshLockRedis,
  releaseRefreshLockRedis,
  setTradeReadySymbols,
} from '@/lib/cache/redis-cache'
import { isRedisAvailable, isRedisRequired } from '@/lib/cache/redis-client'
import { isMarketOpen, getNowET, getETMinutes } from '@/lib/scheduler/marketHours'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'
import { providerMonitor } from '@/lib/monitor/provider-monitor'

export const maxDuration = 300

const MIN_SCAN_BARS = 6331
const TIME_LIMIT_MS = 250_000

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
  const internalCron = request.headers.get('x-internal-cron')
  const cronSecret = process.env.CRON_SECRET
  const vercelCron = request.headers.get('x-vercel-cron')
  const isAuthorized = (cronSecret && (
    authHeader === `Bearer ${cronSecret}` ||
    internalCron === cronSecret
  )) || vercelCron === '1'

  if (!isAuthorized) {
    logger.warn('Cron unauthorized request', { module: 'cron' })
    return NextResponse.json(createApiError('Unauthorized', 'Invalid credentials', 'AUTH'), { status: 401 })
  }

  const url = new URL(request.url)
  const forceParam = url.searchParams.get('force')
  const forceRun = forceParam === '1' || forceParam === 'true'
  const universeParam = (url.searchParams.get('universe') || 'ALL').toUpperCase()
  const universe: UniverseTier = (['ALL', 'HOT', 'WARM', 'COLD'].includes(universeParam) ? universeParam : 'ALL') as UniverseTier
  const bypassLock = forceRun
  const marketOpen = isMarketOpen()

  if (!marketOpen && !forceRun) {
    logger.info('Cron skipped — market closed', { module: 'cron' })
    return NextResponse.json({
      status: 'skipped',
      reason: 'Market kapali (force=1 ile zorlayabilirsiniz)',
      timestamp: new Date().toISOString(),
    })
  }

  let lockAcquired = false
  if (!bypassLock) {
    lockAcquired = await acquireRefreshLockRedis()
    if (!lockAcquired) {
      logger.info('Cron skipped — refresh already in progress', { module: 'cron' })
      return NextResponse.json({
        status: 'skipped',
        reason: 'Refresh already in progress',
        timestamp: new Date().toISOString(),
      })
    }
  } else {
    logger.debug('Cron lock bypassed (force=1)', { module: 'cron' })
  }

  const context = getScanContext()
  const redisReady = isRedisAvailable()
  const redisRequired = isRedisRequired()
  if (redisRequired && !redisReady) {
    logger.error('CRON_REDIS_REQUIRED_UNAVAILABLE', { module: 'cron', context })
    return NextResponse.json(
      createApiError('Redis required but unavailable', 'Set REQUIRE_REDIS=false only for local emergency use', 'REDIS_REQUIRED'),
      { status: 503 }
    )
  }

    let bootstrapComplete = false
    if (redisReady) {
      const progress = await getBootstrapProgress()
      bootstrapComplete = !!(progress && progress.status === 'complete')

      // Fallback guard:
      // bootstrap:progress key can expire while Redis bar cache is still fully available.
      // In that case, infer bootstrap completion from checkpoint/skipped or bar-cache coverage.
      if (!bootstrapComplete) {
        const [checkpoint, skipped, cacheCount] = await Promise.all([
          getBootstrapCheckpoint(),
          getBootstrapSkipped(),
          getBarCacheCount(),
        ])
        const allCount = getUniverseTierSymbols('ALL').length
        const checkpointCovered = (checkpoint?.length ?? 0) + (skipped?.length ?? 0)
        const coverageThreshold = Math.floor(allCount * 0.95)

        if (checkpointCovered >= coverageThreshold || cacheCount >= coverageThreshold) {
          bootstrapComplete = true
          logger.info('Cron bootstrap fallback activated from Redis coverage', {
            module: 'cron',
            checkpointCovered,
            cacheCount,
            allCount,
            coverageThreshold,
          })
        }
      }
    }

  // Decide mode
  let mode: 'REDIS_SCAN' | 'DELTA' | 'FULL_STITCH'
  if (bootstrapComplete && marketOpen) {
    mode = 'DELTA'
  } else if (bootstrapComplete) {
    mode = 'REDIS_SCAN'
  } else {
    mode = 'FULL_STITCH'
  }

  logger.info(`Cron ${context} scan starting (mode: ${mode}, market: ${marketOpen ? 'OPEN' : 'CLOSED'})`, { module: 'cron' })

  try {
    const allSymbols = getUniverseTierSymbols(universe)
    const results: ScanResult[] = []
    let totalErrors = 0
    let redisHits = 0
    let deltaHits = 0
    let skippedBars = 0

    const quotes = await getBatchQuotes(allSymbols)
    const queue = [...allSymbols]
    const concurrency = mode === 'REDIS_SCAN' ? 20 : mode === 'DELTA' ? 10 : 5

    async function processSymbol(symbol: string): Promise<ScanResult | null> {
      try {
        let bars: OHLCV[] | null = null

        if (mode === 'REDIS_SCAN') {
          const cached = await getBarCache(symbol)
          if (cached && cached.length >= MIN_SCAN_BARS) {
            bars = cached
            redisHits++
          } else {
            skippedBars++
            return null
          }
        } else if (mode === 'DELTA') {
          const existing = await getBarCache(symbol)
          if (existing && existing.length >= MIN_SCAN_BARS) {
            bars = await getHistorical15MinDelta(symbol, existing)
            await setBarCache(symbol, bars).catch(() => {})
            deltaHits++
          } else {
            skippedBars++
            return null
          }
        } else {
          // FULL_STITCH: fetch from FMP when Redis is unavailable
          try {
            bars = await getHistorical15Min(symbol)
          } catch {
            skippedBars++
            return null
          }
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
        if (Date.now() - startTime > TIME_LIMIT_MS) break
        const symbol = queue.shift()
        if (!symbol) break
        const result = await processSymbol(symbol)
        if (result) results.push(result)
        await new Promise(resolve => setTimeout(resolve, mode === 'REDIS_SCAN' ? 5 : 20))
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)

    let finalResults = results

    // Partial universe scans should merge into latest full cache, never overwrite with subset.
    if (universe !== 'ALL') {
      const latest = await loadLatestScan()
      if (latest?.results?.length) {
        const merged = new Map<string, ScanResult>()
        for (const r of latest.results) merged.set(r.symbol, r)
        for (const r of results) merged.set(r.symbol, r)
        finalResults = Array.from(merged.values())
      }
    }

    const allStrongLongs = finalResults.filter(r => r.hermes.signalType === 'strong_long')
    const allStrongShorts = finalResults.filter(r => r.hermes.signalType === 'strong_short')
    const totalScanned = finalResults.length

    const summary: ScanSummary = {
      scanId: `cron-ALL-${Date.now()}`,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      totalScanned,
      strongLongs: allStrongLongs,
      strongShorts: allStrongShorts,
      longs: finalResults.filter(r => r.hermes.signalType === 'long'),
      shorts: finalResults.filter(r => r.hermes.signalType === 'short'),
      neutrals: finalResults.filter(r => r.hermes.signalType === 'neutral').length,
      errors: totalErrors,
      segment: 'ALL',
    }

    saveScanResults('ALL', finalResults, summary)
    await Promise.all([
      providerMonitor.recordDataFetch('scan'),
      providerMonitor.recordDataFetch('stocksQuote'),
    ])

    // Save trade-ready symbol list to Redis
    if (finalResults.length > 1000) {
      const tradeReadySymbols = finalResults.map(r => r.symbol).sort()
      await setTradeReadySymbols(tradeReadySymbols)
    }

    const duration = Date.now() - startTime
    logger.info(`Cron ${context}: ${totalScanned} scanned (mode: ${mode}, universe: ${universe}, redis: ${redisHits}, delta: ${deltaHits}, skipped: ${skippedBars}) — ${(duration / 1000).toFixed(1)}s`, { module: 'cron' })

    return NextResponse.json({
      status: 'completed',
      mode,
      universe,
      context,
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
      totalScanned,
      refreshedSymbols: results.length,
      totalErrors,
      redisHits,
      deltaHits,
      skippedBars,
      strongLongs: allStrongLongs.length,
      strongShorts: allStrongShorts.length,
    })

  } catch (error) {
    logger.error('CRON_SCAN_FAILED', { module: 'cron', error })
    return NextResponse.json(
      createApiError('Cron scan failed', (error as Error).message, 'CRON_ERROR'),
      { status: 500 }
    )
  } finally {
    if (lockAcquired) await releaseRefreshLockRedis()
  }
}
