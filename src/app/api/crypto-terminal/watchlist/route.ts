// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/watchlist
// Fetches specific coins by their IDs for the watchlist module
// Uses CoinGecko /coins/markets?ids=... parameter
// Cached per unique id-set for 5 minutes
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { cgApiFetch } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { CoinMarket } from '@/lib/crypto-terminal/coingecko-types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids') || ''

    if (!idsParam.trim()) {
      return NextResponse.json({ coins: [], timestamp: new Date().toISOString() })
    }

    // Clean and deduplicate IDs
    const ids = [...new Set(
      idsParam.split(',').map(id => id.trim().toLowerCase()).filter(Boolean)
    )]

    if (ids.length === 0) {
      return NextResponse.json({ coins: [], timestamp: new Date().toISOString() })
    }

    // CoinGecko supports up to ~250 IDs per request
    // Split into chunks if needed
    const MAX_IDS_PER_REQUEST = 100
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
      chunks.push(ids.slice(i, i + MAX_IDS_PER_REQUEST))
    }

    const allCoins: CoinMarket[] = []

    for (const chunk of chunks) {
      const sortedIds = [...chunk].sort()
      const idsHash = sortedIds.join(',').split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
      const cacheKey = `crypto-watchlist-${Math.abs(idsHash)}-${chunk.length}`

      const coins = await getCached<CoinMarket[]>(
        cacheKey,
        CRYPTO_CACHE_TTL.COINS_LIST, // 1h cache for watchlist coins
        () => cgApiFetch<CoinMarket[]>('/coins/markets', {
          vs_currency: 'usd',
          ids: chunk.join(','),
          order: 'market_cap_desc',
          per_page: String(chunk.length),
          page: '1',
          sparkline: 'true',
          price_change_percentage: '1h,24h,7d,30d',
          locale: 'en',
          precision: '8',
        }),
      )

      if (Array.isArray(coins)) {
        allCoins.push(...coins)
      }
    }

    return NextResponse.json({
      coins: allCoins,
      count: allCoins.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch watchlist coins', message, coins: [], timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
