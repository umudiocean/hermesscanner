// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/onchain
// GeckoTerminal DEX pools, trending pools, on-chain data
// K2: Real on-chain score data | K6: Whale tracker data
// K8: Megafilter DEX screener
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import {
  fetchTrendingPools, fetchNetworkPools, fetchNewlyListed,
  fetchMegafilter, fetchNewPools, fetchSearchPools,
} from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`crypto-onchain:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const { searchParams } = new URL(request.url)
    const network = searchParams.get('network') || ''
    const mode = searchParams.get('mode') || 'overview' // overview, megafilter, whale, newpools
    const coinId = searchParams.get('coinId') || ''
    const query = searchParams.get('q') || ''

    // Mode: megafilter (K8 DEX Screener)
    if (mode === 'megafilter') {
      const filterParams: Record<string, string> = {}
      const minVolume = searchParams.get('minVolume')
      const minLiquidity = searchParams.get('minLiquidity')
      const sort = searchParams.get('sort')
      if (network) filterParams.networks = network
      if (minVolume) filterParams.min_h24_volume_usd = minVolume
      if (minLiquidity) filterParams.min_reserve_in_usd = minLiquidity
      if (sort) filterParams.sort = sort

      const megafilterData = await getCached(
        `crypto-megafilter-${JSON.stringify(filterParams)}`,
        CRYPTO_CACHE_TTL.ONCHAIN,
        () => fetchMegafilter(filterParams),
      )

      return NextResponse.json({
        mode: 'megafilter',
        pools: megafilterData,
        timestamp: new Date().toISOString(),
      })
    }

    // Mode: newpools
    if (mode === 'newpools') {
      const newPools = await getCached(
        'crypto-new-pools',
        CRYPTO_CACHE_TTL.ONCHAIN,
        () => fetchNewPools(),
      )

      return NextResponse.json({
        mode: 'newpools',
        pools: newPools,
        timestamp: new Date().toISOString(),
      })
    }

    // Mode: search pools
    if (mode === 'search' && query) {
      const searchResults = await getCached(
        `crypto-pool-search-${query}`,
        CRYPTO_CACHE_TTL.ONCHAIN,
        () => fetchSearchPools(query),
      )

      return NextResponse.json({
        mode: 'search',
        query,
        pools: searchResults,
        timestamp: new Date().toISOString(),
      })
    }

    // Default: overview mode — trending + newly listed + network pools
    const [trendingRes, newlyListedRes, networkPoolsRes] = await Promise.allSettled([
      getCached(
        'crypto-onchain-trending',
        CRYPTO_CACHE_TTL.ONCHAIN,
        () => fetchTrendingPools(),
      ),
      getCached(
        'crypto-newly-listed',
        CRYPTO_CACHE_TTL.ONCHAIN,
        () => fetchNewlyListed(),
      ),
      network
        ? getCached(
            `crypto-onchain-pools-${network}`,
            CRYPTO_CACHE_TTL.ONCHAIN,
            () => fetchNetworkPools(network),
          )
        : Promise.resolve(null),
    ])

    const trending = trendingRes.status === 'fulfilled' ? trendingRes.value : null
    const newlyListed = newlyListedRes.status === 'fulfilled' ? newlyListedRes.value : []
    const networkPools = networkPoolsRes.status === 'fulfilled' ? networkPoolsRes.value : null

    return NextResponse.json({
      mode: 'overview',
      trendingPools: trending,
      newlyListed: Array.isArray(newlyListed) ? newlyListed.slice(0, 50) : [],
      networkPools,
      network: network || 'all',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch on-chain data', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
