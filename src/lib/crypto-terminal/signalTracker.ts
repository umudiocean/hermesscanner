// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Signal Performance Tracker (K7)
// Client-side localStorage tracker for signal hit rates
//
// HERMES_FIX: SIGNAL_TRACKER_LOGGING 2026-02-19 SEVERITY: MEDIUM
// All localStorage operations use safeLocalStorage() wrapper.
// Silent .catch(() => {}) is permanently banned per ARTICLE 13.
// Errors are surfaced via console.warn for debugging.
// ═══════════════════════════════════════════════════════════════════

export interface TrackedSignal {
  id: string // coinId-signal-timestamp
  coinId: string
  symbol: string
  signal: string // e.g., 'STRONG_LONG', 'ALPHA_LONG', etc.
  entryPrice: number
  tpPrice: number
  slPrice: number
  timestamp: number
  status: 'ACTIVE' | 'TP_HIT' | 'SL_HIT' | 'EXPIRED' | 'MANUAL_CLOSE'
  closePrice?: number
  closeTimestamp?: number
  pnlPercent?: number
}

export interface SignalStats {
  total: number
  active: number
  tpHit: number
  slHit: number
  expired: number
  winRate: number // tpHit / (tpHit + slHit) * 100
  avgPnl: number
  bestSignal: string
  worstSignal: string
}

const STORAGE_KEY = 'hermes-crypto-signal-tracker'
const MAX_SIGNALS = 500
const SIGNAL_EXPIRY_MS = 72 * 60 * 60 * 1000 // 72 hours
const PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// HERMES_FIX: SIGNAL_TRACKER_LOGGING — Safe localStorage wrapper
// Handles: SSR (no window), private browsing, quota exceeded, corrupt data
function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch (err) {
    console.warn(`[SignalTracker] localStorage.getItem("${key}") failed:`, err)
    return null
  }
}

function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.warn('[SignalTracker] localStorage quota exceeded — pruning old signals')
      pruneOldSignals()
      try {
        window.localStorage.setItem(key, value)
        return true
      } catch (retryErr) {
        console.error('[SignalTracker] Write failed after prune:', retryErr)
        return false
      }
    }
    console.warn(`[SignalTracker] localStorage.setItem("${key}") failed:`, err)
    return false
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch (err) {
    console.warn(`[SignalTracker] localStorage.removeItem("${key}") failed:`, err)
  }
}

function pruneOldSignals(): void {
  try {
    const raw = safeGetItem(STORAGE_KEY)
    if (!raw) return
    const signals: TrackedSignal[] = JSON.parse(raw)
    const cutoff = Date.now() - PRUNE_AGE_MS
    const kept = signals.filter(s => s.timestamp >= cutoff)
    const pruned = signals.length - kept.length
    if (pruned > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kept.slice(-100)))
      console.info(`[SignalTracker] Pruned ${pruned} signals older than 30 days`)
    }
  } catch (err) {
    console.error('[SignalTracker] pruneOldSignals failed:', err)
  }
}

export function loadTrackedSignals(): TrackedSignal[] {
  const raw = safeGetItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as TrackedSignal[]
  } catch (err) {
    console.warn('[SignalTracker] Failed to parse stored signals, resetting:', err)
    safeRemoveItem(STORAGE_KEY)
    return []
  }
}

export function saveTrackedSignals(signals: TrackedSignal[]): void {
  const trimmed = signals.slice(-MAX_SIGNALS)
  const ok = safeSetItem(STORAGE_KEY, JSON.stringify(trimmed))
  if (!ok && trimmed.length > 100) {
    safeSetItem(STORAGE_KEY, JSON.stringify(trimmed.slice(-100)))
  }
}

export function trackSignal(
  coinId: string,
  symbol: string,
  signal: string,
  entryPrice: number,
  tpPrice: number,
  slPrice: number,
): TrackedSignal {
  const tracked: TrackedSignal = {
    id: `${coinId}-${signal}-${Date.now()}`,
    coinId,
    symbol,
    signal,
    entryPrice,
    tpPrice,
    slPrice,
    timestamp: Date.now(),
    status: 'ACTIVE',
  }

  const all = loadTrackedSignals()
  all.push(tracked)
  saveTrackedSignals(all)
  return tracked
}

export function updateSignalStatus(
  signalId: string,
  currentPrice: number,
): TrackedSignal | null {
  const all = loadTrackedSignals()
  const signal = all.find(s => s.id === signalId)
  if (!signal || signal.status !== 'ACTIVE') return null

  const isLong = signal.signal.includes('LONG') || signal.signal.includes('BUY')
  const pnl = isLong
    ? ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100
    : ((signal.entryPrice - currentPrice) / signal.entryPrice) * 100

  if (isLong && currentPrice >= signal.tpPrice) {
    signal.status = 'TP_HIT'
    signal.closePrice = currentPrice
    signal.closeTimestamp = Date.now()
    signal.pnlPercent = pnl
  } else if (!isLong && currentPrice <= signal.tpPrice) {
    signal.status = 'TP_HIT'
    signal.closePrice = currentPrice
    signal.closeTimestamp = Date.now()
    signal.pnlPercent = pnl
  } else if (isLong && currentPrice <= signal.slPrice) {
    signal.status = 'SL_HIT'
    signal.closePrice = currentPrice
    signal.closeTimestamp = Date.now()
    signal.pnlPercent = pnl
  } else if (!isLong && currentPrice >= signal.slPrice) {
    signal.status = 'SL_HIT'
    signal.closePrice = currentPrice
    signal.closeTimestamp = Date.now()
    signal.pnlPercent = pnl
  } else if (Date.now() - signal.timestamp > SIGNAL_EXPIRY_MS) {
    signal.status = 'EXPIRED'
    signal.closePrice = currentPrice
    signal.closeTimestamp = Date.now()
    signal.pnlPercent = pnl
  }

  saveTrackedSignals(all)
  return signal
}

export function getSignalStats(): SignalStats {
  const all = loadTrackedSignals()
  const total = all.length
  const active = all.filter(s => s.status === 'ACTIVE').length
  const tpHit = all.filter(s => s.status === 'TP_HIT').length
  const slHit = all.filter(s => s.status === 'SL_HIT').length
  const expired = all.filter(s => s.status === 'EXPIRED').length
  const closed = all.filter(s => s.pnlPercent != null)
  const avgPnl = closed.length > 0 ? closed.reduce((s, c) => s + (c.pnlPercent || 0), 0) / closed.length : 0
  const winRate = tpHit + slHit > 0 ? (tpHit / (tpHit + slHit)) * 100 : 0

  const signalPnls: Record<string, number[]> = {}
  for (const s of closed) {
    if (!signalPnls[s.signal]) signalPnls[s.signal] = []
    signalPnls[s.signal].push(s.pnlPercent || 0)
  }

  let bestSignal = '-'
  let worstSignal = '-'
  let bestAvg = -Infinity
  let worstAvg = Infinity

  for (const [sig, pnls] of Object.entries(signalPnls)) {
    const avg = pnls.reduce((a, b) => a + b) / pnls.length
    if (avg > bestAvg) { bestAvg = avg; bestSignal = sig }
    if (avg < worstAvg) { worstAvg = avg; worstSignal = sig }
  }

  return { total, active, tpHit, slHit, expired, winRate, avgPnl, bestSignal, worstSignal }
}

export function clearSignalHistory(): void {
  safeRemoveItem(STORAGE_KEY)
}
