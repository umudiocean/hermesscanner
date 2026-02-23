// ═══════════════════════════════════════════════════════════════════
// HERMES CRYPTO — Target Price & Floor Price Engine
// 6 AI Consensus Implementation (2026-02-19)
//
// Crypto: Fibonacci + Fair Value + Momentum + TVL/MCap
// Server-side only — no proprietary IP in client response
// ═══════════════════════════════════════════════════════════════════

export interface CryptoPriceTarget {
  targetPrice: number
  floorPrice: number
  targetPct: number       // (target - price) / price * 100
  floorPct: number        // (price - floor) / price * 100
  riskReward: number      // targetPct / floorPct (>1 = favorable)
  zone: CryptoZone
  confidence: number      // 0-100
  method: string
  /** RULE-P4: floorPrice > targetPrice = nonsensical */
  floorAboveTarget?: boolean
  /** RULE-CR7: fdv < marketCap is mathematically impossible — corrupt API data */
  fdvBelowMcap?: boolean
}

export type CryptoZone = 'BUY_ZONE' | 'ACCUMULATE' | 'NEUTRAL' | 'DISTRIBUTE' | 'SELL_ZONE'

interface CryptoTargetInput {
  price: number
  ath: number
  atl: number
  athChangePct: number          // negative: how far below ATH
  change24h: number
  change7d: number
  change30d: number
  marketCap: number
  fdv: number | null
  tvl: number | null
  volumeToMcap: number
  overvaluationScore: number    // 0-100
  overvaluationLevel: string
  healthScore: number           // 0-100 CHI
  healthLevel: string
  hermesSkor: number            // 0-100 HERMES AI score
  hermesLevel: string
  fundingZScore?: number
}

// Fibonacci levels
const FIB_LEVELS = [0.236, 0.382, 0.500, 0.618, 0.786]

function fibonacciLevels(low: number, high: number): number[] {
  return FIB_LEVELS.map(f => low + (high - low) * f)
}

// ─── Target Price ─────────────────────────────────────────────────

