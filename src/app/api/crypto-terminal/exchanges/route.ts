// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/exchanges
// Exchange list with trust scores and volume
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchExchanges } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { Exchange } from '@/lib/crypto-terminal/coingecko-types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`crypto-exchanges:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const exchanges = await getCached<Exchange[]>(
      'crypto-exchanges',
      CRYPTO_CACHE_TTL.EXCHANGES,
      () => fetchExchanges(100, 1) as Promise<Exchange[]>,
    )

    return NextResponse.json({
      exchanges: exchanges ?? [],
      total: exchanges?.length ?? 0,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch exchanges', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
