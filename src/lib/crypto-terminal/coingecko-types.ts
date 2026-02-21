// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — CoinGecko TypeScript Definitions
// Analyst Plan — 75+ endpoint, WebSocket, on-chain DEX data
// ═══════════════════════════════════════════════════════════════════

// ─── Score System ──────────────────────────────────────────────────

export type CryptoScoreLevel = 'STRONG' | 'GOOD' | 'NEUTRAL' | 'WEAK' | 'BAD'

export interface CryptoScoreBreakdown {
  marketStructure: number   // 0-100 (agirlik: 17%) — mcap rank, supply ratio, mcap size
  momentum: number          // 0-100 (agirlik: 15%) — 1h/24h/7d/30d price change
  volume: number            // 0-100 (agirlik: 13%) — volume/mcap percentile, abs volume
  sentiment: number         // 0-100 (agirlik: 10%) — community, developer, public interest
  fundamentals: number      // 0-100 (agirlik: 13%) — TVL, FDV/mcap, supply ratio
  onchain: number           // 0-100 (agirlik: 15%) — holder conc, growth, smart money, DEX liq
  exchange: number          // 0-100 (agirlik: 7%)  — exchange count, trust score spread
  derivatives: number       // 0-100 (agirlik: 10%) — funding z-score, OI, spread
}

export interface CryptoScore {
  total: number
  level: CryptoScoreLevel
  categories: CryptoScoreBreakdown
  confidence: number
  degraded: boolean
  missingInputs: string[]
  timestamp: string
}

// K13: Revised weights — 6/6 AI Consensus (On-Chain 10→15%, Derivatives 5→10%)
export const CRYPTO_SCORE_WEIGHTS: Record<keyof CryptoScoreBreakdown, number> = {
  marketStructure: 0.17,
  momentum: 0.15,
  volume: 0.13,
  sentiment: 0.10,
  fundamentals: 0.13,
  onchain: 0.15,      // Was 0.10 — critical for crypto, now with real data
  exchange: 0.07,
  derivatives: 0.10,  // Was 0.05 — funding z-score + OI is key signal
}

export const CRYPTO_CATEGORY_LABELS: Record<keyof CryptoScoreBreakdown, string> = {
  marketStructure: 'Market',
  momentum: 'Momentum',
  volume: 'Volume',
  sentiment: 'Sentiment',
  fundamentals: 'Temel',
  onchain: 'On-Chain',
  exchange: 'Borsa',
  derivatives: 'Turev',
}

// Score level helpers
export function getCryptoScoreLevel(score: number): CryptoScoreLevel {
  if (score >= 80) return 'STRONG'
  if (score >= 60) return 'GOOD'
  if (score >= 40) return 'NEUTRAL'
  if (score >= 20) return 'WEAK'
  return 'BAD'
}

export function getCryptoScoreColor(level: CryptoScoreLevel): string {
  switch (level) {
    case 'STRONG': return 'text-amber-400'
    case 'GOOD': return 'text-emerald-400'
    case 'NEUTRAL': return 'text-slate-300'
    case 'WEAK': return 'text-orange-400'
    case 'BAD': return 'text-red-400'
  }
}

export const CRYPTO_SCORE_LABELS: Record<CryptoScoreLevel, string> = {
  STRONG: 'GUCLU',
  GOOD: 'IYI',
  NEUTRAL: 'NOTR',
  WEAK: 'ZAYIF',
  BAD: 'KOTU',
}

// ─── CoinGecko API Types ───────────────────────────────────────────

// /coins/markets
export interface CoinMarket {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  fully_diluted_valuation: number | null
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number | null
  max_supply: number | null
  ath: number
  ath_change_percentage: number
  ath_date: string
  atl: number
  atl_change_percentage: number
  atl_date: string
  last_updated: string
  // Sparkline
  sparkline_in_7d?: { price: number[] }
  // Price changes
  price_change_percentage_1h_in_currency?: number
  price_change_percentage_24h_in_currency?: number
  price_change_percentage_7d_in_currency?: number
  price_change_percentage_14d_in_currency?: number
  price_change_percentage_30d_in_currency?: number
  price_change_percentage_200d_in_currency?: number
  price_change_percentage_1y_in_currency?: number
  // Total value locked (DeFi)
  total_value_locked?: number | null
}

