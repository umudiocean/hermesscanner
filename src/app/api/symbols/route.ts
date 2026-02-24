// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Symbols API
// Segment bazli sembol listesini dondurur (chunking icin)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCleanSymbols, getCleanSegmentStats } from '@/lib/symbols'
import { Segment } from '@/lib/types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`symbols:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const { searchParams } = new URL(request.url)
  const segment = (searchParams.get('segment') || 'ALL') as Segment

  const symbols = getCleanSymbols(segment)
  const stats = getCleanSegmentStats()

  return NextResponse.json({ symbols, stats, count: symbols.length })
}
