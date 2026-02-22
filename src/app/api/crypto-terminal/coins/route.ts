// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/coins
// V2: DefiLlama TVL/Revenue + Moralis On-Chain + Overvaluation + CHI
// 1000 coins per page, 1h cache, parallel data fetch
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchCoinsMarkets, fetchCoinsList } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { scoreAllCoins, ScoreAllCoinsResult } from '@/lib/crypto-terminal/crypto-score-engine'
import { CoinMarket, CryptoTerminalCoin, CryptoScore, CryptoOvervaluation, CryptoHealthIndex, CryptoScorePublic, CryptoOvervaluationPublic, CryptoHealthIndexPublic } from '@/lib/crypto-terminal/coingecko-types'
import { getDefiLlamaDataBatch, DefiLlamaCoinData } from '@/lib/crypto-terminal/defillama-client'
import { getMoralisOnChainBatch, extractEVMAddresses, MoralisOnChainResult } from '@/lib/crypto-terminal/moralis-client'
import { computeCryptoTargetFloor } from '@/lib/crypto-terminal/crypto-target-engine'
import logger from '@/lib/logger'
import { providerMonitor } from '@/lib/monitor/provider-monitor'

export const dynamic = 'force-dynamic'

const CG_PAGE_SIZE = 250
const COINS_PER_PAGE = 1000
const CG_PAGES_PER_FRONTEND_PAGE = COINS_PER_PAGE / CG_PAGE_SIZE

// HERMES_FIX: S1 2026-02-19 SEVERITY: HIGH
// Problem: Full score breakdown (categories, missingInputs, weights) leaked to client
// Root cause: transformCoin passed raw CryptoScore including all internals
// Fix: Sanitize score to only include total, level, confidence, degraded
// Verified: Client receives score.total/level/confidence only — no category breakdown
function sanitizeScore(raw: CryptoScore | undefined | null): CryptoScorePublic | null {
  if (!raw) return null
  return {
    total: raw.total,
    level: raw.level,
    confidence: raw.confidence,
    degraded: raw.degraded,
  }
}

// HERMES_FIX: S10-OV 2026-02-19 SEVERITY: HIGH
// Problem: Full overvaluation/CHI component breakdowns leaked to client
// Fix: Only return score and level, strip internal component weights
function sanitizeOvervaluation(raw: CryptoOvervaluation | undefined | null): CryptoOvervaluationPublic | null {
  if (!raw) return null
  return { score: raw.score, level: raw.level }
}

function sanitizeHealthIndex(raw: CryptoHealthIndex | undefined | null): CryptoHealthIndexPublic | null {
  if (!raw) return null
  return { score: raw.score, level: raw.level }
}

