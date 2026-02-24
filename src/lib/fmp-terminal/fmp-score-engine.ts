// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL — FMP Score Engine V5
// 8-Category Scoring (Smart Money = Insider+Inst+Congress merged)
// V5: Valuation V2, Sektor Altman Z, Z=0 Fallback, Overvaluation Motor
//     3D Confidence, Badge System, 52W Position, P/S Z-Score
// ═══════════════════════════════════════════════════════════════════

import {
  FMPScore, FMPScoreBreakdown, FMPScoreLevel, RedFlag,
  ScoreThresholds, getScoreLevel, FIXED_SCORE_THRESHOLDS,
  StockBadge, BadgeType, OvervaluationResult,
} from './fmp-types'

// ═══════════════════════════════════════════════════════════════════
// WEIGHTS V5 (8 Category — Sprint 1+2+3 Konsensus)
// Smart Money = Insider + Institutional + Congressional birlesti
// ═══════════════════════════════════════════════════════════════════

const WEIGHTS = {
  valuation: 0.22,
  health: 0.20,
  growth: 0.14,
  analyst: 0.11,
  quality: 0.12,
  momentum: 0.11,
  sector: 0.05,
  smartMoney: 0.05,
} as const

// ═══════════════════════════════════════════════════════════════════
// INPUT DATA TYPES — V5 Extended
// ═══════════════════════════════════════════════════════════════════

export interface ScoreInputMetrics {
  symbol: string
  sector: string
  // Valuation
  pe: number
  pb: number
  evEbitda: number
  dcf: number
  price: number
  pegRatio: number
  pfcf: number
  priceToSales: number       // V5: P/S ratio
  yearHigh: number           // V5: 52-week high
  yearLow: number            // V5: 52-week low
  // Health
  altmanZ: number
  piotroski: number
  debtEquity: number
  currentRatio: number
  interestCoverage: number
  fcfPerShare: number
  // Growth
  revenueGrowth: number
  epsGrowth: number
  netIncomeGrowth: number
  // Analyst
  analystConsensus: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  priceTarget: number
  epsRevision30d: number      // Analyst EPS revision %, 30d
  epsRevision90d: number      // Analyst EPS revision %, 90d
  analystRevisionCount: number // Analyst estimate coverage count
  // Insider
  insiderNetBuys: number
  insiderNetValue: number
  cSuiteBuying: boolean
  clusterBuy: boolean
  // Institutional
  institutionalOwnership: number
  institutionalChange: number
  newPositions: number
  // Sector
  sectorPerformance1M: number
  // Congressional
  congressNetBuys: number
  congressMultiple: boolean
  // Momentum
  priceChange1M: number
  priceChange6M: number
  volumeRatio: number
  // Quality
  roic: number
  grossMargin: number
  fcfToNetIncome: number
  // Earnings Surprises — V5
  earningsBeatCount: number   // son 4Q'da kac kez beat
  earningsMissCount: number   // son 4Q'da kac kez miss
  lastEpsSurprise: number     // son ceyrek surprise %
  // Short Interest — V5
  shortFloat: number          // short interest % of float
  // Meta
  changePercent: number
  marketCap: number
  beta: number
  indexMembership: string[]
  etfExposureCount: number
  employeeGrowth: number
}

// ═══════════════════════════════════════════════════════════════════
// SECTOR PEER DATA
// ═══════════════════════════════════════════════════════════════════

export interface SectorPeerData {
  peValues: number[]
  pbValues: number[]
  evEbitdaValues: number[]
  psValues: number[]          // V5: P/S per sector
  roeValues: number[]
  debtEquityValues: number[]
  revenueGrowthValues: number[]
  sectorMedianPE: number
}

// ═══════════════════════════════════════════════════════════════════
// MATH HELPERS
// ═══════════════════════════════════════════════════════════════════

function percentileRank(value: number, values: number[], lowerIsBetter: boolean = false): number {
  if (values.length === 0) return 50
  const sorted = [...values].filter(v => isFinite(v) && v !== 0).sort((a, b) => a - b)
  if (sorted.length < 3) return 50
  const p01 = sorted[Math.floor(sorted.length * 0.01)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]
  const clipped = Math.max(p01, Math.min(p99, value))
  const below = sorted.filter(v => v < clipped).length
  const pct = (below / sorted.length) * 100
  return lowerIsBetter ? (100 - pct) : pct
}

function sigmoid(value: number, center: number, steepness: number): number {
  return 100 / (1 + Math.exp(-steepness * (value - center)))
}

