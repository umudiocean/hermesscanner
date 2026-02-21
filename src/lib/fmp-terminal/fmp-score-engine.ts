// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL — FMP Score Engine V4
// 8-Category Pure Fundamental Scoring (0-100)
// V4: Technical KALDIRILDI (6/6 AI konsensus), 8 kategori
//     Growth birim bugu duzeltildi, Piotroski gate duzeltildi
//     Stretch factor confidence-bazli, Altman Z soft-gate
// ═══════════════════════════════════════════════════════════════════

import {
  FMPScore, FMPScoreBreakdown, FMPScoreLevel, RedFlag,
  ScoreThresholds, getScoreLevel, FIXED_SCORE_THRESHOLDS,
} from './fmp-types'

// ═══════════════════════════════════════════════════════════════════
// WEIGHTS V4 (8 Category — 6 AI Mega Konsensus)
// Technical KALDIRILDI: Trade AI zaten teknik analizi fazlasiyla yapiyor
// Insider/Institutional: bulk veri yoksa adaptive weight=0 (phantom 50 yok)
// ═══════════════════════════════════════════════════════════════════

const WEIGHTS = {
  valuation: 0.20,
  health: 0.19,
  growth: 0.15,
  analyst: 0.11,
  quality: 0.08,
  momentum: 0.08,
  sector: 0.06,
  insider: 0.05,
  institutional: 0.05,
  congressional: 0.03,
} as const

// ═══════════════════════════════════════════════════════════════════
// INPUT DATA TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ScoreInputMetrics {
  symbol: string
  sector: string
  // Valuation
  pe: number           // Price/Earnings TTM
  pb: number           // Price/Book TTM
  evEbitda: number     // EV/EBITDA TTM
  dcf: number          // DCF value
  price: number        // Current price
  pegRatio: number     // PEG Ratio
  pfcf: number         // Price/FCF TTM
  // Health
  altmanZ: number      // Altman Z-Score
  piotroski: number    // Piotroski F-Score (0-9)
  debtEquity: number   // Debt/Equity
  currentRatio: number // Current Ratio
  interestCoverage: number // Interest Coverage
  fcfPerShare: number  // Free Cash Flow per Share
  // Growth
  revenueGrowth: number   // Revenue Growth YoY %
  epsGrowth: number       // EPS Growth YoY %
  netIncomeGrowth: number // Net Income Growth YoY %
  // Analyst
  analystConsensus: string // 'Strong Buy'|'Buy'|'Hold'|'Sell'|'Strong Sell'
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  priceTarget: number     // Consensus price target
  // Insider (pre-aggregated)
  insiderNetBuys: number  // Net insider buys count (6M)
  insiderNetValue: number // Net insider $ value (6M, positive=buys)
  cSuiteBuying: boolean   // CEO/CFO open market purchase
  clusterBuy: boolean     // 3+ insiders buying within 30 days
  // Institutional
  institutionalOwnership: number  // % of shares held
  institutionalChange: number     // QoQ change in %
  newPositions: number            // New institutional positions count
  // Sector
  sectorPerformance1M: number     // Sector 1-month performance %
  // Congressional
  congressNetBuys: number         // Net congressional purchases (6M)
  congressMultiple: boolean       // 2+ different members buying
  // Momentum
  priceChange1M: number           // 1-month price change %
  priceChange6M: number           // 6-month price change %
  volumeRatio: number             // daily volume / avg volume
  // Quality
  roic: number                    // Return on Invested Capital TTM
  grossMargin: number             // Gross Profit Margin TTM (0-1)
  fcfToNetIncome: number          // FCF / Net Income ratio
  // Meta
  changePercent: number           // Daily change %
  marketCap: number
  beta: number
  indexMembership: string[]       // ['SP500', 'NDX100', etc.]
  etfExposureCount: number        // Number of ETFs holding this stock
  employeeGrowth: number          // YoY employee count growth %
}

// ═══════════════════════════════════════════════════════════════════
// SECTOR PEER DATA (for percentile calculation)
// ═══════════════════════════════════════════════════════════════════

