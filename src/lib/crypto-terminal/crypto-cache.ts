// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Cache Management
// LRU Memory + Disk cache (same pattern as FMP cache)
// ═══════════════════════════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import logger from '../logger'

const CACHE_DIR = path.join(process.cwd(), '.next', 'cache', 'crypto-terminal')
const MAX_MEMORY_ENTRIES = 1000

interface CacheEntry {
  data: unknown
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry>()

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
    logger.debug(`Crypto LRU evicted ${evicted} entries`, { module: 'cryptoCache', cacheSize: memoryCache.size })
  }
}

// Cache TTL defaults (ms) — 24h agresif cache for API limit savings
// Every CoinGecko response is cached 24h on disk + memory
// Multiple users hitting same data = 0 API calls (cache hit)
const H24 = 24 * 60 * 60 * 1000 // 24 hours
const H6 = 6 * 60 * 60 * 1000   // 6 hours
const H1 = 60 * 60 * 1000       // 1 hour

export const CRYPTO_CACHE_TTL = {
  COINS_LIST: H1,               // 1h — coin market data (prices change but 1h is balanced)
  COIN_DETAIL: H6,              // 6h — individual coin details
  GLOBAL: H1,                   // 1h — global market stats
  TRENDING: H6,                 // 6h — trending coins
  CATEGORIES: H24,              // 24h — category list rarely changes
  EXCHANGES: H24,               // 24h — exchange list stable
  DERIVATIVES: H6,              // 6h — funding rates
  TREASURY: H24,                // 24h — treasury data very stable
  CHART: H6,                    // 6h — chart OHLCV data
  ONCHAIN: H6,                  // 6h — DEX pool data
  MARKET_DASHBOARD: H1,         // 1h — market overview
  GAINERS_LOSERS: H1,           // 1h — top movers
  KEY_INFO: H24,                // 24h — static key info
  SEARCH: H24,                  // 24h — coin list for search (18K+ coins)
  COIN_QUERY: H24,              // 24h — user-queried coin data
} as const

async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  } catch {
    // dir exists
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
  memoryCache.delete(key)
  memoryCache.set(key, entry) // LRU: move to end
  return entry.data as T
}

export function setMemoryCache(key: string, data: unknown): void {
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
    logger.warn('Crypto disk cache write failed', { module: 'cryptoCache', error: err, key })
  }
}

// ─── Combined Cache ────────────────────────────────────────────────

export async function getCached<T>(
  key: string,
  maxAge: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const mem = getMemoryCache<T>(key, maxAge)
  if (mem !== null) return mem

  const disk = await getDiskCache<T>(key, maxAge)
  if (disk !== null) {
    setMemoryCache(key, disk)
    return disk
  }

  const data = await fetcher()
  setMemoryCache(key, data)
  await setDiskCache(key, data)
  return data
}

// ─── Stale-While-Revalidate ────────────────────────────────────────

export async function getStaleWhileRevalidate<T>(
  key: string,
  maxAge: number,
  staleAge: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const mem = getMemoryCache<T>(key, maxAge)
  if (mem !== null) return mem

  const stale = getMemoryCache<T>(key, staleAge)
  if (stale !== null) {
    fetcher().then(data => {
      setMemoryCache(key, data)
      setDiskCache(key, data).catch(() => {})
    }).catch(() => {})
    return stale
  }

  const disk = await getDiskCache<T>(key, staleAge)
  if (disk !== null) {
    setMemoryCache(key, disk)
    fetcher().then(data => {
      setMemoryCache(key, data)
      setDiskCache(key, data).catch(() => {})
    }).catch(() => {})
    return disk
  }

  const data = await fetcher()
  setMemoryCache(key, data)
  await setDiskCache(key, data)
  return data
}

// ─── Clear ─────────────────────────────────────────────────────────

export function clearCryptoMemoryCache(): void {
  memoryCache.clear()
}

export async function clearCryptoDiskCache(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR)
    await Promise.all(files.map(f => fs.unlink(path.join(CACHE_DIR, f)).catch(() => {})))
  } catch {
    // dir may not exist
  }
}

export function getCryptoCacheStats() {
  let oldestTs: number | null = null
  for (const entry of memoryCache.values()) {
    if (oldestTs === null || entry.timestamp < oldestTs) oldestTs = entry.timestamp
  }
  return {
    memoryEntries: memoryCache.size,
    maxEntries: MAX_MEMORY_ENTRIES,
    oldestEntry: oldestTs ? Date.now() - oldestTs : null,
  }
}
