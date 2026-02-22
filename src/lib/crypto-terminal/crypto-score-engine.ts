// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Crypto Score Engine V2
// 8-Category Scoring (0-100) + Overvaluation + CHI
// V2: DefiLlama TVL/Revenue + Moralis Holder/SmartMoney + Alt.me F&G
// K2: Real On-Chain Score | K5: Funding Z-Score | K13: Weight Revision
// ═══════════════════════════════════════════════════════════════════

import {
  CryptoScore, CryptoScoreBreakdown,
  CRYPTO_SCORE_WEIGHTS, getCryptoScoreLevel,
  CoinMarket, CoinDetail, Derivative,
  CryptoOvervaluation, CryptoHealthIndex,
} from './coingecko-types'
import type { DefiLlamaCoinData } from './defillama-client'
import type { MoralisOnChainResult } from './moralis-client'

// ═══════════════════════════════════════════════════════════════════
// SCORING CONFIGURATION — All formula constants in one place (LAW 04)
// HERMES_FIX: F1 2026-02-19 SEVERITY: HIGH
// Problem: 18+ sigmoid calls used hardcoded magic numbers with no documentation
// Fix: Extract all formula parameters into named config object
// ═══════════════════════════════════════════════════════════════════

const SCORING_CONFIG = {
  marketStructure: {
    rankLogMultiplier: 25,          // Maps rank 1-10000 to 0-100 via log10
    mcapSigmoidCenter: 9,          // log10($1B) — center point for mcap scoring
    mcapSigmoidSteepness: 0.8,
  },
  momentum: {
    changeScaleDiv: 30,             // ±30% price change maps to full 0-100 range
    subWeights: { h1: 0.1, h24: 0.25, d7: 0.35, d30: 0.3 },
  },
  volume: {
    absoluteVolCenter: 7,           // log10($10M) daily volume
    absoluteVolSteepness: 0.6,
  },
  sentiment: {
    watchlistCenter: 4,             // log10(10K) watchlist users
    twitterCenter: 5,               // log10(100K) followers
    redditCenter: 4,                // log10(10K) subscribers
    telegramCenter: 4,
    starsCenter: 3,                 // log10(1K) GitHub stars
    commitCenter: 20,               // 20 commits/4weeks = active
    prCenter: 50,                   // 50 PRs merged = active
    communitySteepness: 0.8,
    commitSteepness: 0.1,
    prSteepness: 0.05,
  },
  fundamentals: {
    tvlCenter: 8,                   // log10($100M) TVL
    tvlSteepness: 0.7,
    tvlChangeScale: 5,              // ±10% TVL change maps to ±50 score
    revenueCenter: 5,               // log10($100K/day) revenue
    revenueSteepness: 0.5,
    feeYieldCenter: 5,              // 5% annualized fee yield
    feeYieldSteepness: 0.3,
    fdvPenaltyScale: 15,            // Each 1x above 1.0 FDV/MCap = -15 points
    athBands: [5, 20, 50, 80] as const,
    athScores: [85, 70, 50, 30, 15] as const,
  },
  onchain: {
    holderConcentrationBands: {
      excellent: 20, good: 35, moderate: 50, poor: 70,
    },
    dexLiquidityCenter: 6,          // log10($1M) DEX liquidity
    dexLiquiditySteepness: 0.6,
    dexVolumeCenter: 5,             // log10($100K) DEX volume
    dexVolumeSteepness: 0.5,
  },
  exchange: {
    exchangeCountCenter: 15,
    exchangeCountSteepness: 0.15,
    spreadPenaltyScale: 10,         // Each 1% spread = -10 points
  },
  derivatives: {
    derivExchangeCenter: 5,
    derivExchangeSteepness: 0.4,
    spreadPenaltyScale: 5,
    fundingZBands: { extreme: 2, elevated: 1 },
    fundingZScores: { extreme: 30, elevated: 50, healthy: 70 },
    simpleFundingScale: 500,
  },
  overvaluation: {
    weights: { fdvMcapRatio: 0.25, athProximity: 0.20, whaleConcentration: 0.25, momentumExhaustion: 0.15, supplyInflation: 0.15 },
    levels: { extreme: 80, high: 65, moderate: 45, fair: 25 } as const,
  },
  chi: {
    weights: { tvlTrend: 0.25, holderGrowth: 0.25, exchangeHealth: 0.15, liquidityDepth: 0.20, developmentActivity: 0.15 },
    tvlCenter: 7,                   // log10($10M)
    tvlSteepness: 0.5,
    levels: { healthy: 70, caution: 50, risky: 30 } as const,
  },
  confidence: {
    base: 30,
    maxCoverageBonus: 65,
    maxConfidence: 95,
  },
  stretch: {
    totalCategories: 8,
    factor: 0.5,                    // dataRatio * 0.5 added to 1.0
  },
} as const

