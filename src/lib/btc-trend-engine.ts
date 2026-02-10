// ═══════════════════════════════════════════════════════════════════
// BITCOIN TREND DISCOVERY ENGINE
// Equity-Driven, Treasury-Free BTC Regime Inference
// 
// Infers Bitcoin market direction using NASDAQ/NYSE equity data
// without relying on companies that hold BTC on their balance sheet.
// Uses pure price, volume, volatility, and correlation statistics.
// ═══════════════════════════════════════════════════════════════════

import { OHLCV } from './types'

// ═══════════════════════════════════════════════════════════════════
// BTC STOCK CLASSIFICATION
// 3 tiers: Treasury (always excluded), Miners (STRICT excluded),
//          Flow/Adoption (always included, priority weighted)
// ═══════════════════════════════════════════════════════════════════

/** TIER 1 — ALWAYS EXCLUDED: Balance-sheet BTC holders & ETFs */
export const BTC_TREASURY_EXCLUSIONS = new Set([
  'MSTR',   // MicroStrategy - largest corporate BTC holder (~200k+ BTC)
  'SMLR',   // Semler Scientific - BTC treasury strategy
  'TSLA',   // Tesla - holds BTC on balance sheet
  // BTC ETFs / Trusts
  'GBTC', 'IBIT', 'BITO', 'BITB', 'ARKB', 'FBTC',
])

/** TIER 2 — BTC MINERS: Excluded in STRICT, included in RELAXED
 *  Revenue & margins directly tied to BTC price + hash economics.
 *  Most accumulate BTC inventory → some "treasury" overlap. */
export const BTC_MINERS = new Set([
  'MARA',   // Marathon Digital - large-scale miner, high BTC beta
  'RIOT',   // Riot Platforms - large miner, high BTC beta
  'CLSK',   // CleanSpark - "bitcoin miner" positioning
  'CIFR',   // Cipher Mining - mining + data center
  'WULF',   // TeraWulf - mining + HPC
  'HUT',    // Hut 8 Mining
  'BITF',   // Bitfarms
  'BTBT',   // Bit Digital
  'IREN',   // Iris Energy
  'CORZ',   // Core Scientific
  'BTDR',   // Bitdeer Technologies
  'ARBK',   // Argo Blockchain
  'HIVE',   // HIVE Blockchain
])

/** TIER 3 — BTC FLOW & ADOPTION: Always included, priority weighted
 *  Business model tied to crypto trading volume/adoption, NOT treasury.
 *  Best trend proxy: BTC trend → trading volume → revenue/sentiment → stock price */
export const BTC_FLOW_PROXIES = new Set([
  'COIN',   // Coinbase - #1 US crypto exchange, direct BTC volume proxy
  'HOOD',   // Robinhood - retail crypto flow, risk appetite proxy
  'SQ',     // Block (fka Square) - Cash App crypto trading
  'SOFI',   // SoFi - fintech crypto trading
  'PYPL',   // PayPal - crypto buy/sell features
])

/** Combined BTC-Adjacent = Miners + Flow (all that are BTC-related by business model) */
export const BTC_ADJACENT = new Set([
  ...BTC_MINERS,
  ...BTC_FLOW_PROXIES,
])

/** Known priority carriers — these get a contribution score boost
 *  because their BTC correlation is structural, not coincidental.
 *  Ordered by expected signal quality. */
export const BTC_PRIORITY_CARRIERS: Record<string, {
  role: string
  tier: 'flow' | 'miner'
  boost: number  // contribution score multiplier (1.0 = no boost)
}> = {
  // Flow & Adoption — best for trend direction
  'COIN': { role: 'BTC Flow & Adoption', tier: 'flow', boost: 2.5 },
  'HOOD': { role: 'Retail Risk Flow', tier: 'flow', boost: 2.0 },
  'SQ':   { role: 'Crypto Fintech', tier: 'flow', boost: 1.5 },
  'SOFI': { role: 'Fintech Crypto', tier: 'flow', boost: 1.3 },
  'PYPL': { role: 'Crypto Payments', tier: 'flow', boost: 1.2 },
  // Miners — best for volatility/panic regime
  'MARA': { role: 'BTC Supply Side', tier: 'miner', boost: 2.0 },
  'RIOT': { role: 'BTC Supply Side', tier: 'miner', boost: 2.0 },
  'CLSK': { role: 'BTC Miner', tier: 'miner', boost: 1.5 },
  'CIFR': { role: 'BTC Miner/DC', tier: 'miner', boost: 1.3 },
  'WULF': { role: 'BTC Miner/HPC', tier: 'miner', boost: 1.3 },
}

