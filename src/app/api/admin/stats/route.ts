import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics } from '@/lib/analytics/tracker'
import { getRedisCacheStats } from '@/lib/cache/redis-cache'
import { getCacheStats } from '@/lib/fmp-terminal/fmp-cache'
import { getCryptoCacheStats } from '@/lib/crypto-terminal/crypto-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'

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
    generatedAt: new Date().toISOString(),
  })
}
