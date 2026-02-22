// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Squeeze Guard v1.0
// HERMES_FIX: SQUEEZE_GUARD_v1 2026-02-19 SEVERITY: CRITICAL
//
// Deterministic, fail-closed, production-grade short squeeze detector.
// Protects all crypto short signals from:
//   1. Perpetual leverage squeeze (funding crowding)
//   2. Momentum ignition / cascade liquidation
//   3. Thin liquidity manipulation
//   4. Volatility expansion traps
//
// RULES:
//   - Pure function, < 1ms per symbol, no async, no API calls
//   - FAIL-CLOSED: missing data → block short
//   - Guard metadata NEVER exposed to client
//   - No bypass, no override, no env flag
// ═══════════════════════════════════════════════════════════════════

export interface SqueezeGuardInput {
  fundingRate: number | undefined
  fundingZScore: number | undefined
  openInterestChange24hPct: number | undefined
  openInterestChange7dPct: number | undefined
  priceChange1hPct: number | undefined
  priceChange4hPct: number | undefined
  priceChange24hPct: number | undefined
  dexLiquidityUSD: number | undefined
  volume24h: number | undefined
  spreadPct: number | undefined
  realizedVolatilityZ: number | undefined
  marketCapRank: number | undefined
  dataFreshnessMinutes: number | undefined
}

export type SqueezeSeverity = 'HIGH' | 'MEDIUM' | 'LOW'

export type SqueezeBlockReason =
  | 'LEVERAGE_CROWDING'
  | 'EXTREME_FUNDING'
  | 'MOMENTUM_IGNITION'
  | 'CROWDING_AND_MOMENTUM'
  | 'LIQUIDITY_RISK'
  | 'VOLATILITY_EXPANSION'
  | 'COMPOSITE_SQUEEZE'
  | 'DATA_INCOMPLETE'
  | 'DATA_STALE'

export interface SqueezeGuardResult {
  blocked: boolean
  reason: SqueezeBlockReason | null
  squeezeScore: number
  severity: SqueezeSeverity
  detectors: {
    crowding: boolean
    momentumIgnition: boolean
    liquidityRisk: boolean
    volExpansion: boolean
  }
}

// Detector weights for composite squeeze score
const DETECTOR_WEIGHTS = {
  crowding: 0.35,
  momentumIgnition: 0.25,
  liquidityRisk: 0.20,
  volExpansion: 0.20,
} as const

// Liquidity thresholds by market cap bucket
function getLiquidityThreshold(mcapRank: number | undefined): number {
  if (mcapRank === undefined) return 10_000_000
  if (mcapRank <= 20) return 10_000_000
  if (mcapRank <= 100) return 2_000_000
  return 500_000
}

function hasRequiredData(input: SqueezeGuardInput): boolean {
  return (
    input.fundingZScore !== undefined &&
    input.openInterestChange24hPct !== undefined &&
    input.priceChange1hPct !== undefined &&
    input.priceChange24hPct !== undefined
  )
}

function detectCrowding(input: SqueezeGuardInput): boolean {
  const fz = input.fundingZScore ?? 0
  const oiChange24h = input.openInterestChange24hPct ?? 0
  return fz > 1.8 && oiChange24h > 12
}

function detectMomentumIgnition(input: SqueezeGuardInput): boolean {
  const p4h = input.priceChange4hPct ?? 0
  const p24h = input.priceChange24hPct ?? 0
  const oi7d = input.openInterestChange7dPct ?? 0
  return p4h > 6 || (p24h > 12 && oi7d > 20)
}

function detectLiquidityRisk(input: SqueezeGuardInput): boolean {
  const liq = input.dexLiquidityUSD
  const spread = input.spreadPct ?? 0
  const threshold = getLiquidityThreshold(input.marketCapRank)

  if (liq !== undefined && liq < threshold) return true
  if (spread > 0.35) return true
  return false
}

