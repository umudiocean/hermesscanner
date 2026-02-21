// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Crypto Cron Endpoint
// Her saat otomatik calisir (7/24)
// CoinGecko cache'lerini onceden yeniler (warm cache)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'
import { getRedisCache, setRedisCache } from '@/lib/cache/redis-cache'
import { fetchCoinsMarkets, fetchGlobalData, fetchTrending, fetchTopGainersLosers } from '@/lib/crypto-terminal/coingecko-client'
import { setMemoryCache, setDiskCache } from '@/lib/crypto-terminal/crypto-cache'
import { scoreAllCoins } from '@/lib/crypto-terminal/crypto-score-engine'
import { CoinMarket } from '@/lib/crypto-terminal/coingecko-types'

export const maxDuration = 120

const CRYPTO_CRON_LOCK_KEY = 'cron:crypto:last_run'
const MIN_INTERVAL_MS = 50 * 60 * 1000 // 50 min (guard for dup runs within 1h window)

async function shouldRun(): Promise<boolean> {
  try {
    const lastRun = await getRedisCache<number>(CRYPTO_CRON_LOCK_KEY)
    if (lastRun && Date.now() - lastRun < MIN_INTERVAL_MS) {
      return false
    }
  } catch {
    // Redis down — run anyway
  }
  return true
}

async function markRun(): Promise<void> {
  try {
    await setRedisCache(CRYPTO_CRON_LOCK_KEY, Date.now(), 2 * 60 * 60 * 1000)
  } catch {
    // ignore
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Auth
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const vercelCron = request.headers.get('x-vercel-cron')
  const isAuthorized = (cronSecret && authHeader === `Bearer ${cronSecret}`) || vercelCron === '1'

  if (!isAuthorized) {
    logger.warn('Crypto cron unauthorized request', { module: 'cron-crypto' })
    return NextResponse.json(createApiError('Unauthorized', 'Invalid credentials', 'AUTH'), { status: 401 })
  }

  // Dedup guard
  if (!(await shouldRun())) {
    logger.info('Crypto cron skipped — ran recently', { module: 'cron-crypto' })
    return NextResponse.json({
      status: 'skipped',
      reason: 'Last run was less than 50 minutes ago',
      timestamp: new Date().toISOString(),
    })
  }

  logger.info('Crypto cron starting — warm cache', { module: 'cron-crypto' })

  try {
    let totalCoins = 0
    let errors = 0

    // 1. Fetch & cache top 1000 coins (4 pages x 250)
    const allCoins: CoinMarket[] = []
    for (let page = 1; page <= 4; page++) {
      try {
        const coins = await fetchCoinsMarkets(page, 250, page <= 4, '1h,24h,7d,30d') as CoinMarket[]
        if (coins && coins.length > 0) {
          allCoins.push(...coins)
          const cacheKey = `crypto-coins-v4-p${page}`
          setMemoryCache(cacheKey, coins)
          await setDiskCache(cacheKey, coins)
        }
      } catch {
        errors++
      }
    }
    totalCoins = allCoins.length

    // Score all coins and store
    if (allCoins.length > 0) {
      scoreAllCoins(allCoins)
    }

    // 2. Fetch global data
    try {
      const global = await fetchGlobalData()
      if (global) {
        setMemoryCache('crypto-global', global)
        await setDiskCache('crypto-global', global)
      }
    } catch {
      errors++
    }

    // 3. Fetch trending
    try {
      const trending = await fetchTrending()
      if (trending) {
        setMemoryCache('crypto-trending', trending)
        await setDiskCache('crypto-trending', trending)
      }
    } catch {
      errors++
    }

    // 4. Fetch gainers/losers
    try {
      const gl = await fetchTopGainersLosers()
      if (gl) {
        setMemoryCache('crypto-gainers-losers', gl)
        await setDiskCache('crypto-gainers-losers', gl)
      }
    } catch {
      errors++
    }

    await markRun()

    const duration = Date.now() - startTime
    logger.info(`Crypto cron completed: ${totalCoins} coins cached, ${errors} errors, ${(duration / 1000).toFixed(1)}s`, { module: 'cron-crypto' })

    return NextResponse.json({
      status: 'completed',
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
      totalCoins,
      errors,
    })

  } catch (error) {
    logger.error('Crypto cron error', { module: 'cron-crypto', error })
    return NextResponse.json(
      createApiError('Crypto cron failed', (error as Error).message, 'CRON_ERROR'),
      { status: 500 },
    )
  }
}
