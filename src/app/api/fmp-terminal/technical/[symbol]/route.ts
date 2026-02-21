import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTechnicals, fetchRSI, fetchSMA, fetchEMA, fetchADX } from '@/lib/fmp-terminal/fmp-bulk-client'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    if (!symbol) {
      return NextResponse.json(createApiError('Symbol required', 'Provide a stock symbol', 'VALIDATION'), { status: 400 })
    }

    const upperSymbol = symbol.toUpperCase()

    // Fetch summary (all indicators in parallel)
    const summary = await fetchAllTechnicals(upperSymbol)

    // Also fetch historical data for charts (last 30 days)
    const [rsiHistory, sma50History, sma200History, ema20History, adxHistory] = await Promise.allSettled([
      fetchRSI(upperSymbol, 14),
      fetchSMA(upperSymbol, 50),
      fetchSMA(upperSymbol, 200),
      fetchEMA(upperSymbol, 20),
      fetchADX(upperSymbol, 14),
    ])

    const safeArr = (r: PromiseSettledResult<unknown[]>) =>
      r.status === 'fulfilled' ? (r.value || []).slice(0, 30) : []

    return NextResponse.json({
      symbol: upperSymbol,
      summary,
      history: {
        rsi: safeArr(rsiHistory),
        sma50: safeArr(sma50History),
        sma200: safeArr(sma200History),
        ema20: safeArr(ema20History),
        adx: safeArr(adxHistory),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Technical API error', { module: 'api/technical', error })
    return NextResponse.json(
      createApiError('Technical data fetch failed', String(error), 'FETCH_ERROR'),
      { status: 500 }
    )
  }
}
