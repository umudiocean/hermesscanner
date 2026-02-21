// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Market Risk Engine
// Portfolio-level risk management: VIX gating, regime detection,
// drawdown circuit breaker, exposure limits.
//
// Provides a single getMarketRisk() call that all modules consume.
// Data sources: FMP treasury rates + batch-quote (^VIX, indices)
// ═══════════════════════════════════════════════════════════════════

import logger from '../logger'
import { fmpApiFetchRaw } from '../api/fmpClient'

// ─── Types ──────────────────────────────────────────────────────────

export type MarketRegime = 'RISK_ON' | 'CAUTION' | 'RISK_OFF' | 'CRISIS'

export interface MarketRiskState {
  regime: MarketRegime
  vix: number | null
  vixLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME'
  breadth: number | null       // % of S&P500 above SMA50 (proxy via gainer/loser ratio)
  drawdownPct: number          // Intraday portfolio drawdown estimate (0 = no drawdown)
  signalsPaused: boolean       // true = regime too dangerous, suppress new signals
  pauseReason: string | null
  longAllowed: boolean
  shortAllowed: boolean
  positionSizeMultiplier: number  // 1.0 = full, 0.5 = half, 0 = none
  timestamp: string
  dataAge: number              // ms since last successful fetch
}

export interface DrawdownTracker {
  peakEquity: number
  currentEquity: number
  dailyPnL: number
  dailyMaxLoss: number         // config: max daily loss % before circuit break
  isCircuitBroken: boolean
  brokenAt: string | null
}

// ─── Configuration ──────────────────────────────────────────────────

export const RISK_CONFIG = {
  VIX_THRESHOLDS: {
    LOW: 15,         // VIX < 15 → RISK_ON
    MODERATE: 20,    // VIX 15-20 → CAUTION
    HIGH: 30,        // VIX 20-30 → RISK_OFF
    EXTREME: 40,     // VIX > 40 → CRISIS
  },
  BREADTH_THRESHOLDS: {
    STRONG: 70,      // >70% → healthy market
    WEAK: 40,        // <40% → deteriorating
    CRISIS: 25,      // <25% → broad selloff
  },
  POSITION_SIZE: {
    RISK_ON: 1.0,
    CAUTION: 0.75,
    RISK_OFF: 0.50,
    CRISIS: 0.0,
  },
  DAILY_MAX_LOSS_PCT: 3.0,      // 3% daily portfolio loss → circuit break
  CACHE_TTL_MS: 5 * 60 * 1000,  // Re-fetch every 5 min
  DRAWDOWN_RESET_HOUR_ET: 9,    // Reset daily at 9 AM ET (pre-market)
} as const

// ─── State ──────────────────────────────────────────────────────────

let cachedRisk: MarketRiskState | null = null
let lastFetchTime = 0

const drawdown: DrawdownTracker = {
  peakEquity: 100_000,
  currentEquity: 100_000,
  dailyPnL: 0,
  dailyMaxLoss: RISK_CONFIG.DAILY_MAX_LOSS_PCT,
  isCircuitBroken: false,
  brokenAt: null,
}

// ─── VIX Fetch ──────────────────────────────────────────────────────

async function fetchVIX(): Promise<number | null> {
  try {
    const res = await fmpApiFetchRaw('/batch-quote', { symbols: '^VIX' })
    if (!res.ok) return null
    const data = await res.json()
    const quotes = Array.isArray(data) ? data : data?.value || []
    const vixQuote = quotes.find((q: Record<string, unknown>) => q.symbol === '^VIX' || q.symbol === 'VIX')
    if (vixQuote && typeof vixQuote.price === 'number') {
      return vixQuote.price
    }
    return null
  } catch (err) {
    logger.warn('Failed to fetch VIX', { module: 'marketRisk', error: err })
    return null
  }
}

// ─── Market Breadth (proxy from gainers/losers) ─────────────────────

async function fetchBreadth(): Promise<number | null> {
  try {
    const [gRes, lRes] = await Promise.all([
      fmpApiFetchRaw('/biggest-gainers', {}),
      fmpApiFetchRaw('/biggest-losers', {}),
    ])
    if (!gRes.ok || !lRes.ok) return null

    const gData = await gRes.json()
    const lData = await lRes.json()

    const gainers = (Array.isArray(gData) ? gData : gData?.value || []).length
    const losers = (Array.isArray(lData) ? lData : lData?.value || []).length
    const total = gainers + losers
    if (total === 0) return 50

    return Math.round((gainers / total) * 100)
  } catch (err) {
    logger.warn('Failed to fetch market breadth', { module: 'marketRisk', error: err })
    return null
  }
}

// ─── Regime Detection ───────────────────────────────────────────────

