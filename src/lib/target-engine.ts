// ═══════════════════════════════════════════════════════════════════
// HERMES NASDAQ — Target Price & Floor Price Engine
// 6 AI Consensus Implementation (2026-02-19)
//
// NASDAQ: Mean-Reversion VWAP bands + Analyst Targets + DCF
// Server-side only — no proprietary IP in client response
// ═══════════════════════════════════════════════════════════════════

export interface NasdaqPriceTarget {
  targetPrice: number
  floorPrice: number
  targetPct: number       // (target - price) / price * 100
  floorPct: number        // (price - floor) / price * 100
  riskReward: number      // targetPct / floorPct (>1 = favorable)
  zone: PriceZone
  confidence: number      // 0-100
  method: 'hybrid' | 'technical' | 'fundamental'
}

export type PriceZone = 'BUY_ZONE' | 'ACCUMULATE' | 'NEUTRAL' | 'DISTRIBUTE' | 'SELL_ZONE'

interface NasdaqTargetInput {
  price: number
  signalType: string
  score: number
  bands: {
    vwap52w: number
    upperInner: number
    lowerInner: number
    upperOuter: number
    lowerOuter: number
  }
  indicators: {
    rsi: number
    mfi: number
    atr: number
  }
  fmpData?: {
    targetHigh?: number
    targetLow?: number
    targetMedian?: number
    targetConsensus?: number
    dcf?: number
    dcfDiff?: number
    beta?: number
    altmanZ?: number
    piotroski?: number
    riskScore?: number
    yearHigh?: number
    yearLow?: number
    sma200?: number
  }
}

// ─── Target Price ─────────────────────────────────────────────────

function computeTargetPrice(input: NasdaqTargetInput): number {
  const { price, signalType, bands, indicators, fmpData } = input
  if (price <= 0) return price

  const isLong = signalType === 'strong_long' || signalType === 'long'
  const isShort = signalType === 'strong_short' || signalType === 'short'

  // 1. Technical target from VWAP bands (weight: adaptive)
  let techTarget: number
  if (isLong) {
    techTarget = bands.vwap52w + (bands.upperInner - bands.vwap52w) * 0.8
  } else if (isShort) {
    techTarget = bands.vwap52w - (bands.vwap52w - bands.lowerInner) * 0.8
  } else {
    techTarget = bands.vwap52w
  }

  // RSI adjustment: oversold strengthens long target, overbought strengthens short target
  if (isLong && indicators.rsi < 30) {
    techTarget = techTarget + (bands.upperInner - techTarget) * 0.15
  } else if (isShort && indicators.rsi > 70) {
    techTarget = techTarget - (techTarget - bands.lowerInner) * 0.15
  }

  // 2. Analyst consensus target
  let analystTarget: number | null = null
  if (fmpData?.targetConsensus && fmpData.targetConsensus > 0) {
    analystTarget = fmpData.targetConsensus
  } else if (fmpData?.targetMedian && fmpData.targetMedian > 0) {
    analystTarget = fmpData.targetMedian
  }

  // Stale/extreme analyst filter: if target is >100% away from price, reduce weight
  let analystWeight = 0.35
  if (analystTarget) {
    const analystDiff = Math.abs(analystTarget - price) / price
    if (analystDiff > 1.0) analystWeight = 0.10
    else if (analystDiff > 0.5) analystWeight = 0.20
  }

  // 3. DCF-based target
  let dcfTarget: number | null = null
  if (fmpData?.dcf && fmpData.dcf > 0) {
    const dcfUpside = (fmpData.dcf - price) / price
    if (Math.abs(dcfUpside) < 3.0) {
      dcfTarget = isLong
        ? price + (fmpData.dcf - price) * 0.6
        : price - (price - fmpData.dcf) * 0.4
    }
  }

  // Adaptive weighting
  const sources: { value: number; weight: number }[] = [
    { value: techTarget, weight: 0.45 },
  ]

  if (analystTarget !== null) {
    sources.push({ value: analystTarget, weight: analystWeight })
  }
  if (dcfTarget !== null) {
    sources.push({ value: dcfTarget, weight: 0.20 })
  }

  // Normalize weights
  const totalWeight = sources.reduce((s, x) => s + x.weight, 0)
  let blendedTarget = sources.reduce((s, x) => s + x.value * (x.weight / totalWeight), 0)

  // Clamp: target must be in a reasonable range
  if (isLong) {
    blendedTarget = Math.max(blendedTarget, price * 1.005) // min +0.5%
    blendedTarget = Math.min(blendedTarget, price * 1.50)  // max +50%
  } else if (isShort) {
    blendedTarget = Math.min(blendedTarget, price * 0.995) // min -0.5%
    blendedTarget = Math.max(blendedTarget, price * 0.50)  // max -50%
  } else {
    // Neutral: target = VWAP center
    blendedTarget = Math.max(blendedTarget, price * 0.90)
    blendedTarget = Math.min(blendedTarget, price * 1.10)
  }

  return Math.round(blendedTarget * 100) / 100
}

// ─── Floor Price ──────────────────────────────────────────────────