function piecewise(value: number, breakpoints: [number, number][]): number {
  if (breakpoints.length === 0) return 50
  if (value <= breakpoints[0][0]) return breakpoints[0][1]
  if (value >= breakpoints[breakpoints.length - 1][0]) return breakpoints[breakpoints.length - 1][1]
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [x0, y0] = breakpoints[i]
    const [x1, y1] = breakpoints[i + 1]
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return 50
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

// ═══════════════════════════════════════════════════════════════════
// SECTOR-SPECIFIC ALTMAN Z THRESHOLDS
// Finance/REIT uses different thresholds, Growth companies tolerate lower Z
// ═══════════════════════════════════════════════════════════════════

const FINANCE_SECTORS = ['Financial Services', 'Financials', 'Financial', 'Banks', 'Insurance']
const REIT_SECTORS = ['Real Estate', 'REIT', 'REITs']
const GROWTH_SECTORS = ['Technology', 'Communication Services', 'Healthcare', 'Biotechnology']

function getAltmanZScore(z: number, sector: string, m: ScoreInputMetrics): { score: number; method: string } {
  if (z === 0 || !isFinite(z)) {
    const quickHealth = (
      (m.currentRatio > 1 ? 25 : m.currentRatio > 0.5 ? 10 : 0) +
      (m.debtEquity >= 0 && m.debtEquity < 2 ? 25 : m.debtEquity < 4 ? 10 : 0) +
      (m.interestCoverage > 3 ? 25 : m.interestCoverage > 1 ? 10 : 0) +
      (m.fcfPerShare > 0 ? 25 : 0)
    )
    return { score: quickHealth, method: 'FALLBACK' }
  }

  if (FINANCE_SECTORS.some(s => sector.includes(s))) {
    return {
      score: piecewise(z, [[0, 5], [0.5, 15], [1.0, 35], [1.5, 55], [2.0, 75], [3.0, 90], [5.0, 100]]),
      method: 'FINANCE',
    }
  }

  if (REIT_SECTORS.some(s => sector.includes(s))) {
    return {
      score: piecewise(z, [[0, 5], [0.3, 20], [0.8, 40], [1.2, 60], [2.0, 80], [3.0, 95], [5.0, 100]]),
      method: 'REIT',
    }
  }

  if (GROWTH_SECTORS.some(s => sector.includes(s))) {
    return {
      score: piecewise(z, [[0, 0], [0.8, 10], [1.5, 30], [2.5, 60], [4.0, 85], [6.0, 95], [10, 100]]),
      method: 'GROWTH',
    }
  }

  return {
    score: piecewise(z, [[0, 0], [1.1, 10], [1.8, 30], [3.0, 70], [5.0, 95], [10, 100]]),
    method: 'STANDARD',
  }
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORY SCORERS — V5
// ═══════════════════════════════════════════════════════════════════

function scoreValuation(m: ScoreInputMetrics, peers: SectorPeerData | null): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 8

  // 1. P/E vs sector percentile (15%)
  if (m.pe > 0 && peers && peers.peValues.length > 5) {
    total += percentileRank(m.pe, peers.peValues, true)
    dataPoints++
  } else if (m.pe > 0) {
    total += sigmoid(m.pe, 25, -0.1)
    dataPoints++
  }

  // 2. P/B vs sector percentile
  if (m.pb > 0 && peers && peers.pbValues.length > 5) {
    total += percentileRank(m.pb, peers.pbValues, true)
    dataPoints++
  } else if (m.pb > 0) {
    total += sigmoid(m.pb, 3, -0.5)
    dataPoints++
  }

  // 3. EV/EBITDA vs sector percentile (10%)
  if (m.evEbitda > 0 && peers && peers.evEbitdaValues.length > 5) {
    total += percentileRank(m.evEbitda, peers.evEbitdaValues, true)
    dataPoints++
  } else if (m.evEbitda > 0) {
    total += sigmoid(m.evEbitda, 15, -0.15)
    dataPoints++
  }

  // 4. DCF Upside with reliability filter (15%)
  if (m.dcf > 0 && m.price > 0) {
    const dcfUpside = ((m.dcf - m.price) / m.price) * 100
    const cappedUpside = Math.max(-100, Math.min(300, dcfUpside))
    let dcfReliability = 1.0
    if (Math.abs(dcfUpside) > 300) dcfReliability = 0.3
    else if (Math.abs(dcfUpside) > 150) dcfReliability = 0.6
    if (m.fcfPerShare < 0) dcfReliability *= 0.5
    const raw = sigmoid(cappedUpside, 0, 0.06)
    total += 50 + (raw - 50) * dcfReliability
    dataPoints++
  }

  // 5. PEG (10%) — with negative growth guard
  if (m.pegRatio > 0 && m.pegRatio < 10 && m.epsGrowth > 0) {
    total += sigmoid(m.pegRatio, 1.5, -1.5)
    dataPoints++
  }

  // 6. FCF Yield (20%) — elevated weight
  if (m.pfcf > 0 && m.pfcf < 200) {
    const fcfYield = 100 / m.pfcf
    total += sigmoid(fcfYield, 4, 0.5)
    dataPoints++
  }

  // 7. 52W Position (15%) — V5 NEW
  if (m.yearHigh > 0 && m.yearLow > 0 && m.price > 0 && m.yearHigh > m.yearLow) {
    const range = m.yearHigh - m.yearLow
    const position = (m.price - m.yearLow) / range
    total += clamp(100 - position * 100)
    dataPoints++
  }

  // 8. P/S Sector Z-Score (10%) — V5 NEW
  if (m.priceToSales > 0 && peers && peers.psValues.length > 5) {
    total += percentileRank(m.priceToSales, peers.psValues, true)
    dataPoints++
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: clamp(score), dataPoints, maxPoints }
}

function scoreHealth(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number; redFlags: RedFlag[] } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 6
  const redFlags: RedFlag[] = []

  // 1. Altman Z — sector-aware
  const zResult = getAltmanZScore(m.altmanZ, m.sector, m)
  total += zResult.score
  dataPoints++
  if (m.altmanZ > 0 && m.altmanZ < 1.8 && zResult.method === 'STANDARD') {
    redFlags.push({
      severity: 'critical', category: 'health',
      message: `Altman Z-Score ${m.altmanZ.toFixed(2)} < 1.8 — Iflas riski bolgesi`,
      value: m.altmanZ,
    })
  }

  // 2. Piotroski F-Score
  if (m.piotroski > 0) {
    total += piecewise(m.piotroski, [[0, 0], [2, 15], [4, 40], [6, 65], [7, 80], [8, 92], [9, 100]])
    dataPoints++
  }

  // 3. D/E
  if (m.debtEquity >= 0) {
    total += sigmoid(m.debtEquity, 1.5, -1.0)
    dataPoints++
    if (m.debtEquity > 5) {
      redFlags.push({ severity: 'warning', category: 'health', message: `Borc/Ozkaynak ${m.debtEquity.toFixed(2)} > 5 — Asiri borclu`, value: m.debtEquity })
    }
  }

  // 4. Current Ratio
  if (m.currentRatio > 0) {
    const dist = Math.abs(m.currentRatio - 2.0)
    total += Math.max(0, 100 - dist * 25)
    dataPoints++
  }

  // 5. Interest Coverage
  if (m.interestCoverage !== 0) {
    total += piecewise(m.interestCoverage, [[-5, 0], [0, 5], [2, 25], [5, 55], [10, 80], [20, 95], [50, 100]])
    dataPoints++
  }

  // 6. FCF Per Share
  if (m.fcfPerShare !== 0) {
    total += m.fcfPerShare > 0 ? Math.min(100, 50 + m.fcfPerShare * 5) : Math.max(0, 50 + m.fcfPerShare * 10)
    dataPoints++
    if (m.fcfPerShare < 0) {
      redFlags.push({ severity: 'warning', category: 'health', message: `FCF negatif ($${m.fcfPerShare.toFixed(2)}/pay) — Nakit yakiyor`, value: m.fcfPerShare })
    }
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: clamp(score), dataPoints, maxPoints, redFlags }
}