function detectRegime(vix: number | null, breadth: number | null): MarketRegime {
  const th = RISK_CONFIG.VIX_THRESHOLDS
  const bth = RISK_CONFIG.BREADTH_THRESHOLDS

  // VIX-based primary signal
  if (vix !== null) {
    if (vix >= th.EXTREME) return 'CRISIS'
    if (vix >= th.HIGH) return 'RISK_OFF'

    // Combine with breadth for nuance
    if (breadth !== null) {
      if (vix >= th.MODERATE && breadth < bth.WEAK) return 'RISK_OFF'
      if (vix >= th.MODERATE) return 'CAUTION'
      if (vix < th.LOW && breadth >= bth.STRONG) return 'RISK_ON'
      if (breadth < bth.CRISIS) return 'RISK_OFF'
      if (breadth < bth.WEAK) return 'CAUTION'
    } else {
      if (vix >= th.MODERATE) return 'CAUTION'
    }
    return 'RISK_ON'
  }

  // VIX unavailable — breadth only
  if (breadth !== null) {
    if (breadth < bth.CRISIS) return 'RISK_OFF'
    if (breadth < bth.WEAK) return 'CAUTION'
    return 'RISK_ON'
  }

  // No data → conservative
  return 'CAUTION'
}

function getVixLevel(vix: number | null): MarketRiskState['vixLevel'] {
  if (vix === null) return 'MODERATE'
  const th = RISK_CONFIG.VIX_THRESHOLDS
  if (vix >= th.EXTREME) return 'EXTREME'
  if (vix >= th.HIGH) return 'HIGH'
  if (vix >= th.MODERATE) return 'MODERATE'
  return 'LOW'
}

// ─── Drawdown Circuit Breaker ───────────────────────────────────────

export function updateDrawdown(pnlDelta: number): void {
  drawdown.dailyPnL += pnlDelta
  drawdown.currentEquity += pnlDelta

  if (drawdown.currentEquity > drawdown.peakEquity) {
    drawdown.peakEquity = drawdown.currentEquity
  }

  const lossPct = Math.abs(drawdown.dailyPnL) / drawdown.peakEquity * 100
  if (drawdown.dailyPnL < 0 && lossPct >= drawdown.dailyMaxLoss) {
    drawdown.isCircuitBroken = true
    drawdown.brokenAt = new Date().toISOString()
    logger.error(`DRAWDOWN CIRCUIT BREAKER: Daily loss ${lossPct.toFixed(2)}% >= ${drawdown.dailyMaxLoss}%`, {
      module: 'marketRisk', dailyPnL: drawdown.dailyPnL, peakEquity: drawdown.peakEquity,
    })
  }
}

export function resetDailyDrawdown(): void {
  drawdown.dailyPnL = 0
  drawdown.isCircuitBroken = false
  drawdown.brokenAt = null
}

export function getDrawdownState(): DrawdownTracker {
  return { ...drawdown }
}

// ─── Main API ───────────────────────────────────────────────────────

export async function getMarketRisk(forceRefresh = false): Promise<MarketRiskState> {
  const now = Date.now()

  if (!forceRefresh && cachedRisk && (now - lastFetchTime) < RISK_CONFIG.CACHE_TTL_MS) {
    return { ...cachedRisk, dataAge: now - lastFetchTime }
  }

  const [vix, breadth] = await Promise.all([fetchVIX(), fetchBreadth()])

  const regime = detectRegime(vix, breadth)
  const posSize = RISK_CONFIG.POSITION_SIZE[regime]

  let signalsPaused = false
  let pauseReason: string | null = null

  // Circuit breaker check
  if (drawdown.isCircuitBroken) {
    signalsPaused = true
    pauseReason = `Daily drawdown limit (${RISK_CONFIG.DAILY_MAX_LOSS_PCT}%) exceeded`
  }

  // Regime-based pause
  if (regime === 'CRISIS') {
    signalsPaused = true
    pauseReason = pauseReason || `CRISIS regime: VIX=${vix ?? '?'}`
  }

  const state: MarketRiskState = {
    regime,
    vix,
    vixLevel: getVixLevel(vix),
    breadth,
    drawdownPct: drawdown.peakEquity > 0
      ? Math.abs(Math.min(0, drawdown.dailyPnL)) / drawdown.peakEquity * 100
      : 0,
    signalsPaused,
    pauseReason,
    longAllowed: regime !== 'CRISIS' && !drawdown.isCircuitBroken,
    shortAllowed: regime !== 'CRISIS' && !drawdown.isCircuitBroken,
    positionSizeMultiplier: drawdown.isCircuitBroken ? 0 : posSize,
    timestamp: new Date().toISOString(),
    dataAge: 0,
  }

  cachedRisk = state
  lastFetchTime = now

  logger.info(`Market risk updated: ${regime} | VIX=${vix ?? 'N/A'} | Breadth=${breadth ?? 'N/A'}% | PosSize=${posSize}`, {
    module: 'marketRisk', regime, vix, breadth, signalsPaused,
  })

  return state
}

// ─── API Route Helper ───────────────────────────────────────────────

export function serializeRiskState(state: MarketRiskState) {
  return {
    ...state,
    drawdown: getDrawdownState(),
    config: RISK_CONFIG,
  }
}
