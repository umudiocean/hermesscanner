// Admin-only bootstrap status (Redis direct read, no cron secret needed)

import { NextResponse } from 'next/server'
import { getCleanSymbols } from '@/lib/symbols'
import {
  getBootstrapProgress,
  getBarCacheCount,
  getBootstrapSkipped,
  getBootstrapCheckpoint,
} from '@/lib/cache/redis-cache'

export async function GET() {
  const progress = await getBootstrapProgress()
  const barCount = await getBarCacheCount()
  const skipped = await getBootstrapSkipped()
  const completed = await getBootstrapCheckpoint()

  const allSymbols = getCleanSymbols('ALL')
  const completedSet = new Set(completed || [])
  const skippedSet = new Set(skipped || [])
  const missing = allSymbols.filter(s => !completedSet.has(s) && !skippedSet.has(s))

  return NextResponse.json({
    progress: progress || { completed: 0, total: 0, status: 'not_started' },
    barCacheCount: barCount,
    skipped: skipped || [],
    skippedCount: skippedSet.size,
    completedCount: completedSet.size,
    missing,
    missingCount: missing.length,
    timestamp: new Date().toISOString(),
  })
}
