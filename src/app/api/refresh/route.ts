// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Incremental Refresh API
// GET /api/refresh?symbols=AAPL,MSFT,...
//
// Cache'deki 15dk barlari yukler, son chunk'i gunceller, re-score.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { computeSegmentFromMarketCap } from '@/lib/symbols'
import { getBatchQuotes, refresh15MinLatest } from '@/lib/fmp-client'
import { calculateHermes } from '@/lib/hermes-engine'
import { ScanResult } from '@/lib/types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import { symbolsParamSchema, validateParams } from '@/lib/validation/schemas'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`refresh:${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const symbolParam = searchParams.get('symbols')

    if (!symbolParam) {
      return NextResponse.json({ error: 'symbols parameter is required' }, { status: 400 })
    }

    const parsed = validateParams(symbolsParamSchema, symbolParam)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid symbols', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const symbols = parsed.data

    const quotes = await getBatchQuotes(symbols)

    const results: ScanResult[] = []
    let errorCount = 0
    const concurrency = 20

    const queue = [...symbols]

    async function processSymbol(symbol: string): Promise<ScanResult | null> {
      try {
        // 15dk veri refresh — cache'den yukle + son chunk guncelle
        const bars = await refresh15MinLatest(symbol)
        const MIN_SCAN_BARS = 6331
        if (!bars || bars.length < MIN_SCAN_BARS) return null

        const quote = quotes.get(symbol)
        const hermes = calculateHermes(bars)

        return {
          symbol,
          segment: computeSegmentFromMarketCap(quote?.marketCap),
          hermes,
          quote: quote ? {
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
          } : undefined,
          timestamp: new Date().toISOString(),
        }
      } catch (err) {
        console.error(`[Refresh] Error for ${symbol}:`, (err as Error).message)
        errorCount++
        return null
      }
    }

    async function worker() {
      while (queue.length > 0) {
        const symbol = queue.shift()
        if (!symbol) break
        const result = await processSymbol(symbol)
        if (result) results.push(result)
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker())
    }
    await Promise.all(workers)

    const duration = Date.now() - startTime
    console.log(`[Refresh] ${results.length}/${symbols.length} symbols refreshed in ${duration}ms`)

    return NextResponse.json({
      results: results.sort((a, b) => a.hermes.score - b.hermes.score),
      duration,
      refreshed: results.length,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[Refresh] Error:', error)
    return NextResponse.json(
      { error: 'Refresh failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
