// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/market
// Global market data, trending, Fear & Greed, gainers/losers
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import logger from '@/lib/logger'
import {
  fetchGlobalData, fetchGlobalDeFi, fetchTrending,
  fetchCoinsMarkets, fetchTopGainersLosers,
} from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import {
  GlobalData, GlobalDeFiData, TrendingData,
  CoinMarket, CryptoFearGreed, CryptoMarketDashboard,
  AlternativeFearGreedData,
} from '@/lib/crypto-terminal/coingecko-types'
import { fetchAlternativeFearGreed } from '@/lib/crypto-terminal/alternative-fg-client'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function computeCryptoFearGreed(
  global: GlobalData['data'] | null,
  coins: CoinMarket[],
  trending: TrendingData | null,
): CryptoFearGreed {
  const components = {
    btcDominance: 50,
    volumeMomentum: 50,
    priceMomentum: 50,
    marketBreadth: 50,
    altcoinSeason: 50,
    defiStrength: 50,
    derivativeSentiment: 50,
  }

  // 1. BTC Dominance (inverse — high BTC dom = fear, low = greed)
  if (global?.market_cap_percentage?.btc) {
    const btcDom = global.market_cap_percentage.btc
    // 70% btc dom = extreme fear (20), 40% = greed (80)
    components.btcDominance = Math.max(0, Math.min(100, 100 - (btcDom - 40) * (80 / 30)))
  }

  // 2. Volume Momentum (24h volume change)
  if (global?.total_volume?.usd && global?.total_market_cap?.usd) {
    const volToMcap = global.total_volume.usd / global.total_market_cap.usd
    // Normal vol/mcap ratio ~0.05-0.15
    components.volumeMomentum = Math.max(0, Math.min(100, volToMcap * 500))
  }

  // 3. Price Momentum (market cap 24h change)
  if (global?.market_cap_change_percentage_24h_usd != null) {
    const change = global.market_cap_change_percentage_24h_usd
    components.priceMomentum = Math.max(0, Math.min(100, 50 + change * 10))
  }

  // 4. Market Breadth (% of top coins in green)
  if (coins.length > 0) {
    const greenCoins = coins.filter(c => (c.price_change_percentage_24h ?? 0) > 0).length
    components.marketBreadth = (greenCoins / coins.length) * 100
  }

  // 5. Altcoin Season (ETH + top alts vs BTC)
  if (global?.market_cap_percentage) {
    const ethDom = global.market_cap_percentage.eth ?? 0
    const btcDom = global.market_cap_percentage.btc ?? 50
    // High altcoin share = greed/risk-on
    components.altcoinSeason = Math.max(0, Math.min(100, (100 - btcDom) * 1.2))
  }

  // 6. DeFi Strength (defi market cap ratio + trending count)
  if (global?.total_market_cap?.usd) {
    const defiMcap = (global as Record<string, unknown>).defi_market_cap
    if (typeof defiMcap === 'number' && defiMcap > 0) {
      const defiRatio = defiMcap / global.total_market_cap.usd
      components.defiStrength = Math.max(0, Math.min(100, defiRatio * 1000))
    } else if (trending?.coins) {
      components.defiStrength = Math.max(0, Math.min(100, trending.coins.length * 7))
    }
  }

  // Weighted average (7 components)
  const weights = {
    btcDominance: 0.20,
    volumeMomentum: 0.15,
    priceMomentum: 0.25,
    marketBreadth: 0.20,
    altcoinSeason: 0.10,
    defiStrength: 0.05,
    derivativeSentiment: 0.05,
  }

  let index = 0
  for (const [key, weight] of Object.entries(weights)) {
    index += (components[key as keyof typeof components] ?? 50) * weight
  }
  index = Math.round(Math.max(0, Math.min(100, index)))

  let label: string
  if (index <= 15) label = 'EXTREME FEAR'
  else if (index <= 30) label = 'FEAR'
  else if (index <= 45) label = 'SLIGHT FEAR'
  else if (index <= 55) label = 'NEUTRAL'
  else if (index <= 70) label = 'SLIGHT GREED'
  else if (index <= 85) label = 'GREED'
  else label = 'EXTREME GREED'

  // HERMES_FIX: S6 2026-02-19 SEVERITY: HIGH
  // Only return index and label to client — component weights are proprietary IP
  return { index, label }
}

