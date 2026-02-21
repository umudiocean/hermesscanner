// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — System Health Endpoint
// GET /api/system/health
// Returns overall system health, cache status, scan metrics
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getCacheStats } from '@/lib/fmp-terminal/fmp-cache'
import { getMetricsSummary } from '@/lib/api/fmpClient'
import { getMarketStatus } from '@/lib/scheduler/marketHours'
import {
  getScanMetrics,
  getIntegrityReport,
  getUptime,
  computeHealthStatus,
} from '@/lib/monitoring/metrics'
import { SCORING } from '@/lib/config/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = computeHealthStatus()
  const scanMetrics = getScanMetrics()
  const cacheStats = getCacheStats()
  const apiMetrics = getMetricsSummary()
  const marketStatus = getMarketStatus()
  const integrity = getIntegrityReport()
  const uptime = getUptime()

  // Environment check
  const envCheck = {
    FMP_API_KEY: !!process.env.FMP_API_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'unknown',
  }

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    uptime: `${uptime}s`,

    market: marketStatus,

    scans: {
      last52W: scanMetrics.last52W,
      last5D: scanMetrics.last5D,
      lastFMPStocks: scanMetrics.lastFMPStocks,
    },

    cache: {
      memoryEntries: cacheStats.memoryEntries,
      maxEntries: cacheStats.maxEntries,
      oldestEntryAge: cacheStats.oldestEntry ? `${Math.round(cacheStats.oldestEntry / 1000)}s` : null,
    },

    api: {
      totalCalls: apiMetrics.totalCalls,
      totalErrors: apiMetrics.totalErrors,
      avgDuration: `${apiMetrics.avgDuration}ms`,
      failedEndpoints: apiMetrics.failedEndpoints,
    },

    integrity: integrity ? {
      totalStocks: integrity.totalStocks,
      targetStocks: SCORING.TOTAL_STOCKS,
      nanScores: integrity.nanScores,
      degradedScores: integrity.degradedScores,
      missingSymbols: integrity.missingSymbols.length,
      lastCheck: integrity.timestamp,
    } : null,

    environment: envCheck,
  })
}