export interface SectorPeerData {
  peValues: number[]
  pbValues: number[]
  evEbitdaValues: number[]
  roeValues: number[]
  debtEquityValues: number[]
  revenueGrowthValues: number[]
  sectorMedianPE: number
}

// ═══════════════════════════════════════════════════════════════════
// PERCENTILE CALCULATION (Robust — Winsorized)
// ═══════════════════════════════════════════════════════════════════

/** Calculate percentile rank (0-100) within array. lowerIsBetter reverses. */
function percentileRank(value: number, values: number[], lowerIsBetter: boolean = false): number {
  if (values.length === 0) return 50
  
  // Winsorize: clip to 1st-99th percentile
  const sorted = [...values].filter(v => isFinite(v) && v !== 0).sort((a, b) => a - b)
  if (sorted.length < 3) return 50
  
  const p01 = sorted[Math.floor(sorted.length * 0.01)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]
  const clipped = Math.max(p01, Math.min(p99, value))
  
  // Count how many values are below clipped value
  const below = sorted.filter(v => v < clipped).length
  const pct = (below / sorted.length) * 100
  
  return lowerIsBetter ? (100 - pct) : pct
}

/** Sigmoid smooth mapping for continuous transitions */
function sigmoid(value: number, center: number, steepness: number): number {
  return 100 / (1 + Math.exp(-steepness * (value - center)))
}

/** Piecewise linear mapping */
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

// ═══════════════════════════════════════════════════════════════════
// CATEGORY SCORERS
// ═══════════════════════════════════════════════════════════════════

function scoreValuation(m: ScoreInputMetrics, peers: SectorPeerData | null): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 6

  // 1. P/E vs sector (percentile, lower = better)
  if (m.pe > 0 && peers && peers.peValues.length > 5) {
    total += percentileRank(m.pe, peers.peValues, true)
    dataPoints++
  } else if (m.pe > 0) {
    // Fallback: absolute scoring with sigmoid
    total += sigmoid(m.pe, 25, -0.1) // center 25, lower is better
    dataPoints++
  }

  // 2. P/B vs sector (percentile, lower = better)
  if (m.pb > 0 && peers && peers.pbValues.length > 5) {
    total += percentileRank(m.pb, peers.pbValues, true)
    dataPoints++
  } else if (m.pb > 0) {
    total += sigmoid(m.pb, 3, -0.5)
    dataPoints++
  }

  // 3. EV/EBITDA vs sector (percentile, lower = better)
  if (m.evEbitda > 0 && peers && peers.evEbitdaValues.length > 5) {
    total += percentileRank(m.evEbitda, peers.evEbitdaValues, true)
    dataPoints++
  } else if (m.evEbitda > 0) {
    total += sigmoid(m.evEbitda, 15, -0.15)
    dataPoints++
  }

  // 4. DCF Upside (sigmoid: center at 0%, positive = undervalued)
  if (m.dcf > 0 && m.price > 0) {
    const dcfUpside = ((m.dcf - m.price) / m.price) * 100
    total += sigmoid(dcfUpside, 0, 0.08)
    dataPoints++
  }

  // 5. PEG Ratio (lower = better, growth-adjusted P/E)
  if (m.pegRatio > 0 && m.pegRatio < 10) {
    total += sigmoid(m.pegRatio, 1.5, -1.5)
    dataPoints++
  }

  // 6. Price/FCF (lower = better)
  if (m.pfcf > 0 && m.pfcf < 200) {
    total += sigmoid(m.pfcf, 20, -0.1)
    dataPoints++
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints }
}

