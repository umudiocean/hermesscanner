// HERMES_FIX: PROVIDER_MONITOR_v1 — Provider drift & data freshness tracking
// All state in Redis (serverless-safe). No in-memory counters.
// Used by: health endpoint, cron jobs, SLA fail-closed logic

import { getRedis } from '@/lib/cache/redis-client'
import { sentinelLog } from '@/lib/logger/sentinel-log'

// ── Types ──

export type ProviderName = 'coingecko' | 'defiLlama' | 'fmp' | 'moralis'

export type DataKey =
  | 'cryptoMarket'
  | 'coinsBulk'
  | 'derivatives'
  | 'scan'
  | 'stocksQuote'
  | 'europeScan'
  | 'onchain'

export interface ProviderStatus {
  ok: boolean
  lastSuccessAt: string | null
  lastErrorAt: string | null
  errorRate1h: number
  http429Rate1h: number
}

export interface DataFreshness {
  cryptoMarketAgeMin: number | null
  coinsBulkAgeMin: number | null
  derivativesAgeMin: number | null
  scanAgeMin: number | null
  stocksQuoteAgeMin: number | null
}

export interface GuardStats {
  squeezeGuardEnabled: boolean
  shortsBlocked1h: number
  blockedReasonCounts1h: Record<string, number>
}

export interface CacheStats {
  redis: {
    ok: boolean
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

export interface SlaStatus {
  cryptoMarketBreached: boolean
  derivativesBreached: boolean
  scanBreached: boolean
  coinsBulkBreached: boolean
  stocksQuoteBreached: boolean
}

export interface WatchdogStats {
  lastRunAt: string | null
  lastStatus: 'OK' | 'DEGRADED' | 'DOWN' | null
  lastSelfHealAt: string | null
  selfHealSuccess1h: number
  selfHealFail1h: number
}

export interface SlaTrend1h {
  totalChecks1h: number
  breachCounts1h: {
    cryptoMarket: number
    derivatives: number
    scan: number
    coinsBulk: number
    stocksQuote: number
  }
}

// HERMES_FIX: SLA_THRESHOLDS_v2 — Data freshness SLA definitions
// stocksQuote relaxed from 15 to 120 min (scan refreshes every 60 min during market hours)
export const SLA_THRESHOLDS_MINUTES: Record<DataKey, number> = {
  cryptoMarket: 30,
  coinsBulk: 60,
  derivatives: 60,
  scan: 120,
  stocksQuote: 120,
  europeScan: 600,
  onchain: 120,
}

// ── Redis key helpers ──

const pmKey = (provider: ProviderName, suffix: string) => `pm:${provider}:${suffix}`
const freshKey = (key: DataKey) => `fresh:${key}:fetchedAt`
const squeezeKey = (suffix: string) => `squeeze:${suffix}`
const cacheStatsKey = (suffix: string) => `cache:stats:${suffix}`
const watchdogKey = (suffix: string) => `watchdog:${suffix}`
const slaKey = (suffix: string) => `sla:${suffix}`

const TTL_1H = 3600
const TTL_2H = 7200

function isUsMarketLikelyOpen(): boolean {
  const now = new Date()
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const et = new Date(etStr)
  const day = et.getDay()
  if (day === 0 || day === 6) return false
  const mins = et.getHours() * 60 + et.getMinutes()
  return mins >= 570 && mins <= 960
}

async function safeRedis<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const r = getRedis()
    if (!r) return fallback
    return await fn()
  } catch (err) {
    sentinelLog.warn('PROVIDER_ERROR', {
      module: 'providerMonitor',
      error: err instanceof Error ? err.message : String(err),
    })
    return fallback
  }
}

// ── Monitor API ──

