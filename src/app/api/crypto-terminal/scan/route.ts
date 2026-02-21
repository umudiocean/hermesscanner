// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/scan
// Trade AI Scan: V377_R6.85_Z55 | L30_S90
// CoinGecko market_chart → daily OHLCV → VWAP/Z-Score engine
// Page-based: ?page=1..4 (250 coins each, total 1000)
// Aggressive cache: market_chart 12h, page results 30min
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchCoinsMarkets, fetchMarketChart } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL, getMemoryCache, setMemoryCache, getDiskCache, setDiskCache } from '@/lib/crypto-terminal/crypto-cache'
import { calculateCryptoTradeAI, CryptoDailyBar, CryptoTradeResult, CRYPTO_TRADE_CONFIG } from '@/lib/crypto-terminal/crypto-trade-engine'
import { CoinMarket } from '@/lib/crypto-terminal/coingecko-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CHART_DAYS = '600'
const CHART_CACHE_TTL = 2 * 60 * 60 * 1000  // 2 saat (eski: 12h — crypto 24/7 icin 12h cok bayat)
const PAGE_CACHE_TTL = 30 * 60 * 1000
const COINS_PER_PAGE = 250
const CONCURRENCY = 10

interface MarketChartResponse {
  prices: [number, number][]
  total_volumes: [number, number][]
}

export interface CryptoScanItem {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  price_change_24h: number
  market_cap: number
  market_cap_rank: number
  total_volume: number
  circulating_supply: number
  total_supply: number | null
  fully_diluted_valuation: number | null
  ath_change_percentage: number
  tradeAI: CryptoTradeResult
}

function marketChartToBars(data: MarketChartResponse): CryptoDailyBar[] {
  const prices = data.prices || []
  const volumes = data.total_volumes || []

  const volMap = new Map<number, number>()
  for (const [ts, vol] of volumes) {
    const dayTs = Math.floor(ts / 86400000) * 86400000
    volMap.set(dayTs, vol)
  }

  return prices.map(([ts, price]) => {
    const dayTs = Math.floor(ts / 86400000) * 86400000
    return { timestamp: ts, close: price, volume: volMap.get(dayTs) || 0 }
  })
}

async function scanPage(page: number, skipChartCache: boolean = false): Promise<{ results: CryptoScanItem[]; errors: number }> {
  const coins = await getCached<CoinMarket[]>(
    `crypto-coins-scan-p${page}`,
    CRYPTO_CACHE_TTL.COINS_LIST,
    () => fetchCoinsMarkets(page, COINS_PER_PAGE, false, '24h') as Promise<CoinMarket[]>
  )

  if (!coins?.length) return { results: [], errors: 0 }

  const results: CryptoScanItem[] = []
  const queue = [...coins]
  let errorCount = 0

  async function processOne(coin: CoinMarket): Promise<CryptoScanItem | null> {
    try {
      const chartCacheKey = `crypto-mchart-${coin.id}-${CHART_DAYS}d`
      const chartData = await getCached<MarketChartResponse>(
        chartCacheKey,
        skipChartCache ? 0 : CHART_CACHE_TTL,
        () => fetchMarketChart(coin.id, CHART_DAYS) as Promise<MarketChartResponse>
      )

      if (!chartData?.prices?.length) return null

      const bars = marketChartToBars(chartData)
      if (bars.length < 60) return null

      const tradeAI = calculateCryptoTradeAI(bars)

      return {
        id: coin.id,
        symbol: coin.symbol?.toUpperCase() || '',
        name: coin.name || '',
        image: coin.image || '',
        current_price: coin.current_price || 0,
        price_change_24h: coin.price_change_percentage_24h || 0,
        market_cap: coin.market_cap || 0,
        market_cap_rank: coin.market_cap_rank || 0,
        total_volume: coin.total_volume || 0,
        circulating_supply: coin.circulating_supply || 0,
        total_supply: coin.total_supply,
        fully_diluted_valuation: coin.fully_diluted_valuation,
        ath_change_percentage: coin.ath_change_percentage || 0,
        tradeAI,
      }
    } catch {
      errorCount++
      return null
    }
  }

  async function worker() {
    while (queue.length > 0) {
      const coin = queue.shift()
      if (!coin) break
      const result = await processOne(coin)
      if (result) results.push(result)
    }
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < Math.min(CONCURRENCY, coins.length); i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  results.sort((a, b) => a.tradeAI.score - b.tradeAI.score)
  return { results, errors: errorCount }
}

export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.min(4, Math.max(1, parseInt(searchParams.get('page') || '1')))
    const forceRefresh = searchParams.get('refresh') === '1'

    const cacheKey = `crypto-scan-v377r685z55-P${page}`

    if (!forceRefresh) {
      const memCached = getMemoryCache<{ results: CryptoScanItem[] }>(cacheKey, PAGE_CACHE_TTL)
      if (memCached) {
        return NextResponse.json({
          ...memCached,
          page,
          scanned: memCached.results.length,
          config: CRYPTO_TRADE_CONFIG,
          cached: true,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        })
      }

      const diskCached = await getDiskCache<{ results: CryptoScanItem[] }>(cacheKey, PAGE_CACHE_TTL)
      if (diskCached) {
        setMemoryCache(cacheKey, diskCached)
        return NextResponse.json({
          ...diskCached,
          page,
          scanned: diskCached.results.length,
          config: CRYPTO_TRADE_CONFIG,
          cached: true,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        })
      }
    }

    const { results, errors } = await scanPage(page, forceRefresh)

    const scores = results.map(r => r.tradeAI.score)
    const zscores = results.map(r => r.tradeAI.zscore)
    const stats = results.length > 0 ? {
      scoreMin: Math.min(...scores),
      scoreMax: Math.max(...scores),
      scoreAvg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      zscoreMin: Math.min(...zscores).toFixed(2),
      zscoreMax: Math.max(...zscores).toFixed(2),
      signals: {
        strong_long: results.filter(r => r.tradeAI.signalType === 'strong_long').length,
        long: results.filter(r => r.tradeAI.signalType === 'long').length,
        neutral: results.filter(r => r.tradeAI.signalType === 'neutral').length,
        short: results.filter(r => r.tradeAI.signalType === 'short').length,
        strong_short: results.filter(r => r.tradeAI.signalType === 'strong_short').length,
      },
    } : null

    const payload = { results, timestamp: new Date().toISOString() }
    setMemoryCache(cacheKey, payload)
    await setDiskCache(cacheKey, payload)

    return NextResponse.json({
      results,
      page,
      scanned: results.length,
      errors,
      stats,
      config: CRYPTO_TRADE_CONFIG,
      cached: false,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Crypto scan failed', message, page: 0, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
