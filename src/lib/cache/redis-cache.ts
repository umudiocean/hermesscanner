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
