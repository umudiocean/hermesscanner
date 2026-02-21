// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Scan Results Store
// In-memory + Disk cache (server restart'a dayanikli)
// ═══════════════════════════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import { ScanResult, ScanSummary } from './types'
import { getRedisCache, setRedisCache } from './cache/redis-cache'

const SCANS_DIR = path.join(process.cwd(), 'data', 'scans')
const LATEST_SCAN_FILE = path.join(SCANS_DIR, 'latest.json')

// Son tarama sonuclari (segment bazli)
const scanResults = new Map<string, ScanResult[]>()
const scanSummaries = new Map<string, ScanSummary>()

// Son full scan sonucu (tum segmentler birlesik)
let lastFullScan: ScanSummary | null = null

/** Dizinin var oldugundan emin ol */
async function ensureDir(): Promise<void> {
  await fs.mkdir(SCANS_DIR, { recursive: true })
}

/**
 * Segment tarama sonuclarini kaydet
 */
const SCAN_REDIS_KEY = 'scan:latest'
const SCAN_REDIS_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

export function saveScanResults(segment: string, results: ScanResult[], summary: ScanSummary): void {
  scanResults.set(segment, results)
  scanSummaries.set(segment, summary)

  updateFullScan()
  
  // Disk + Redis async save
  const payload = {
    scanId: lastFullScan?.scanId || `full-${Date.now()}`,
    timestamp: new Date().toISOString(),
    totalResults: getAllResults().length,
    results: getAllResults(),
  }
  saveLatestToDisk().catch(err => {
    console.error('[SCAN-STORE] Failed to save to disk:', err)
  })
  setRedisCache(SCAN_REDIS_KEY, payload, SCAN_REDIS_TTL).catch(() => {})
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
 * Son tarama sonuclarini disk'e kaydet (internal)
 */
async function saveLatestToDisk(): Promise<void> {
  const all = getAllResults()
  if (all.length === 0) return
  
  await ensureDir()
  await fs.writeFile(LATEST_SCAN_FILE, JSON.stringify({
    scanId: lastFullScan?.scanId || `full-${Date.now()}`,
    timestamp: new Date().toISOString(),
    totalResults: all.length,
    results: all,
  }, null, 2))
}

/**
 * Tam tarama sonuçlarını disk'e kaydet (client'tan çağrılır)
 * Bu fonksiyon tüm sonuçları tek seferde kaydeder
 */
export async function saveFullScan(results: ScanResult[], scanId: string): Promise<void> {
  if (!results || results.length === 0) return
  
  const payload = {
    scanId,
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    results,
  }
  
  await ensureDir()
  await fs.writeFile(LATEST_SCAN_FILE, JSON.stringify(payload, null, 2))
  await setRedisCache(SCAN_REDIS_KEY, payload, SCAN_REDIS_TTL).catch(() => {})
  
  console.log(`[SCAN-STORE] Saved ${results.length} results to disk + Redis`)
}

/**
 * Son tarama sonuclarini disk'ten yukle
 */
export async function loadLatestScan(): Promise<{
  scanId: string
  timestamp: string
  results: ScanResult[]
} | null> {
  // 1. Try Redis first (shared across instances)
  try {
    const redis = await getRedisCache<{ scanId: string; timestamp: string; results: ScanResult[] }>(SCAN_REDIS_KEY)
    if (redis && redis.results?.length > 0) return redis
  } catch {
    // fallback to disk
  }

  // 2. Disk fallback
  try {
    const content = await fs.readFile(LATEST_SCAN_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    // Promote to Redis for other instances
    if (parsed?.results?.length > 0) {
      setRedisCache(SCAN_REDIS_KEY, parsed, SCAN_REDIS_TTL).catch(() => {})
    }
    return parsed
  } catch {
    return null
  }
}