function scoreHealth(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number; redFlags: RedFlag[] } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 6
  const redFlags: RedFlag[] = []

  // 1. Altman Z-Score (piecewise — most important health metric)
  if (m.altmanZ !== 0) {
    total += piecewise(m.altmanZ, [
      [0, 0], [1.1, 10], [1.8, 30], [3.0, 70], [5.0, 95], [10, 100]
    ])
    dataPoints++

    // Red flag check
    if (m.altmanZ < 1.8 && m.altmanZ > 0) {
      redFlags.push({
        severity: 'critical',
        category: 'health',
        message: `Altman Z-Score ${m.altmanZ.toFixed(2)} < 1.8 — Iflas riski bolgesi`,
        value: m.altmanZ,
      })
    }
  }

  // 2. Piotroski F-Score (0-9, piecewise)
  // BUG FIX: piotroski >= 0 her zaman true idi (default 0). > 0 olmali.
  if (m.piotroski > 0) {
    total += piecewise(m.piotroski, [
      [0, 0], [2, 15], [4, 40], [6, 65], [7, 80], [8, 92], [9, 100]
    ])
    dataPoints++
  }

  // 3. Debt/Equity (lower = safer, sector context would be ideal)
  if (m.debtEquity >= 0) {
    total += sigmoid(m.debtEquity, 1.5, -1.0)
    dataPoints++

    if (m.debtEquity > 5) {
      redFlags.push({
        severity: 'warning',
        category: 'health',
        message: `Borc/Ozkaynak ${m.debtEquity.toFixed(2)} > 5 — Asiri borclu`,
        value: m.debtEquity,
      })
    }
  }

  // 4. Current Ratio (target 1.5-3.0)
  if (m.currentRatio > 0) {
    // Bell curve: optimal around 2.0
    const dist = Math.abs(m.currentRatio - 2.0)
    total += Math.max(0, 100 - dist * 25)
    dataPoints++
  }

  // 5. Interest Coverage (higher = safer)
  if (m.interestCoverage !== 0) {
    total += piecewise(m.interestCoverage, [
      [-5, 0], [0, 5], [2, 25], [5, 55], [10, 80], [20, 95], [50, 100]
    ])
    dataPoints++
  }

  // 6. FCF Per Share (positive = good)
  if (m.fcfPerShare !== 0) {
    total += m.fcfPerShare > 0 ? Math.min(100, 50 + m.fcfPerShare * 5) : Math.max(0, 50 + m.fcfPerShare * 10)
    dataPoints++

    if (m.fcfPerShare < 0) {
      redFlags.push({
        severity: 'warning',
        category: 'health',
        message: `FCF negatif ($${m.fcfPerShare.toFixed(2)}/pay) — Nakit yakiyor`,
        value: m.fcfPerShare,
      })
    }
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints, redFlags }
}

function scoreGrowth(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 3

  // Check if we have ANY growth data (at least one non-zero)
  const hasGrowthData = m.revenueGrowth !== 0 || m.epsGrowth !== 0 || m.netIncomeGrowth !== 0

  if (hasGrowthData) {
    // 1. Revenue Growth YoY (sigmoid, center 10%)
    if (isFinite(m.revenueGrowth)) {
      total += sigmoid(m.revenueGrowth, 10, 0.08)
      dataPoints++
    }

    // 2. EPS Growth YoY (sigmoid, center 15%)
    if (isFinite(m.epsGrowth)) {
      total += sigmoid(m.epsGrowth, 15, 0.06)
      dataPoints++
    }

    // 3. Net Income Growth YoY
    if (isFinite(m.netIncomeGrowth)) {
      total += sigmoid(m.netIncomeGrowth, 10, 0.06)
      dataPoints++
    }
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints }
}

function scoreAnalyst(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 3

  // 1. Consensus Rating
  const totalAnalysts = m.strongBuy + m.buy + m.hold + m.sell + m.strongSell
  if (totalAnalysts > 0) {
    const buyRatio = (m.strongBuy + m.buy) / totalAnalysts
    total += buyRatio * 100
    dataPoints++
  }

  // 2. Price Target Upside
  if (m.priceTarget > 0 && m.price > 0) {
    const upside = ((m.priceTarget - m.price) / m.price) * 100
    total += sigmoid(upside, 10, 0.1)
    dataPoints++
  }

  // 3. Consensus label
  if (m.analystConsensus) {
    const consensusScores: Record<string, number> = {
      'Strong Buy': 95, 'Buy': 75, 'Hold': 50, 'Sell': 25, 'Strong Sell': 5,
    }
    total += consensusScores[m.analystConsensus] ?? 50
    dataPoints++
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints }
}

