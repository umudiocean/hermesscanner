// Admin-only bootstrap status (Redis direct read, no cron secret needed)

import { NextResponse } from 'next/server'
import { getCleanSymbols } from '@/lib/symbols'
import {
  getBootstrapProgress,
  getBarCacheCount,
  getBootstrapSkipped,
  getBootstrapCheckpoint,
} from '@/lib/cache/redis-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'

export async function GET() {
  const redisAvailable = isRedisAvailable()
  const progress = redisAvailable ? await getBootstrapProgress() : null
  const barCount = redisAvailable ? await getBarCacheCount() : 0
  const skipped = redisAvailable ? await getBootstrapSkipped() : []
  const completed = redisAvailable ? await getBootstrapCheckpoint() : []

  const allSymbols = getCleanSymbols('ALL')
  const totalSymbols = allSymbols.length
  const completedSet = new Set(completed || [])
  const skippedSet = new Set(skipped || [])
  const missing = allSymbols.filter(s => !completedSet.has(s) && !skippedSet.has(s))

  const progressData = progress || { completed: 0, total: totalSymbols, status: 'not_started', lastSymbol: '' }
  if (progressData.total === 0 && totalSymbols > 0) progressData.total = totalSymbols

  return NextResponse.json({
    redisAvailable,
    progress: progressData,
    barCacheCount: barCount,
    skipped: skipped || [],
    skippedCount: skippedSet.size,
    completedCount: completedSet.size,
    missing,
    missingCount: missing.length,
    timestamp: new Date().toISOString(),
  })
}