function scoreGrowth(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 3
  const hasGrowthData = m.revenueGrowth !== 0 || m.epsGrowth !== 0 || m.netIncomeGrowth !== 0
  if (hasGrowthData) {
    if (isFinite(m.revenueGrowth)) { total += sigmoid(m.revenueGrowth, 10, 0.08); dataPoints++ }
    if (isFinite(m.epsGrowth)) { total += sigmoid(m.epsGrowth, 15, 0.06); dataPoints++ }
    if (isFinite(m.netIncomeGrowth)) { total += sigmoid(m.netIncomeGrowth, 10, 0.06); dataPoints++ }
  }
  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: clamp(score), dataPoints, maxPoints }
}

function scoreAnalyst(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let weights = 0
  let dataPoints = 0
  const maxPoints = 5
  const totalAnalysts = m.strongBuy + m.buy + m.hold + m.sell + m.strongSell

  // 1) Consensus breadth / direction
  if (totalAnalysts > 0) {
    const buyRatio = (m.strongBuy + m.buy) / totalAnalysts
    total += buyRatio * 100 * 0.25
    weights += 0.25
    dataPoints++
  }

  // 2) Price target upside
  if (m.priceTarget > 0 && m.price > 0) {
    const upside = ((m.priceTarget - m.price) / m.price) * 100
    total += sigmoid(upside, 10, 0.1) * 0.25
    weights += 0.25
    dataPoints++
  }

  // 3) Consensus label
  if (m.analystConsensus) {
    const consensusScores: Record<string, number> = { 'Strong Buy': 95, 'Buy': 75, 'Hold': 50, 'Sell': 25, 'Strong Sell': 5 }
    total += (consensusScores[m.analystConsensus] ?? 50) * 0.15
    weights += 0.15
    dataPoints++
  }

  // 4) EPS revision momentum (30d + 90d)
  if (m.analystRevisionCount > 0) {
    const rev30Score = sigmoid(m.epsRevision30d, 0, 0.35)
    const rev90Score = sigmoid(m.epsRevision90d, 0, 0.22)
    const revisionComposite = rev30Score * 0.65 + rev90Score * 0.35
    total += revisionComposite * 0.30
    weights += 0.30
    dataPoints++
  }

  // 5) Coverage depth (higher analyst count -> slightly higher confidence score)
  if (totalAnalysts > 0) {
    const depthScore = clamp(35 + Math.min(15, totalAnalysts) * 4)
    total += depthScore * 0.05
    weights += 0.05
    dataPoints++
  }

  const score = weights > 0 ? total / weights : 50
  return { score: clamp(score), dataPoints, maxPoints }
}

function scoreQuality(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 3
  if (m.roic !== 0 && isFinite(m.roic)) {
    const roicPct = Math.abs(m.roic) < 1 ? m.roic * 100 : m.roic
    total += sigmoid(roicPct, 12, 0.12)
    dataPoints++
  }
  if (m.grossMargin > 0 && isFinite(m.grossMargin)) {
    const gmPct = m.grossMargin < 1 ? m.grossMargin * 100 : m.grossMargin
    total += sigmoid(gmPct, 40, 0.08)
    dataPoints++
  }
  if (m.fcfToNetIncome !== 0 && isFinite(m.fcfToNetIncome)) {
    total += sigmoid(m.fcfToNetIncome, 0.8, 2.0)
    dataPoints++
  }
  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: clamp(score), dataPoints, maxPoints }
}

