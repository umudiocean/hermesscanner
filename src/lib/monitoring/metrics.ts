// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Runtime Metrics
// In-memory tracking for API health, scan status, and system state
// ═══════════════════════════════════════════════════════════════════

// ─── Scan Metrics ───────────────────────────────────────────────────

interface ScanTimestamp {
  timestamp: string
  stocksScored: number
  duration: number
  errors: number
}

const scanMetrics = {
  last52W: null as ScanTimestamp | null,
  last5D: null as ScanTimestamp | null,
  lastFMPStocks: null as ScanTimestamp | null,
}

export function recordScan52W(stocksScored: number, duration: number, errors: number): void {
  scanMetrics.last52W = {
    timestamp: new Date().toISOString(),
    stocksScored,
    duration,
    errors,
  }
}

export function recordScan5D(stocksScored: number, duration: number, errors: number): void {
  scanMetrics.last5D = {
    timestamp: new Date().toISOString(),
    stocksScored,
    duration,
    errors,
  }
}

export function recordFMPStocksScan(stocksScored: number, duration: number, errors: number): void {
  scanMetrics.lastFMPStocks = {
    timestamp: new Date().toISOString(),
    stocksScored,
    duration,
    errors,
  }
}

export function getScanMetrics() {
  return { ...scanMetrics }
}

// ─── Integrity Tracking ────────────────────────────────────────────

interface IntegrityReport {
  timestamp: string
  totalStocks: number
  nanScores: number
  degradedScores: number
  missingSymbols: string[]
}

let lastIntegrityReport: IntegrityReport | null = null

export function recordIntegrityCheck(
  totalStocks: number,
  nanScores: number,
  degradedScores: number,
  missingSymbols: string[]
): void {
  lastIntegrityReport = {
    timestamp: new Date().toISOString(),
    totalStocks,
    nanScores,
    degradedScores,
    missingSymbols: missingSymbols.slice(0, 20), // cap at 20
  }
}

export function getIntegrityReport(): IntegrityReport | null {
  return lastIntegrityReport
}

// ─── System Uptime ──────────────────────────────────────────────────

const startTime = Date.now()

export function getUptime(): number {
  return Math.round((Date.now() - startTime) / 1000)
}

// ─── Health Summary ─────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export function computeHealthStatus(): HealthStatus {
  // Unhealthy if: no scan ever completed
  if (!scanMetrics.last52W && !scanMetrics.lastFMPStocks) return 'unhealthy'

  // Degraded if: scan is stale (>2 hours old)
  const TWO_HOURS = 2 * 60 * 60 * 1000
  const now = Date.now()

  if (scanMetrics.lastFMPStocks) {
    const age = now - new Date(scanMetrics.lastFMPStocks.timestamp).getTime()
    if (age > TWO_HOURS) return 'degraded'
  }

  if (scanMetrics.last52W) {
    const age = now - new Date(scanMetrics.last52W.timestamp).getTime()
    if (age > TWO_HOURS) return 'degraded'
  }

  // Degraded if integrity has issues
  if (lastIntegrityReport) {
    if (lastIntegrityReport.nanScores > 0) return 'degraded'
    if (lastIntegrityReport.missingSymbols.length > 50) return 'degraded'
  }

  return 'healthy'
}
