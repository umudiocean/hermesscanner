// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Target & Floor Price Engine
// Europe Terminal: Analyst + DCF + 52W position (no VWAP bands)
// ═══════════════════════════════════════════════════════════════════

export interface EuropePriceTarget {
  targetPrice: number
  floorPrice: number
  targetPct: number
  floorPct: number
  riskReward: number
  zone: PriceZone
  confidence: number
  method: 'hybrid' | 'fundamental' | 'technical'
  /** RULE-P4: floorPrice > targetPrice = nonsensical support/resistance */
  floorAboveTarget?: boolean
}

export type PriceZone = 'BUY_ZONE' | 'ACCUMULATE' | 'NEUTRAL' | 'DISTRIBUTE' | 'SELL_ZONE'

interface EuropeTargetInput {
  price: number
  signal: string
  signalScore: number
  priceTarget?: number
  dcf?: number
  yearHigh?: number
  yearLow?: number
  beta?: number
  altmanZ?: number
  piotroski?: number
}

function computeTarget(input: EuropeTargetInput): number {
  const { price, signal, priceTarget, dcf, yearHigh, yearLow } = input
  if (price <= 0) return price

  const isBullish = signal === 'STRONG' || signal === 'GOOD'
  const isBearish = signal === 'WEAK' || signal === 'BAD'

  const sources: { value: number; weight: number }[] = []

  // Analyst target
  if (priceTarget && priceTarget > 0) {
    let w = 0.4
    const diff = Math.abs(priceTarget - price) / price
    if (diff > 1.0) w = 0.1
    else if (diff > 0.5) w = 0.2
    sources.push({ value: priceTarget, weight: w })
  }

  // DCF
  if (dcf && dcf > 0) {
    const dcfUpside = (dcf - price) / price
    if (Math.abs(dcfUpside) < 3.0) {
      const adj = isBullish ? price + (dcf - price) * 0.5 : isBearish ? price - (price - dcf) * 0.3 : price
      sources.push({ value: adj, weight: 0.25 })
    }
  }

  // 52-week band midpoint / range
  if (yearHigh && yearLow && yearHigh > yearLow) {
    const mid = (yearHigh + yearLow) / 2
    const target = isBullish ? mid + (yearHigh - mid) * 0.6 : isBearish ? mid - (mid - yearLow) * 0.6 : mid
    sources.push({ value: target, weight: 0.25 })
  }

  // Fallback: price * factor
  const fallback = isBullish ? price * 1.08 : isBearish ? price * 0.92 : price
  sources.push({ value: fallback, weight: sources.length === 0 ? 1 : 0.2 })

  const totalW = sources.reduce((s, x) => s + x.weight, 0)
  let result = sources.reduce((s, x) => s + x.value * (x.weight / totalW), 0)
  result = isBullish ? Math.max(result, price * 1.005) : isBearish ? Math.min(result, price * 0.995) : result
  result = Math.max(result, price * 0.5)
  result = Math.min(result, price * 1.5)
  return Math.round(result * 100) / 100
}

function computeFloor(input: EuropeTargetInput): number {
  const { price, signal, dcf, yearLow, beta, altmanZ, piotroski } = input
  if (price <= 0) return price

  const sources: { value: number; weight: number }[] = []

  if (yearLow && yearLow > 0 && yearLow < price) {
    sources.push({ value: yearLow, weight: 0.45 })
  }

  if (dcf && dcf > 0 && dcf * 0.75 < price) {
    sources.push({ value: dcf * 0.75, weight: 0.25 })
  }

  const fallback = price * 0.88
  sources.push({ value: fallback, weight: sources.length === 0 ? 1 : 0.3 })

  const totalW = sources.reduce((s, x) => s + x.weight, 0)
  let result = sources.reduce((s, x) => s + x.value * (x.weight / totalW), 0)

  const b = beta ?? 1.0
  const volMult = Math.max(0.8, Math.min(1.3, 0.7 + b * 0.2))
  result = price - (price - result) * volMult

  let healthMult = 1.0
  if ((altmanZ ?? 3) < 1.8) healthMult = 1.15
  if ((piotroski ?? 5) <= 2) healthMult *= 1.1
  result = price - (price - result) * healthMult

  result = Math.max(result, price * 0.5)
  result = Math.min(result, price * 0.995)
  if (yearLow && result < yearLow * 0.85) result = yearLow * 0.85
  return Math.round(result * 100) / 100
}

function computeZone(price: number, target: number, floor: number): PriceZone {
  if (price <= 0 || target <= 0 || floor <= 0 || target <= floor) return 'NEUTRAL'
  const range = target - floor
  const pos = (price - floor) / range
  if (pos <= 0.15) return 'BUY_ZONE'
  if (pos <= 0.35) return 'ACCUMULATE'
  if (pos <= 0.65) return 'NEUTRAL'
  if (pos <= 0.85) return 'DISTRIBUTE'
  return 'SELL_ZONE'
}

export function computeEuropeTargetFloor(input: EuropeTargetInput): EuropePriceTarget | null {
  if (!input.price || input.price <= 0) return null

  const targetPrice = computeTarget(input)
  const floorPrice = computeFloor(input)
  const targetPct = ((targetPrice - input.price) / input.price) * 100
  const floorPct = ((input.price - floorPrice) / input.price) * 100
  const riskReward = floorPct > 0.01 ? Math.round((Math.abs(targetPct) / floorPct) * 100) / 100 : 99
  const zone = computeZone(input.price, targetPrice, floorPrice)

  let confidence = 35
  if (input.priceTarget) confidence += 20
  if (input.dcf) confidence += 15
  if (input.yearLow) confidence += 10
  if (input.beta) confidence += 5

  const hasFundamental = !!(input.priceTarget || input.dcf)
  const method = hasFundamental ? 'hybrid' : 'technical'
  const floorAboveTarget = floorPrice > targetPrice

  return {
    targetPrice,
    floorPrice,
    floorAboveTarget,
    targetPct: Math.round(targetPct * 100) / 100,
    floorPct: Math.round(floorPct * 100) / 100,
    riskReward,
    zone,
    confidence: Math.min(100, confidence),
    method,
  }
}
