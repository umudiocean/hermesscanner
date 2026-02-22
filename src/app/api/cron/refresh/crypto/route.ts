// HERMES_FIX: CRON_REFRESH_CRYPTO_v1 — Scheduled crypto data refresh
// Schedule: every 30 min (Vercel cron)
// Purpose: Pre-warm crypto caches, record freshness for SLA

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/monitor/cron-auth'
import { sentinelLog } from '@/lib/logger/sentinel-log'
import { providerMonitor } from '@/lib/monitor/provider-monitor'
import { fetchCoinsMarkets, fetchGlobalData, fetchTrending, fetchTopGainersLosers } from '@/lib/crypto-terminal/coingecko-client'
import { setMemoryCache, setDiskCache } from '@/lib/crypto-terminal/crypto-cache'
import { scoreAllCoins } from '@/lib/crypto-terminal/crypto-score-engine'
import { CoinMarket } from '@/lib/crypto-terminal/coingecko-types'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startAt = Date.now()

  try {
    let totalCoins = 0
    let errors = 0

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
        await providerMonitor.recordSuccess('coingecko')
      } catch {
        errors++
        await providerMonitor.recordError('coingecko', 0)
      }
    }
    totalCoins = allCoins.length

    if (allCoins.length > 0) {
      scoreAllCoins(allCoins)
      await providerMonitor.recordDataFetch('coinsBulk')
    }

    try {
      const global = await fetchGlobalData()
      if (global) {
        setMemoryCache('crypto-global', global)
        await setDiskCache('crypto-global', global)
        await providerMonitor.recordDataFetch('cryptoMarket')
        await providerMonitor.recordSuccess('coingecko')
      }
    } catch {
      errors++
      await providerMonitor.recordError('coingecko', 0)
    }

    try {
      const trending = await fetchTrending()
      if (trending) {
        setMemoryCache('crypto-trending', trending)
        await setDiskCache('crypto-trending', trending)
      }
      await providerMonitor.recordSuccess('coingecko')
    } catch {
      errors++
      await providerMonitor.recordError('coingecko', 0)
    }

    try {
      const gl = await fetchTopGainersLosers()
      if (gl) {
        setMemoryCache('crypto-gainers-losers', gl)
        await setDiskCache('crypto-gainers-losers', gl)
      }
      await providerMonitor.recordSuccess('coingecko')
    } catch {
      errors++
      await providerMonitor.recordError('coingecko', 0)
    }

    const durationMs = Date.now() - startAt
    sentinelLog.info('CRON_CRYPTO_REFRESH_OK', { durationMs, totalCoins, errors })

    return NextResponse.json({ ran: true, durationMs, totalCoins, errors })
  } catch (err) {
    const durationMs = Date.now() - startAt
    sentinelLog.error('CRON_CRYPTO_REFRESH_FAILED', {
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    })
    await providerMonitor.recordError('coingecko', 0)
    return NextResponse.json({ ran: false, error: 'Crypto refresh failed' }, { status: 500 })
  }
}
