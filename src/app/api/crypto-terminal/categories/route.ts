// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/categories
// Coin categories (DeFi, Layer 1, Meme, etc.)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchCategories } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { CoinCategory } from '@/lib/crypto-terminal/coingecko-types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`crypto-categories:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const categories = await getCached<CoinCategory[]>(
      'crypto-categories',
      CRYPTO_CACHE_TTL.CATEGORIES,
      () => fetchCategories() as Promise<CoinCategory[]>,
    )

    return NextResponse.json({
      categories: categories ?? [],
      total: categories?.length ?? 0,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch categories', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