function scoreMomentum(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let weights = 0
  let dataPoints = 0
  const maxPoints = 4

  // 1. 1M Price Change (30%)
  if (isFinite(m.priceChange1M)) {
    dataPoints++
    total += sigmoid(m.priceChange1M, 0, 0.15) * 0.30
    weights += 0.30
  }
  // 2. 6M Price Change (30%)
  if (m.priceChange6M !== 0 && isFinite(m.priceChange6M)) {
    dataPoints++
    total += sigmoid(m.priceChange6M, 0, 0.08) * 0.30
    weights += 0.30
  }
  // 3. Volume Ratio (20%)
  if (m.volumeRatio > 0) {
    dataPoints++
    let volScore = 50
    if (m.volumeRatio > 2.0 && m.changePercent > 0) volScore = 85
    else if (m.volumeRatio > 1.5 && m.changePercent > 0) volScore = 75
    else if (m.volumeRatio > 1.5 && m.changePercent < 0) volScore = 25
    else if (m.volumeRatio > 1.0 && m.changePercent > 0) volScore = 60
    else if (m.volumeRatio > 1.0) volScore = 45
    else if (m.volumeRatio > 0.5) volScore = 40
    else volScore = 35
    total += volScore * 0.20
    weights += 0.20
  }
  // 4. 52W Relative Strength (20%) — V5 NEW
  if (m.yearHigh > 0 && m.yearLow > 0 && m.price > 0 && m.yearHigh > m.yearLow) {
    dataPoints++
    const rs = (m.price - m.yearLow) / (m.yearHigh - m.yearLow) * 100
    total += rs * 0.20
    weights += 0.20
  }

  const score = weights > 0 ? total / weights : 50
  return { score: clamp(score), dataPoints, maxPoints }
}

function scoreSector(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  if (isFinite(m.sectorPerformance1M) && m.sectorPerformance1M !== 0) {
    return { score: clamp(sigmoid(m.sectorPerformance1M, 0, 0.3)), dataPoints: 1, maxPoints: 1 }
  }
  return { score: 50, dataPoints: 0, maxPoints: 1 }
}

// Smart Money = Insider + Institutional + Congressional merged
function scoreSmartMoney(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number; redFlags: RedFlag[] } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 6
  const redFlags: RedFlag[] = []

  // Insider signals (weight ~60% of smart money)
  const hasInsider = m.clusterBuy || m.cSuiteBuying || m.insiderNetBuys !== 0 || m.insiderNetValue !== 0
  if (hasInsider) {
    if (m.clusterBuy) { total += 95; dataPoints++ }
    if (m.cSuiteBuying) { total += 90; dataPoints++ }
    if (m.insiderNetBuys !== 0) { total += sigmoid(m.insiderNetBuys, 0, 0.5); dataPoints++ }
    if (m.insiderNetValue !== 0) {
      total += sigmoid(m.insiderNetValue / 1_000_000, 0, 2.0)
      dataPoints++
      if (m.insiderNetValue < -5_000_000) {
        redFlags.push({ severity: 'warning', category: 'smartMoney', message: `Insider net satis: $${(m.insiderNetValue / 1_000_000).toFixed(1)}M`, value: m.insiderNetValue })
      }
    }
  }

  // Institutional signals
  if (m.institutionalOwnership > 0 || m.institutionalChange !== 0 || m.newPositions > 0) {
    if (m.institutionalOwnership > 0) {
      if (m.institutionalOwnership >= 30 && m.institutionalOwnership <= 80) total += 70 + (1 - Math.abs(m.institutionalOwnership - 55) / 25) * 30
      else if (m.institutionalOwnership > 80) total += 45
      else total += 30
      dataPoints++
    }
  }

  // Congressional
  if (m.congressNetBuys !== 0 || m.congressMultiple) {
    let cScore = 50
    if (m.congressNetBuys !== 0) cScore = sigmoid(m.congressNetBuys, 0, 1.0)
    if (m.congressMultiple) cScore = Math.min(100, cScore + 20)
    total += cScore
    dataPoints++
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: clamp(score), dataPoints, maxPoints, redFlags }
}

// ═══════════════════════════════════════════════════════════════════
// OVERVALUATION SCORE (0-100) — V5 Short Signal Motor
// 0 = Not overvalued, 100 = Extremely overvalued
// ═══════════════════════════════════════════════════════════════════

export function computeOvervaluationScore(m: ScoreInputMetrics, valuationScore: number): OvervaluationResult {
  let score = 0
  const triggers: string[] = []

  // 1. Valuation inverse (35%) — high valuation = high overval
  const valInverse = clamp(100 - valuationScore)
  score += valInverse * 0.35
  if (valuationScore < 30) triggers.push('PAHALI_DEGERLEME')

  // 2. Momentum breakdown (25%): 6M up + 1M down = reversal risk
  if (m.priceChange6M > 20 && m.priceChange1M < -5) {
    score += 80 * 0.25
    triggers.push('MOMENTUM_KIRILMA')
  } else if (m.priceChange6M > 10 && m.priceChange1M < 0) {
    score += 55 * 0.25
    triggers.push('MOMENTUM_ZAYIFLAMA')
  } else {
    const momRisk = clamp(50 + (m.priceChange6M - 10) * 2 - m.priceChange1M * 3)
    score += momRisk * 0.25
  }

  // 3. Earnings miss (15%)
  if (m.earningsMissCount >= 2) {
    score += 85 * 0.15
    triggers.push('KAZANC_MISS_2Q+')
  } else if (m.earningsMissCount >= 1 && m.lastEpsSurprise < -5) {
    score += 65 * 0.15
    triggers.push('KAZANC_MISS')
  } else {
    score += (50 - m.earningsBeatCount * 10) * 0.15
  }

  // 4. Insider selling (15%)
  if (m.insiderNetValue < -2_000_000 && !m.cSuiteBuying) {
    score += 80 * 0.15
    triggers.push('INSIDER_SATIS')
  } else if (m.insiderNetBuys < -3) {
    score += 65 * 0.15
    triggers.push('INSIDER_NET_SATIS')
  } else {
    score += clamp(50 - m.insiderNetBuys * 10) * 0.15
  }

  // 5. Short float (10%) — high SI but SQUEEZE GUARD
  if (m.shortFloat > 10) {
    score += clamp(50 + (m.shortFloat - 10) * 5) * 0.10
    if (m.shortFloat > 20) triggers.push('YUKSEK_SHORT_FLOAT')
  } else {
    score += 30 * 0.10
  }

  const total = clamp(Math.round(score))
  let level: OvervaluationResult['level'] = 'LOW'
  if (total >= 70) level = 'EXTREME'
  else if (total >= 50) level = 'HIGH'
  else if (total >= 30) level = 'MEDIUM'

  return { score: total, level, triggers }
}

