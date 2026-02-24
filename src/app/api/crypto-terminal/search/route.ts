// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/search
// Precomputed index search (18K+ coins in <1ms after first build)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchCoinsList } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { getSearchIndex } from '@/lib/crypto-terminal/search-index'
import { searchQuerySchema, limitSchema, validateParams } from '@/lib/validation/schemas'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface CoinListItem {
  id: string
  symbol: string
  name: string
  platforms?: Record<string, string>
}

const INDEX_REBUILD_TTL = CRYPTO_CACHE_TTL.SEARCH

async function ensureIndex(): Promise<number> {
  const index = getSearchIndex()

  if (index.coinCount > 0 && index.age < INDEX_REBUILD_TTL) {
    return index.coinCount
  }

  const list = await getCached<CoinListItem[]>(
    'crypto-coins-full-list-v3',
    INDEX_REBUILD_TTL,
    () => fetchCoinsList() as Promise<CoinListItem[]>,
  )

  if (list && Array.isArray(list) && list.length > 0) {
    index.build(list)
    return index.coinCount
  }

  return index.coinCount
}

export async function GET(request: Request) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`crypto-search:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const { searchParams } = new URL(request.url)
    const rawQ = searchParams.get('q') || ''
    const rawLimit = searchParams.get('limit') || '20'

    const qResult = validateParams(searchQuerySchema, rawQ)
    const q = qResult.success ? qResult.data.toLowerCase() : ''
    const limitResult = validateParams(limitSchema, rawLimit)
    const limit = Math.min(limitResult.success ? limitResult.data : 20, 50)

    if (!q) {
      return NextResponse.json({ results: [], query: '', total: 0 })
    }

    const allCoinsCount = await ensureIndex()
    const index = getSearchIndex()
    const results = index.search(q, limit)

    return NextResponse.json({
      results,
      query: q,
      total: results.length,
      allCoinsCount,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Search failed', message, results: [], timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