function computeCryptoTarget(input: CryptoTargetInput): number {
  const { price, ath, atl, change7d, change30d, overvaluationScore, healthScore, hermesSkor } = input
  if (price <= 0) return price

  const isBullish = hermesSkor >= 60 || (change7d > 0 && change30d > 0)
  const isBearish = hermesSkor <= 40 || (change7d < 0 && change30d < 0)

  // 1. Fibonacci extension target (weight: 30%)
  let fibTarget = price
  if (ath > 0 && atl > 0 && ath > atl) {
    const fibs = fibonacciLevels(atl, ath)
    if (isBullish) {
      // Find next Fibonacci above current price
      const nextFib = fibs.find(f => f > price * 1.01)
      fibTarget = nextFib ?? ath * 0.9
    } else if (isBearish) {
      // Find next Fibonacci below current price
      const belowFibs = fibs.filter(f => f < price * 0.99).reverse()
      fibTarget = belowFibs[0] ?? price * 0.92
    } else {
      fibTarget = fibs.find(f => Math.abs(f - price) / price < 0.15) ?? price
    }
  }

  // 2. Fair value target (weight: 25%)
  let fairTarget = price
  if (overvaluationScore > 0) {
    if (overvaluationScore >= 70) {
      // Overvalued: target is below price (mean reversion down)
      fairTarget = price * (1 - (overvaluationScore - 50) * 0.004)
    } else if (overvaluationScore <= 30) {
      // Undervalued: target is above price (mean reversion up)
      fairTarget = price * (1 + (50 - overvaluationScore) * 0.005)
    } else {
      fairTarget = price * 1.02 // Slight upward bias for fair-valued
    }
  }

  // 3. Momentum projection (weight: 25%)
  const avgMomentum = (change7d + change30d * 0.3) / 1.3
  let momentumTarget = price * (1 + avgMomentum * 0.003)
  // Cap extreme momentum projections
  momentumTarget = Math.max(momentumTarget, price * 0.70)
  momentumTarget = Math.min(momentumTarget, price * 1.60)

  // 4. TVL/MCap-based value target (weight: 20%)
  let tvlTarget = price
  if (input.tvl && input.tvl > 0 && input.marketCap > 0) {
    const tvlRatio = input.tvl / input.marketCap
    if (tvlRatio > 1.0) {
      tvlTarget = price * Math.min(1.3, 1 + (tvlRatio - 1) * 0.2)
    } else if (tvlRatio < 0.3) {
      tvlTarget = price * Math.max(0.85, 1 - (0.3 - tvlRatio) * 0.3)
    } else {
      tvlTarget = price * 1.01
    }
  }

  // Weighted blend
  const weights = { fib: 0.30, fair: 0.25, mom: 0.25, tvl: 0.20 }
  if (!input.tvl || input.tvl <= 0) {
    weights.fib = 0.35; weights.fair = 0.30; weights.mom = 0.35; weights.tvl = 0
  }

  const totalW = weights.fib + weights.fair + weights.mom + weights.tvl
  let blended = (
    fibTarget * weights.fib +
    fairTarget * weights.fair +
    momentumTarget * weights.mom +
    tvlTarget * weights.tvl
  ) / totalW

  // Health penalty: sick tokens get lower targets
  if (healthScore < 30) {
    blended = price + (blended - price) * 0.5
  } else if (healthScore < 50) {
    blended = price + (blended - price) * 0.75
  }

  // Funding rate z-score contrarian adjustment
  if (input.fundingZScore !== undefined) {
    if (input.fundingZScore > 2) {
      // Extreme long funding: contrarian → reduce target
      blended = price + (blended - price) * 0.8
    } else if (input.fundingZScore < -2) {
      // Extreme short funding: contrarian → boost target
      blended = price + (blended - price) * 1.15
    }
  }

  // Clamp
  if (isBullish || hermesSkor >= 50) {
    blended = Math.max(blended, price * 1.005) // at least +0.5%
    blended = Math.min(blended, ath > 0 ? ath * 1.05 : price * 2.0) // don't exceed ATH+5% unreasonably
  } else if (isBearish) {
    blended = Math.min(blended, price * 0.995) // short target below price
    blended = Math.max(blended, price * 0.50)
  } else {
    blended = Math.max(blended, price * 0.92)
    blended = Math.min(blended, price * 1.15)
  }

  return Math.round(blended * 10000) / 10000 // 4 decimal for crypto
}

// ─── Floor Price ──────────────────────────────────────────────────

function computeCryptoFloor(input: CryptoTargetInput): number {
  const { price, ath, atl, change7d, change30d, overvaluationScore, healthScore, marketCap, fdv } = input
  if (price <= 0) return price

  // 1. Fibonacci support (30%)
  let fibFloor = price * 0.85
  if (ath > 0 && atl > 0 && ath > atl) {
    const fibs = fibonacciLevels(atl, ath)
    const belowFibs = fibs.filter(f => f < price * 0.99).reverse()
    fibFloor = belowFibs[0] ?? atl
  }

  // 2. Fair value discounted floor (25%)
  let fairFloor = price * 0.88
  if (overvaluationScore >= 70) {
    // Overvalued: deeper floor
    fairFloor = price * (1 - overvaluationScore * 0.003)
  } else if (overvaluationScore <= 30) {
    // Undervalued: tighter floor
    fairFloor = price * (1 - (100 - overvaluationScore) * 0.001)
  }

  // 3. Momentum-based floor (25%)
  const avgMom = (change7d + change30d * 0.3) / 1.3
  let momFloor = price * (1.0 + avgMom * 0.003) * 0.92
  momFloor = Math.max(momFloor, price * 0.50)
  momFloor = Math.min(momFloor, price * 0.98)

  // 4. FDV/MCap pressure floor (20%) — RULE-CR7: fdv must be >= marketCap (skip if corrupt)
  let fdvFloor = price * 0.88
  const fdvInvalid = fdv && fdv > 0 && marketCap > 0 && fdv < marketCap
  if (fdv && fdv > 0 && marketCap > 0 && !fdvInvalid) {
    const fdvRatio = fdv / marketCap
    if (fdvRatio > 5) fdvFloor = price * 0.70
    else if (fdvRatio > 3) fdvFloor = price * 0.78
    else if (fdvRatio > 2) fdvFloor = price * 0.84
    else fdvFloor = price * 0.90
  }

  // Weighted blend
  const w = { fib: 0.30, fair: 0.25, mom: 0.25, fdv: 0.20 }
  if (!fdv || fdv <= 0 || fdvInvalid) {
    w.fib = 0.35; w.fair = 0.30; w.mom = 0.35; w.fdv = 0
  }

  const totalW = w.fib + w.fair + w.mom + w.fdv
  let blended = (
    fibFloor * w.fib +
    fairFloor * w.fair +
    momFloor * w.mom +
    fdvFloor * w.fdv
  ) / totalW

  // Health penalty: unhealthy tokens have deeper floors
  if (healthScore < 30) {
    blended = price - (price - blended) * 1.4
  } else if (healthScore < 50) {
    blended = price - (price - blended) * 1.15
  }

  // Funding rate z-score adjustment
  if (input.fundingZScore !== undefined && input.fundingZScore > 2) {
    // Crowded long → deeper floor
    blended = price - (price - blended) * 1.2
  }

  // Clamp
  blended = Math.max(blended, atl > 0 ? atl * 0.85 : price * 0.30)
  blended = Math.min(blended, price * 0.995)

  return Math.round(blended * 10000) / 10000
}

