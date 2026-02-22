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
}

export interface SlaStatus {
  cryptoMarketBreached: boolean
  derivativesBreached: boolean
  scanBreached: boolean
  coinsBulkBreached: boolean
}

// HERMES_FIX: SLA_THRESHOLDS_v1 — Data freshness SLA definitions
export const SLA_THRESHOLDS_MINUTES: Record<DataKey, number> = {
  cryptoMarket: 30,
  coinsBulk: 60,
  derivatives: 60,
  scan: 15,
  onchain: 120,
}

// ── Redis key helpers ──

const pmKey = (provider: ProviderName, suffix: string) => `pm:${provider}:${suffix}`
const freshKey = (key: DataKey) => `fresh:${key}:fetchedAt`
const squeezeKey = (suffix: string) => `squeeze:${suffix}`
const cacheStatsKey = (suffix: string) => `cache:stats:${suffix}`

const TTL_1H = 3600
const TTL_2H = 7200

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
      const keys: DataKey[] = ['cryptoMarket', 'coinsBulk', 'derivatives', 'scan']
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
      }
    }, {
      cryptoMarketAgeMin: null,
      coinsBulkAgeMin: null,
      derivativesAgeMin: null,
      scanAgeMin: null,
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
      const results = await p.exec()

      return {
        redis: {
          ok: true,
          lastWriteAt: (results[0] as string | null) ?? null,
          lastReadAt: (results[1] as string | null) ?? null,
        },
      }
    }, {
      redis: { ok: false, lastWriteAt: null, lastReadAt: null },
    })
  },

  async getSlaStatus(): Promise<SlaStatus> {
    const freshness = await this.getDataFreshness()

    function breached(ageMin: number | null, key: DataKey): boolean {
      if (ageMin === null) return true // Never fetched = breached
      return ageMin > SLA_THRESHOLDS_MINUTES[key]
    }

    const status: SlaStatus = {
      cryptoMarketBreached: breached(freshness.cryptoMarketAgeMin, 'cryptoMarket'),
      derivativesBreached: breached(freshness.derivativesAgeMin, 'derivatives'),
      scanBreached: breached(freshness.scanAgeMin, 'scan'),
      coinsBulkBreached: breached(freshness.coinsBulkAgeMin, 'coinsBulk'),
    }

    if (Object.values(status).some(Boolean)) {
      sentinelLog.warn('SLA_BREACH', {
        ...status,
        freshness,
      })
    }

    return status
  },
}
