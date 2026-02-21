// ═══════════════════════════════════════════════════════════════════
// Redis Cache Layer — shared across all serverless instances
// Graceful fallback: Redis unavailable → skip silently
// Max key TTL: 7 days (auto-cleanup)
// ═══════════════════════════════════════════════════════════════════

import { getRedis } from './redis-client'

const MAX_TTL_SEC = 7 * 24 * 60 * 60 // 7 days hard ceiling
const KEY_PREFIX = 'hermes:cache:'

function redisTtlSec(ttlMs: number): number {
  return Math.min(Math.ceil(ttlMs / 1000), MAX_TTL_SEC)
}

export async function getRedisCache<T>(key: string): Promise<T | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const raw = await r.get<string>(KEY_PREFIX + key)
    if (raw === null || raw === undefined) return null
    return typeof raw === 'string' ? JSON.parse(raw) as T : raw as T
  } catch {
    return null
  }
}

export async function setRedisCache(key: string, data: unknown, ttlMs: number): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    const ttlSec = redisTtlSec(ttlMs)
    await r.set(KEY_PREFIX + key, JSON.stringify(data), { ex: ttlSec })
  } catch {
    // silent — Redis write failure is non-critical
  }
}

export async function deleteRedisCache(key: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.del(KEY_PREFIX + key)
  } catch {
    // silent
  }
}

export async function clearRedisCacheByPrefix(prefix: string): Promise<number> {
  const r = getRedis()
  if (!r) return 0
  try {
    const keys = await r.keys(KEY_PREFIX + prefix + '*')
    if (keys.length > 0) {
      await r.del(...keys)
    }
    return keys.length
  } catch {
    return 0
  }
}

// ═══════════════════════════════════════════════════════════════════
// 15-Minute Bar Cache — Redis-backed persistent bar storage
// Used by bootstrap + delta cron to avoid full stitching on every scan
// ═══════════════════════════════════════════════════════════════════

const BARS_PREFIX = 'bars15m:'
const BARS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function getBarCache(symbol: string): Promise<Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const raw = await r.get<string>(KEY_PREFIX + BARS_PREFIX + symbol)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw as Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>
  } catch {
    return null
  }
}

export async function setBarCache(symbol: string, bars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.set(KEY_PREFIX + BARS_PREFIX + symbol, JSON.stringify(bars), { ex: redisTtlSec(BARS_TTL_MS) })
  } catch {
    // silent
  }
}

export async function getBootstrapProgress(): Promise<{ completed: number; total: number; lastSymbol: string; startedAt: string; status: string } | null> {
  return getRedisCache<{ completed: number; total: number; lastSymbol: string; startedAt: string; status: string }>('bootstrap:progress')
}

export async function setBootstrapProgress(data: { completed: number; total: number; lastSymbol: string; startedAt: string; status: string }): Promise<void> {
  await setRedisCache('bootstrap:progress', data, 24 * 60 * 60 * 1000) // 1 day
}

export async function getBootstrapCheckpoint(): Promise<string[] | null> {
  return getRedisCache<string[]>('bootstrap:checkpoint')
}

export async function setBootstrapCheckpoint(completedSymbols: string[]): Promise<void> {
  await setRedisCache('bootstrap:checkpoint', completedSymbols, BARS_TTL_MS)
}

export async function getBootstrapSkipped(): Promise<string[] | null> {
  return getRedisCache<string[]>('bootstrap:skipped')
}

export async function setBootstrapSkipped(skippedSymbols: string[]): Promise<void> {
  await setRedisCache('bootstrap:skipped', skippedSymbols, BARS_TTL_MS)
}

export async function getBarCacheCount(): Promise<number> {
  const r = getRedis()
  if (!r) return 0
  try {
    const keys = await r.keys(KEY_PREFIX + BARS_PREFIX + '*')
    return keys.length
  } catch {
    return 0
  }
}

export async function getRedisCacheStats(): Promise<{
  available: boolean
  keyCount: number
  prefixes: Record<string, number>
}> {
  const r = getRedis()
  if (!r) return { available: false, keyCount: 0, prefixes: {} }
  try {
    const keys = await r.keys(KEY_PREFIX + '*')
    const prefixes: Record<string, number> = {}
    for (const k of keys) {
      const parts = k.replace(KEY_PREFIX, '').split(':')
      const prefix = parts[0] || 'other'
      prefixes[prefix] = (prefixes[prefix] || 0) + 1
    }
    return { available: true, keyCount: keys.length, prefixes }
  } catch {
    return { available: false, keyCount: 0, prefixes: {} }
  }
}