// /coins/{id} (detailed)
export interface CoinDetail {
  id: string
  symbol: string
  name: string
  web_slug: string
  categories: string[]
  description: { en: string }
  links: {
    homepage: string[]
    whitepaper: string
    blockchain_site: string[]
    official_forum_url: string[]
    chat_url: string[]
    announcement_url: string[]
    twitter_screen_name: string
    facebook_username: string
    telegram_channel_identifier: string
    subreddit_url: string
    repos_url: { github: string[]; bitbucket: string[] }
  }
  image: { thumb: string; small: string; large: string }
  genesis_date: string | null
  sentiment_votes_up_percentage: number
  sentiment_votes_down_percentage: number
  watchlist_portfolio_users: number
  market_cap_rank: number
  market_data: CoinMarketData
  community_data: CoinCommunityData
  developer_data: CoinDeveloperData
  tickers: CoinTicker[]
  last_updated: string
}

export interface CoinMarketData {
  current_price: Record<string, number>
  total_value_locked: number | null
  mcap_to_tvl_ratio: number | null
  fdv_to_tvl_ratio: number | null
  ath: Record<string, number>
  ath_change_percentage: Record<string, number>
  ath_date: Record<string, string>
  atl: Record<string, number>
  atl_change_percentage: Record<string, number>
  atl_date: Record<string, string>
  market_cap: Record<string, number>
  market_cap_rank: number
  fully_diluted_valuation: Record<string, number>
  market_cap_fdv_ratio: number
  total_volume: Record<string, number>
  high_24h: Record<string, number>
  low_24h: Record<string, number>
  price_change_24h: number
  price_change_percentage_24h: number
  price_change_percentage_7d: number
  price_change_percentage_14d: number
  price_change_percentage_30d: number
  price_change_percentage_60d: number
  price_change_percentage_200d: number
  price_change_percentage_1y: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  total_supply: number | null
  max_supply: number | null
  circulating_supply: number
  sparkline_7d?: { price: number[] }
}

export interface CoinCommunityData {
  facebook_likes: number | null
  twitter_followers: number | null
  reddit_average_posts_48h: number
  reddit_average_comments_48h: number
  reddit_subscribers: number
  reddit_accounts_active_48h: number
  telegram_channel_user_count: number | null
}

export interface CoinDeveloperData {
  forks: number
  stars: number
  subscribers: number
  total_issues: number
  closed_issues: number
  pull_requests_merged: number
  pull_request_contributors: number
  code_additions_deletions_4_weeks: { additions: number | null; deletions: number | null }
  commit_count_4_weeks: number
  last_4_weeks_commit_activity_series: number[]
}

export interface CoinTicker {
  base: string
  target: string
  market: { name: string; identifier: string; has_trading_incentive: boolean }
  last: number
  volume: number
  converted_last: { btc: number; eth: number; usd: number }
  converted_volume: { btc: number; eth: number; usd: number }
  trust_score: string | null
  bid_ask_spread_percentage: number | null
  timestamp: string
  last_traded_at: string
  last_fetch_at: string
  is_anomaly: boolean
  is_stale: boolean
  trade_url: string | null
  coin_id: string
  target_coin_id?: string
}

// /global
export interface GlobalData {
  data: {
    active_cryptocurrencies: number
    upcoming_icos: number
    ongoing_icos: number
    ended_icos: number
    markets: number
    total_market_cap: Record<string, number>
    total_volume: Record<string, number>
    market_cap_percentage: Record<string, number>
    market_cap_change_percentage_24h_usd: number
    updated_at: number
  }
}

// /global/decentralized_finance_defi
export interface GlobalDeFiData {
  data: {
    defi_market_cap: string
    eth_market_cap: string
    defi_to_eth_ratio: string
    trading_volume_24h: string
    defi_dominance: string
    top_coin_name: string
    top_coin_defi_dominance: number
  }
}