// ═══════════════════════════════════════════════════════════════════
// BADGE SYSTEM — V5
// ═══════════════════════════════════════════════════════════════════

export function computeBadges(m: ScoreInputMetrics, valuationScore: number, overval: OvervaluationResult): StockBadge[] {
  const badges: StockBadge[] = []

  // KAZANC GUCLU: son 4Q'da 3+ beat
  if (m.earningsBeatCount >= 3) {
    badges.push({ type: 'KAZANC_GUCLU', label: 'KAZANC GUCLU', color: 'emerald', tooltip: `Son 4Q: ${m.earningsBeatCount}x beat` })
  }
  if (m.earningsMissCount >= 2) {
    badges.push({ type: 'KAZANC_ZAYIF', label: 'KAZANC ZAYIF', color: 'red', tooltip: `Son 4Q: ${m.earningsMissCount}x miss` })
  }

  // AKIN VAR: volume > 2x + meaningful move
  if (m.volumeRatio > 2.0 && Math.abs(m.changePercent) > 3) {
    if (m.changePercent > 0) {
      badges.push({ type: 'AKIN_YUKSELIS', label: 'AKIN YUKSELIS', color: 'emerald', tooltip: `Hacim ${m.volumeRatio.toFixed(1)}x + ${m.changePercent.toFixed(1)}%` })
    } else {
      badges.push({ type: 'AKIN_DUSUS', label: 'AKIN DUSUS', color: 'red', tooltip: `Hacim ${m.volumeRatio.toFixed(1)}x + ${m.changePercent.toFixed(1)}%` })
    }
  }

  // BUBBLE RISKI
  if (overval.level === 'EXTREME' && m.yearHigh > 0 && m.price > 0) {
    const nearHigh = (m.price / m.yearHigh) > 0.9
    if (nearHigh) {
      badges.push({ type: 'BUBBLE_RISKI', label: 'BUBBLE RISKI', color: 'red', tooltip: '52W tepe yakini + asiri degerlenmis' })
    }
  }

  // SQUEEZE RISKI: short > 20% + son 5g yukselis
  if (m.shortFloat > 20 && m.priceChange1M > 5) {
    badges.push({ type: 'SQUEEZE_RISKI', label: 'SQUEEZE RISKI', color: 'amber', tooltip: `Short Float ${m.shortFloat.toFixed(1)}% + yukselis trendi` })
  }

  // HEDEF: analyst target vs price
  if (m.priceTarget > 0 && m.price > 0) {
    const targetUpside = ((m.priceTarget - m.price) / m.price) * 100
    if (targetUpside > 30) {
      badges.push({ type: 'HEDEF_YUKARI', label: 'HEDEF +' + Math.round(targetUpside) + '%', color: 'emerald', tooltip: `Analist hedef: $${m.priceTarget.toFixed(0)}` })
    }
    if (targetUpside < -15) {
      badges.push({ type: 'HEDEF_ASAGI', label: 'HEDEF ' + Math.round(targetUpside) + '%', color: 'red', tooltip: `Analist hedef: $${m.priceTarget.toFixed(0)}` })
    }
  }

  // MOAT: Gross Margin > 50% + ROIC > 15%
  const gmPct = m.grossMargin < 1 ? m.grossMargin * 100 : m.grossMargin
  const roicPct = Math.abs(m.roic) < 1 ? m.roic * 100 : m.roic
  if (gmPct > 60 && roicPct > 20) {
    badges.push({ type: 'GENIS_MOAT', label: 'GENIS MOAT', color: 'violet', tooltip: `GM ${gmPct.toFixed(0)}% + ROIC ${roicPct.toFixed(0)}%` })
  } else if (gmPct > 50 && roicPct > 15) {
    badges.push({ type: 'DAR_MOAT', label: 'DAR MOAT', color: 'blue', tooltip: `GM ${gmPct.toFixed(0)}% + ROIC ${roicPct.toFixed(0)}%` })
  }

  // VALUE TRAP: ucuz fiyat ama saglik kotu
  if (valuationScore >= 65 && m.altmanZ > 0 && m.altmanZ < 1.8 && m.fcfPerShare < 0) {
    badges.push({ type: 'VALUE_TRAP', label: 'VALUE TRAP', color: 'orange', tooltip: 'Ucuz gorunuyor ama saglik zayif + FCF negatif' })
  }

  return badges
}

// ═══════════════════════════════════════════════════════════════════
// 3D CONFIDENCE SCORE — V5
// Coverage (40%) + Consistency (35%) + Freshness (25%)
// ═══════════════════════════════════════════════════════════════════

