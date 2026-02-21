// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Signal Performance Tracker (K7)
// Client-side localStorage tracker for signal hit rates
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

export function loadTrackedSignals(): TrackedSignal[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as TrackedSignal[]
  } catch {
    return []
  }
}

export function saveTrackedSignals(signals: TrackedSignal[]): void {
  if (typeof window === 'undefined') return
  try {
    // Keep only last MAX_SIGNALS
    const trimmed = signals.slice(-MAX_SIGNALS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage full — clear oldest
    try {
      const trimmed = signals.slice(-100)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch { /* */ }
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

  // Check TP
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
  }
  // Check SL
  else if (isLong && currentPrice <= signal.slPrice) {
    signal.status = 'SL_HIT'
    signal.closePrice = currentPrice
    signal.closeTimestamp = Date.now()
    signal.pnlPercent = pnl
  } else if (!isLong && currentPrice >= signal.slPrice) {
    signal.status = 'SL_HIT'
    signal.closePrice = currentPrice
    signal.closeTimestamp = Date.now()
    signal.pnlPercent = pnl
  }
  // Check expiry
  else if (Date.now() - signal.timestamp > SIGNAL_EXPIRY_MS) {
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

  // Best/worst signal types
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
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
