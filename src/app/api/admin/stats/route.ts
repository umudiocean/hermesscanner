import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics } from '@/lib/analytics/tracker'
import { getRedisCacheStats } from '@/lib/cache/redis-cache'
import { getCacheStats } from '@/lib/fmp-terminal/fmp-cache'
import { getCryptoCacheStats } from '@/lib/crypto-terminal/crypto-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get('days')) || 7, 30)

  const [analytics, redisCache, fmpCache, cryptoCache] = await Promise.all([
    getAnalytics(days),
    getRedisCacheStats(),
    Promise.resolve(getCacheStats()),
    Promise.resolve(getCryptoCacheStats()),
  ])

  // System health summary
  let systemHealth: Record<string, unknown> = { status: 'unknown' }
  try {
    const baseUrl = request.nextUrl.origin
    const res = await fetch(`${baseUrl}/api/system/health`, {
      headers: { 'x-internal-secret': process.env.CRON_SECRET || '' },
    })
    if (res.ok) systemHealth = await res.json()
  } catch {
    systemHealth = { status: 'unavailable' }
  }

  return NextResponse.json({
    analytics,
    cache: {
      redis: { ...redisCache, connected: isRedisAvailable() },
      fmpMemory: fmpCache,
      cryptoMemory: cryptoCache,
    },
    system: systemHealth,
    ops: {
      status: (systemHealth as { status?: string })?.status ?? 'unknown',
      freshness: (systemHealth as { dataFreshness?: unknown })?.dataFreshness ?? null,
      sla: (systemHealth as { sla?: unknown })?.sla ?? null,
      sloTrend1h: (systemHealth as { sloTrend1h?: unknown })?.sloTrend1h ?? null,
      watchdog: (systemHealth as { watchdog?: unknown })?.watchdog ?? null,
      cache: (systemHealth as { cache?: unknown })?.cache ?? null,
      thresholds: (systemHealth as { opsThresholds?: unknown })?.opsThresholds ?? null,
    },
    generatedAt: new Date().toISOString(),
  })
}
