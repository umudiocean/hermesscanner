// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Scan Results Store
// In-memory + Redis (Vercel serverless uyumlu — disk yazimi YOK)
// Redis: cross-instance paylasim | In-memory: ayni instance hizi
// ═══════════════════════════════════════════════════════════════════

import { ScanResult, ScanSummary } from './types'
import { getRedisCache, setRedisCache } from './cache/redis-cache'
import { isRedisAvailable } from './cache/redis-client'
import { SCAN_GUARD } from './config/constants'

const scanResults = new Map<string, ScanResult[]>()
const scanSummaries = new Map<string, ScanSummary>()

let lastFullScan: ScanSummary | null = null

const SCAN_REDIS_KEY = 'scan:latest'
const SCAN_REDIS_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function countSnapshotErrors(results: ScanResult[]): number {
  return results.filter(r => Boolean(r.hermes?.error)).length
}

export function evaluateAllSnapshot(results: ScanResult[]): {
  trusted: boolean
  reason?: string
  errorCount: number
  errorRate: number
} {
  const total = results.length
  const errorCount = countSnapshotErrors(results)
  const errorRate = total > 0 ? errorCount / total : 1

  if (total < SCAN_GUARD.MIN_TRUSTED_RESULTS) {
    return {
      trusted: false,
      reason: `partial_snapshot_${total}_lt_${SCAN_GUARD.MIN_TRUSTED_RESULTS}`,
      errorCount,
      errorRate,
    }
  }

  if (errorRate > SCAN_GUARD.MAX_ERROR_RATE) {
    return {
      trusted: false,
      reason: `error_rate_${errorRate.toFixed(3)}_gt_${SCAN_GUARD.MAX_ERROR_RATE}`,
      errorCount,
      errorRate,
    }
  }

  return { trusted: true, errorCount, errorRate }
}

export function saveScanResults(segment: string, results: ScanResult[], summary: ScanSummary): void {
  // Guardrail: never let a partial ALL scan (e.g. 120 symbols test run)
  // overwrite production snapshot expected to be ~2050-2064.
  if (segment === 'ALL') {
    const snapshot = evaluateAllSnapshot(results)
    if (!snapshot.trusted) {
      console.warn(
        `[SCAN-STORE] Untrusted ALL snapshot ignored: ${snapshot.reason} (errors=${snapshot.errorCount}, errorRate=${snapshot.errorRate.toFixed(3)})`
      )
      return
    }
  }

  scanResults.set(segment, results)
  scanSummaries.set(segment, summary)

  updateFullScan()
  
  const payload = {
    scanId: lastFullScan?.scanId || `full-${Date.now()}`,
    timestamp: new Date().toISOString(),
    totalResults: getAllResults().length,
    results: getAllResults(),
  }
  if (isRedisAvailable()) {
    setRedisCache(SCAN_REDIS_KEY, payload, SCAN_REDIS_TTL).catch(err => {
      console.warn('[SCAN-STORE] Redis save failed:', (err as Error).message)
    })
  }
}

/**
 * Segment tarama sonuclarini getir
 */
export function getScanResults(segment: string): ScanResult[] {
  return scanResults.get(segment) || []
}

/**
 * Segment ozeti getir
 */
export function getScanSummary(segment: string): ScanSummary | null {
  return scanSummaries.get(segment) || null
}

/**
 * Tum segmentleri birlestirerek full scan ozetini guncelle
 */
function updateFullScan(): void {
  const allResults: ScanResult[] = []
  for (const results of scanResults.values()) {
    allResults.push(...results)
  }

  if (allResults.length === 0) return

  const strongLongs = allResults.filter(r => r.hermes.signalType === 'strong_long')
  const strongShorts = allResults.filter(r => r.hermes.signalType === 'strong_short')
  const longs = allResults.filter(r => r.hermes.signalType === 'long')
  const shorts = allResults.filter(r => r.hermes.signalType === 'short')
  const errors = allResults.filter(r => r.hermes.error).length

  lastFullScan = {
    scanId: `full-${Date.now()}`,
    timestamp: new Date().toISOString(),
    duration: 0,
    totalScanned: allResults.length,
    strongLongs: strongLongs.sort((a, b) => a.hermes.score - b.hermes.score),
    strongShorts: strongShorts.sort((a, b) => b.hermes.score - a.hermes.score),
    longs: longs.sort((a, b) => a.hermes.score - b.hermes.score),
    shorts: shorts.sort((a, b) => b.hermes.score - a.hermes.score),
    neutrals: allResults.filter(r => r.hermes.signalType === 'neutral').length,
    errors,
    segment: 'ALL',
  }
}

/**
 * Full scan ozetini getir
 */
export function getFullScanSummary(): ScanSummary | null {
  return lastFullScan
}

/**
 * Tum sonuclari getir (sorted)
 */
export function getAllResults(): ScanResult[] {
  const all: ScanResult[] = []
  for (const results of scanResults.values()) {
    all.push(...results)
  }
  return all.sort((a, b) => a.hermes.score - b.hermes.score)
}

/**
 * Store durumunu temizle
 */
export function clearStore(): void {
  scanResults.clear()
  scanSummaries.clear()
  lastFullScan = null
}

/**
 * Tam tarama sonuclarini kaydet (Redis + in-memory)
 */
export async function saveFullScan(
  results: ScanResult[],
  scanId: string
): Promise<{ saved: boolean; reason?: string }> {
  if (!results || results.length === 0) return { saved: false, reason: 'empty_results' }

  const snapshot = evaluateAllSnapshot(results)
  if (!snapshot.trusted) {
    console.warn(
      `[SCAN-STORE] saveFullScan ignored (${snapshot.reason}) errors=${snapshot.errorCount} errorRate=${snapshot.errorRate.toFixed(3)}`
    )
    return { saved: false, reason: snapshot.reason }
  }
  
  const payload = {
    scanId,
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    results,
  }
  
  if (isRedisAvailable()) {
    await setRedisCache(SCAN_REDIS_KEY, payload, SCAN_REDIS_TTL).catch(err => {
      console.warn('[SCAN-STORE] Redis save failed:', (err as Error).message)
    })
  }

  // In-memory'ye de kaydet (ayni instance icin hiz)
  for (const r of results) {
    const seg = r.segment || 'ALL'
    if (!scanResults.has(seg)) scanResults.set(seg, [])
    scanResults.get(seg)!.push(r)
  }
  updateFullScan()
  
  console.log(`[SCAN-STORE] Saved ${results.length} results${isRedisAvailable() ? ' (Redis + memory)' : ' (memory only — Redis unavailable)'}`)
  return { saved: true }
}

/**
 * Son tarama sonuclarini yukle (Redis > in-memory fallback)
 */
export async function loadLatestScan(): Promise<{
  scanId: string
  timestamp: string
  results: ScanResult[]
} | null> {
  // 1. Redis (cross-instance paylasim)
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisCache<{ scanId: string; timestamp: string; results: ScanResult[] }>(SCAN_REDIS_KEY)
      if (redis && redis.results?.length > 0) return redis
    } catch (err) {
      console.warn('[SCAN-STORE] Redis load failed:', (err as Error).message)
    }
  }

  // 2. In-memory fallback (ayni instance)
  const all = getAllResults()
  if (all.length > 0) {
    return {
      scanId: lastFullScan?.scanId || `mem-${Date.now()}`,
      timestamp: lastFullScan?.timestamp || new Date().toISOString(),
      results: all,
    }
  }

  return null
}