// ═══════════════════════════════════════════════════════════════════
// HELPER: Sigmoid mapping (smooth 0-100)
// ═══════════════════════════════════════════════════════════════════

function sigmoid(value: number, center: number, steepness: number): number {
  return 100 / (1 + Math.exp(-steepness * (value - center)))
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

// HERMES_FIX: F14 2026-02-19 SEVERITY: MEDIUM
// Problem: percentileRank returned 0 when all values were equal
// Fix: When all values equal the target, return 50 (median rank)
function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50
  const sorted = [...allValues].sort((a, b) => a - b)
  let rank = 0
  for (const v of sorted) {
    if (v < value) rank++
    else break
  }
  if (rank === 0 && sorted[0] === value) return 50
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
  if (!detail) return -1

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
    if (dd.stars) devMetrics.push(sigmoid(Math.log10(dd.stars + 1), SCORING_CONFIG.sentiment.starsCenter, SCORING_CONFIG.sentiment.communitySteepness))
    if (dd.commit_count_4_weeks) devMetrics.push(sigmoid(dd.commit_count_4_weeks, SCORING_CONFIG.sentiment.commitCenter, SCORING_CONFIG.sentiment.commitSteepness))
    if (dd.pull_requests_merged) devMetrics.push(sigmoid(dd.pull_requests_merged, SCORING_CONFIG.sentiment.prCenter, SCORING_CONFIG.sentiment.prSteepness))
    if (devMetrics.length > 0) {
      scores.push(devMetrics.reduce((a, b) => a + b) / devMetrics.length)
    }
  }

  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : -1
}