function computeFloorPrice(input: NasdaqTargetInput): number {
  const { price, signalType, bands, indicators, fmpData } = input
  if (price <= 0) return price

  const isLong = signalType === 'strong_long' || signalType === 'long'

  // 1. Technical floor from VWAP lower bands
  let techFloor: number
  if (isLong) {
    techFloor = bands.lowerInner
  } else {
    techFloor = bands.lowerOuter
  }

  // 2. Analyst targetLow
  let analystFloor: number | null = null
  if (fmpData?.targetLow && fmpData.targetLow > 0) {
    const lowDiff = Math.abs(fmpData.targetLow - price) / price
    if (lowDiff < 1.0) {
      analystFloor = fmpData.targetLow
    }
  }

  // 3. DCF discounted floor
  let dcfFloor: number | null = null
  if (fmpData?.dcf && fmpData.dcf > 0) {
    dcfFloor = fmpData.dcf * 0.70 // 30% discount to DCF
    if (dcfFloor > price) dcfFloor = null // DCF floor above price is meaningless
  }

  // 4. 52-week low as absolute floor
  const yearLow = fmpData?.yearLow && fmpData.yearLow > 0 ? fmpData.yearLow : null

  // Adaptive weighting
  const sources: { value: number; weight: number }[] = [
    { value: techFloor, weight: 0.40 },
  ]
  if (analystFloor !== null) sources.push({ value: analystFloor, weight: 0.30 })
  if (dcfFloor !== null) sources.push({ value: dcfFloor, weight: 0.15 })
  if (yearLow !== null) sources.push({ value: yearLow, weight: 0.15 })

  const totalWeight = sources.reduce((s, x) => s + x.weight, 0)
  let blendedFloor = sources.reduce((s, x) => s + x.value * (x.weight / totalWeight), 0)

  // Volatility adjustment via beta
  const beta = fmpData?.beta ?? 1.0
  const volMultiplier = Math.max(0.8, Math.min(1.4, 0.7 + beta * 0.3))
  blendedFloor = price - (price - blendedFloor) * volMultiplier

  // Fundamental health penalty
  let healthPenalty = 1.0
  const altmanZ = fmpData?.altmanZ ?? 3.0
  if (altmanZ < 1.1) healthPenalty = 1.4       // distress: widen floor
  else if (altmanZ < 1.8) healthPenalty = 1.2   // grey zone
  else if (altmanZ < 3.0) healthPenalty = 1.05

  const piotroski = fmpData?.piotroski ?? 5
  if (piotroski <= 2) healthPenalty *= 1.15

  blendedFloor = price - (price - blendedFloor) * healthPenalty

  // Clamp
  blendedFloor = Math.max(blendedFloor, price * 0.50)  // max -50%
  blendedFloor = Math.min(blendedFloor, price * 0.995)  // min -0.5%

  // Year low absolute floor (floor can't be below 52-week low unless extreme)
  if (yearLow && blendedFloor < yearLow * 0.85) {
    blendedFloor = yearLow * 0.85
  }

  return Math.round(blendedFloor * 100) / 100
}

// ─── Zone Detection ───────────────────────────────────────────────

function computeZone(price: number, target: number, floor: number): PriceZone {
  if (price <= 0 || target <= 0 || floor <= 0) return 'NEUTRAL'
  const range = target - floor
  if (range <= 0) return 'NEUTRAL'

  const position = (price - floor) / range // 0 = at floor, 1 = at target

  if (position <= 0.15) return 'BUY_ZONE'
  if (position <= 0.35) return 'ACCUMULATE'
  if (position <= 0.65) return 'NEUTRAL'
  if (position <= 0.85) return 'DISTRIBUTE'
  return 'SELL_ZONE'
}

// ─── Confidence ───────────────────────────────────────────────────

function computeConfidence(input: NasdaqTargetInput): number {
  let score = 40 // base

  // Data coverage
  if (input.fmpData?.targetConsensus || input.fmpData?.targetMedian) score += 15
  if (input.fmpData?.dcf && input.fmpData.dcf > 0) score += 10
  if (input.fmpData?.targetLow && input.fmpData.targetLow > 0) score += 10
  if (input.fmpData?.yearLow && input.fmpData.yearLow > 0) score += 5
  if (input.fmpData?.beta) score += 5
  if (input.fmpData?.altmanZ) score += 5

  // Signal strength bonus
  const st = input.signalType
  if (st === 'strong_long' || st === 'strong_short') score += 10
  else if (st === 'long' || st === 'short') score += 5

  return Math.min(100, Math.max(10, score))
}

// ─── Main Export ──────────────────────────────────────────────────

export function computeNasdaqTargetFloor(input: NasdaqTargetInput): NasdaqPriceTarget | null {
  if (!input.price || input.price <= 0) return null
  if (!input.bands || input.bands.vwap52w <= 0) return null

  const targetPrice = computeTargetPrice(input)
  const floorPrice = computeFloorPrice(input)

  const targetPct = ((targetPrice - input.price) / input.price) * 100
  const floorPct = ((input.price - floorPrice) / input.price) * 100

  const riskReward = floorPct > 0.01
    ? Math.round((Math.abs(targetPct) / floorPct) * 100) / 100
    : 99

  const zone = computeZone(input.price, targetPrice, floorPrice)
  const confidence = computeConfidence(input)

  const hasFundamental = !!(input.fmpData?.targetConsensus || input.fmpData?.dcf)
  const method = hasFundamental ? 'hybrid' : 'technical'

  return {
    targetPrice,
    floorPrice,
    targetPct: Math.round(targetPct * 100) / 100,
    floorPct: Math.round(floorPct * 100) / 100,
    riskReward,
    zone,
    confidence,
    method,
  }
}
