// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/categories
// Coin categories (DeFi, Layer 1, Meme, etc.)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchCategories } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { CoinCategory } from '@/lib/crypto-terminal/coingecko-types'

export const dynamic = 'force-dynamic'

export async function GET() {
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