// /search/trending
export interface TrendingData {
  coins: Array<{
    item: {
      id: string
      coin_id: number
      name: string
      symbol: string
      market_cap_rank: number
      thumb: string
      small: string
      large: string
      slug: string
      price_btc: number
      score: number
      data: {
        price: number
        price_btc: string
        price_change_percentage_24h: Record<string, number>
        market_cap: string
        market_cap_btc: string
        total_volume: string
        total_volume_btc: string
        sparkline: string
        content: { title: string; description: string } | null
      }
    }
  }>
  nfts: Array<{
    id: string
    name: string
    symbol: string
    thumb: string
    nft_contract_id: number
    native_currency_symbol: string
    floor_price_in_native_currency: number
    floor_price_24h_percentage_change: number
    data: {
      floor_price: string
      floor_price_in_usd_24h_percentage_change: string
      h24_volume: string
      h24_average_sale_price: string
      sparkline: string
      content: null
    }
  }>
  categories: Array<{
    id: number
    name: string
    market_cap_1h_change: number
    slug: string
    coins_count: number
    data: {
      market_cap: number
      market_cap_btc: number
      total_volume: number
      total_volume_btc: number
      market_cap_change_percentage_24h: Record<string, number>
      sparkline: string
    }
  }>
}

// /coins/{id}/ohlc
export interface OHLCData {
  // [timestamp, open, high, low, close]
  data: [number, number, number, number, number][]
}

// /coins/{id}/market_chart
export interface MarketChartData {
  prices: [number, number][]
  market_caps: [number, number][]
  total_volumes: [number, number][]
}

// /coins/categories
export interface CoinCategory {
  id: string
  name: string
  market_cap: number
  market_cap_change_24h: number
  content: string
  top_3_coins: string[]
  volume_24h: number
  updated_at: string
}

// /exchanges
export interface Exchange {
  id: string
  name: string
  year_established: number | null
  country: string | null
  description: string
  url: string
  image: string
  has_trading_incentive: boolean
  trust_score: number
  trust_score_rank: number
  trade_volume_24h_btc: number
  trade_volume_24h_btc_normalized: number
}

// /exchanges/{id}
export interface ExchangeDetail {
  name: string
  year_established: number | null
  country: string | null
  description: string
  url: string
  image: string
  facebook_url: string
  reddit_url: string
  telegram_url: string
  slack_url: string
  other_url_1: string
  other_url_2: string
  twitter_handle: string
  has_trading_incentive: boolean
  centralized: boolean
  public_notice: string
  alert_notice: string
  trust_score: number
  trust_score_rank: number
  trade_volume_24h_btc: number
  trade_volume_24h_btc_normalized: number
  tickers: ExchangeTicker[]
  status_updates: unknown[]
}

export interface ExchangeTicker {
  base: string
  target: string
  market: { name: string; identifier: string; has_trading_incentive: boolean }
  last: number
  volume: number
  converted_last: { btc: number; eth: number; usd: number }
  converted_volume: { btc: number; eth: number; usd: number }
  trust_score: string | null
  bid_ask_spread_percentage: number | null
  timestamp: string
  last_traded_at: string
  last_fetch_at: string
  is_anomaly: boolean
  is_stale: boolean
  trade_url: string | null
  coin_id: string
  target_coin_id?: string
}

// /derivatives
export interface Derivative {
  market: string
  symbol: string
  index_id: string
  price: string
  price_percentage_change_24h: number
  contract_type: string
  index: number | null
  basis: number
  spread: number | null
  funding_rate: number | null
  open_interest: number | null
  volume_24h: number
  last_traded_at: number
  expired_at: string | null
}

// /derivatives/exchanges
export interface DerivativeExchange {
  name: string
  id: string
  open_interest_btc: number | null
  trade_volume_24h_btc: string
  number_of_perpetual_pairs: number
  number_of_futures_pairs: number
  image: string
  year_established: number | null
  country: string | null
  description: string
  url: string
}

// /companies/public_treasury/{coin_id}
export interface PublicTreasury {
  total_holdings: number
  total_value_usd: number
  market_cap_dominance: number
  companies: TreasuryCompany[]
}