function scoreInsider(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number; redFlags: RedFlag[] } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 4
  const redFlags: RedFlag[] = []

  // Check if we have ANY insider data
  const hasInsiderData = m.clusterBuy || m.cSuiteBuying || m.insiderNetBuys !== 0 || m.insiderNetValue !== 0

  if (hasInsiderData) {
    // 1. Cluster buying (strongest signal)
    if (m.clusterBuy) {
      total += 95
      dataPoints++
    }

    // 2. C-Suite buying
    if (m.cSuiteBuying) {
      total += 90
      dataPoints++
    }

    // 3. Net insider buys (count)
    if (m.insiderNetBuys !== 0) {
      total += sigmoid(m.insiderNetBuys, 0, 0.5)
      dataPoints++
    }

    // 4. Net insider value ($)
    if (m.insiderNetValue !== 0) {
      const valInMillions = m.insiderNetValue / 1_000_000
      total += sigmoid(valInMillions, 0, 2.0)
      dataPoints++

      if (m.insiderNetValue < -5_000_000) {
        redFlags.push({
          severity: 'warning',
          category: 'insider',
          message: `Insider net satis: $${(m.insiderNetValue / 1_000_000).toFixed(1)}M`,
          value: m.insiderNetValue,
        })
      }
    }
  }

  // No insider data → score stays 50 (neutral) but dataPoints = 0 → weight redistributed
  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints, redFlags }
}

function scoreInstitutional(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 3

  // Check if we have ANY institutional data
  const hasInstData = m.institutionalOwnership > 0 || m.institutionalChange !== 0 || m.newPositions > 0

  if (hasInstData) {
    // 1. Institutional ownership % (30-80% ideal)
    if (m.institutionalOwnership > 0) {
      if (m.institutionalOwnership >= 30 && m.institutionalOwnership <= 80) {
        total += 70 + (1 - Math.abs(m.institutionalOwnership - 55) / 25) * 30
      } else if (m.institutionalOwnership > 80) {
        total += 45
      } else {
        total += 30
      }
      dataPoints++
    }

    // 2. Quarterly change
    if (m.institutionalChange !== 0) {
      total += sigmoid(m.institutionalChange, 0, 0.5)
      dataPoints++
    }

    // 3. New positions
    if (m.newPositions > 0) {
      total += Math.min(100, 50 + m.newPositions * 5)
      dataPoints++
    }
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints }
}

function scoreSector(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let dataPoints = 0
  const maxPoints = 1

  // Sector 1M performance — even small values count as data
  if (isFinite(m.sectorPerformance1M) && m.sectorPerformance1M !== 0) {
    dataPoints++
    return { score: Math.max(0, Math.min(100, sigmoid(m.sectorPerformance1M, 0, 0.3))), dataPoints, maxPoints }
  }

  return { score: 50, dataPoints: 0, maxPoints }
}

function scoreCongressional(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 50 // Neutral base (most stocks have no congressional activity)
  let dataPoints = 0
  const maxPoints = 2

  // 1. Net buys
  if (m.congressNetBuys !== 0) {
    total = sigmoid(m.congressNetBuys, 0, 1.0)
    dataPoints++
  }

  // 2. Multiple members
  if (m.congressMultiple) {
    total = Math.min(100, total + 20)
    dataPoints++
  }

  return { score: Math.max(0, Math.min(100, total)), dataPoints, maxPoints }
}

// ═══════════════════════════════════════════════════════════════════
// QUALITY SCORE (V5: 8%) — ROIC, Gross Margin, FCF/Net Income
// ═══════════════════════════════════════════════════════════════════