// ─── Zone Detection ───────────────────────────────────────────────

function computeCryptoZone(price: number, target: number, floor: number): CryptoZone {
  if (price <= 0 || target <= 0 || floor <= 0) return 'NEUTRAL'
  const range = target - floor
  if (range <= 0) return 'NEUTRAL'

  const position = (price - floor) / range

  if (position <= 0.15) return 'BUY_ZONE'
  if (position <= 0.35) return 'ACCUMULATE'
  if (position <= 0.65) return 'NEUTRAL'
  if (position <= 0.85) return 'DISTRIBUTE'
  return 'SELL_ZONE'
}

// ─── Confidence ───────────────────────────────────────────────────

function computeCryptoConfidence(input: CryptoTargetInput): number {
  let score = 30

  if (input.ath > 0 && input.atl > 0) score += 15
  if (input.tvl && input.tvl > 0) score += 10
  if (input.fdv && input.fdv > 0) score += 5
  if (input.fundingZScore !== undefined) score += 10
  if (input.overvaluationScore > 0 && input.overvaluationScore < 100) score += 5
  if (input.healthScore > 0) score += 10
  if (input.volumeToMcap > 0.01) score += 5
  if (input.marketCap > 100_000_000) score += 5 // large cap = more reliable

  // Signal strength
  if (input.hermesSkor >= 70 || input.hermesSkor <= 30) score += 5

  return Math.min(100, Math.max(10, score))
}

// ─── Main Export ──────────────────────────────────────────────────

export function computeCryptoTargetFloor(input: CryptoTargetInput): CryptoPriceTarget | null {
  if (!input.price || input.price <= 0) return null

  const targetPrice = computeCryptoTarget(input)
  const floorPrice = computeCryptoFloor(input)
  const floorAboveTarget = floorPrice > targetPrice
  const fdvBelowMcap = !!(input.fdv && input.fdv > 0 && input.marketCap > 0 && input.fdv < input.marketCap)

  const targetPct = ((targetPrice - input.price) / input.price) * 100
  const floorPct = ((input.price - floorPrice) / input.price) * 100

  const riskReward = floorPct > 0.01
    ? Math.round((Math.abs(targetPct) / floorPct) * 100) / 100
    : 99

  const zone = computeCryptoZone(input.price, targetPrice, floorPrice)
  const confidence = computeCryptoConfidence(input)

  const hasTvl = !!(input.tvl && input.tvl > 0)
  const hasFib = input.ath > 0 && input.atl > 0
  const method = hasTvl && hasFib ? 'fibonacci_tvl_hybrid' : hasFib ? 'fibonacci' : 'momentum_fair'

  return {
    targetPrice,
    floorPrice,
    floorAboveTarget,
    fdvBelowMcap: fdvBelowMcap || undefined,
    targetPct: Math.round(targetPct * 100) / 100,
    floorPct: Math.round(floorPct * 100) / 100,
    riskReward,
    zone,
    confidence,
    method,
  }
}