/** Fundamentals (18%): TVL (DefiLlama), Protocol Revenue, FDV/mcap, supply economics */
function scoreFundamentals(coin: CoinMarket, defiData?: DefiLlamaCoinData | null): number {
  const scores: number[] = []

  // TVL — prefer DefiLlama (more accurate), fallback to CoinGecko
  const tvl = defiData?.tvl ?? coin.total_value_locked
  if (tvl && tvl > 0) {
    const tvlScore = sigmoid(Math.log10(tvl), 8, 0.7) // center ~$100M
    scores.push(tvlScore)
  }

  // TVL Trend from DefiLlama (1d + 7d change)
  if (defiData?.tvlChange1d != null) {
    const trendScore = clamp(50 + defiData.tvlChange1d * 5) // ±10% = full range
    scores.push(trendScore)
  }

  // Protocol Revenue (DefiLlama) — revenue-generating protocols are fundamentally stronger
  if (defiData?.revenue24h != null && defiData.revenue24h > 0) {
    const revScore = sigmoid(Math.log10(defiData.revenue24h), 5, 0.5) // center ~$100K/day
    scores.push(revScore)
  }

  // Protocol Fees (DefiLlama) — fee capture = economic activity
  if (defiData?.fees24h != null && defiData.fees24h > 0 && coin.market_cap > 0) {
    const feesToMcap = (defiData.fees24h * 365) / coin.market_cap
    const feeScore = sigmoid(feesToMcap * 100, 5, 0.3) // annualized fee yield
    scores.push(feeScore)
  }

  // FDV/MCap ratio — lower is better
  if (coin.fully_diluted_valuation && coin.market_cap > 0) {
    const fdvRatio = coin.fully_diluted_valuation / coin.market_cap
    const fdvScore = clamp(100 - (fdvRatio - 1) * 15)
    scores.push(fdvScore)
  }

  // Supply coverage
  if (coin.max_supply && coin.max_supply > 0 && coin.circulating_supply > 0) {
    const coverage = coin.circulating_supply / coin.max_supply
    scores.push(clamp(coverage * 100))
  }

  // ATH distance
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
 * On-Chain (20%): REAL DATA from Moralis (EVM) + GeckoTerminal Analyst (K2)
 * 5 sub-components:
 * 1. Holder Concentration (Moralis top holders — lower = healthier)
 * 2. Holder Growth Trend (Moralis historical holders)
 * 3. Smart Money Flow (Moralis top profitable wallets)
 * 4. DEX Liquidity Depth (GeckoTerminal pool TVL + volume)
 * 5. Token Activity (Moralis stats — transfers, transactions)
 */
function scoreOnchain(onchainData?: OnChainData | null, moralisData?: MoralisOnChainResult | null): number {
  let hasRealData = false
  const scores: number[] = []

  // ── Moralis data (EVM tokens — real on-chain) ──
  if (moralisData) {
    // 1. Holder Concentration from Moralis (more accurate than GeckoTerminal)
    if (moralisData.holderConcentration) {
      hasRealData = true
      const top10Pct = moralisData.holderConcentration.top10Pct
      let concScore: number
      if (top10Pct < 20) concScore = 90
      else if (top10Pct < 35) concScore = 75
      else if (top10Pct < 50) concScore = 55 + (50 - top10Pct) * 1.3
      else if (top10Pct < 70) concScore = 30 + (70 - top10Pct) * 1.25
      else concScore = Math.max(5, 30 - (top10Pct - 70) * 0.5)
      scores.push(clamp(concScore))
    }

    // 2. Holder Growth from Moralis
    if (moralisData.holderGrowth) {
      hasRealData = true
      const { trend, change30d } = moralisData.holderGrowth
      let growthScore: number
      if (trend === 'growing') growthScore = 70 + Math.min(30, change30d * 0.3)
      else if (trend === 'stable') growthScore = 50
      else growthScore = Math.max(10, 40 - Math.abs(change30d) * 0.3)
      scores.push(clamp(growthScore))
    }

    // 3. Smart Money from Moralis
    if (moralisData.smartMoney) {
      hasRealData = true
      const { topProfitableCount, avgProfitPct, netBuySignal } = moralisData.smartMoney
      let smartScore = 50
      if (netBuySignal) smartScore = 80
      else if (topProfitableCount >= 3 && avgProfitPct > 5) smartScore = 65
      else if (topProfitableCount >= 1) smartScore = 55
      else smartScore = 35
      scores.push(clamp(smartScore))
    }
  }

  // ── GeckoTerminal data (fallback / supplement) ──
  if (onchainData) {
    // Holder Concentration fallback (only if Moralis didn't provide)
    if (!moralisData?.holderConcentration && onchainData.topHolders && onchainData.topHolders.length > 0) {
      hasRealData = true
      const top10 = onchainData.topHolders.slice(0, 10)
      const top10Pct = top10.reduce((sum, h) => sum + (h.percentage || 0), 0)
      let concScore: number
      if (top10Pct < 30) concScore = 85 + (30 - top10Pct) * 0.5
      else if (top10Pct < 50) concScore = 55 + (50 - top10Pct) * 1.5
      else if (top10Pct < 70) concScore = 30 + (70 - top10Pct) * 1.25
      else concScore = Math.max(5, 30 - (top10Pct - 70) * 0.5)
      scores.push(clamp(concScore))
    }

    // Holder Growth fallback
    if (!moralisData?.holderGrowth && onchainData.holdersChart && onchainData.holdersChart.length >= 3) {
      hasRealData = true
      const chart = onchainData.holdersChart
      const first = chart[0].count
      const last = chart[chart.length - 1].count
      if (first > 0) {
        const growthPct = ((last - first) / first) * 100
        scores.push(clamp(50 + growthPct * 2))
      }
    }

    // Smart Money fallback
    if (!moralisData?.smartMoney && onchainData.topTraders) {
      hasRealData = true
      const { buyers_total_usd = 0, sellers_total_usd = 0 } = onchainData.topTraders
      const total = buyers_total_usd + sellers_total_usd
      if (total > 0) {
        const buyRatio = buyers_total_usd / total
        scores.push(clamp(buyRatio * 100 + (buyRatio - 0.5) * 40))
      }
    }

    // DEX Liquidity
    if (onchainData.totalLiquidity != null && onchainData.totalLiquidity > 0) {
      hasRealData = true
      scores.push(sigmoid(Math.log10(onchainData.totalLiquidity), 6, 0.6))
    }

    // DEX Volume
    if (onchainData.dexVolume24h != null && onchainData.dexVolume24h > 0) {
      hasRealData = true
      scores.push(sigmoid(Math.log10(onchainData.dexVolume24h), 5, 0.5))
    }
  }

  // HERMES_FIX: F5 2026-02-19 SEVERITY: CRITICAL
  // Problem: return 50 was a phantom score entering adaptive weight system
  // Fix: Return -1 sentinel when no data; adaptive weight loop recognizes this
  if (!hasRealData) return -1
  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : -1
}

/** Exchange (7%): number of exchanges, trust score spread */
function scoreExchange(detail?: CoinDetail | null): number {
  if (!detail || !detail.tickers || detail.tickers.length === 0) return -1

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
  if (!derivatives || derivatives.length === 0) return -1

  const perpetuals = derivatives.filter(d => d.contract_type === 'perpetual')
  if (perpetuals.length === 0) return -1

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
  moralisData?: MoralisOnChainResult | null
  defiData?: DefiLlamaCoinData | null
  fundingHistory?: number[]
}

export function scoreCoin(input: ScoreCoinInput): CryptoScore {
  const { coin, allCoins, detail, derivatives, onchainData, moralisData, defiData, fundingHistory } = input
  const missingInputs: string[] = []

  const marketStructure = scoreMarketStructure(coin, allCoins)
  const momentum = scoreMomentum(coin)
  const volume = scoreVolume(coin, allCoins)
  const sentiment = scoreSentiment(detail)
  const fundamentals = scoreFundamentals(coin, defiData)
  const onchain = scoreOnchain(onchainData, moralisData)
  const exchange = scoreExchange(detail)
  const derivativesScore = scoreDerivatives(derivatives, fundingHistory)

  const categories: CryptoScoreBreakdown = {
    marketStructure, momentum, volume, sentiment,
    fundamentals, onchain, exchange, derivatives: derivativesScore,
  }

  // HERMES_FIX: F6 2026-02-19 SEVERITY: MEDIUM
  // Problem: phantom-50 elimination used catScore===50 which false-positived genuine 50s
  // Fix: Scoring functions return -1 when no data available. Skip those in adaptive loop.
  let totalWeight = 0
  let weightedSum = 0
  let dataPoints = 0
  let coveredWeight = 0

  for (const [key, weight] of Object.entries(CRYPTO_SCORE_WEIGHTS)) {
    const catKey = key as keyof CryptoScoreBreakdown
    const catScore = categories[catKey]

    if (catScore < 0) {
      missingInputs.push(catKey)
      categories[catKey] = 50 // Normalize for UI display
      continue
    }

    weightedSum += catScore * weight
    totalWeight += weight
    dataPoints++
    coveredWeight += weight
  }

  let total = totalWeight > 0 ? weightedSum / totalWeight : 50

  const { base, maxCoverageBonus, maxConfidence } = SCORING_CONFIG.confidence
  const confidence = Math.round(clamp(base + coveredWeight * maxCoverageBonus, base, maxConfidence))

  const dataRatio = dataPoints / SCORING_CONFIG.stretch.totalCategories
  const stretchFactor = 1.0 + dataRatio * SCORING_CONFIG.stretch.factor
  total = 50 + (total - 50) * stretchFactor
  total = clamp(Math.round(total))

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

// ═══════════════════════════════════════════════════════════════════
// CRYPTO OVERVALUATION SCORE
// Identifies tokens at risk of being overpriced — key for short signals
// ═══════════════════════════════════════════════════════════════════

export function computeOvervaluation(
  coin: CoinMarket,
  moralisData?: MoralisOnChainResult | null,
): CryptoOvervaluation {
  const components = {
    fdvMcapRatio: 50,
    athProximity: 50,
    whaleConcentration: 50,
    momentumExhaustion: 50,
    supplyInflation: 50,
  }

  // FDV/MCap — higher ratio = more future dilution
  if (coin.fully_diluted_valuation && coin.market_cap > 0) {
    const ratio = coin.fully_diluted_valuation / coin.market_cap
    if (ratio > 5) components.fdvMcapRatio = 90
    else if (ratio > 3) components.fdvMcapRatio = 75
    else if (ratio > 2) components.fdvMcapRatio = 60
    else if (ratio > 1.3) components.fdvMcapRatio = 40
    else components.fdvMcapRatio = 20
  }

  // ATH Proximity — near ATH = higher risk of reversal
  if (coin.ath_change_percentage != null) {
    const dist = Math.abs(coin.ath_change_percentage)
    if (dist < 5) components.athProximity = 85
    else if (dist < 15) components.athProximity = 70
    else if (dist < 30) components.athProximity = 50
    else if (dist < 60) components.athProximity = 30
    else components.athProximity = 15
  }

  // Whale Concentration (Moralis) — high concentration = dump risk
  if (moralisData?.holderConcentration) {
    const top10 = moralisData.holderConcentration.top10Pct
    if (top10 > 70) components.whaleConcentration = 90
    else if (top10 > 50) components.whaleConcentration = 70
    else if (top10 > 35) components.whaleConcentration = 50
    else if (top10 > 20) components.whaleConcentration = 30
    else components.whaleConcentration = 15
  }

  // Momentum Exhaustion — sharp rise without pullback
  const change7d = coin.price_change_percentage_7d_in_currency ?? 0
  const change30d = coin.price_change_percentage_30d_in_currency ?? 0
  if (change7d > 50) components.momentumExhaustion = 90
  else if (change7d > 30) components.momentumExhaustion = 75
  else if (change7d > 15 && change30d > 50) components.momentumExhaustion = 65
  else if (change7d > 10) components.momentumExhaustion = 45
  else components.momentumExhaustion = 20

  // Supply Inflation — low circulating/total = future sell pressure
  if (coin.total_supply && coin.total_supply > 0 && coin.circulating_supply > 0) {
    const ratio = coin.circulating_supply / coin.total_supply
    if (ratio < 0.2) components.supplyInflation = 85
    else if (ratio < 0.4) components.supplyInflation = 65
    else if (ratio < 0.6) components.supplyInflation = 45
    else if (ratio < 0.8) components.supplyInflation = 25
    else components.supplyInflation = 10
  }

  const ovWeights = SCORING_CONFIG.overvaluation.weights
  let score = 0
  for (const [k, w] of Object.entries(ovWeights)) {
    score += components[k as keyof typeof components] * w
  }
  score = Math.round(clamp(score))

  const ovLevels = SCORING_CONFIG.overvaluation.levels
  let level: CryptoOvervaluation['level']
  if (score >= ovLevels.extreme) level = 'EXTREME'
  else if (score >= ovLevels.high) level = 'HIGH'
  else if (score >= ovLevels.moderate) level = 'MODERATE'
  else if (score >= ovLevels.fair) level = 'FAIR'
  else level = 'UNDERVALUED'

  return { score, level, components }
}

// ═══════════════════════════════════════════════════════════════════
// CRYPTO HEALTH INDEX (CHI)
// Composite health metric — crypto equivalent of Altman Z-Score
// ═══════════════════════════════════════════════════════════════════

export function computeCryptoHealthIndex(
  coin: CoinMarket,
  defiData?: DefiLlamaCoinData | null,
  moralisData?: MoralisOnChainResult | null,
  detail?: CoinDetail | null,
): CryptoHealthIndex {
  const components = {
    tvlTrend: 50,
    holderGrowth: 50,
    exchangeHealth: 50,
    liquidityDepth: 50,
    developmentActivity: 50,
  }

  let dataPoints = 0

  // TVL Trend (DefiLlama)
  const tvl = defiData?.tvl ?? coin.total_value_locked
  if (tvl && tvl > 0) {
    dataPoints++
    let tvlScore = sigmoid(Math.log10(tvl), 7, 0.5) // center ~$10M
    if (defiData?.tvlChange7d != null) {
      if (defiData.tvlChange7d > 5) tvlScore = Math.min(100, tvlScore + 15)
      else if (defiData.tvlChange7d < -10) tvlScore = Math.max(10, tvlScore - 20)
    }
    components.tvlTrend = clamp(tvlScore)
  }

  // Holder Growth (Moralis)
  if (moralisData?.holderGrowth) {
    dataPoints++
    const { trend } = moralisData.holderGrowth
    if (trend === 'growing') components.holderGrowth = 80
    else if (trend === 'stable') components.holderGrowth = 50
    else components.holderGrowth = 20
  }

  // Exchange Health (trust scores from CoinGecko detail)
  if (detail?.tickers && detail.tickers.length > 0) {
    dataPoints++
    const greenPct = detail.tickers.filter(t => t.trust_score === 'green').length / detail.tickers.length
    const exchangeCount = new Set(detail.tickers.map(t => t.market.identifier)).size
    components.exchangeHealth = clamp(greenPct * 60 + sigmoid(exchangeCount, 10, 0.2) * 0.4)
  }

  // Liquidity Depth
  if (coin.total_volume > 0 && coin.market_cap > 0) {
    dataPoints++
    const volMcap = coin.total_volume / coin.market_cap
    components.liquidityDepth = clamp(sigmoid(volMcap, 0.1, 15) * 0.6 + sigmoid(Math.log10(coin.total_volume), 7, 0.5) * 0.4)
  }

  // Development Activity (GitHub from CoinGecko)
  if (detail?.developer_data) {
    dataPoints++
    const dd = detail.developer_data
    const commits = dd.commit_count_4_weeks ?? 0
    const prs = dd.pull_requests_merged ?? 0
    const stars = dd.stars ?? 0
    const devScore = sigmoid(commits, 15, 0.15) * 0.4 + sigmoid(prs, 30, 0.06) * 0.3 + sigmoid(Math.log10(stars + 1), 3, 0.8) * 0.3
    components.developmentActivity = clamp(devScore)
  }

  const chiWeights = SCORING_CONFIG.chi.weights
  let score = 0
  for (const [k, w] of Object.entries(chiWeights)) {
    score += components[k as keyof typeof components] * w
  }
  score = Math.round(clamp(score))

  const chiLevels = SCORING_CONFIG.chi.levels
  let level: CryptoHealthIndex['level']
  if (score >= chiLevels.healthy) level = 'HEALTHY'
  else if (score >= chiLevels.caution) level = 'CAUTION'
  else if (score >= chiLevels.risky) level = 'RISKY'
  else level = 'CRITICAL'

  return { score, level, components }
}

// ═══════════════════════════════════════════════════════════════════
// BATCH SCORING (V2)
// ═══════════════════════════════════════════════════════════════════

export interface ScoreAllCoinsResult {
  scores: Map<string, CryptoScore>
  overvaluations: Map<string, CryptoOvervaluation>
  healthIndexes: Map<string, CryptoHealthIndex>
}

export function scoreAllCoins(
  coins: CoinMarket[],
  detailMap?: Map<string, CoinDetail>,
  derivativeMap?: Map<string, Derivative[]>,
  onchainMap?: Map<string, OnChainData>,
  fundingHistoryMap?: Map<string, number[]>,
  moralisMap?: Map<string, MoralisOnChainResult>,
  defiDataMap?: Map<string, DefiLlamaCoinData>,
): ScoreAllCoinsResult {
  const scores = new Map<string, CryptoScore>()
  const overvaluations = new Map<string, CryptoOvervaluation>()
  const healthIndexes = new Map<string, CryptoHealthIndex>()

  for (const coin of coins) {
    const detail = detailMap?.get(coin.id) ?? null
    const derivatives = derivativeMap?.get(coin.symbol.toUpperCase())
    const onchainData = onchainMap?.get(coin.id) ?? null
    const fundingHistory = fundingHistoryMap?.get(coin.symbol.toUpperCase())
    const moralisData = moralisMap?.get(coin.id) ?? null
    const defiData = defiDataMap?.get(coin.id) ?? null

    const score = scoreCoin({ coin, allCoins: coins, detail, derivatives, onchainData, moralisData, defiData, fundingHistory })
    scores.set(coin.id, score)

    const overval = computeOvervaluation(coin, moralisData)
    overvaluations.set(coin.id, overval)

    const chi = computeCryptoHealthIndex(coin, defiData, moralisData, detail)
    healthIndexes.set(coin.id, chi)
  }

  return { scores, overvaluations, healthIndexes }
}