function scoreQuality(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let dataPoints = 0
  const maxPoints = 3

  // 1. ROIC (Return on Invested Capital) — higher is better
  if (m.roic !== 0 && isFinite(m.roic)) {
    const roicPct = Math.abs(m.roic) < 1 ? m.roic * 100 : m.roic
    total += sigmoid(roicPct, 12, 0.12)
    dataPoints++
  }

  // 2. Gross Margin — higher is better (value 0-1 or 0-100)
  if (m.grossMargin > 0 && isFinite(m.grossMargin)) {
    const gmPct = m.grossMargin < 1 ? m.grossMargin * 100 : m.grossMargin
    total += sigmoid(gmPct, 40, 0.08)
    dataPoints++
  }

  // 3. FCF/Net Income ratio — >0.8 = high quality earnings
  if (m.fcfToNetIncome !== 0 && isFinite(m.fcfToNetIncome)) {
    total += sigmoid(m.fcfToNetIncome, 0.8, 2.0)
    dataPoints++
  }

  const score = dataPoints > 0 ? total / dataPoints : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints }
}

// ═══════════════════════════════════════════════════════════════════
// MOMENTUM SCORE (V4: 8%)
// ═══════════════════════════════════════════════════════════════════

function scoreMomentum(m: ScoreInputMetrics): { score: number; dataPoints: number; maxPoints: number } {
  let total = 0
  let weights = 0
  let dataPoints = 0
  const maxPoints = 3

  // 1. Daily/Short-term Price Change (40%)
  if (isFinite(m.priceChange1M)) {
    dataPoints++
    const momScore = sigmoid(m.priceChange1M, 0, 0.15) // positive change = higher score
    total += momScore * 0.40
    weights += 0.40
  }

  // 2. Longer-term Price Change (35%)
  if (m.priceChange6M !== 0 && isFinite(m.priceChange6M)) {
    dataPoints++
    const longMomScore = sigmoid(m.priceChange6M, 0, 0.08)
    total += longMomScore * 0.35
    weights += 0.35
  }

  // 3. Volume Ratio (25%) — volume vs avg volume
  if (m.volumeRatio > 0) {
    dataPoints++
    let volScore = 50
    if (m.volumeRatio > 2.0 && m.changePercent > 0) volScore = 85  // Strong volume + positive
    else if (m.volumeRatio > 1.5 && m.changePercent > 0) volScore = 75
    else if (m.volumeRatio > 1.5 && m.changePercent < 0) volScore = 25 // Strong volume + negative
    else if (m.volumeRatio > 1.0 && m.changePercent > 0) volScore = 60
    else if (m.volumeRatio > 1.0) volScore = 45
    else if (m.volumeRatio > 0.5) volScore = 40
    else volScore = 35  // Very low volume
    total += volScore * 0.25
    weights += 0.25
  }

  const score = weights > 0 ? total / weights : 50
  return { score: Math.max(0, Math.min(100, score)), dataPoints, maxPoints }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════

export function computeFMPScore(
  metrics: ScoreInputMetrics,
  sectorPeers: SectorPeerData | null = null,
  thresholds?: ScoreThresholds,
): FMPScore {
  // Score each category (V5: 9 categories + Quality)
  const val = scoreValuation(metrics, sectorPeers)
  const hlt = scoreHealth(metrics)
  const grw = scoreGrowth(metrics)
  const anl = scoreAnalyst(metrics)
  const qlt = scoreQuality(metrics)
  const ins = scoreInsider(metrics)
  const inst = scoreInstitutional(metrics)
  const mom = scoreMomentum(metrics)
  const sec = scoreSector(metrics)
  const cng = scoreCongressional(metrics)

  // Build breakdown (V5: 9 kategori + Quality)
  const categories: FMPScoreBreakdown = {
    valuation: Math.round(val.score),
    health: Math.round(hlt.score),
    growth: Math.round(grw.score),
    analyst: Math.round(anl.score),
    quality: Math.round(qlt.score),
    insider: Math.round(ins.score),
    institutional: Math.round(inst.score),
    momentum: Math.round(mom.score),
    sector: Math.round(sec.score),
    congressional: Math.round(cng.score),
  }

  // Weighted total (V5: 9 categories — ADAPTIVE WEIGHTING)
  interface CatEntry { key: keyof typeof WEIGHTS; score: number; dp: number }
  const catEntries: CatEntry[] = [
    { key: 'valuation', score: categories.valuation, dp: val.dataPoints },
    { key: 'health', score: categories.health, dp: hlt.dataPoints },
    { key: 'growth', score: categories.growth, dp: grw.dataPoints },
    { key: 'analyst', score: categories.analyst, dp: anl.dataPoints },
    { key: 'quality', score: categories.quality, dp: qlt.dataPoints },
    { key: 'insider', score: categories.insider, dp: ins.dataPoints },
    { key: 'institutional', score: categories.institutional, dp: inst.dataPoints },
    { key: 'momentum', score: categories.momentum, dp: mom.dataPoints },
    { key: 'sector', score: categories.sector, dp: sec.dataPoints },
    { key: 'congressional', score: categories.congressional, dp: cng.dataPoints },
  ]

  // Separate categories with data vs without
  const withData = catEntries.filter(c => c.dp > 0)
  const totalActiveWeight = withData.reduce((sum, c) => sum + WEIGHTS[c.key], 0)

  let total: number
  if (totalActiveWeight > 0) {
    // Redistribute weight proportionally among active categories
    const rawTotal = withData.reduce((sum, c) => {
      const normalizedWeight = WEIGHTS[c.key] / totalActiveWeight
      return sum + c.score * normalizedWeight
    }, 0)

    // Confidence-bazli stretch: cok veri → daha geniş skor dagilimi
    const dataRatio = withData.length / catEntries.length
    const stretchFactor = 1.0 + dataRatio * 0.5
    total = 50 + (rawTotal - 50) * stretchFactor
  } else {
    // No data at all → neutral
    total = 50
  }

  // Collect red flags
  const redFlags: RedFlag[] = [...hlt.redFlags, ...ins.redFlags]

  // ═══ ALTMAN Z — SADECE RED FLAG (V5 Final) ═══
  // Altman Z zaten Health kategorisinde (%21 agirlik) puanlanir.
  // Ayri gate/cap/multiplier = cift cezalandirma, skor dagitimini bozar.
  // Dogru yaklasim: Z dusukse Health skoru zaten duser → toplam skor duser.
  // Sadece kullaniciya uyari (red flag) gosterilir.
  const gated = false
  if (metrics.altmanZ > 0 && metrics.altmanZ < 1.8) {
    redFlags.push({
      severity: 'critical',
      category: 'health',
      message: `Altman Z-Score ${metrics.altmanZ.toFixed(2)} < 1.8 — Iflas riski bolgesi`,
      value: metrics.altmanZ,
    })
  }

  // P/E negative (unprofitable) → warning
  if (metrics.pe < 0) {
    redFlags.push({
      severity: 'warning',
      category: 'valuation',
      message: 'P/E negatif — sirket zarar ediyor',
      value: metrics.pe,
    })
  }

  // ═══ CONFIDENCE SCORE (Missing Data Policy) ═══
  // Kategoriler icinde veri olanlari say — Growth/Analyst bulk'ta sik eksik oldugu icin
  // tum kategorileri saymak guven puanini yapay olarak dusuruyordu (max ~56%).
  // Sadece veri olan kategorileri normalize et — boylece iyi kapsanan hisseler %80+ alabilir.
  const allCats = [
    { dp: val.dataPoints, mp: val.maxPoints },
    { dp: hlt.dataPoints, mp: hlt.maxPoints },
    { dp: grw.dataPoints, mp: grw.maxPoints },
    { dp: anl.dataPoints, mp: anl.maxPoints },
    { dp: qlt.dataPoints, mp: qlt.maxPoints },
    { dp: mom.dataPoints, mp: mom.maxPoints },
    { dp: sec.dataPoints, mp: sec.maxPoints },
    { dp: ins.dataPoints, mp: ins.maxPoints },
    { dp: inst.dataPoints, mp: inst.maxPoints },
    { dp: cng.dataPoints, mp: cng.maxPoints },
  ]
  let totalDataPoints = 0
  let totalMaxPoints = 0
  for (const cat of allCats) {
    // Sadece veri olan kategorileri say — eksik kategoriler cezalandirmasin
    if (cat.dp > 0) {
      totalDataPoints += cat.dp
      totalMaxPoints += cat.mp
    }
  }

  const rawConfidence = totalMaxPoints > 0 ? (totalDataPoints / totalMaxPoints) * 100 : 30
  const confidence = Math.max(30, Math.min(100, rawConfidence))

  // NaN guard — if scoring produced NaN, degrade gracefully
  if (!isFinite(total) || isNaN(total)) {
    total = 0
  }

  // Clamp final score
  total = Math.max(0, Math.min(100, Math.round(total)))

  const level: FMPScoreLevel = getScoreLevel(total, thresholds)
  const roundedConfidence = Math.round(confidence)
  const isDegraded = roundedConfidence < 50

  // Track missing inputs
  const missingInputs: string[] = []
  if (val.dataPoints === 0) missingInputs.push('valuation')
  if (hlt.dataPoints === 0) missingInputs.push('health')
  if (grw.dataPoints === 0) missingInputs.push('growth')
  if (anl.dataPoints === 0) missingInputs.push('analyst')
  if (qlt.dataPoints === 0) missingInputs.push('quality')
  if (ins.dataPoints === 0) missingInputs.push('insider')
  if (inst.dataPoints === 0) missingInputs.push('institutional')
  if (mom.dataPoints === 0) missingInputs.push('momentum')
  if (sec.dataPoints === 0) missingInputs.push('sector')
  if (cng.dataPoints === 0) missingInputs.push('congressional')

  return {
    total,
    level,
    categories,
    redFlags,
    confidence: roundedConfidence,
    gated,
    degraded: isDegraded,
    missingInputs,
    timestamp: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════
// BULK SCORING — Score all stocks with sector peer data
// ═══════════════════════════════════════════════════════════════════

export function buildSectorPeerData(
  allMetrics: Map<string, ScoreInputMetrics>
): Map<string, SectorPeerData> {
  const sectorMap = new Map<string, ScoreInputMetrics[]>()

  // Group by sector
  for (const m of allMetrics.values()) {
    const sector = m.sector || 'Unknown'
    if (!sectorMap.has(sector)) sectorMap.set(sector, [])
    sectorMap.get(sector)!.push(m)
  }

  // Build peer data per sector
  const result = new Map<string, SectorPeerData>()
  for (const [sector, stocks] of sectorMap) {
    const peValues = stocks.map(s => s.pe).filter(v => v > 0 && isFinite(v))
    const pbValues = stocks.map(s => s.pb).filter(v => v > 0 && isFinite(v))
    const evEbitdaValues = stocks.map(s => s.evEbitda).filter(v => v > 0 && isFinite(v))
    const roeValues = stocks.map(s => s.pe > 0 ? s.pe : 0).filter(v => v > 0) // placeholder
    const debtEquityValues = stocks.map(s => s.debtEquity).filter(v => v >= 0 && isFinite(v))
    const revenueGrowthValues = stocks.map(s => s.revenueGrowth).filter(v => isFinite(v) && v !== 0)

    const sortedPE = [...peValues].sort((a, b) => a - b)
    const sectorMedianPE = sortedPE.length > 0 ? sortedPE[Math.floor(sortedPE.length / 2)] : 20

    result.set(sector, {
      peValues,
      pbValues,
      evEbitdaValues,
      roeValues,
      debtEquityValues,
      revenueGrowthValues,
      sectorMedianPE,
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
// DEFAULT INPUT (for missing data — all zeros except neutral base)
// ═══════════════════════════════════════════════════════════════════

export function createDefaultInput(symbol: string, sector: string = 'Unknown'): ScoreInputMetrics {
  return {
    symbol, sector,
    pe: 0, pb: 0, evEbitda: 0, dcf: 0, price: 0, pegRatio: 0, pfcf: 0,
    altmanZ: 0, piotroski: 0, debtEquity: 0, currentRatio: 0, interestCoverage: 0, fcfPerShare: 0,
    revenueGrowth: 0, epsGrowth: 0, netIncomeGrowth: 0,
    // Quality
    roic: 0, grossMargin: 0, fcfToNetIncome: 0,
    // Momentum
    priceChange1M: 0, priceChange6M: 0, volumeRatio: 0,
    analystConsensus: '', strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, priceTarget: 0,
    insiderNetBuys: 0, insiderNetValue: 0, cSuiteBuying: false, clusterBuy: false,
    institutionalOwnership: 0, institutionalChange: 0, newPositions: 0,
    sectorPerformance1M: 0,
    congressNetBuys: 0, congressMultiple: false,
    changePercent: 0, marketCap: 0, beta: 0,
    indexMembership: [], etfExposureCount: 0, employeeGrowth: 0,
  }
}

// ═══════════════════════════════════════════════════════════════════
// RISK SCORE (0-100, 0=En Dusuk Risk, 100=En Yuksek Risk)
// 6 AI Consensus: Ayri gauge olarak goster
// ═══════════════════════════════════════════════════════════════════

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME'

export interface RiskScore {
  total: number        // 0-100
  level: RiskLevel
  components: {
    financial: number    // Altman Z risk (0-100)
    leverage: number     // Debt/Equity risk
    liquidity: number    // Current ratio risk
    volatility: number   // Beta risk
    size: number         // Market cap risk (kucuk = riskli)
    valuation: number    // Asiri degerleme riski
  }
}

export function computeRiskScore(m: ScoreInputMetrics): RiskScore {
  const components = {
    financial: 50,
    leverage: 50,
    liquidity: 50,
    volatility: 50,
    size: 50,
    valuation: 50,
  }

  // Financial risk (Altman Z — weight 30%)
  if (m.altmanZ > 0) {
    if (m.altmanZ < 1.1) components.financial = 95
    else if (m.altmanZ < 1.8) components.financial = 75
    else if (m.altmanZ < 3.0) components.financial = 40
    else components.financial = 10
  }

  // Leverage risk (D/E — weight 20%)
  if (m.debtEquity >= 0) {
    if (m.debtEquity > 5) components.leverage = 90
    else if (m.debtEquity > 3) components.leverage = 70
    else if (m.debtEquity > 1.5) components.leverage = 50
    else if (m.debtEquity > 0.5) components.leverage = 30
    else components.leverage = 10
  }

  // Liquidity risk (Current Ratio — weight 15%)
  if (m.currentRatio > 0) {
    if (m.currentRatio < 0.5) components.liquidity = 90
    else if (m.currentRatio < 1.0) components.liquidity = 70
    else if (m.currentRatio < 1.5) components.liquidity = 40
    else components.liquidity = 15
  }

  // Volatility risk (Beta — weight 15%)
  if (m.beta > 0) {
    if (m.beta > 2.0) components.volatility = 90
    else if (m.beta > 1.5) components.volatility = 65
    else if (m.beta > 1.0) components.volatility = 40
    else if (m.beta > 0.5) components.volatility = 25
    else components.volatility = 10
  }

  // Size risk (Market cap — weight 10%)
  if (m.marketCap > 0) {
    if (m.marketCap < 300_000_000) components.size = 85       // Micro
    else if (m.marketCap < 2_000_000_000) components.size = 60 // Small
    else if (m.marketCap < 10_000_000_000) components.size = 40 // Mid
    else if (m.marketCap < 200_000_000_000) components.size = 20 // Large
    else components.size = 10                                    // Mega
  }

  // Valuation risk (DCF overvaluation — weight 10%)
  if (m.dcf > 0 && m.price > 0) {
    const dcfUpside = ((m.dcf - m.price) / m.price) * 100
    if (dcfUpside < -50) components.valuation = 90
    else if (dcfUpside < -20) components.valuation = 65
    else if (dcfUpside < 0) components.valuation = 40
    else components.valuation = 15
  }

  // Weighted total
  const total = Math.round(
    components.financial * 0.30 +
    components.leverage * 0.20 +
    components.liquidity * 0.15 +
    components.volatility * 0.15 +
    components.size * 0.10 +
    components.valuation * 0.10
  )

  let level: RiskLevel
  if (total <= 25) level = 'LOW'
  else if (total <= 50) level = 'MODERATE'
  else if (total <= 75) level = 'HIGH'
  else level = 'EXTREME'

  return { total: Math.max(0, Math.min(100, total)), level, components }
}