export interface TreasuryCompany {
  name: string
  symbol: string
  country: string
  total_holdings: number
  total_entry_value_usd: number
  total_current_value_usd: number
  percentage_of_total_supply: number
}

// Fear & Greed (crypto-specific)
export interface CryptoFearGreed {
  index: number
  label: string
  components: {
    btcDominance: number
    volumeMomentum: number
    priceMomentum: number
    marketBreadth: number
    altcoinSeason: number
    defiStrength: number
    derivativeSentiment: number
  }
}

// ─── GeckoTerminal (On-Chain DEX Data) ─────────────────────────────

export interface GeckoTerminalPool {
  id: string
  type: string
  attributes: {
    base_token_price_usd: string
    base_token_price_native_currency: string
    quote_token_price_usd: string
    quote_token_price_native_currency: string
    base_token_price_quote_token: string
    quote_token_price_base_token: string
    address: string
    name: string
    pool_created_at: string
    fdv_usd: string
    market_cap_usd: string | null
    price_change_percentage: {
      m5: string
      h1: string
      h6: string
      h24: string
    }
    transactions: {
      m5: { buys: number; sells: number; buyers: number; sellers: number }
      m15: { buys: number; sells: number; buyers: number; sellers: number }
      m30: { buys: number; sells: number; buyers: number; sellers: number }
      h1: { buys: number; sells: number; buyers: number; sellers: number }
      h24: { buys: number; sells: number; buyers: number; sellers: number }
    }
    volume_usd: {
      m5: string
      h1: string
      h6: string
      h24: string
    }
    reserve_in_usd: string
  }
  relationships: {
    base_token: { data: { id: string; type: string } }
    quote_token: { data: { id: string; type: string } }
    dex: { data: { id: string; type: string } }
  }
}

// ─── Composite Types (for API routes) ──────────────────────────────

export interface CryptoMarketDashboard {
  global: GlobalData['data'] | null
  globalDefi: GlobalDeFiData['data'] | null
  trending: TrendingData | null
  fearGreed: CryptoFearGreed | null
  topGainers: CoinMarket[]
  topLosers: CoinMarket[]
  btcDominance: number
  ethDominance: number
  totalMarketCap: number
  total24hVolume: number
  activeCryptos: number
  activeExchanges: number
}

export interface CryptoTerminalCoin {
  id: string
  symbol: string
  name: string
  image: string
  price: number
  change1h: number
  change24h: number
  change7d: number
  change30d: number
  marketCap: number
  marketCapRank: number
  volume24h: number
  volumeToMcap: number
  circulatingSupply: number
  totalSupply: number | null
  maxSupply: number | null
  ath: number
  athChangePercent: number
  athDate: string
  atl: number
  atlChangePercent: number
  fdv: number | null
  tvl: number | null
  sparkline7d: number[]
  score: CryptoScore | null
}

// Newly listed coins
export interface NewCoin {
  id: string
  symbol: string
  name: string
  activated_at: number
}

// Top gainers/losers (Analyst plan)
export interface TopMover {
  id: string
  symbol: string
  name: string
  image: string
  market_cap_rank: number
  usd: number
  usd_24h_vol: number
  usd_24h_change: number
  usd_1h_change: number
  usd_7d_change: number
  usd_30d_change: number
}

// Token holders
export interface TokenHolder {
  address: string
  balance: string
  percentage: number
}

// /coins/{id}/history
export interface CoinHistoryData {
  id: string
  symbol: string
  name: string
  market_data: {
    current_price: Record<string, number>
    market_cap: Record<string, number>
    total_volume: Record<string, number>
  }
}

// OHLCV range response (Analyst plan)
export interface OHLCVRangeData {
  // [timestamp, open, high, low, close]
  data: [number, number, number, number, number][]
}

// ─── API Key Info ──────────────────────────────────────────────────

export interface CoinGeckoKeyInfo {
  plan: string
  rate_limit_request_per_minute: number
  monthly_call_credit: number
  current_total_monthly_calls: number
  current_remaining_monthly_calls: number
}
