// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - 5 GÜN Incremental Refresh API
// GET /api/refresh-200d?symbols=AAPL,MSFT,...
//
// Tam stitch yapmaz! Cache'deki 15dk barlari yükler,
// son chunk'ı FMP'den çeker, merge eder, re-score yapar.
// 5G VWAP (5D) + Z-Score LB=12D | 70/15/15 | 20/80
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSegment } from '@/lib/symbols'
import { refresh15MinLatest, getBatchQuotes } from '@/lib/fmp-client'
import { calculateHermes200D } from '@/lib/hermes-200d-engine'
import { Scan200DResult } from '@/lib/types'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const symbolParam = searchParams.get('symbols')

    if (!symbolParam) {
      return NextResponse.json({ error: 'symbols parameter is required' }, { status: 400 })
    }

    const symbols = symbolParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

    if (symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols provided' }, { status: 400 })
    }

    // Batch quote al
    const quotes = await getBatchQuotes(symbols)

    const results: Scan200DResult[] = []
    let errorCount = 0
    const concurrency = 10 // 15dk veri merge etmek daha ağır, düşük concurrency

    const queue = [...symbols]

    async function processSymbol(symbol: string): Promise<Scan200DResult | null> {
      try {
        // Cache'deki stitched barlari yükle + son chunk'ı merge et
        const bars = await refresh15MinLatest(symbol)
        if (!bars || bars.length === 0) return null

        // Anlık quote ile son bari güncelle
        const quote = quotes.get(symbol)
        if (quote && quote.price > 0 && bars.length > 0) {
          const lastBar = bars[bars.length - 1]
          lastBar.close = quote.price
          lastBar.high = Math.max(lastBar.high, quote.price)
          lastBar.low = Math.min(lastBar.low, quote.price)
          lastBar.volume = quote.volume || lastBar.volume
        }

        // Re-score
        const hermes = calculateHermes200D(bars)

        return {
          symbol,
          segment: getSegment(symbol),
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
        console.error(`[Refresh 200D] Error for ${symbol}:`, (err as Error).message)
        errorCount++
        return null
      }
    }

    // Concurrent worker pattern
    async function worker() {
      while (queue.length > 0) {
        const symbol = queue.shift()
        if (!symbol) break
        const result = await processSymbol(symbol)
        if (result) results.push(result)
        // Rate limiting (15dk API calls)
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker())
    }
    await Promise.all(workers)

    const duration = Date.now() - startTime
    console.log(`[Refresh 200D] ${results.length}/${symbols.length} symbols refreshed in ${duration}ms`)

    return NextResponse.json({
      results: results.sort((a, b) => a.hermes.score - b.hermes.score),
      duration,
      refreshed: results.length,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[Refresh 200D] Error:', error)
    return NextResponse.json(
      { error: 'Refresh failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
