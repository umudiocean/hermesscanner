// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/treasury
// Public company BTC/ETH holdings
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchPublicTreasury } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { PublicTreasury } from '@/lib/crypto-terminal/coingecko-types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`crypto-treasury:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const [btcRes, ethRes] = await Promise.allSettled([
      getCached<PublicTreasury>(
        'crypto-treasury-btc',
        CRYPTO_CACHE_TTL.TREASURY,
        () => fetchPublicTreasury('bitcoin') as Promise<PublicTreasury>,
      ),
      getCached<PublicTreasury>(
        'crypto-treasury-eth',
        CRYPTO_CACHE_TTL.TREASURY,
        () => fetchPublicTreasury('ethereum') as Promise<PublicTreasury>,
      ),
    ])

    const btc = btcRes.status === 'fulfilled' ? btcRes.value : null
    const eth = ethRes.status === 'fulfilled' ? ethRes.value : null

    return NextResponse.json({
      bitcoin: btc,
      ethereum: eth,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch treasury data', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
