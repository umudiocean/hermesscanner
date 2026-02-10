// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - 52W Incremental Refresh API
// GET /api/refresh?symbols=AAPL,MSFT,...
//
// Tam tarama yapmaz! Cache'deki daily barlari yükler,
// batch quote ile bugünkü bari günceller, re-score yapar.
// ~2-5 saniye (tam tarama ~60+ saniye)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSegment } from '@/lib/symbols'
import { refreshHistoricalDaily, getBatchQuotes, refresh15MinLatest } from '@/lib/fmp-client'
import { calculateHermes } from '@/lib/hermes-engine'
import { ScanResult } from '@/lib/types'

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

    // Batch quote al (tüm semboller için tek seferde)
    const quotes = await getBatchQuotes(symbols)

    const results: ScanResult[] = []
    let errorCount = 0
    const concurrency = 20

    const queue = [...symbols]

    async function processSymbol(symbol: string): Promise<ScanResult | null> {
      try {
        // Cache'deki daily barlari yükle (API call yapmaz)
        const bars = await refreshHistoricalDaily(symbol)
        if (!bars || bars.length === 0) return null

        // Anlık quote ile bugünkü bari güncelle
        const quote = quotes.get(symbol)
        if (quote && quote.price > 0 && bars.length > 0) {
          const lastBar = bars[bars.length - 1]
          const today = new Date().toISOString().split('T')[0]

          if (lastBar.date === today) {
            lastBar.high = Math.max(lastBar.high, quote.dayHigh || lastBar.high)
            lastBar.low = Math.min(lastBar.low, quote.dayLow || lastBar.low)
            lastBar.close = quote.price
            lastBar.volume = quote.volume || lastBar.volume
          } else if (quote.price > 0) {
            bars.push({
              date: today,
              open: quote.open || quote.price,
              high: quote.dayHigh || quote.price,
              low: quote.dayLow || quote.price,
              close: quote.price,
              volume: quote.volume || 0,
            })
          }
        }

        // 15dk veriyi refresh et (cache'den yükle + son chunk güncelle)
        let bars15m = undefined
        try {
          bars15m = await refresh15MinLatest(symbol) ?? undefined
        } catch {
          // 15dk veri yoksa daily fallback
        }

        // Re-score (dual timeframe)
        const hermes = calculateHermes(bars, {}, bars15m)

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
        console.error(`[Refresh] Error for ${symbol}:`, (err as Error).message)
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
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker())
    }
    await Promise.all(workers)

    const duration = Date.now() - startTime
    console.log(`[Refresh 52W] ${results.length}/${symbols.length} symbols refreshed in ${duration}ms`)

    return NextResponse.json({
      results: results.sort((a, b) => a.hermes.score - b.hermes.score),
      duration,
      refreshed: results.length,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[Refresh 52W] Error:', error)
    return NextResponse.json(
      { error: 'Refresh failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
