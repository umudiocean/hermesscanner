// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Crypto Score Engine V2
// 8-Category Scoring (0-100) for Cryptocurrency Assets
// K2: Real On-Chain Score | K5: Funding Z-Score | K13: Weight Revision
// 6/6 AI Consensus Implementation
// ═══════════════════════════════════════════════════════════════════

import {
  CryptoScore, CryptoScoreBreakdown, CryptoScoreLevel,
  CRYPTO_SCORE_WEIGHTS, getCryptoScoreLevel,
  CoinMarket, CoinDetail, Derivative,
} from './coingecko-types'

// ═══════════════════════════════════════════════════════════════════
// HELPER: Sigmoid mapping (smooth 0-100)
// ═══════════════════════════════════════════════════════════════════

function sigmoid(value: number, center: number, steepness: number): number {
  return 100 / (1 + Math.exp(-steepness * (value - center)))
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50
  const sorted = [...allValues].sort((a, b) => a - b)
  let rank = 0
  for (const v of sorted) {
    if (v < value) rank++
    else break
  }
  return (rank / sorted.length) * 100
}

// ═══════════════════════════════════════════════════════════════════
// ON-CHAIN DATA TYPES (K2)
// ═══════════════════════════════════════════════════════════════════

export interface OnChainData {
  // From top_holders endpoint
  topHolders?: {
    address: string
    percentage: number
    balance: number
  }[]

  // From top_traders endpoint
  topTraders?: {
    buyers_count?: number
    sellers_count?: number
    buyers_total_usd?: number
    sellers_total_usd?: number
  }

  // From holders_chart endpoint
  holdersChart?: {
    timestamp: number
    count: number
  }[]

  // From token pools
  pools?: {
    id: string
    reserve_in_usd?: number
    volume_24h_usd?: number
    tx_count_24h?: number
  }[]

