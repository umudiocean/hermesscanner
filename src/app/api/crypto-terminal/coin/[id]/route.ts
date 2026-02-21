// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/coin/[id]
// Single coin detail with full metrics
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchCoinDetail, fetchDerivatives, fetchCoinTickers } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { CoinDetail, Derivative } from '@/lib/crypto-terminal/coingecko-types'
import { scoreCoin } from '@/lib/crypto-terminal/crypto-score-engine'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing coin id' }, { status: 400 })
    }

    // Fetch detail + derivatives + tickers in parallel
    const [detailRes, derivativesRes, tickersRes] = await Promise.allSettled([
      getCached<CoinDetail>(
        `crypto-coin-${id}`,
        CRYPTO_CACHE_TTL.COIN_DETAIL,
        () => fetchCoinDetail(id) as Promise<CoinDetail>,
      ),
      getCached<Derivative[]>(
        'crypto-derivatives-tickers',
        CRYPTO_CACHE_TTL.DERIVATIVES,
        () => fetchDerivatives() as Promise<Derivative[]>,
      ),
      getCached<{ tickers: unknown[] }>(
        `crypto-tickers-${id}`,
        CRYPTO_CACHE_TTL.COIN_DETAIL,
        () => fetchCoinTickers(id) as Promise<{ tickers: unknown[] }>,
      ),
    ])

    const detail = detailRes.status === 'fulfilled' ? detailRes.value : null
    const allDerivatives = derivativesRes.status === 'fulfilled' ? derivativesRes.value : []
    const tickersData = tickersRes.status === 'fulfilled' ? tickersRes.value : null
    const tickers = (tickersData as { tickers?: unknown[] })?.tickers ?? []

    if (!detail) {
      return NextResponse.json({ error: `Coin ${id} not found` }, { status: 404 })
    }

    // Filter derivatives for this coin — exact base symbol match
    const coinSymbol = detail.symbol.toUpperCase()
    const coinDerivatives = allDerivatives?.filter(d => {
      const base = d.symbol?.split('/')[0]?.toUpperCase()
      return base === coinSymbol || d.index_id?.toLowerCase() === id
    }) ?? []

    // Build a CoinMarket-like object for scoring
    const md = detail.market_data
    const mockCoinMarket = {
      id: detail.id,
      symbol: detail.symbol,
      name: detail.name,
      image: detail.image?.large ?? '',
      current_price: md?.current_price?.usd ?? 0,
      market_cap: md?.market_cap?.usd ?? 0,
      market_cap_rank: md?.market_cap_rank ?? 9999,
      fully_diluted_valuation: md?.fully_diluted_valuation?.usd ?? null,
      total_volume: md?.total_volume?.usd ?? 0,
      high_24h: md?.high_24h?.usd ?? 0,
      low_24h: md?.low_24h?.usd ?? 0,
      price_change_24h: md?.price_change_24h ?? 0,
      price_change_percentage_24h: md?.price_change_percentage_24h ?? 0,
      market_cap_change_24h: md?.market_cap_change_24h ?? 0,
      market_cap_change_percentage_24h: md?.market_cap_change_percentage_24h ?? 0,
      circulating_supply: md?.circulating_supply ?? 0,
      total_supply: md?.total_supply ?? null,
      max_supply: md?.max_supply ?? null,
      ath: md?.ath?.usd ?? 0,
      ath_change_percentage: md?.ath_change_percentage?.usd ?? 0,
      ath_date: md?.ath_date?.usd ?? '',
      atl: md?.atl?.usd ?? 0,
      atl_change_percentage: md?.atl_change_percentage?.usd ?? 0,
      atl_date: md?.atl_date?.usd ?? '',
      last_updated: detail.last_updated ?? '',
      price_change_percentage_1h_in_currency: null,
      price_change_percentage_24h_in_currency: md?.price_change_percentage_24h ?? null,
      price_change_percentage_7d_in_currency: md?.price_change_percentage_7d ?? null,
      price_change_percentage_30d_in_currency: md?.price_change_percentage_30d ?? null,
      total_value_locked: md?.total_value_locked ?? null,
    }

    // Score
    const score = scoreCoin({
      coin: mockCoinMarket as never,
      allCoins: [mockCoinMarket as never],
      detail,
      derivatives: coinDerivatives,
    })

    return NextResponse.json({
      detail,
      score,
      derivatives: coinDerivatives.slice(0, 20),
      tickers: (tickers as unknown[]).slice(0, 50),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch coin detail', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