// ═══════════════════════════════════════════════════════════════════
// ANALYSIS MODE
// ═══════════════════════════════════════════════════════════════════

export type AnalysisMode = 'strict' | 'relaxed'

/**
 * STRICT mode:  Treasury + Miners excluded. Only pure equity + flow proxies.
 *               Cleaner signal, less noise, but fewer known BTC carriers.
 * RELAXED mode: Treasury excluded. Miners + Flow proxies included with boost.
 *               Stronger BTC signal, more carriers, but some "structural" correlation.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type TrendDirection = 'UP' | 'DOWN' | 'NEUTRAL'
export type BucketType = 'risk_on_leader' | 'risk_off_warning' | 'volatility_carrier' | 'liquidity_proxy'
export type BucketStrength = 'STRONG' | 'NEUTRAL' | 'WEAK'
export type IntegrityState = 'NORMAL' | 'DEGRADED' | 'FAIL_CLOSED'

export interface StockFeatures {
  symbol: string
  isBtcAdjacent: boolean
  isPriorityCarrier: boolean
  carrierRole?: string
  carrierTier?: 'flow' | 'miner'
  returns1d: number
  returns5d: number
  returns20d: number
  relStrengthSPY: number
  relStrengthQQQ: number
  realizedVol20d: number
  atrRatio: number
  volumeZScore: number
  trendPersistence: number
  betaStabilitySPY: number
}

export interface LeadLagProfile {
  symbol: string
  leadCorrelations: number[]  // correlations at lag -1 to -5 (stock leads BTC)
  contemporaneousCorr: number // correlation at lag 0
  bestLeadLag: number         // lag with highest abs correlation
  bestLeadCorr: number        // correlation at best lead lag
  predictiveScore: number     // |bestLeadCorr| * consistency factor
  predictiveDirection: 'positive' | 'negative'
}

export interface BucketedStock {
  symbol: string
  bucket: BucketType
  features: StockFeatures
  leadLag: LeadLagProfile
  contributionScore: number
}

export interface BucketSummary {
  type: BucketType
  label: string
  strength: BucketStrength
  internalConsistency: number
  memberCount: number
  topMembers: { symbol: string; score: number; direction: string }[]
  subScore: number  // 0-100
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
}

export interface BTCTrendResult {
  score: number       // 0-100 (0=extreme bearish, 100=extreme bullish)
  trend: TrendDirection
  confidence: number  // 0-100
  mode: AnalysisMode
  regimeExplanation: string
  buckets: BucketSummary[]
  topContributors: BucketedStock[]
  priorityCarrierSummary: {
    symbol: string
    role: string
    tier: 'flow' | 'miner'
    returns1d: number
    returns5d: number
    leadCorr: number
    bucket: BucketType
  }[]
  integrity: {
    dataGaps: boolean
    reliabilityState: IntegrityState
    stocksAnalyzed: number
    stocksExcluded: number
    minersIncluded: boolean
    priorityCarriersFound: number
    dataQualityScore: number
    benchmarkDataDays: number
  }
  btcPrice?: number
  btcChange24h?: number
  timestamp: string
}

// ═══════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 10) return 0 // Minimum sample size

  const mx = mean(x.slice(0, n))
  const my = mean(y.slice(0, n))
  const sx = stdev(x.slice(0, n))
  const sy = stdev(y.slice(0, n))

  if (sx === 0 || sy === 0) return 0

  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (x[i] - mx) * (y[i] - my)
  }

  return sum / ((n - 1) * sx * sy)
}

/** Compute simple returns from close prices: ret[i] = close[i]/close[i-period] - 1 */
function computeReturns(closes: number[], period: number = 1): number[] {
  const ret: number[] = []
  for (let i = period; i < closes.length; i++) {
    if (closes[i - period] === 0) ret.push(0)
    else ret.push(closes[i] / closes[i - period] - 1)
  }
  return ret
}

/** True Range for a single bar */
function trueRange(high: number, low: number, prevClose: number): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
}

/** ATR(period) at the end of bars */
function computeATR(bars: OHLCV[], period: number): number {
  if (bars.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    trs.push(trueRange(bars[i].high, bars[i].low, bars[i - 1].close))
  }
  // Wilder's smoothing
  let atr = mean(trs.slice(0, period))
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
  }
  return atr
}