function detectVolExpansion(input: SqueezeGuardInput): boolean {
  const rv = input.realizedVolatilityZ ?? 0
  return rv > 1.5
}

/**
 * Run squeeze guard on a single coin. Pure function, deterministic, < 1ms.
 * FAIL-CLOSED: if critical data is missing, short is blocked.
 */
export function runSqueezeGuard(input: SqueezeGuardInput): SqueezeGuardResult {
  // ─── FAIL-CLOSED: Missing critical data ────────────────────────
  if (!hasRequiredData(input)) {
    return {
      blocked: true,
      reason: 'DATA_INCOMPLETE',
      squeezeScore: 1,
      severity: 'HIGH',
      detectors: { crowding: false, momentumIgnition: false, liquidityRisk: false, volExpansion: false },
    }
  }

  // ─── FAIL-CLOSED: Stale data ──────────────────────────────────
  if (input.dataFreshnessMinutes !== undefined && input.dataFreshnessMinutes > 60) {
    return {
      blocked: true,
      reason: 'DATA_STALE',
      squeezeScore: 1,
      severity: 'HIGH',
      detectors: { crowding: false, momentumIgnition: false, liquidityRisk: false, volExpansion: false },
    }
  }

  // ─── Run all 4 detectors ──────────────────────────────────────
  const crowding = detectCrowding(input)
  const momentumIgnition = detectMomentumIgnition(input)
  const liquidityRisk = detectLiquidityRisk(input)
  const volExpansion = detectVolExpansion(input)

  const detectors = { crowding, momentumIgnition, liquidityRisk, volExpansion }

  // ─── Composite squeeze score (0-1) ────────────────────────────
  const squeezeScore = +(
    DETECTOR_WEIGHTS.crowding * (crowding ? 1 : 0) +
    DETECTOR_WEIGHTS.momentumIgnition * (momentumIgnition ? 1 : 0) +
    DETECTOR_WEIGHTS.liquidityRisk * (liquidityRisk ? 1 : 0) +
    DETECTOR_WEIGHTS.volExpansion * (volExpansion ? 1 : 0)
  ).toFixed(2)

  // ─── BLOCK RULES (any single condition → block) ───────────────

  // Rule 1: Extreme funding alone → immediate block
  const fz = input.fundingZScore ?? 0
  if (fz > 2.3) {
    return { blocked: true, reason: 'EXTREME_FUNDING', squeezeScore, severity: 'HIGH', detectors }
  }

  // Rule 2: Crowding + momentum together → cascade risk
  if (crowding && momentumIgnition) {
    return { blocked: true, reason: 'CROWDING_AND_MOMENTUM', squeezeScore, severity: 'HIGH', detectors }
  }

  // Rule 3: Composite score threshold
  if (squeezeScore >= 0.6) {
    const primaryReason: SqueezeBlockReason = crowding ? 'LEVERAGE_CROWDING'
      : momentumIgnition ? 'MOMENTUM_IGNITION'
      : liquidityRisk ? 'LIQUIDITY_RISK'
      : volExpansion ? 'VOLATILITY_EXPANSION'
      : 'COMPOSITE_SQUEEZE'
    return { blocked: true, reason: primaryReason, squeezeScore, severity: squeezeScore >= 0.8 ? 'HIGH' : 'MEDIUM', detectors }
  }

  // ─── ALLOWED: Low squeeze risk ────────────────────────────────
  const severity: SqueezeSeverity = squeezeScore >= 0.35 ? 'MEDIUM' : 'LOW'
  return { blocked: false, reason: null, squeezeScore, severity, detectors }
}

// ─── Short signal types that must pass through guard ────────────
export const SHORT_SIGNAL_TYPES = [
  'hermes_short', 'alpha_short', 'confluence_sell',
] as const

export type ShortSignalType = typeof SHORT_SIGNAL_TYPES[number]

export function isShortSignal(signalType: string): boolean {
  return SHORT_SIGNAL_TYPES.includes(signalType as ShortSignalType)
}