function compute3DConfidence(cats: { dp: number; mp: number; score: number }[], m: ScoreInputMetrics): number {
  // Coverage: veri olan kategorilerin dp/mp ortalamasi
  let totalDp = 0, totalMp = 0
  for (const cat of cats) {
    if (cat.dp > 0) { totalDp += cat.dp; totalMp += cat.mp }
  }
  const coverage = totalMp > 0 ? (totalDp / totalMp) * 100 : 30

  // Consistency: critical data points (pe, altmanZ, analyst, price)
  let criticalPresent = 0
  const criticalTotal = 5
  if (m.pe > 0) criticalPresent++
  if (m.altmanZ !== 0) criticalPresent++
  if (m.analystConsensus) criticalPresent++
  if (m.price > 0) criticalPresent++
  if (m.revenueGrowth !== 0 || m.epsGrowth !== 0) criticalPresent++
  const consistency = (criticalPresent / criticalTotal) * 100

  // Freshness: assume data is fresh if we have recent quote data
  const freshness = m.price > 0 && m.marketCap > 0 ? 80 : 40

  const final = coverage * 0.40 + consistency * 0.35 + freshness * 0.25
  return clamp(Math.round(final), 30, 100)
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION — V5
// ═══════════════════════════════════════════════════════════════════

export function computeFMPScore(
  metrics: ScoreInputMetrics,
  sectorPeers: SectorPeerData | null = null,
  thresholds?: ScoreThresholds,
): FMPScore {
  const val = scoreValuation(metrics, sectorPeers)
  const hlt = scoreHealth(metrics)
  const grw = scoreGrowth(metrics)
  const anl = scoreAnalyst(metrics)
  const qlt = scoreQuality(metrics)
  const mom = scoreMomentum(metrics)
  const sec = scoreSector(metrics)
  const sm = scoreSmartMoney(metrics)

  const categories: FMPScoreBreakdown = {
    valuation: Math.round(val.score),
    health: Math.round(hlt.score),
    growth: Math.round(grw.score),
    analyst: Math.round(anl.score),
    quality: Math.round(qlt.score),
    momentum: Math.round(mom.score),
    sector: Math.round(sec.score),
    smartMoney: Math.round(sm.score),
  }

  interface CatEntry { key: keyof typeof WEIGHTS; score: number; dp: number }
  const catEntries: CatEntry[] = [
    { key: 'valuation', score: categories.valuation, dp: val.dataPoints },
    { key: 'health', score: categories.health, dp: hlt.dataPoints },
    { key: 'growth', score: categories.growth, dp: grw.dataPoints },
    { key: 'analyst', score: categories.analyst, dp: anl.dataPoints },
    { key: 'quality', score: categories.quality, dp: qlt.dataPoints },
    { key: 'momentum', score: categories.momentum, dp: mom.dataPoints },
    { key: 'sector', score: categories.sector, dp: sec.dataPoints },
    { key: 'smartMoney', score: categories.smartMoney, dp: sm.dataPoints },
  ]

  const withData = catEntries.filter(c => c.dp > 0)
  const totalActiveWeight = withData.reduce((sum, c) => sum + WEIGHTS[c.key], 0)

  let total: number
  if (totalActiveWeight > 0) {
    const rawTotal = withData.reduce((sum, c) => {
      const normalizedWeight = WEIGHTS[c.key] / totalActiveWeight
      return sum + c.score * normalizedWeight
    }, 0)
    const dataRatio = withData.length / catEntries.length
    const stretchFactor = 1.0 + dataRatio * 0.5
    total = 50 + (rawTotal - 50) * stretchFactor
  } else {
    total = 50
  }

  const redFlags: RedFlag[] = [...hlt.redFlags, ...sm.redFlags]

  // Red flag for Altman Z (only report, not gate)
  if (metrics.altmanZ > 0 && metrics.altmanZ < 1.8 && !FINANCE_SECTORS.some(s => metrics.sector.includes(s)) && !REIT_SECTORS.some(s => metrics.sector.includes(s))) {
    const exists = redFlags.some(r => r.category === 'health' && r.message.includes('Altman'))
    if (!exists) {
      redFlags.push({ severity: 'critical', category: 'health', message: `Altman Z-Score ${metrics.altmanZ.toFixed(2)} < 1.8 — Iflas riski bolgesi`, value: metrics.altmanZ })
    }
  }

  if (metrics.pe < 0) {
    redFlags.push({ severity: 'warning', category: 'valuation', message: 'P/E negatif — sirket zarar ediyor', value: metrics.pe })
  }

  // RULE-Z1/Z2: Altman Z < 1.8 gate — cap total score to 50 (Finance/REIT use sector-specific thresholds)
  const isAltmanDistress = metrics.altmanZ > 0 && metrics.altmanZ < 1.8 &&
    !FINANCE_SECTORS.some(s => metrics.sector.includes(s)) &&
    !REIT_SECTORS.some(s => metrics.sector.includes(s))
  if (isAltmanDistress) {
    total = Math.min(total, 50)
  }

  // RULE-R1/R2: Red flag count cap — multiple red flags must reduce composite score
  if (redFlags.length >= 5) {
    total = Math.min(total, 50)
  } else if (redFlags.length >= 3) {
    total = Math.min(total, 65)
  }

  // 3D Confidence
  const allCats = [
    { dp: val.dataPoints, mp: val.maxPoints, score: val.score },
    { dp: hlt.dataPoints, mp: hlt.maxPoints, score: hlt.score },
    { dp: grw.dataPoints, mp: grw.maxPoints, score: grw.score },
    { dp: anl.dataPoints, mp: anl.maxPoints, score: anl.score },
    { dp: qlt.dataPoints, mp: qlt.maxPoints, score: qlt.score },
    { dp: mom.dataPoints, mp: mom.maxPoints, score: mom.score },
    { dp: sec.dataPoints, mp: sec.maxPoints, score: sec.score },
    { dp: sm.dataPoints, mp: sm.maxPoints, score: sm.score },
  ]
  const confidence = compute3DConfidence(allCats, metrics)

  // NaN guard
  if (!isFinite(total) || isNaN(total)) total = 0
  total = clamp(Math.round(total))

  const level: FMPScoreLevel = getScoreLevel(total, thresholds)
  const isDegraded = confidence < 50

  const missingInputs: string[] = []
  if (val.dataPoints === 0) missingInputs.push('valuation')
  if (hlt.dataPoints === 0) missingInputs.push('health')
  if (grw.dataPoints === 0) missingInputs.push('growth')
  if (anl.dataPoints === 0) missingInputs.push('analyst')
  if (qlt.dataPoints === 0) missingInputs.push('quality')
  if (mom.dataPoints === 0) missingInputs.push('momentum')
  if (sec.dataPoints === 0) missingInputs.push('sector')
  if (sm.dataPoints === 0) missingInputs.push('smartMoney')

  // Overvaluation + Badges
  const overvaluation = computeOvervaluationScore(metrics, categories.valuation)
  const badges = computeBadges(metrics, categories.valuation, overvaluation)

  // Valuation label — category score + DCF/analyst cross-check
  const valS = categories.valuation
  let valuationLabel: 'COK UCUZ' | 'UCUZ' | 'NORMAL' | 'PAHALI' | 'COK PAHALI'
  if (valS >= 80) valuationLabel = 'COK UCUZ'
  else if (valS >= 65) valuationLabel = 'UCUZ'
  else if (valS >= 40) valuationLabel = 'NORMAL'
  else if (valS >= 25) valuationLabel = 'PAHALI'
  else valuationLabel = 'COK PAHALI'

  // Cross-check: DCF + analyst target + 52W position vs price
  // Only boost/lower by ONE step at a time to prevent score-label mismatch
  if (metrics.price > 0) {
    const dcfUpside = metrics.dcf > 0 ? ((metrics.dcf - metrics.price) / metrics.price) * 100 : 0
    const targetUpside = metrics.priceTarget > 0 ? ((metrics.priceTarget - metrics.price) / metrics.price) * 100 : 0
    const pos52w = (metrics.yearHigh > 0 && metrics.yearLow > 0 && metrics.yearHigh > metrics.yearLow)
      ? (metrics.price - metrics.yearLow) / (metrics.yearHigh - metrics.yearLow)
      : 0.5

    // Undervaluation: boost label (max 1 step unless score also supports it)
    const underSignals = [dcfUpside > 40, targetUpside > 30, pos52w < 0.15].filter(Boolean).length
    if (underSignals >= 2) {
      if (valuationLabel === 'COK PAHALI') valuationLabel = 'PAHALI'
      else if (valuationLabel === 'PAHALI') valuationLabel = 'NORMAL'
      else if (valuationLabel === 'NORMAL') valuationLabel = 'UCUZ'
      else if (valuationLabel === 'UCUZ' && underSignals >= 3 && valS >= 55) valuationLabel = 'COK UCUZ'
    }

    // Overvaluation: lower label (max 1 step unless score also supports it)
    const overSignals = [dcfUpside < -30, targetUpside < -20, pos52w > 0.9].filter(Boolean).length
    if (overSignals >= 2) {
      if (valuationLabel === 'COK UCUZ') valuationLabel = 'UCUZ'
      else if (valuationLabel === 'UCUZ') valuationLabel = 'NORMAL'
      else if (valuationLabel === 'NORMAL') valuationLabel = 'PAHALI'
      else if (valuationLabel === 'PAHALI' && overSignals >= 3 && valS <= 30) valuationLabel = 'COK PAHALI'
    }
  }

  return {
    total,
    level,
    categories,
    redFlags,
    confidence,
    gated: isAltmanDistress,
    degraded: isDegraded,
    missingInputs,
    badges,
    overvaluation,
    valuationScore: valS,
    valuationLabel,
    timestamp: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════
// BULK SCORING
// ═══════════════════════════════════════════════════════════════════

export function buildSectorPeerData(
  allMetrics: Map<string, ScoreInputMetrics>
): Map<string, SectorPeerData> {
  const sectorMap = new Map<string, ScoreInputMetrics[]>()
  for (const m of allMetrics.values()) {
    const sector = m.sector || 'Unknown'
    if (!sectorMap.has(sector)) sectorMap.set(sector, [])
    sectorMap.get(sector)!.push(m)
  }

  const result = new Map<string, SectorPeerData>()
  for (const [sector, stocks] of sectorMap) {
    result.set(sector, {
      peValues: stocks.map(s => s.pe).filter(v => v > 0 && isFinite(v)),
      pbValues: stocks.map(s => s.pb).filter(v => v > 0 && isFinite(v)),
      evEbitdaValues: stocks.map(s => s.evEbitda).filter(v => v > 0 && isFinite(v)),
      psValues: stocks.map(s => s.priceToSales).filter(v => v > 0 && isFinite(v)),
      // Sector peer quality baseline should use ROIC/ROE proxy, never P/E.
      roeValues: stocks.map(s => s.roic !== 0 ? s.roic : 0).filter(v => v !== 0 && isFinite(v)),
      debtEquityValues: stocks.map(s => s.debtEquity).filter(v => v >= 0 && isFinite(v)),
      revenueGrowthValues: stocks.map(s => s.revenueGrowth).filter(v => isFinite(v) && v !== 0),
      sectorMedianPE: (() => {
        const sorted = stocks.map(s => s.pe).filter(v => v > 0 && isFinite(v)).sort((a, b) => a - b)
        return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 20
      })(),
    })
  }
  return result
}

export function scoreAllStocks(
  allMetrics: Map<string, ScoreInputMetrics>
): { scores: Map<string, FMPScore>; thresholds: ScoreThresholds } {
  const sectorPeers = buildSectorPeerData(allMetrics)
  const thresholds = FIXED_SCORE_THRESHOLDS
  const results = new Map<string, FMPScore>()
  for (const [symbol, metrics] of allMetrics) {
    const peers = sectorPeers.get(metrics.sector) || null
    results.set(symbol, computeFMPScore(metrics, peers))
  }
  return { scores: results, thresholds }
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT INPUT
// ═══════════════════════════════════════════════════════════════════

export function createDefaultInput(symbol: string, sector: string = 'Unknown'): ScoreInputMetrics {
  return {
    symbol, sector,
    pe: 0, pb: 0, evEbitda: 0, dcf: 0, price: 0, pegRatio: 0, pfcf: 0,
    priceToSales: 0, yearHigh: 0, yearLow: 0,
    altmanZ: 0, piotroski: 0, debtEquity: 0, currentRatio: 0, interestCoverage: 0, fcfPerShare: 0,
    revenueGrowth: 0, epsGrowth: 0, netIncomeGrowth: 0,
    roic: 0, grossMargin: 0, fcfToNetIncome: 0,
    priceChange1M: 0, priceChange6M: 0, volumeRatio: 0,
    analystConsensus: '', strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, priceTarget: 0,
    epsRevision30d: 0, epsRevision90d: 0, analystRevisionCount: 0,
    insiderNetBuys: 0, insiderNetValue: 0, cSuiteBuying: false, clusterBuy: false,
    institutionalOwnership: 0, institutionalChange: 0, newPositions: 0,
    sectorPerformance1M: 0,
    congressNetBuys: 0, congressMultiple: false,
    earningsBeatCount: 0, earningsMissCount: 0, lastEpsSurprise: 0,
    shortFloat: 0,
    changePercent: 0, marketCap: 0, beta: 0,
    indexMembership: [], etfExposureCount: 0, employeeGrowth: 0,
  }
}

// ═══════════════════════════════════════════════════════════════════
// RISK SCORE (0-100)
// ═══════════════════════════════════════════════════════════════════

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME'

export interface RiskScore {
  total: number
  level: RiskLevel
  components: {
    financial: number
    leverage: number
    liquidity: number
    volatility: number
    size: number
    valuation: number
  }
}

export function computeRiskScore(m: ScoreInputMetrics): RiskScore {
  const components = { financial: 50, leverage: 50, liquidity: 50, volatility: 50, size: 50, valuation: 50 }

  if (m.altmanZ > 0) {
    if (m.altmanZ < 1.1) components.financial = 95
    else if (m.altmanZ < 1.8) components.financial = 75
    else if (m.altmanZ < 3.0) components.financial = 40
    else components.financial = 10
  }

  if (m.debtEquity >= 0) {
    if (m.debtEquity > 5) components.leverage = 90
    else if (m.debtEquity > 3) components.leverage = 70
    else if (m.debtEquity > 1.5) components.leverage = 50
    else if (m.debtEquity > 0.5) components.leverage = 30
    else components.leverage = 10
  }

  if (m.currentRatio > 0) {
    if (m.currentRatio < 0.5) components.liquidity = 90
    else if (m.currentRatio < 1.0) components.liquidity = 70
    else if (m.currentRatio < 1.5) components.liquidity = 40
    else components.liquidity = 15
  }

  if (m.beta > 0) {
    if (m.beta > 2.0) components.volatility = 90
    else if (m.beta > 1.5) components.volatility = 65
    else if (m.beta > 1.0) components.volatility = 40
    else if (m.beta > 0.5) components.volatility = 25
    else components.volatility = 10
  }

  if (m.marketCap > 0) {
    if (m.marketCap < 300_000_000) components.size = 85
    else if (m.marketCap < 2_000_000_000) components.size = 60
    else if (m.marketCap < 10_000_000_000) components.size = 40
    else if (m.marketCap < 200_000_000_000) components.size = 20
    else components.size = 10
  }

  if (m.dcf > 0 && m.price > 0) {
    const dcfUpside = ((m.dcf - m.price) / m.price) * 100
    if (dcfUpside < -50) components.valuation = 90
    else if (dcfUpside < -20) components.valuation = 65
    else if (dcfUpside < 0) components.valuation = 40
    else components.valuation = 15
  }

  const total = Math.round(
    components.financial * 0.30 + components.leverage * 0.20 +
    components.liquidity * 0.15 + components.volatility * 0.15 +
    components.size * 0.10 + components.valuation * 0.10
  )

  let level: RiskLevel
  if (total <= 25) level = 'LOW'
  else if (total <= 50) level = 'MODERATE'
  else if (total <= 75) level = 'HIGH'
  else level = 'EXTREME'

  return { total: clamp(total), level, components }
}