  // Aggregated metrics
  dexVolume24h?: number
  totalLiquidity?: number
  poolCount?: number
  txCount24h?: number
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORY SCORING
// ═══════════════════════════════════════════════════════════════════

/** Market Structure (17%): mcap rank, volume, liquidity, supply ratio */
function scoreMarketStructure(coin: CoinMarket, _allCoins: CoinMarket[]): number {
  const scores: number[] = []

  // Market cap rank (lower = better, log scale)
  if (coin.market_cap_rank) {
    const rankScore = clamp(100 - Math.log10(coin.market_cap_rank) * 25)
    scores.push(rankScore)
  }

  // Circulating supply ratio (prefer high circulating/total)
  if (coin.total_supply && coin.total_supply > 0 && coin.circulating_supply > 0) {
    const supplyRatio = coin.circulating_supply / coin.total_supply
    scores.push(clamp(supplyRatio * 100))
  }

  // Market cap size (absolute — larger = safer)
  if (coin.market_cap > 0) {
    const mcapScore = sigmoid(Math.log10(coin.market_cap), 9, 0.8) // center ~1B
    scores.push(mcapScore)
  }

  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 50
}

/** Momentum (15%): 1h, 24h, 7d, 30d price changes */
function scoreMomentum(coin: CoinMarket): number {
  const changes = [
    { val: coin.price_change_percentage_1h_in_currency, weight: 0.1 },
    { val: coin.price_change_percentage_24h_in_currency, weight: 0.25 },
    { val: coin.price_change_percentage_7d_in_currency, weight: 0.35 },
    { val: coin.price_change_percentage_30d_in_currency, weight: 0.3 },
  ]

  let totalWeight = 0
  let weightedScore = 0

  for (const { val, weight } of changes) {
    if (val != null) {
      const s = clamp(50 + val * (50 / 30))
      weightedScore += s * weight
      totalWeight += weight
    }
  }

  if (totalWeight > 0) return weightedScore / totalWeight

  if (coin.price_change_percentage_24h != null) {
    return clamp(50 + coin.price_change_percentage_24h * (50 / 30))
  }

  return 50
}

/** Volume (13%): volume/mcap ratio, volume momentum */
function scoreVolume(coin: CoinMarket, allCoins: CoinMarket[]): number {
  const scores: number[] = []

  // Volume / market cap ratio (percentile among peers)
  if (coin.market_cap > 0 && coin.total_volume > 0) {
    const ratio = coin.total_volume / coin.market_cap
    const allRatios = allCoins.filter(c => c.market_cap > 0 && c.total_volume > 0)
      .map(c => c.total_volume / c.market_cap)
    scores.push(percentileRank(ratio, allRatios))
  }

  // Absolute volume (higher = better liquidity)
  if (coin.total_volume > 0) {
    const volScore = sigmoid(Math.log10(coin.total_volume), 7, 0.6) // center ~$10M
    scores.push(volScore)
  }

  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 50
}

/** Sentiment (10%): community metrics (when available from detail) */
function scoreSentiment(detail?: CoinDetail | null): number {
  if (!detail) return 50

  const scores: number[] = []

  if (detail.sentiment_votes_up_percentage != null) {
    scores.push(detail.sentiment_votes_up_percentage)
  }

  if (detail.watchlist_portfolio_users) {
    const watchScore = sigmoid(Math.log10(detail.watchlist_portfolio_users), 4, 1)
    scores.push(watchScore)
  }

  if (detail.community_data) {
    const cd = detail.community_data
    const communityMetrics: number[] = []
    if (cd.twitter_followers) communityMetrics.push(sigmoid(Math.log10(cd.twitter_followers), 5, 0.8))
    if (cd.reddit_subscribers) communityMetrics.push(sigmoid(Math.log10(cd.reddit_subscribers), 4, 0.8))
    if (cd.telegram_channel_user_count) communityMetrics.push(sigmoid(Math.log10(cd.telegram_channel_user_count), 4, 0.8))
    if (communityMetrics.length > 0) {
      scores.push(communityMetrics.reduce((a, b) => a + b) / communityMetrics.length)
    }
  }

  if (detail.developer_data) {
    const dd = detail.developer_data
    const devMetrics: number[] = []
    if (dd.stars) devMetrics.push(sigmoid(Math.log10(dd.stars + 1), 3, 0.8))
    if (dd.commit_count_4_weeks) devMetrics.push(sigmoid(dd.commit_count_4_weeks, 20, 0.1))
    if (dd.pull_requests_merged) devMetrics.push(sigmoid(dd.pull_requests_merged, 50, 0.05))
    if (devMetrics.length > 0) {
      scores.push(devMetrics.reduce((a, b) => a + b) / devMetrics.length)
    }
  }

  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 50
}

/** Fundamentals (13%): TVL, FDV/mcap, supply economics */
function scoreFundamentals(coin: CoinMarket): number {
  const scores: number[] = []

  if (coin.total_value_locked && coin.total_value_locked > 0) {
    const tvlScore = sigmoid(Math.log10(coin.total_value_locked), 8, 0.7)
    scores.push(tvlScore)
  }

  if (coin.fully_diluted_valuation && coin.market_cap > 0) {
    const fdvRatio = coin.fully_diluted_valuation / coin.market_cap
    const fdvScore = clamp(100 - (fdvRatio - 1) * 15)
    scores.push(fdvScore)
  }

  if (coin.max_supply && coin.max_supply > 0 && coin.circulating_supply > 0) {
    const coverage = coin.circulating_supply / coin.max_supply
    scores.push(clamp(coverage * 100))
  }

  if (coin.ath_change_percentage != null) {
    const athDist = Math.abs(coin.ath_change_percentage)
    if (athDist < 5) scores.push(85)
    else if (athDist < 20) scores.push(70)
    else if (athDist < 50) scores.push(50)
    else if (athDist < 80) scores.push(30)
    else scores.push(15)
  }

  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 50
}

/**
 * On-Chain (15%): REAL DATA from GeckoTerminal Analyst endpoints (K2)
 * 4 sub-components:
 * 1. Holder Concentration (top holders — lower concentration = healthier)
 * 2. Holder Growth Trend (holders_chart — positive slope = growing adoption)
 * 3. Smart Money Flow (top_traders — net buy ratio)
 * 4. DEX Liquidity Depth (pool TVL + volume)
 */
function scoreOnchain(onchainData?: OnChainData | null): number {
  if (!onchainData) return 50 // No data = neutral (adaptive weight will skip this)

  const scores: number[] = []
  let hasRealData = false

  // 1. Holder Concentration (30% of on-chain score)
  if (onchainData.topHolders && onchainData.topHolders.length > 0) {
    hasRealData = true
    // Top 10 holders percentage — lower = more distributed = healthier
    const top10 = onchainData.topHolders.slice(0, 10)
    const top10Pct = top10.reduce((sum, h) => sum + (h.percentage || 0), 0)
    // <30% concentration = great (90), 30-50% = good (60), 50-70% = medium (40), >70% = risky (15)
    let concScore: number
    if (top10Pct < 30) concScore = 85 + (30 - top10Pct) * 0.5
    else if (top10Pct < 50) concScore = 55 + (50 - top10Pct) * 1.5
    else if (top10Pct < 70) concScore = 30 + (70 - top10Pct) * 1.25
    else concScore = Math.max(5, 30 - (top10Pct - 70) * 0.5)
    scores.push(clamp(concScore))
  }

  // 2. Holder Growth Trend (20%)
  if (onchainData.holdersChart && onchainData.holdersChart.length >= 3) {
    hasRealData = true
    const chart = onchainData.holdersChart
    const first = chart[0].count
    const last = chart[chart.length - 1].count
    if (first > 0) {
      const growthPct = ((last - first) / first) * 100
      // >20% growth = excellent, 5-20% = good, 0-5% = neutral, negative = bad
      const trendScore = clamp(50 + growthPct * 2)
      scores.push(trendScore)
    }
  }

  // 3. Smart Money Flow (25%)
  if (onchainData.topTraders) {
    hasRealData = true
    const { buyers_total_usd = 0, sellers_total_usd = 0 } = onchainData.topTraders
    const total = buyers_total_usd + sellers_total_usd
    if (total > 0) {
      const buyRatio = buyers_total_usd / total
      // >0.70 = strong buy pressure (85), 0.50-0.70 = moderate (60), <0.30 = sell pressure (15)
      const flowScore = clamp(buyRatio * 100 + (buyRatio - 0.5) * 40)
      scores.push(flowScore)
    }
  }

  // 4. DEX Liquidity Depth (25%)
  if (onchainData.totalLiquidity != null && onchainData.totalLiquidity > 0) {
    hasRealData = true
    // Higher liquidity = safer to trade
    const liqScore = sigmoid(Math.log10(onchainData.totalLiquidity), 6, 0.6) // center ~$1M
    scores.push(liqScore)
  }

  // DEX Volume bonus
  if (onchainData.dexVolume24h != null && onchainData.dexVolume24h > 0) {
    hasRealData = true
    const volScore = sigmoid(Math.log10(onchainData.dexVolume24h), 5, 0.5) // center ~$100K
    scores.push(volScore)
  }

  if (!hasRealData) return 50
  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 50
}

/** Exchange (7%): number of exchanges, trust score spread */
function scoreExchange(detail?: CoinDetail | null): number {
  if (!detail || !detail.tickers || detail.tickers.length === 0) return 50

  const scores: number[] = []
  const tickers = detail.tickers

  const uniqueExchanges = new Set(tickers.map(t => t.market.identifier))
  scores.push(sigmoid(uniqueExchanges.size, 15, 0.15))

  const trustScores = tickers
    .filter(t => t.trust_score)
    .map((t): number => t.trust_score === 'green' ? 100 : t.trust_score === 'yellow' ? 60 : 20)
  if (trustScores.length > 0) {
    scores.push(trustScores.reduce((a, b) => a + b) / trustScores.length)
  }

  const spreads = tickers.filter(t => t.bid_ask_spread_percentage != null && t.bid_ask_spread_percentage > 0)
    .map(t => t.bid_ask_spread_percentage!)
  if (spreads.length > 0) {
    const avgSpread = spreads.reduce((a, b) => a + b) / spreads.length
    scores.push(clamp(100 - avgSpread * 10))
  }

  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 50
}

/**
 * Derivatives (10%): K5 — Funding rate Z-Score + OI analysis
 * Not just instantaneous funding — historical z-score for extreme detection
 */
function scoreDerivatives(derivatives?: Derivative[], fundingHistory?: number[]): number {
  if (!derivatives || derivatives.length === 0) return 50

  const perpetuals = derivatives.filter(d => d.contract_type === 'perpetual')
  if (perpetuals.length === 0) return 50

  const scores: number[] = []

  // Current funding rate analysis
  const fundingRates = perpetuals.filter(d => d.funding_rate != null).map(d => d.funding_rate!)
  if (fundingRates.length > 0) {
    const avgFunding = fundingRates.reduce((a, b) => a + b, 0) / fundingRates.length

    if (fundingHistory && fundingHistory.length >= 7) {
      // K5: Z-Score based funding analysis
      const mean = fundingHistory.reduce((a, b) => a + b) / fundingHistory.length
      const std = Math.sqrt(fundingHistory.reduce((a, v) => a + (v - mean) ** 2, 0) / fundingHistory.length)
      if (std > 0) {
        const zScore = (avgFunding - mean) / std
        // |z| > 2 = extreme (contrarian signal value is high)
        // Neutral funding (z near 0) = healthy market → score 65
        // Extreme positive (z > 2) = overleveraged longs → score 25 (risk)
        // Extreme negative (z < -2) = overleveraged shorts → score 25 (opportunity for longs)
        const absZ = Math.abs(zScore)
        if (absZ > 2) scores.push(30) // Extreme = risky/opportunity
        else if (absZ > 1) scores.push(50) // Elevated
        else scores.push(70) // Healthy
      } else {
        scores.push(clamp(70 - Math.abs(avgFunding) * 500))
      }
    } else {
      // Fallback: simple funding rate scoring
      scores.push(clamp(70 - Math.abs(avgFunding) * 500))
    }
  }

  // Open Interest concentration (number of derivative exchanges)
  const derivExchanges = new Set(perpetuals.map(d => d.market))
  scores.push(sigmoid(derivExchanges.size, 5, 0.4))

  // Spread analysis for derivatives
  const spreads = perpetuals.filter(d => d.spread != null && d.spread > 0)
    .map(d => d.spread!)
  if (spreads.length > 0) {
    const avgSpread = spreads.reduce((a, b) => a + b) / spreads.length
    scores.push(clamp(100 - avgSpread * 5))
  }

  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 50
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════

export interface ScoreCoinInput {
  coin: CoinMarket
  allCoins: CoinMarket[]
  detail?: CoinDetail | null
  derivatives?: Derivative[]
  onchainData?: OnChainData | null
  fundingHistory?: number[]
}

export function scoreCoin(input: ScoreCoinInput): CryptoScore {
  const { coin, allCoins, detail, derivatives, onchainData, fundingHistory } = input
  const missingInputs: string[] = []

  // Calculate each category
  const marketStructure = scoreMarketStructure(coin, allCoins)
  const momentum = scoreMomentum(coin)
  const volume = scoreVolume(coin, allCoins)
  const sentiment = scoreSentiment(detail)
  const fundamentals = scoreFundamentals(coin)
  const onchain = scoreOnchain(onchainData)
  const exchange = scoreExchange(detail)
  const derivativesScore = scoreDerivatives(derivatives, fundingHistory)

  if (!detail) missingInputs.push('sentiment', 'exchange')
  if (!derivatives || derivatives.length === 0) missingInputs.push('derivatives')
  if (!onchainData || (!onchainData.topHolders && !onchainData.topTraders && !onchainData.holdersChart)) {
    missingInputs.push('onchain')
  }
  if (!coin.total_value_locked) missingInputs.push('tvl')

  const categories: CryptoScoreBreakdown = {
    marketStructure, momentum, volume, sentiment,
    fundamentals, onchain, exchange, derivatives: derivativesScore,
  }

  // Adaptive weighting (skip missing categories — K13 phantom 50 elimination)
  let totalWeight = 0
  let weightedSum = 0
  let dataPoints = 0
  let coveredWeight = 0

  for (const [key, weight] of Object.entries(CRYPTO_SCORE_WEIGHTS)) {
    const catKey = key as keyof CryptoScoreBreakdown
    const catScore = categories[catKey]

    // If category is in missingInputs AND score is default 50, skip it
    if (missingInputs.includes(catKey) && catScore === 50) {
      continue
    }

    weightedSum += catScore * weight
    totalWeight += weight
    dataPoints++
    coveredWeight += weight
  }

  // Normalize if some categories were skipped
  let total = totalWeight > 0 ? weightedSum / totalWeight : 50

  // Confidence = weight coverage (0-1) mapped to 30-95 range
  // With market+momentum+volume+fundamentals (58% weight) → ~68% confidence
  // With all 8 categories (100% weight) → 95% confidence
  const confidence = Math.round(clamp(30 + coveredWeight * 65, 30, 95))

  // Confidence-based stretch (K13: replaces fixed 1.35x)
  const dataRatio = dataPoints / 8
  const stretchFactor = 1.0 + dataRatio * 0.5
  total = 50 + (total - 50) * stretchFactor
  total = clamp(Math.round(total))

  // NaN guard
  if (isNaN(total)) {
    return {
      total: 50, level: 'NEUTRAL', categories,
      confidence: 30, degraded: true, missingInputs: ['NaN_detected'],
      timestamp: new Date().toISOString(),
    }
  }

  const level = getCryptoScoreLevel(total)
  const degraded = confidence < 50

  return {
    total, level, categories, confidence, degraded, missingInputs,
    timestamp: new Date().toISOString(),
  }
}

/** Score all coins in batch */
export function scoreAllCoins(
  coins: CoinMarket[],
  detailMap?: Map<string, CoinDetail>,
  derivativeMap?: Map<string, Derivative[]>,
  onchainMap?: Map<string, OnChainData>,
  fundingHistoryMap?: Map<string, number[]>,
): Map<string, CryptoScore> {
  const result = new Map<string, CryptoScore>()

  for (const coin of coins) {
    const detail = detailMap?.get(coin.id) ?? null
    const derivatives = derivativeMap?.get(coin.symbol.toUpperCase())
    const onchainData = onchainMap?.get(coin.id) ?? null
    const fundingHistory = fundingHistoryMap?.get(coin.symbol.toUpperCase())

    const score = scoreCoin({ coin, allCoins: coins, detail, derivatives, onchainData, fundingHistory })
    result.set(coin.id, score)
  }

  return result
}