export const providerMonitor = {
  async recordSuccess(provider: ProviderName): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      const now = new Date().toISOString()
      const p = r.pipeline()
      p.set(pmKey(provider, 'lastSuccessAt'), now, { ex: TTL_2H })
      p.incr(pmKey(provider, 'req:1h'))
      p.expire(pmKey(provider, 'req:1h'), TTL_1H)
      await p.exec()
    }, undefined)
  },

  async recordError(provider: ProviderName, status: number): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      const now = new Date().toISOString()
      const p = r.pipeline()
      p.set(pmKey(provider, 'lastErrorAt'), now, { ex: TTL_2H })
      p.incr(pmKey(provider, 'errors:1h'))
      p.expire(pmKey(provider, 'errors:1h'), TTL_1H)
      p.incr(pmKey(provider, 'req:1h'))
      p.expire(pmKey(provider, 'req:1h'), TTL_1H)
      if (status === 429) {
        p.incr(pmKey(provider, '429s:1h'))
        p.expire(pmKey(provider, '429s:1h'), TTL_1H)
      }
      await p.exec()

      sentinelLog.warn('PROVIDER_ERROR', { provider, status })
    }, undefined)
  },

  async recordDataFetch(key: DataKey): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      await r.set(freshKey(key), new Date().toISOString(), { ex: TTL_2H })
    }, undefined)
  },

  async recordSqueezeBlock(reason: string): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      const p = r.pipeline()
      p.incr(squeezeKey('blocked:1h'))
      p.expire(squeezeKey('blocked:1h'), TTL_1H)
      p.incr(squeezeKey(`reason:${reason}:1h`))
      p.expire(squeezeKey(`reason:${reason}:1h`), TTL_1H)
      await p.exec()

      sentinelLog.info('SQUEEZE_BLOCKED', { reason })
    }, undefined)
  },

  async recordCacheRead(): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      await r.set(cacheStatsKey('lastReadAt'), new Date().toISOString(), { ex: TTL_2H })
    }, undefined)
  },

  async recordCacheWrite(): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      await r.set(cacheStatsKey('lastWriteAt'), new Date().toISOString(), { ex: TTL_2H })
    }, undefined)
  },

  async recordCacheTierHit(tier: 'memory' | 'redis' | 'disk' | 'origin'): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      const p = r.pipeline()
      p.incr(cacheStatsKey(`tier:${tier}:1h`))
      p.expire(cacheStatsKey(`tier:${tier}:1h`), TTL_1H)
      await p.exec()
    }, undefined)
  },

  // ── Read methods for health endpoint ──

  async getProviderStatus(provider: ProviderName): Promise<ProviderStatus> {
    return safeRedis(async () => {
      const r = getRedis()!
      const p = r.pipeline()
      p.get(pmKey(provider, 'lastSuccessAt'))
      p.get(pmKey(provider, 'lastErrorAt'))
      p.get(pmKey(provider, 'errors:1h'))
      p.get(pmKey(provider, 'req:1h'))
      p.get(pmKey(provider, '429s:1h'))
      const results = await p.exec()

      const lastSuccessAt = (results[0] as string | null) ?? null
      const lastErrorAt = (results[1] as string | null) ?? null
      const errors = Number(results[2] ?? 0)
      const total = Number(results[3] ?? 0)
      const http429s = Number(results[4] ?? 0)

      const errorRate = total > 0 ? errors / total : 0
      const http429Rate = total > 0 ? http429s / total : 0

      return {
        ok: lastSuccessAt !== null && errorRate < 0.5,
        lastSuccessAt,
        lastErrorAt,
        errorRate1h: Math.round(errorRate * 1000) / 1000,
        http429Rate1h: Math.round(http429Rate * 1000) / 1000,
      }
    }, {
      ok: false,
      lastSuccessAt: null,
      lastErrorAt: null,
      errorRate1h: 0,
      http429Rate1h: 0,
    })
  },

  async getDataFreshness(): Promise<DataFreshness> {
    return safeRedis(async () => {
      const r = getRedis()!
      const keys: DataKey[] = ['cryptoMarket', 'coinsBulk', 'derivatives', 'scan', 'stocksQuote']
      const p = r.pipeline()
      for (const k of keys) p.get(freshKey(k))
      const results = await p.exec()

      function ageMin(ts: unknown): number | null {
        if (!ts || typeof ts !== 'string') return null
        const diff = Date.now() - new Date(ts).getTime()
        return Math.round(diff / 60000)
      }

      return {
        cryptoMarketAgeMin: ageMin(results[0]),
        coinsBulkAgeMin: ageMin(results[1]),
        derivativesAgeMin: ageMin(results[2]),
        scanAgeMin: ageMin(results[3]),
        stocksQuoteAgeMin: ageMin(results[4]),
      }
    }, {
      cryptoMarketAgeMin: null,
      coinsBulkAgeMin: null,
      derivativesAgeMin: null,
      scanAgeMin: null,
      stocksQuoteAgeMin: null,
    })
  },

  async getGuardStats(): Promise<GuardStats> {
    return safeRedis(async () => {
      const r = getRedis()!
      const blocked = Number(await r.get(squeezeKey('blocked:1h')) ?? 0)

      const KNOWN_REASONS = [
        'LEVERAGE_CROWDING', 'MOMENTUM_IGNITION', 'LIQUIDITY_RISK',
        'VOL_EXPANSION', 'DATA_INCOMPLETE', 'DATA_STALE', 'COMPOSITE_HIGH',
        'CROWDING_AND_MOMENTUM',
      ]
      const reasonCounts: Record<string, number> = {}
      if (blocked > 0) {
        const p = r.pipeline()
        for (const reason of KNOWN_REASONS) {
          p.get(squeezeKey(`reason:${reason}:1h`))
        }
        const results = await p.exec()
        for (let i = 0; i < KNOWN_REASONS.length; i++) {
          const count = Number(results[i] ?? 0)
          if (count > 0) reasonCounts[KNOWN_REASONS[i]] = count
        }
      }

      return {
        squeezeGuardEnabled: true,
        shortsBlocked1h: blocked,
        blockedReasonCounts1h: reasonCounts,
      }
    }, {
      squeezeGuardEnabled: true,
      shortsBlocked1h: 0,
      blockedReasonCounts1h: {},
    })
  },

  async getCacheStats(): Promise<CacheStats> {
    return safeRedis<CacheStats>(async () => {
      const r = getRedis()!
      const p = r.pipeline()
      p.get(cacheStatsKey('lastWriteAt'))
      p.get(cacheStatsKey('lastReadAt'))
      p.get(cacheStatsKey('tier:memory:1h'))
      p.get(cacheStatsKey('tier:redis:1h'))
      p.get(cacheStatsKey('tier:disk:1h'))
      p.get(cacheStatsKey('tier:origin:1h'))
      const results = await p.exec()

      return {
        redis: {
          ok: true,
          lastWriteAt: (results[0] as string | null) ?? null,
          lastReadAt: (results[1] as string | null) ?? null,
        },
        tierHits1h: {
          memory: Number(results[2] ?? 0),
          redis: Number(results[3] ?? 0),
          disk: Number(results[4] ?? 0),
          origin: Number(results[5] ?? 0),
        },
      }
    }, {
      redis: { ok: false, lastWriteAt: null, lastReadAt: null },
      tierHits1h: { memory: 0, redis: 0, disk: 0, origin: 0 },
    })
  },

  async getSlaStatus(): Promise<SlaStatus> {
    const freshness = await this.getDataFreshness()

    function breached(ageMin: number | null, key: DataKey): boolean {
      if (ageMin === null) return false
      return ageMin > SLA_THRESHOLDS_MINUTES[key]
    }

    const marketOpen = isUsMarketLikelyOpen()

    const status: SlaStatus = {
      cryptoMarketBreached: breached(freshness.cryptoMarketAgeMin, 'cryptoMarket'),
      derivativesBreached: breached(freshness.derivativesAgeMin, 'derivatives'),
      scanBreached: marketOpen ? breached(freshness.scanAgeMin, 'scan') : false,
      coinsBulkBreached: breached(freshness.coinsBulkAgeMin, 'coinsBulk'),
      stocksQuoteBreached: marketOpen ? breached(freshness.stocksQuoteAgeMin, 'stocksQuote') : false,
    }

    if (Object.values(status).some(Boolean)) {
      sentinelLog.warn('SLA_BREACH', {
        ...status,
        freshness,
      })
    }

    return status
  },

  async recordWatchdogRun(status: 'OK' | 'DEGRADED' | 'DOWN'): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      const now = new Date().toISOString()
      const p = r.pipeline()
      p.set(watchdogKey('lastRunAt'), now, { ex: TTL_2H })
      p.set(watchdogKey('lastStatus'), status, { ex: TTL_2H })
      await p.exec()
    }, undefined)
  },

  async recordWatchdogSelfHeal(success: boolean): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      const now = new Date().toISOString()
      const p = r.pipeline()
      p.set(watchdogKey('lastSelfHealAt'), now, { ex: TTL_2H })
      if (success) {
        p.incr(watchdogKey('selfHealSuccess:1h'))
        p.expire(watchdogKey('selfHealSuccess:1h'), TTL_1H)
      } else {
        p.incr(watchdogKey('selfHealFail:1h'))
        p.expire(watchdogKey('selfHealFail:1h'), TTL_1H)
      }
      await p.exec()
    }, undefined)
  },

  async getWatchdogStats(): Promise<WatchdogStats> {
    return safeRedis(async () => {
      const r = getRedis()!
      const p = r.pipeline()
      p.get(watchdogKey('lastRunAt'))
      p.get(watchdogKey('lastStatus'))
      p.get(watchdogKey('lastSelfHealAt'))
      p.get(watchdogKey('selfHealSuccess:1h'))
      p.get(watchdogKey('selfHealFail:1h'))
      const results = await p.exec()
      return {
        lastRunAt: (results[0] as string | null) ?? null,
        lastStatus: ((results[1] as 'OK' | 'DEGRADED' | 'DOWN' | null) ?? null),
        lastSelfHealAt: (results[2] as string | null) ?? null,
        selfHealSuccess1h: Number(results[3] ?? 0),
        selfHealFail1h: Number(results[4] ?? 0),
      }
    }, {
      lastRunAt: null,
      lastStatus: null,
      lastSelfHealAt: null,
      selfHealSuccess1h: 0,
      selfHealFail1h: 0,
    })
  },

  async recordSlaSnapshot(sla: SlaStatus): Promise<void> {
    await safeRedis(async () => {
      const r = getRedis()!
      const p = r.pipeline()
      p.incr(slaKey('checks:1h'))
      p.expire(slaKey('checks:1h'), TTL_1H)

      if (sla.cryptoMarketBreached) {
        p.incr(slaKey('breach:cryptoMarket:1h'))
        p.expire(slaKey('breach:cryptoMarket:1h'), TTL_1H)
      }
      if (sla.derivativesBreached) {
        p.incr(slaKey('breach:derivatives:1h'))
        p.expire(slaKey('breach:derivatives:1h'), TTL_1H)
      }
      if (sla.scanBreached) {
        p.incr(slaKey('breach:scan:1h'))
        p.expire(slaKey('breach:scan:1h'), TTL_1H)
      }
      if (sla.coinsBulkBreached) {
        p.incr(slaKey('breach:coinsBulk:1h'))
        p.expire(slaKey('breach:coinsBulk:1h'), TTL_1H)
      }
      if (sla.stocksQuoteBreached) {
        p.incr(slaKey('breach:stocksQuote:1h'))
        p.expire(slaKey('breach:stocksQuote:1h'), TTL_1H)
      }
      await p.exec()
    }, undefined)
  },

  async getSlaTrend1h(): Promise<SlaTrend1h> {
    return safeRedis(async () => {
      const r = getRedis()!
      const p = r.pipeline()
      p.get(slaKey('checks:1h'))
      p.get(slaKey('breach:cryptoMarket:1h'))
      p.get(slaKey('breach:derivatives:1h'))
      p.get(slaKey('breach:scan:1h'))
      p.get(slaKey('breach:coinsBulk:1h'))
      p.get(slaKey('breach:stocksQuote:1h'))
      const results = await p.exec()
      return {
        totalChecks1h: Number(results[0] ?? 0),
        breachCounts1h: {
          cryptoMarket: Number(results[1] ?? 0),
          derivatives: Number(results[2] ?? 0),
          scan: Number(results[3] ?? 0),
          coinsBulk: Number(results[4] ?? 0),
          stocksQuote: Number(results[5] ?? 0),
        },
      }
    }, {
      totalChecks1h: 0,
      breachCounts1h: {
        cryptoMarket: 0,
        derivatives: 0,
        scan: 0,
        coinsBulk: 0,
        stocksQuote: 0,
      },
    })
  },
}