/** Rolling beta: stock returns regressed on benchmark returns */
function rollingBeta(stockRets: number[], benchRets: number[], window: number): number[] {
  const betas: number[] = []
  const n = Math.min(stockRets.length, benchRets.length)
  for (let i = window; i <= n; i++) {
    const sr = stockRets.slice(i - window, i)
    const br = benchRets.slice(i - window, i)
    const corr = pearsonCorrelation(sr, br)
    const sdS = stdev(sr)
    const sdB = stdev(br)
    if (sdB === 0) betas.push(0)
    else betas.push(corr * sdS / sdB)
  }
  return betas
}

// ═══════════════════════════════════════════════════════════════════
// DATE ALIGNMENT
// Align stock data (weekdays only) with BTC data (7 days/week)
// by matching on date strings
// ═══════════════════════════════════════════════════════════════════

interface AlignedData {
  dates: string[]
  stockCloses: number[]
  btcCloses: number[]
  spyCloses: number[]
  qqqCloses: number[]
  stockVolumes: number[]
}

function alignDates(
  stockBars: OHLCV[],
  btcBars: OHLCV[],
  spyBars: OHLCV[],
  qqqBars: OHLCV[],
): AlignedData {
  // Build lookup maps by date
  const btcMap = new Map<string, number>()
  for (const b of btcBars) btcMap.set(b.date, b.close)

  const spyMap = new Map<string, number>()
  for (const b of spyBars) spyMap.set(b.date, b.close)

  const qqqMap = new Map<string, number>()
  for (const b of qqqBars) qqqMap.set(b.date, b.close)

  // Use stock trading days as the reference (only days where all benchmarks have data)
  const dates: string[] = []
  const stockCloses: number[] = []
  const btcCloses: number[] = []
  const spyCloses: number[] = []
  const qqqCloses: number[] = []
  const stockVolumes: number[] = []

  for (const bar of stockBars) {
    const btcClose = btcMap.get(bar.date)
    const spyClose = spyMap.get(bar.date)
    const qqqClose = qqqMap.get(bar.date)

    if (btcClose !== undefined && spyClose !== undefined && qqqClose !== undefined) {
      dates.push(bar.date)
      stockCloses.push(bar.close)
      btcCloses.push(btcClose)
      spyCloses.push(spyClose)
      qqqCloses.push(qqqClose)
      stockVolumes.push(bar.volume)
    }
  }

  return { dates, stockCloses, btcCloses, spyCloses, qqqCloses, stockVolumes }
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE EXTRACTION (per stock)
// ═══════════════════════════════════════════════════════════════════

const MIN_BARS = 80 // Minimum aligned bars needed for analysis

export function extractStockFeatures(
  symbol: string,
  stockBars: OHLCV[],
  btcBars: OHLCV[],
  spyBars: OHLCV[],
  qqqBars: OHLCV[],
): StockFeatures | null {
  const aligned = alignDates(stockBars, btcBars, spyBars, qqqBars)
  if (aligned.stockCloses.length < MIN_BARS) return null

  const n = aligned.stockCloses.length
  const closes = aligned.stockCloses
  const spyCloses = aligned.spyCloses
  const qqqCloses = aligned.qqqCloses
  const volumes = aligned.stockVolumes

  // Multi-horizon returns (most recent)
  const returns1d = closes[n - 1] / closes[n - 2] - 1
  const returns5d = n >= 6 ? closes[n - 1] / closes[n - 6] - 1 : 0
  const returns20d = n >= 21 ? closes[n - 1] / closes[n - 21] - 1 : 0

  // Relative Strength vs SPY/QQQ (20-day)
  const spyRet20d = n >= 21 ? spyCloses[n - 1] / spyCloses[n - 21] - 1 : 0
  const qqqRet20d = n >= 21 ? qqqCloses[n - 1] / qqqCloses[n - 21] - 1 : 0
  const relStrengthSPY = spyRet20d !== 0 ? returns20d / spyRet20d : 0
  const relStrengthQQQ = qqqRet20d !== 0 ? returns20d / qqqRet20d : 0

  // Realized Volatility (20-day, annualized)
  const dailyRets = computeReturns(closes, 1)
  const recentRets = dailyRets.slice(-20)
  const realizedVol20d = stdev(recentRets) * Math.sqrt(252)

  // ATR Ratio
  const recentBars: OHLCV[] = []
  for (let i = Math.max(0, n - 20); i < n; i++) {
    recentBars.push({
      date: aligned.dates[i],
      open: closes[i],
      high: closes[i] * (1 + Math.abs(dailyRets[i - 1] || 0) * 0.5),
      low: closes[i] * (1 - Math.abs(dailyRets[i - 1] || 0) * 0.5),
      close: closes[i],
      volume: volumes[i],
    })
  }
  const atr = computeATR(stockBars.slice(-30), 14)
  const atrRatio = closes[n - 1] !== 0 ? atr / closes[n - 1] : 0

  // Volume Z-Score (5d avg vs 60d avg)
  const vol5d = mean(volumes.slice(-5))
  const vol60d = mean(volumes.slice(-60))
  const volStd60d = stdev(volumes.slice(-60))
  const volumeZScore = volStd60d !== 0 ? (vol5d - vol60d) / volStd60d : 0

  // Trend Persistence (proportion of same-sign returns in last 20 days)
  const last20Rets = dailyRets.slice(-20)
  const posCount = last20Rets.filter(r => r > 0).length
  const trendPersistence = posCount / Math.max(last20Rets.length, 1)

  // Beta Stability (stdev of rolling 20d beta vs SPY over last 60 days)
  const stockDailyRets = computeReturns(closes, 1)
  const spyDailyRets = computeReturns(spyCloses, 1)
  const betas = rollingBeta(stockDailyRets, spyDailyRets, 20)
  const betaStabilitySPY = betas.length >= 10 ? stdev(betas.slice(-40)) : 1.0

  const priorityInfo = BTC_PRIORITY_CARRIERS[symbol]

  return {
    symbol,
    isBtcAdjacent: BTC_ADJACENT.has(symbol),
    isPriorityCarrier: !!priorityInfo,
    carrierRole: priorityInfo?.role,
    carrierTier: priorityInfo?.tier,
    returns1d,
    returns5d,
    returns20d,
    relStrengthSPY,
    relStrengthQQQ,
    realizedVol20d,
    atrRatio,
    volumeZScore,
    trendPersistence,
    betaStabilitySPY,
  }
}

// ═══════════════════════════════════════════════════════════════════
// LEAD-LAG CORRELATION ANALYSIS
// ═══════════════════════════════════════════════════════════════════

const CORRELATION_WINDOW = 60  // 60 trading days (~3 months)
const MAX_LEAD_LAG = 5         // Check up to 5-day leads

export function computeLeadLagProfile(
  symbol: string,
  stockBars: OHLCV[],
  btcBars: OHLCV[],
  spyBars: OHLCV[],
  qqqBars: OHLCV[],
): LeadLagProfile | null {
  const aligned = alignDates(stockBars, btcBars, spyBars, qqqBars)
  if (aligned.stockCloses.length < CORRELATION_WINDOW + MAX_LEAD_LAG + 5) return null

  const stockRets = computeReturns(aligned.stockCloses, 1)
  const btcRets = computeReturns(aligned.btcCloses, 1)

  // Ensure we have enough returns
  const window = CORRELATION_WINDOW
  const recentStockRets = stockRets.slice(-window - MAX_LEAD_LAG)
  const recentBtcRets = btcRets.slice(-window - MAX_LEAD_LAG)

  if (recentStockRets.length < window || recentBtcRets.length < window) return null

  // Contemporaneous correlation (lag 0)
  const contemporaneousCorr = pearsonCorrelation(
    recentStockRets.slice(-window),
    recentBtcRets.slice(-window),
  )

  // Lead correlations: stock at t-k vs BTC at t, for k = 1..5
  const leadCorrelations: number[] = []
  for (let k = 1; k <= MAX_LEAD_LAG; k++) {
    const stockLead = recentStockRets.slice(-(window + k), -k)
    const btcCurrent = recentBtcRets.slice(-window)
    const minLen = Math.min(stockLead.length, btcCurrent.length)
    if (minLen < 20) {
      leadCorrelations.push(0)
    } else {
      const corr = pearsonCorrelation(
        stockLead.slice(0, minLen),
        btcCurrent.slice(0, minLen),
      )
      leadCorrelations.push(corr)
    }
  }

  // Find best predictive lag
  let bestLeadLag = 1
  let bestLeadCorr = leadCorrelations[0]
  for (let i = 1; i < leadCorrelations.length; i++) {
    if (Math.abs(leadCorrelations[i]) > Math.abs(bestLeadCorr)) {
      bestLeadCorr = leadCorrelations[i]
      bestLeadLag = i + 1
    }
  }

  // Predictive score: |correlation| * consistency factor
  // Consistency = how many lags agree in direction
  const leadSigns = leadCorrelations.map(c => Math.sign(c))
  const dominantSign = Math.sign(mean(leadCorrelations))
  const agreeing = leadSigns.filter(s => s === dominantSign).length
  const consistency = agreeing / MAX_LEAD_LAG

  const predictiveScore = Math.abs(bestLeadCorr) * consistency

  return {
    symbol,
    leadCorrelations,
    contemporaneousCorr,
    bestLeadLag,
    bestLeadCorr,
    predictiveScore,
    predictiveDirection: bestLeadCorr >= 0 ? 'positive' : 'negative',
  }
}

// ═══════════════════════════════════════════════════════════════════
// STRUCTURAL BUCKETING
// ═══════════════════════════════════════════════════════════════════

export function classifyBucket(
  features: StockFeatures,
  leadLag: LeadLagProfile,
): BucketType {
  const { predictiveDirection, predictiveScore, leadCorrelations, contemporaneousCorr } = leadLag
  const { volumeZScore, realizedVol20d, trendPersistence, relStrengthSPY } = features

  // Score each bucket candidacy
  const scores: Record<BucketType, number> = {
    risk_on_leader: 0,
    risk_off_warning: 0,
    volatility_carrier: 0,
    liquidity_proxy: 0,
  }

  // Risk-On Leader: positive lead correlation + strong uptrend + high rel strength
  if (predictiveDirection === 'positive' && predictiveScore > 0.05) {
    scores.risk_on_leader += predictiveScore * 2
    if (trendPersistence > 0.55) scores.risk_on_leader += 0.3
    if (relStrengthSPY > 1.0) scores.risk_on_leader += 0.2
  }

  // Risk-Off Warning: negative lead correlation OR breakdown signals
  if (predictiveDirection === 'negative' && predictiveScore > 0.05) {
    scores.risk_off_warning += predictiveScore * 2
    if (trendPersistence < 0.45) scores.risk_off_warning += 0.3
    if (relStrengthSPY < 1.0) scores.risk_off_warning += 0.2
  }

  // Volatility Carrier: high correlation with BTC absolute moves (proxy: high vol + high abs corr)
  const avgAbsLeadCorr = mean(leadCorrelations.map(Math.abs))
  if (realizedVol20d > 0.3 && avgAbsLeadCorr > 0.1) {
    scores.volatility_carrier += avgAbsLeadCorr * 1.5
    if (realizedVol20d > 0.5) scores.volatility_carrier += 0.3
  }
  // Also high absolute contemporaneous correlation
  if (Math.abs(contemporaneousCorr) > 0.2) {
    scores.volatility_carrier += Math.abs(contemporaneousCorr) * 0.5
  }

  // Liquidity Proxy: volume z-score changes correlate with BTC direction
  if (Math.abs(volumeZScore) > 1.0) {
    scores.liquidity_proxy += Math.abs(volumeZScore) * 0.3
    if (predictiveScore > 0.03) scores.liquidity_proxy += 0.2
  }
  // Low beta stability suggests regime sensitivity (liquidity proxy characteristic)
  if (features.betaStabilitySPY > 0.3) {
    scores.liquidity_proxy += 0.2
  }

  // Select the bucket with highest score (must be > 0)
  let maxBucket: BucketType = 'risk_on_leader'
  let maxScore = scores.risk_on_leader

  for (const [bucket, score] of Object.entries(scores) as [BucketType, number][]) {
    if (score > maxScore) {
      maxScore = score
      maxBucket = bucket
    }
  }

  return maxBucket
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITE BTC TREND ENGINE
// ═══════════════════════════════════════════════════════════════════

const BUCKET_WEIGHTS: Record<BucketType, number> = {
  risk_on_leader: 0.30,
  risk_off_warning: 0.30,
  volatility_carrier: 0.20,
  liquidity_proxy: 0.20,
}

const BUCKET_LABELS: Record<BucketType, string> = {
  risk_on_leader: 'Risk-On Leaders',
  risk_off_warning: 'Risk-Off Warnings',
  volatility_carrier: 'Volatility Carriers',
  liquidity_proxy: 'Liquidity Proxies',
}

function computeBucketSubScore(stocks: BucketedStock[], bucketType: BucketType): number {
  if (stocks.length === 0) return 50 // neutral default

  switch (bucketType) {
    case 'risk_on_leader': {
      // Bullish = higher score when leaders are in uptrend
      const avgTrendPersistence = mean(stocks.map(s => s.features.trendPersistence))
      const avgReturns5d = mean(stocks.map(s => s.features.returns5d))
      const avgLeadCorr = mean(stocks.map(s => s.leadLag.bestLeadCorr))
      // Score: high persistence + positive returns + positive lead corr → bullish (>50)
      let score = 50
      score += avgTrendPersistence * 30 - 15  // [-15, +15]
      score += Math.tanh(avgReturns5d * 20) * 20  // [-20, +20]
      score += avgLeadCorr * 15  // [-15, +15]
      return Math.max(0, Math.min(100, score))
    }

    case 'risk_off_warning': {
      // Bearish warnings = LOWER score when warnings are active
      const avgTrendPersistence = mean(stocks.map(s => s.features.trendPersistence))
      const avgReturns5d = mean(stocks.map(s => s.features.returns5d))
      const avgLeadCorr = mean(stocks.map(s => s.leadLag.bestLeadCorr))
      // Score: low persistence + negative returns → bearish (lower score)
      let score = 50
      score -= (1 - avgTrendPersistence) * 30 - 15  // inverse: low persistence → lower score
      score += Math.tanh(avgReturns5d * 20) * 20
      score += avgLeadCorr * 15
      return Math.max(0, Math.min(100, score))
    }

    case 'volatility_carrier': {
      // Vol expansion → regime change, directional via carrier momentum
      const avgVol = mean(stocks.map(s => s.features.realizedVol20d))
      const avgReturns = mean(stocks.map(s => s.features.returns5d))
      // High vol + positive returns → potentially bullish; high vol + negative → bearish
      let score = 50
      if (avgVol > 0.4) {
        score += Math.tanh(avgReturns * 30) * 25 // amplify direction when vol is high
      } else {
        score += Math.tanh(avgReturns * 15) * 15
      }
      return Math.max(0, Math.min(100, score))
    }

    case 'liquidity_proxy': {
      // Tightening → bearish; easing → bullish
      const avgVolZ = mean(stocks.map(s => s.features.volumeZScore))
      const avgReturns = mean(stocks.map(s => s.features.returns5d))
      let score = 50
      score += Math.tanh(avgVolZ * 0.5) * 15  // positive volume → liquidity easing
      score += Math.tanh(avgReturns * 20) * 15
      return Math.max(0, Math.min(100, score))
    }
  }
}

function computeBucketStrength(subScore: number, memberCount: number): BucketStrength {
  if (memberCount < 3) return 'WEAK'
  const deviation = Math.abs(subScore - 50)
  if (deviation > 15) return 'STRONG'
  if (deviation > 5) return 'NEUTRAL'
  return 'WEAK'
}

function computeBucketSignal(subScore: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (subScore > 60) return 'BULLISH'
  if (subScore < 40) return 'BEARISH'
  return 'NEUTRAL'
}

function generateRegimeExplanation(
  trend: TrendDirection,
  confidence: number,
  buckets: BucketSummary[],
): string {
  const riskOn = buckets.find(b => b.type === 'risk_on_leader')
  const riskOff = buckets.find(b => b.type === 'risk_off_warning')
  const volCarrier = buckets.find(b => b.type === 'volatility_carrier')
  const liquidity = buckets.find(b => b.type === 'liquidity_proxy')

  const parts: string[] = []

  if (trend === 'UP') {
    parts.push(`Equity risk-on leaders show ${riskOn?.strength.toLowerCase() || 'neutral'} bullish momentum.`)
    if (riskOff?.signal === 'BULLISH' || riskOff?.signal === 'NEUTRAL') {
      parts.push('Risk-off warning stocks are not signaling distress.')
    }
    if (volCarrier?.signal === 'BULLISH') {
      parts.push('Volatility carriers confirm expansionary bias.')
    }
  } else if (trend === 'DOWN') {
    parts.push(`Risk-off warning stocks show ${riskOff?.strength.toLowerCase() || 'neutral'} bearish signals.`)
    if (riskOn?.signal === 'BEARISH' || riskOn?.signal === 'NEUTRAL') {
      parts.push('Risk-on leaders confirm weakening appetite.')
    }
    if (liquidity?.signal === 'BEARISH') {
      parts.push('Liquidity proxies suggest tightening conditions.')
    }
  } else {
    parts.push('Equity regime signals are mixed with no dominant directional consensus.')
    if (volCarrier?.strength === 'STRONG') {
      parts.push('Elevated volatility carrier activity suggests potential regime transition.')
    } else {
      parts.push('Low signal dispersion indicates a ranging environment.')
    }
  }

  return parts.join(' ') + ` Analysis based on ${buckets.reduce((s, b) => s + b.memberCount, 0)} equity carriers across 4 structural buckets. Confidence: ${confidence.toFixed(0)}%.`
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPUTATION
// ═══════════════════════════════════════════════════════════════════

export interface BTCTrendInput {
  stockDataMap: Map<string, OHLCV[]>  // symbol → daily bars
  btcBars: OHLCV[]
  spyBars: OHLCV[]
  qqqBars: OHLCV[]
  btcPrice?: number
  btcChange24h?: number
  mode?: AnalysisMode  // default: 'relaxed'
}

export function computeBTCTrend(input: BTCTrendInput): BTCTrendResult {
  const { stockDataMap, btcBars, spyBars, qqqBars, btcPrice, btcChange24h } = input
  const mode: AnalysisMode = input.mode || 'relaxed'

  // Step 1: Filter eligible stocks based on mode
  let stocksExcluded = 0
  const eligibleSymbols: string[] = []

  for (const symbol of stockDataMap.keys()) {
    // Always exclude treasury holders
    if (BTC_TREASURY_EXCLUSIONS.has(symbol)) {
      stocksExcluded++
      continue
    }
    // In STRICT mode, also exclude miners (but NOT flow proxies)
    if (mode === 'strict' && BTC_MINERS.has(symbol)) {
      stocksExcluded++
      continue
    }
    eligibleSymbols.push(symbol)
  }

  // Step 2: Extract features + lead-lag for all eligible stocks
  const allBucketed: BucketedStock[] = []
  let dataGapsCount = 0

  for (const symbol of eligibleSymbols) {
    const bars = stockDataMap.get(symbol)
    if (!bars || bars.length < MIN_BARS) {
      dataGapsCount++
      continue
    }

    const features = extractStockFeatures(symbol, bars, btcBars, spyBars, qqqBars)
    if (!features) {
      dataGapsCount++
      continue
    }

    const leadLag = computeLeadLagProfile(symbol, bars, btcBars, spyBars, qqqBars)
    if (!leadLag) {
      dataGapsCount++
      continue
    }

    // Only include stocks with meaningful predictive signal
    // Priority carriers get a lower threshold (they're structurally relevant)
    const isPriority = !!BTC_PRIORITY_CARRIERS[symbol]
    const threshold = isPriority ? 0.005 : 0.02
    if (leadLag.predictiveScore < threshold) continue

    const bucket = classifyBucket(features, leadLag)

    // Apply priority carrier boost to contribution score
    const boost = BTC_PRIORITY_CARRIERS[symbol]?.boost || 1.0
    const boostedScore = leadLag.predictiveScore * boost

    allBucketed.push({
      symbol,
      bucket,
      features,
      leadLag,
      contributionScore: boostedScore,
    })
  }

  // Step 3: Sort by contribution score within each bucket
  const bucketStocks: Record<BucketType, BucketedStock[]> = {
    risk_on_leader: [],
    risk_off_warning: [],
    volatility_carrier: [],
    liquidity_proxy: [],
  }

  for (const stock of allBucketed) {
    bucketStocks[stock.bucket].push(stock)
  }

  for (const bucket of Object.keys(bucketStocks) as BucketType[]) {
    bucketStocks[bucket].sort((a, b) => b.contributionScore - a.contributionScore)
  }

  // Step 4: Compute bucket sub-scores
  const bucketSummaries: BucketSummary[] = (Object.keys(bucketStocks) as BucketType[]).map(bucket => {
    const stocks = bucketStocks[bucket]
    const topStocks = stocks.slice(0, 20) // Use top 20 per bucket for sub-score
    const subScore = computeBucketSubScore(topStocks, bucket)
    const strength = computeBucketStrength(subScore, stocks.length)
    const signal = computeBucketSignal(subScore)

    // Internal consistency: how aligned are the top members
    if (topStocks.length < 2) {
      return {
        type: bucket,
        label: BUCKET_LABELS[bucket],
        strength,
        internalConsistency: 0,
        memberCount: stocks.length,
        topMembers: topStocks.slice(0, 5).map(s => ({
          symbol: s.symbol,
          score: s.contributionScore,
          direction: s.leadLag.predictiveDirection,
        })),
        subScore,
        signal,
      }
    }

    const directions = topStocks.map(s => s.leadLag.predictiveDirection === 'positive' ? 1 : -1)
    const avgDirection = Math.abs(mean(directions))
    const internalConsistency = avgDirection  // 0 = split, 1 = all agree

    return {
      type: bucket,
      label: BUCKET_LABELS[bucket],
      strength,
      internalConsistency,
      memberCount: stocks.length,
      topMembers: topStocks.slice(0, 5).map(s => ({
        symbol: s.symbol,
        score: s.contributionScore,
        direction: s.leadLag.predictiveDirection,
      })),
      subScore,
      signal,
    }
  })

  // Step 5: Compute composite BTC_TREND_SCORE
  let compositeScore = 0
  for (const summary of bucketSummaries) {
    compositeScore += summary.subScore * BUCKET_WEIGHTS[summary.type]
  }

  // Step 6: Map to trend direction
  let trend: TrendDirection = 'NEUTRAL'
  if (compositeScore > 58) trend = 'UP'
  else if (compositeScore < 42) trend = 'DOWN'

  // Step 7: Compute confidence
  // Based on: bucket agreement + low dispersion + data quality
  const subScores = bucketSummaries.map(b => b.subScore)
  const scoreDispersion = stdev(subScores)
  const avgConsistency = mean(bucketSummaries.map(b => b.internalConsistency))
  const dataQuality = 1 - (dataGapsCount / Math.max(eligibleSymbols.length, 1))
  const totalAnalyzed = allBucketed.length

  // Higher agreement (lower dispersion) → higher confidence
  const agreementFactor = Math.max(0, 1 - scoreDispersion / 30) // max 30 pts dispersion
  // More stocks analyzed → higher confidence (up to a point)
  const sampleFactor = Math.min(1, totalAnalyzed / 100)
  // Consistency factor
  const consistencyFactor = avgConsistency

  let confidence = (agreementFactor * 40 + consistencyFactor * 30 + sampleFactor * 20 + dataQuality * 10)
  confidence = Math.max(0, Math.min(100, confidence))

  // If NEUTRAL, reduce confidence (unclear signal)
  if (trend === 'NEUTRAL') confidence *= 0.7

  // Step 8: Data integrity check
  const benchmarkDays = Math.min(btcBars.length, spyBars.length, qqqBars.length)
  let reliabilityState: IntegrityState = 'NORMAL'
  if (totalAnalyzed < 50 || benchmarkDays < 60) reliabilityState = 'DEGRADED'
  if (totalAnalyzed < 10 || benchmarkDays < 30) reliabilityState = 'FAIL_CLOSED'

  if (reliabilityState === 'FAIL_CLOSED') {
    trend = 'NEUTRAL'
    confidence = 0
  }

  // Step 9: Top 10 contributors (across all buckets)
  const topContributors = [...allBucketed]
    .sort((a, b) => b.contributionScore - a.contributionScore)
    .slice(0, 10)

  // Step 10: Priority carrier summary (known BTC proxy stocks)
  const priorityCarrierSummary = allBucketed
    .filter(s => s.features.isPriorityCarrier)
    .map(s => ({
      symbol: s.symbol,
      role: s.features.carrierRole || 'Unknown',
      tier: s.features.carrierTier || 'flow' as const,
      returns1d: s.features.returns1d,
      returns5d: s.features.returns5d,
      leadCorr: s.leadLag.bestLeadCorr,
      bucket: s.bucket,
    }))
    .sort((a, b) => Math.abs(b.leadCorr) - Math.abs(a.leadCorr))

  // Step 11: Generate regime explanation
  const regimeExplanation = generateRegimeExplanation(trend, confidence, bucketSummaries)

  return {
    score: Math.round(compositeScore * 10) / 10,
    trend,
    confidence: Math.round(confidence * 10) / 10,
    mode,
    regimeExplanation,
    buckets: bucketSummaries,
    topContributors,
    priorityCarrierSummary,
    integrity: {
      dataGaps: dataGapsCount > eligibleSymbols.length * 0.3,
      reliabilityState,
      stocksAnalyzed: totalAnalyzed,
      stocksExcluded,
      minersIncluded: mode === 'relaxed',
      priorityCarriersFound: priorityCarrierSummary.length,
      dataQualityScore: Math.round(dataQuality * 100),
      benchmarkDataDays: benchmarkDays,
    },
    btcPrice,
    btcChange24h,
    timestamp: new Date().toISOString(),
  }
}