export async function GET(request: Request) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`crypto-market:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    // Fetch all data in parallel (cached individually)
    const [globalRes, defiRes, trendingRes, coinsRes, gainersLosersRes, altFGRes] = await Promise.allSettled([
      getCached<GlobalData>('crypto-global', CRYPTO_CACHE_TTL.GLOBAL, () => fetchGlobalData() as Promise<GlobalData>),
      getCached<GlobalDeFiData>('crypto-defi', CRYPTO_CACHE_TTL.GLOBAL, () => fetchGlobalDeFi() as Promise<GlobalDeFiData>),
      getCached<TrendingData>('crypto-trending', CRYPTO_CACHE_TTL.TRENDING, () => fetchTrending() as Promise<TrendingData>),
      getCached<CoinMarket[]>('crypto-coins-top100', CRYPTO_CACHE_TTL.COINS_LIST, () => fetchCoinsMarkets(1, 100, false) as Promise<CoinMarket[]>),
      getCached<{ top_gainers: unknown[]; top_losers: unknown[] }>('crypto-gainers-losers', CRYPTO_CACHE_TTL.GAINERS_LOSERS, () => fetchTopGainersLosers('24h') as Promise<{ top_gainers: unknown[]; top_losers: unknown[] }>),
      getCached<AlternativeFearGreedData>('crypto-alt-fg', CRYPTO_CACHE_TTL.GLOBAL, () => fetchAlternativeFearGreed(30) as Promise<AlternativeFearGreedData>),
    ])

    const global = globalRes.status === 'fulfilled' ? globalRes.value?.data ?? null : null
    const globalDefi = defiRes.status === 'fulfilled' ? defiRes.value?.data ?? null : null
    const trending = trendingRes.status === 'fulfilled' ? trendingRes.value : null
    const coins = coinsRes.status === 'fulfilled' ? coinsRes.value ?? [] : []
    const gainersLosers = gainersLosersRes.status === 'fulfilled' ? gainersLosersRes.value : null
    const alternativeFG = altFGRes.status === 'fulfilled' ? altFGRes.value : null

    // Compute our internal Fear & Greed
    const fearGreed = computeCryptoFearGreed(global, coins, trending)

    const sortedByChange = [...coins].sort((a, b) =>
      (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0))
    const topGainers = (gainersLosers?.top_gainers as CoinMarket[]) ?? sortedByChange.slice(0, 10)
    const topLosers = (gainersLosers?.top_losers as CoinMarket[]) ?? sortedByChange.slice(-10).reverse()

    const dashboard: CryptoMarketDashboard = {
      global,
      globalDefi,
      trending,
      fearGreed,
      alternativeFG,
      topGainers,
      topLosers,
      btcDominance: global?.market_cap_percentage?.btc ?? 0,
      ethDominance: global?.market_cap_percentage?.eth ?? 0,
      totalMarketCap: global?.total_market_cap?.usd ?? 0,
      total24hVolume: global?.total_volume?.usd ?? 0,
      activeCryptos: global?.active_cryptocurrencies ?? 0,
      activeExchanges: global?.markets ?? 0,
    }

    return NextResponse.json(dashboard)
  } catch (err) {
    // HERMES_FIX: S7 2026-02-19 SEVERITY: MEDIUM
    // Log full error server-side, return generic message to client
    logger.error('Crypto market fetch failed', {
      module: 'crypto-market',
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Failed to fetch market data', timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
