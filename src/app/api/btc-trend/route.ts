// ═══════════════════════════════════════════════════════════════════
// BTC TREND API ROUTE
// Computes Bitcoin trend inference from equity data
// GET /api/btc-trend
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { OHLCV } from '@/lib/types'
import { getHistoricalDaily, getBatchQuotes } from '@/lib/fmp-client'
import { listHistoricalSymbols, loadHistoricalData } from '@/lib/data-store'
import { computeBTCTrend, BTCTrendResult, BTC_TREASURY_EXCLUSIONS, AnalysisMode } from '@/lib/btc-trend-engine'

// In-memory cache for BTC trend result (per mode)
const cachedResults = new Map<AnalysisMode, { result: BTCTrendResult; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('force') === 'true'
    const mode: AnalysisMode = (searchParams.get('mode') as AnalysisMode) || 'relaxed'

    // Return cached result if fresh
    const cached = cachedResults.get(mode)
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.result)
    }

    console.log('[BTC-Trend] Starting BTC trend analysis...')
    const startTime = Date.now()

    // Step 1: Fetch benchmark data (BTC, SPY, QQQ)
    // Use 400 calendar days to get ~200+ trading days
    const [btcBars, spyBars, qqqBars] = await Promise.all([
      fetchBTCData(),
      getHistoricalDaily('SPY', 400),
      getHistoricalDaily('QQQ', 400),
    ])

    if (btcBars.length < 60) {
      return NextResponse.json(
        { error: 'Insufficient BTC data', btcBars: btcBars.length },
        { status: 400 }
      )
    }

    console.log(`[BTC-Trend] Benchmarks loaded: BTC=${btcBars.length}, SPY=${spyBars.length}, QQQ=${qqqBars.length} bars`)

    // Step 2: Load all stock historical data from disk cache
    const symbols = await listHistoricalSymbols()
    const eligibleSymbols = symbols.filter(s => !BTC_TREASURY_EXCLUSIONS.has(s))

    console.log(`[BTC-Trend] Loading ${eligibleSymbols.length} stock histories from disk...`)

    const stockDataMap = new Map<string, OHLCV[]>()
    const BATCH_SIZE = 200
    let loadedCount = 0

    for (let i = 0; i < eligibleSymbols.length; i += BATCH_SIZE) {
      const batch = eligibleSymbols.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const bars = await loadHistoricalData(symbol)
            return { symbol, bars }
          } catch {
            return { symbol, bars: null }
          }
        })
      )

      for (const { symbol, bars } of results) {
        if (bars && bars.length >= 80) {
          stockDataMap.set(symbol, bars)
          loadedCount++
        }
      }
    }

    console.log(`[BTC-Trend] Loaded ${loadedCount} stock histories`)

    if (loadedCount < 50) {
      return NextResponse.json(
        { error: 'Insufficient stock data. Run 200W scan first.', stocksLoaded: loadedCount },
        { status: 400 }
      )
    }

    // Step 3: Get latest BTC price
    let btcPrice: number | undefined
    let btcChange24h: number | undefined
    try {
      const quotes = await getBatchQuotes(['BTCUSD'])
      const btcQuote = quotes.get('BTCUSD')
      if (btcQuote) {
        btcPrice = btcQuote.price
        btcChange24h = btcQuote.changePercent
      }
    } catch {
      // BTC quote is optional, continue without it
      console.log('[BTC-Trend] Could not fetch BTC quote, continuing without')
    }

    // Step 4: Run engine
    console.log(`[BTC-Trend] Running BTC trend engine (mode: ${mode})...`)
    const result = computeBTCTrend({
      stockDataMap,
      btcBars,
      spyBars,
      qqqBars,
      btcPrice,
      btcChange24h,
      mode,
    })

    const elapsed = Date.now() - startTime
    console.log(`[BTC-Trend] Analysis complete in ${(elapsed / 1000).toFixed(1)}s - Mode: ${mode}, Trend: ${result.trend}, Score: ${result.score}, Confidence: ${result.confidence}%, Priority Carriers: ${result.priorityCarrierSummary.length}`)

    // Cache result
    cachedResults.set(mode, { result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[BTC-Trend] Error:', err)
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}

/**
 * Fetch BTC daily data from FMP
 * FMP uses BTCUSD symbol for Bitcoin
 * Falls back to different symbol formats if needed
 */
async function fetchBTCData(): Promise<OHLCV[]> {
  const symbols = ['BTCUSD', 'BTC-USD', 'BTCUSD']

  for (const symbol of symbols) {
    try {
      const bars = await getHistoricalDaily(symbol, 400)
      if (bars.length > 0) {
        console.log(`[BTC-Trend] BTC data fetched with symbol: ${symbol}, ${bars.length} bars`)
        return bars
      }
    } catch (err) {
      console.log(`[BTC-Trend] Failed to fetch BTC with symbol ${symbol}:`, (err as Error).message)
    }
  }

  throw new Error('Could not fetch BTC historical data from FMP')
}
