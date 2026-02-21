// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/coins
// 1000 coins per page, 24h aggressive cache
// ?page=1 → rank 1-1000, ?page=2 → rank 1001-2000, etc.
// Each CG page (250) cached 1h on disk — 4 requests per page
// Second request = 0 API calls (pure cache)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchCoinsMarkets } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { scoreAllCoins } from '@/lib/crypto-terminal/crypto-score-engine'
import { CoinMarket, CryptoTerminalCoin } from '@/lib/crypto-terminal/coingecko-types'

export const dynamic = 'force-dynamic'

const CG_PAGE_SIZE = 250
const COINS_PER_PAGE = 1000 // 4 CG pages = 1 frontend page
const CG_PAGES_PER_FRONTEND_PAGE = COINS_PER_PAGE / CG_PAGE_SIZE // 4

function transformCoin(coin: CoinMarket, scoreMap: Map<string, ReturnType<typeof scoreAllCoins> extends Map<string, infer V> ? V : never>): CryptoTerminalCoin {
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
    tvl: coin.total_value_locked ?? null,
    sparkline7d: coin.sparkline_in_7d?.price ?? [],
    score: scoreMap.get(coin.id) ?? null,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const frontendPage = Math.max(1, parseInt(searchParams.get('page') || '1'))

    // Calculate which CG pages we need
    // Frontend page 1 → CG pages 1,2,3,4
    // Frontend page 2 → CG pages 5,6,7,8
    const cgStartPage = (frontendPage - 1) * CG_PAGES_PER_FRONTEND_PAGE + 1

    // Fetch 4 CG pages in parallel (each cached 1h on disk)
    const promises = Array.from({ length: CG_PAGES_PER_FRONTEND_PAGE }, (_, i) => {
      const cgPage = cgStartPage + i
      // Only first 4 CG pages get sparkline (top 1000 coins)
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
        coins: [],
        page: frontendPage,
        total: 0,
        hasMore: false,
      }, { status: 502 })
    }

    // Score all 1000 coins
    const scoreMap = scoreAllCoins(allCoins)
    const terminalCoins = allCoins.map(coin => transformCoin(coin, scoreMap))

    // CoinGecko has ~18500+ coins. hasMore = we got full 1000
    const estimatedTotal = 18500
    const hasMore = allCoins.length >= COINS_PER_PAGE

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
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch coins', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
