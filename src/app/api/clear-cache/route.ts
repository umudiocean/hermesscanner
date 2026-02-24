// ═══════════════════════════════════════════════════════════════════
// Cache Temizleme API — Internal Only (CRON_SECRET required)
// POST /api/clear-cache
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { clearAllCaches } from '@/lib/fmp-client'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import logger from '@/lib/logger'

export const maxDuration = 30

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const headerSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '')
  return headerSecret === secret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`clear-cache:${ip}`, 2, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const result = await clearAllCaches()
    return NextResponse.json({
      success: true,
      cleared: result,
      message: `Memory: ${result.memory} entry, Disk: ${result.disk} dosya temizlendi.`,
    })
  } catch (error) {
    logger.error('Internal error', { module: 'clear-cache', error: (error as Error).message })
    return NextResponse.json(
      { error: 'Cache temizleme hatasi', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
