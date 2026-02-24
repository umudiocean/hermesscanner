// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — System Health Endpoint (Phase 3 Sentinel)
// GET /api/system/health
// HERMES_FIX: HEALTH_API_v1 — Single observable truth for system status
// Security: NEVER exposes weights, Z-scores, formula params, raw scoring data
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { isRedisAvailable, isRedisRequired } from '@/lib/cache/redis-client'
import { providerMonitor, type ProviderStatus } from '@/lib/monitor/provider-monitor'
import { sentinelLog } from '@/lib/logger/sentinel-log'
import { OPS_THRESHOLDS } from '@/lib/config/constants'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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
      required: boolean
      lastWriteAt: string | null
      lastReadAt: string | null
    }
    tierHits1h: {
      memory: number
      redis: number
      disk: number
      origin: number
    }
  }
  dataFreshness: {
    cryptoMarketAgeMin: number | null
    coinsBulkAgeMin: number | null
    derivativesAgeMin: number | null
    scanAgeMin: number | null
    stocksQuoteAgeMin: number | null
  }
  guards: {
    squeezeGuardEnabled: boolean
    shortsBlocked1h: number
    blockedReasonCounts1h: Record<string, number>
  }
  watchdog: {
    lastRunAt: string | null
    lastStatus: 'OK' | 'DEGRADED' | 'DOWN' | null
    lastSelfHealAt: string | null
    selfHealSuccess1h: number
    selfHealFail1h: number
  }
  sla: {
    cryptoMarketBreached: boolean
    derivativesBreached: boolean
    scanBreached: boolean
    coinsBulkBreached: boolean
    stocksQuoteBreached: boolean
  }
  sloTrend1h: {
    totalChecks1h: number
    breachCounts1h: {
      cryptoMarket: number
      derivatives: number
      scan: number
      coinsBulk: number
      stocksQuote: number
    }
  }
  opsThresholds: {
    cacheOriginWarnPct: number
    cacheOriginCriticalPct: number
  }
}

function getEnvName(): 'production' | 'preview' | 'development' {
  if (process.env.VERCEL_ENV === 'production') return 'production'
  if (process.env.VERCEL_ENV === 'preview') return 'preview'
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

const OPTIONAL_PROVIDERS: Set<string> = new Set(['defiLlama', 'moralis'])

function isProviderActive(p: ProviderStatus): boolean {
  return p.lastSuccessAt !== null || p.lastErrorAt !== null
}

function determineStatus(h: Omit<HealthResponse, 'status'>): 'OK' | 'DEGRADED' | 'DOWN' {
  if (!h.providers.coingecko.ok && (h.dataFreshness.scanAgeMin === null || h.dataFreshness.scanAgeMin > 60)) {
    return 'DOWN'
  }
  if (h.dataFreshness.scanAgeMin === null && h.dataFreshness.coinsBulkAgeMin === null) {
    return 'DOWN'
  }

  if (h.cache.redis.required && !h.cache.redis.ok) return 'DOWN'

  const activeProviderIssue = (Object.entries(h.providers) as [string, ProviderStatus][]).some(
    ([name, p]) => !OPTIONAL_PROVIDERS.has(name) && isProviderActive(p) && !p.ok
  )
  if (activeProviderIssue) return 'DEGRADED'

  if (Object.values(h.sla).some(Boolean)) return 'DEGRADED'
  if (h.providers.coingecko.errorRate1h > 0.1) return 'DEGRADED'
  if (h.providers.coingecko.http429Rate1h > 0.05) return 'DEGRADED'
  if (!h.cache.redis.ok) return 'DEGRADED'

  return 'OK'
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`system-health:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const [
      cgStatus,
      dlStatus,
      fmpStatus,
      moralisStatus,
      freshness,
      guards,
      watchdog,
      cacheStats,
      sla,
      sloTrend1h,
    ] = await Promise.all([
      providerMonitor.getProviderStatus('coingecko'),
      providerMonitor.getProviderStatus('defiLlama'),
      providerMonitor.getProviderStatus('fmp'),
      providerMonitor.getProviderStatus('moralis'),
      providerMonitor.getDataFreshness(),
      providerMonitor.getGuardStats(),
      providerMonitor.getWatchdogStats(),
      providerMonitor.getCacheStats(),
      providerMonitor.getSlaStatus(),
      providerMonitor.getSlaTrend1h(),
    ])

    const redisOk = isRedisAvailable()
    const redisRequired = isRedisRequired()

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
          required: redisRequired,
          ok: redisOk && cacheStats.redis.ok,
        },
        tierHits1h: cacheStats.tierHits1h,
      },
      dataFreshness: freshness,
      guards,
      watchdog,
      sla,
      sloTrend1h,
      opsThresholds: {
        cacheOriginWarnPct: OPS_THRESHOLDS.CACHE_ORIGIN_WARN_PCT,
        cacheOriginCriticalPct: OPS_THRESHOLDS.CACHE_ORIGIN_CRITICAL_PCT,
      },
    }

    const status = determineStatus(body)

    sentinelLog.debug('CRON_HEALTH_CHECK', { status })

    return NextResponse.json(
      { status, ...body } as HealthResponse,
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Hermes-Health-Status': status,
          'X-Hermes-Scan-Age-Min': String(body.dataFreshness.scanAgeMin ?? -1),
          'X-Hermes-Quote-Age-Min': String(body.dataFreshness.stocksQuoteAgeMin ?? -1),
          'X-Hermes-Sla-Scan-Breached': String(body.sla.scanBreached),
          'X-Hermes-Sla-Quote-Breached': String(body.sla.stocksQuoteBreached),
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
