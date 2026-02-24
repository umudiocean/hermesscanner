// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Cache Management
// LRU Memory + Disk cache with Stale-While-Revalidate pattern
// ═══════════════════════════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import logger from '../logger'
import { getRedisCache, setRedisCache, clearRedisCacheByPrefix } from '../cache/redis-cache'
import { CACHE } from '../config/constants'
import { providerMonitor } from '../monitor/provider-monitor'

const CACHE_DIR = process.env.VERCEL
  ? path.join('/tmp', 'fmp-terminal')
  : path.join(process.cwd(), '.next', 'cache', 'fmp-terminal')

// ─── LRU Memory Cache ───────────────────────────────────────────────
// Bounded to MAX_ENTRIES to prevent unbounded memory growth

const MAX_MEMORY_ENTRIES = 500

interface CacheEntry {
  data: unknown
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry>()

/**
 * Evict oldest entries when cache exceeds MAX_MEMORY_ENTRIES.
 * Uses insertion order (Map preserves insertion order).
 */
function evictIfNeeded(): void {
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return

  const toEvict = memoryCache.size - MAX_MEMORY_ENTRIES
  let evicted = 0
  for (const key of memoryCache.keys()) {
    if (evicted >= toEvict) break
    memoryCache.delete(key)
    evicted++
  }

  if (evicted > 0) {
    logger.debug(`LRU evicted ${evicted} entries`, { module: 'fmpCache', cacheSize: memoryCache.size })
  }
}

// Cache TTL defaults (ms)
export const CACHE_TTL = {
  BULK: CACHE.BULK,
  QUOTE: CACHE.QUOTE,
  ANALYST: CACHE.ANALYST,
  DCF: CACHE.DCF,
  FUNDAMENTALS: CACHE.FUNDAMENTALS,
  INSIDER: CACHE.INSIDER,
  NEWS: CACHE.NEWS,
  INSTITUTIONAL: CACHE.INSTITUTIONAL,
  CONGRESSIONAL: CACHE.CONGRESSIONAL,
  FINANCIALS: CACHE.FINANCIALS,
  SECTOR: CACHE.SECTOR,
  MARKET: CACHE.MARKET,
  TREASURY: CACHE.TREASURY,
  SCORES: CACHE.SCORES,
  TRANSCRIPT: CACHE.TRANSCRIPT,
  TECHNICAL: CACHE.TECHNICAL,
} as const

async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  } catch (err) {
    logger.debug('Cache dir creation skipped (may already exist)', { module: 'fmpCache', error: err })
  }
}

function getCachePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(CACHE_DIR, `${safe}.json`)
}

// ─── Memory Cache ──────────────────────────────────────────────────

export function getMemoryCache<T>(key: string, maxAge: number): T | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > maxAge) return null

  // LRU: move to end (most recently accessed)
  memoryCache.delete(key)
  memoryCache.set(key, entry)

  return entry.data as T
}

export function setMemoryCache(key: string, data: unknown): void {
  // Delete first to move to end (most recently set)
  memoryCache.delete(key)
  memoryCache.set(key, { data, timestamp: Date.now() })
  evictIfNeeded()
}

// ─── Disk Cache ────────────────────────────────────────────────────

