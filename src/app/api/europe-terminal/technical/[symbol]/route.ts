// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Technical Indicators API
// Proxies to same FMP technical endpoints
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTechnicals } from '@/lib/fmp-terminal/fmp-bulk-client'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const ip = getClientIP(_request)
  const { allowed, retryAfterMs } = await checkRateLimit(`eu-technical:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const { symbol } = await params
  const sym = symbol?.toUpperCase()?.trim()
  if (!sym) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  try {
    const data = await fetchAllTechnicals(sym)
    return NextResponse.json({ symbol: sym, ...data, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: 'Failed', message: (error as Error).message }, { status: 500 })
  }
}
