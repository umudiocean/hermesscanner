// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — System Health Endpoint (Phase 3 Sentinel)
// GET /api/system/health
// HERMES_FIX: HEALTH_API_v1 — Single observable truth for system status
// Security: NEVER exposes weights, Z-scores, formula params, raw scoring data
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { isRedisAvailable } from '@/lib/cache/redis-client'
import { providerMonitor, type ProviderStatus } from '@/lib/monitor/provider-monitor'
import { sentinelLog } from '@/lib/logger/sentinel-log'

export const dynamic = 'force-dynamic'

interface HealthResponse {
  status: 'OK' | 'DEGRADED' | 'DOWN'
  timestamp: string
  build: {
    commitSha: string
    buildTime: string
    env: 'production' | 'preview' | 'development'
  }
  providers: {
    coingecko: ProviderStatus
    defiLlama: ProviderStatus
    fmp: ProviderStatus
    moralis: ProviderStatus
  }
  cache: {
    redis: {
      ok: boolean
      lastWriteAt: string | null
      lastReadAt: string | null
    }
  }
  dataFreshness: {
    cryptoMarketAgeMin: number | null
    coinsBulkAgeMin: number | null
    derivativesAgeMin: number | null
    scanAgeMin: number | null
  }
  guards: {
    squeezeGuardEnabled: boolean
    shortsBlocked1h: number
    blockedReasonCounts1h: Record<string, number>
  }
  sla: {
    cryptoMarketBreached: boolean
    derivativesBreached: boolean
    scanBreached: boolean
    coinsBulkBreached: boolean
  }
}

function getEnvName(): 'production' | 'preview' | 'development' {
  if (process.env.VERCEL_ENV === 'production') return 'production'
  if (process.env.VERCEL_ENV === 'preview') return 'preview'
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

function determineStatus(h: Omit<HealthResponse, 'status'>): 'OK' | 'DEGRADED' | 'DOWN' {
  if (!h.providers.coingecko.ok && (h.dataFreshness.scanAgeMin === null || h.dataFreshness.scanAgeMin > 60)) {
    return 'DOWN'
  }
  if (h.dataFreshness.scanAgeMin === null && h.dataFreshness.coinsBulkAgeMin === null) {
    return 'DOWN'
  }

  if (Object.values(h.sla).some(Boolean)) return 'DEGRADED'
  if (h.providers.coingecko.errorRate1h > 0.1) return 'DEGRADED'
  if (h.providers.coingecko.http429Rate1h > 0.05) return 'DEGRADED'
  if (!h.cache.redis.ok) return 'DEGRADED'

  return 'OK'
}

export async function GET() {
  try {
    const [
      cgStatus,
      dlStatus,
      fmpStatus,
      moralisStatus,
      freshness,
      guards,
      cacheStats,
      sla,
    ] = await Promise.all([
      providerMonitor.getProviderStatus('coingecko'),
      providerMonitor.getProviderStatus('defiLlama'),
      providerMonitor.getProviderStatus('fmp'),
      providerMonitor.getProviderStatus('moralis'),
      providerMonitor.getDataFreshness(),
      providerMonitor.getGuardStats(),
      providerMonitor.getCacheStats(),
      providerMonitor.getSlaStatus(),
    ])

    const redisOk = isRedisAvailable()

    const body: Omit<HealthResponse, 'status'> = {
      timestamp: new Date().toISOString(),
      build: {
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
        buildTime: process.env.BUILD_TIME ?? 'unknown',
        env: getEnvName(),
      },
      providers: {
        coingecko: cgStatus,
        defiLlama: dlStatus,
        fmp: fmpStatus,
        moralis: moralisStatus,
      },
      cache: {
        redis: {
          ...cacheStats.redis,
          ok: redisOk && cacheStats.redis.ok,
        },
      },
      dataFreshness: freshness,
      guards,
      sla,
    }

    const status = determineStatus(body)

    sentinelLog.debug('CRON_HEALTH_CHECK', { status })

    return NextResponse.json(
      { status, ...body } as HealthResponse,
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (err) {
    sentinelLog.error('CRON_HEALTH_CHECK_FAILED', {
      error: err instanceof Error ? err.message : String(err),
    })

    return NextResponse.json(
      {
        status: 'DOWN' as const,
        timestamp: new Date().toISOString(),
        error: 'Health check internal error',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