export async function getDiskCache<T>(key: string, maxAge: number): Promise<T | null> {
  try {
    const filepath = getCachePath(key)
    const stat = await fs.stat(filepath)
    if (Date.now() - stat.mtimeMs > maxAge) return null
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export async function setDiskCache(key: string, data: unknown): Promise<void> {
  try {
    await ensureCacheDir()
    const filepath = getCachePath(key)
    await fs.writeFile(filepath, JSON.stringify(data), 'utf-8')
  } catch (err) {
    logger.warn('Disk cache write failed', { module: 'fmpCache', error: err, key })
  }
}

// ─── Combined Cache (Memory → Redis → Disk → Fetch) ────────────────

export async function getCached<T>(
  key: string,
  maxAge: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Memory cache (LRU) — fastest
  const mem = getMemoryCache<T>(key, maxAge)
  if (mem !== null) {
    providerMonitor.recordCacheTierHit('memory').catch(() => {})
    return mem
  }

  // 2. Redis cache — shared across serverless instances
  const redisKey = `fmp:${key}`
  const redis = await getRedisCache<T>(redisKey)
  if (redis !== null) {
    setMemoryCache(key, redis)
    providerMonitor.recordCacheTierHit('redis').catch(() => {})
    return redis
  }

  // 3. Disk cache — local fallback
  const disk = await getDiskCache<T>(key, maxAge)
  if (disk !== null) {
    setMemoryCache(key, disk)
    setRedisCache(redisKey, disk, maxAge).catch(() => {})
    providerMonitor.recordCacheTierHit('disk').catch(() => {})
    return disk
  }

  // 4. Fetch fresh
  const data = await fetcher()
  setMemoryCache(key, data)
  setRedisCache(redisKey, data, maxAge).catch(() => {})
  await setDiskCache(key, data)
  providerMonitor.recordCacheTierHit('origin').catch(() => {})
  return data
}

// ─── Stale-While-Revalidate ────────────────────────────────────────

export async function getStaleWhileRevalidate<T>(
  key: string,
  maxAge: number,
  staleAge: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Memory cache (fresh)
  const mem = getMemoryCache<T>(key, maxAge)
  if (mem !== null) {
    providerMonitor.recordCacheTierHit('memory').catch(() => {})
    return mem
  }

  // 2. Memory cache (stale but usable)
  const stale = getMemoryCache<T>(key, staleAge)
  if (stale !== null) {
    fetcher().then(data => {
      setMemoryCache(key, data)
      setRedisCache(`fmp:${key}`, data, staleAge).catch(() => {})
      setDiskCache(key, data).catch(err => logger.debug('SWR disk write failed', { module: 'fmpCache', error: err }))
    }).catch(err => logger.debug('SWR background revalidation failed', { module: 'fmpCache', error: err, key }))
    providerMonitor.recordCacheTierHit('memory').catch(() => {})
    return stale
  }

  // 3. Redis cache
  const redisKey = `fmp:${key}`
  const redis = await getRedisCache<T>(redisKey)
  if (redis !== null) {
    setMemoryCache(key, redis)
    providerMonitor.recordCacheTierHit('redis').catch(() => {})
    return redis
  }

  // 4. Disk cache
  const disk = await getDiskCache<T>(key, staleAge)
  if (disk !== null) {
    setMemoryCache(key, disk)
    setRedisCache(redisKey, disk, staleAge).catch(() => {})
    const diskFresh = await getDiskCache<T>(key, maxAge)
    if (!diskFresh) {
      fetcher().then(data => {
        setMemoryCache(key, data)
        setRedisCache(redisKey, data, staleAge).catch(() => {})
        setDiskCache(key, data).catch(err => logger.debug('SWR disk rewrite failed', { module: 'fmpCache', error: err }))
      }).catch(err => logger.debug('SWR disk revalidation failed', { module: 'fmpCache', error: err, key }))
    }
    providerMonitor.recordCacheTierHit('disk').catch(() => {})
    return disk
  }

  // 5. Fresh fetch
  const data = await fetcher()
  setMemoryCache(key, data)
  setRedisCache(redisKey, data, staleAge).catch(() => {})
  await setDiskCache(key, data)
  providerMonitor.recordCacheTierHit('origin').catch(() => {})
  return data
}

// ─── Clear Caches ──────────────────────────────────────────────────

export function clearMemoryCache(): void {
  memoryCache.clear()
}

export async function clearDiskCache(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR)
    await Promise.all(
      files.map(f => fs.unlink(path.join(CACHE_DIR, f)).catch(err =>
        logger.debug('Cache file delete failed', { module: 'fmpCache', error: err })
      ))
    )
  } catch (err) {
    logger.debug('Disk cache clear failed (dir may not exist)', { module: 'fmpCache', error: err })
  }
}

export async function clearAllFMPCache(): Promise<void> {
  clearMemoryCache()
  await clearDiskCache()
  await clearRedisCacheByPrefix('fmp:')
}

// ─── Cache Stats ───────────────────────────────────────────────────

export function getCacheStats(): {
  memoryEntries: number
  memoryKeys: string[]
  maxEntries: number
  oldestEntry: number | null
} {
  let oldestTs: number | null = null
  for (const entry of memoryCache.values()) {
    if (oldestTs === null || entry.timestamp < oldestTs) {
      oldestTs = entry.timestamp
    }
  }

  return {
    memoryEntries: memoryCache.size,
    memoryKeys: Array.from(memoryCache.keys()),
    maxEntries: MAX_MEMORY_ENTRIES,
    oldestEntry: oldestTs ? Date.now() - oldestTs : null,
  }
}