function transformCoin(
  coin: CoinMarket,
  scores: Map<string, CryptoScore>,
  overvaluations: Map<string, CryptoOvervaluation>,
  healthIndexes: Map<string, CryptoHealthIndex>,
  defiMap: Map<string, DefiLlamaCoinData>,
): CryptoTerminalCoin {
  const defi = defiMap.get(coin.id)
  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image,
    price: coin.current_price,
    change1h: coin.price_change_percentage_1h_in_currency ?? 0,
    change24h: coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h ?? 0,
    change7d: coin.price_change_percentage_7d_in_currency ?? 0,
    change30d: coin.price_change_percentage_30d_in_currency ?? 0,
    marketCap: coin.market_cap,
    marketCapRank: coin.market_cap_rank,
    volume24h: coin.total_volume,
    volumeToMcap: coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0,
    circulatingSupply: coin.circulating_supply,
    totalSupply: coin.total_supply,
    maxSupply: coin.max_supply,
    ath: coin.ath,
    athChangePercent: coin.ath_change_percentage,
    athDate: coin.ath_date,
    atl: coin.atl,
    atlChangePercent: coin.atl_change_percentage,
    fdv: coin.fully_diluted_valuation,
    tvl: defi?.tvl ?? coin.total_value_locked ?? null,
    sparkline7d: coin.sparkline_in_7d?.price ?? [],
    score: sanitizeScore(scores.get(coin.id)),
    defiLlama: defi ? {
      tvl: defi.tvl,
      tvlChange1d: defi.tvlChange1d,
      tvlChange7d: defi.tvlChange7d,
      revenue24h: defi.revenue24h,
      fees24h: defi.fees24h,
      category: defi.category,
      protocolName: defi.protocolName,
    } : null,
    overvaluation: sanitizeOvervaluation(overvaluations.get(coin.id)),
    healthIndex: sanitizeHealthIndex(healthIndexes.get(coin.id)),
    priceTarget: (() => {
      const ov = overvaluations.get(coin.id)
      const hi = healthIndexes.get(coin.id)
      const sc = scores.get(coin.id)
      return computeCryptoTargetFloor({
        price: coin.current_price,
        ath: coin.ath ?? 0,
        atl: coin.atl ?? 0,
        athChangePct: coin.ath_change_percentage ?? 0,
        change24h: coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h ?? 0,
        change7d: coin.price_change_percentage_7d_in_currency ?? 0,
        change30d: coin.price_change_percentage_30d_in_currency ?? 0,
        marketCap: coin.market_cap ?? 0,
        fdv: coin.fully_diluted_valuation ?? null,
        tvl: defi?.tvl ?? coin.total_value_locked ?? null,
        volumeToMcap: coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0,
        overvaluationScore: ov?.score ?? 50,
        overvaluationLevel: ov?.level ?? 'NEUTRAL',
        healthScore: hi?.score ?? 50,
        healthLevel: hi?.level ?? 'NEUTRAL',
        hermesSkor: sc?.total ?? 50,
        hermesLevel: sc?.level ?? 'NEUTRAL',
      })
    })(),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const frontendPage = Math.max(1, parseInt(searchParams.get('page') || '1'))

    const cgStartPage = (frontendPage - 1) * CG_PAGES_PER_FRONTEND_PAGE + 1

    // Fetch CoinGecko market data (4 pages in parallel, cached)
    const promises = Array.from({ length: CG_PAGES_PER_FRONTEND_PAGE }, (_, i) => {
      const cgPage = cgStartPage + i
      const includeSparkline = cgPage <= 4
      return getCached<CoinMarket[]>(
        `crypto-coins-v4-p${cgPage}`,
        CRYPTO_CACHE_TTL.COINS_LIST,
        () => fetchCoinsMarkets(cgPage, CG_PAGE_SIZE, includeSparkline, '1h,24h,7d,30d') as Promise<CoinMarket[]>,
      )
    })

    const results = await Promise.allSettled(promises)
    const allCoins: CoinMarket[] = []
    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        allCoins.push(...r.value)
      }
    }

    if (allCoins.length === 0) {
      return NextResponse.json({
        error: 'No coin data available',
        coins: [], page: frontendPage, total: 0, hasMore: false,
      }, { status: 502 })
    }

    // V2: Fetch DefiLlama + Moralis data in parallel (cached 6h)
    const coinIds = allCoins.map(c => c.id)

    const [defiDataMap, moralisMap] = await Promise.all([
      getCached<Map<string, DefiLlamaCoinData>>(
        `defi-llama-batch-p${frontendPage}`,
        6 * 60 * 60 * 1000, // 6h cache
        async () => {
          const data = await getDefiLlamaDataBatch(coinIds)
          return data
        },
      ).catch((err) => {
        logger.warn('DefiLlama batch fetch failed, proceeding without TVL data', {
          module: 'crypto-coins', error: err instanceof Error ? err.message : String(err),
        })
        return new Map<string, DefiLlamaCoinData>()
      }),

      getCached<Map<string, MoralisOnChainResult>>(
        `moralis-onchain-p${frontendPage}`,
        6 * 60 * 60 * 1000, // 6h cache
        async () => {
          // Only fetch for top 200 coins on page 1 (budget)
          if (frontendPage > 1) return new Map<string, MoralisOnChainResult>()
          const coinsList = await getCached<Array<{ id: string; platforms?: Record<string, string> }>>(
            'crypto-coins-list-platforms',
            24 * 60 * 60 * 1000, // 24h cache
            () => fetchCoinsList() as Promise<Array<{ id: string; platforms?: Record<string, string> }>>,
          )
          const evmTokens = extractEVMAddresses(coinsList ?? [], coinIds.slice(0, 200))
          return getMoralisOnChainBatch(evmTokens, 200)
        },
      ).catch((err) => {
        logger.warn('Moralis on-chain batch fetch failed, proceeding without holder data', {
          module: 'crypto-coins', error: err instanceof Error ? err.message : String(err),
        })
        return new Map<string, MoralisOnChainResult>()
      }),
    ])

    // Score all coins with V2 data
    const { scores, overvaluations, healthIndexes } = scoreAllCoins(
      allCoins,
      undefined,    // detailMap — not fetched in batch
      undefined,    // derivativeMap
      undefined,    // onchainMap (GeckoTerminal)
      undefined,    // fundingHistoryMap
      moralisMap instanceof Map ? moralisMap : new Map(),
      defiDataMap instanceof Map ? defiDataMap : new Map(),
    )

    const terminalCoins = allCoins.map(coin => transformCoin(
      coin, scores, overvaluations, healthIndexes,
      defiDataMap instanceof Map ? defiDataMap : new Map(),
    ))

    const estimatedTotal = 18500
    const hasMore = allCoins.length >= COINS_PER_PAGE

    logger.info(`Crypto coins V2: ${terminalCoins.length} coins, DefiLlama: ${defiDataMap instanceof Map ? defiDataMap.size : 0}, Moralis: ${moralisMap instanceof Map ? moralisMap.size : 0}`, { module: 'crypto-coins' })

    // HERMES_FIX: PROVIDER_MONITOR_v1 — Record freshness for SLA tracking
    providerMonitor.recordDataFetch('coinsBulk').catch(() => {})

    return NextResponse.json({
      coins: terminalCoins,
      page: frontendPage,
      perPage: COINS_PER_PAGE,
      count: terminalCoins.length,
      totalEstimate: estimatedTotal,
      totalPages: Math.ceil(estimatedTotal / COINS_PER_PAGE),
      hasMore,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    // HERMES_FIX: S4 2026-02-19 SEVERITY: MEDIUM
    // Problem: Raw err.message leaked internal paths/library names to client
    // Fix: Log full error server-side, return generic message to client
    logger.error('Crypto coins fetch failed', {
      module: 'crypto-coins',
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Failed to fetch coins', timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
