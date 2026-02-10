// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - 5 GÜN Scan API Endpoint (15 Dakika)
// GET /api/scan-200d?segment=MEGA&filter=strong
// Segment bazli tarama yapar, 15dk verisi ile 5G VWAP puanlama
// 5G VWAP (5D) + Z-Score LB=12D | 70/15/15 | 20/80
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSymbols, getSegment } from '@/lib/symbols'
import { getHistorical15Min, getBatchQuotes } from '@/lib/fmp-client'
import { calculateHermes200D } from '@/lib/hermes-200d-engine'
import { Scan200DResult, Scan200DSummary, Segment } from '@/lib/types'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const segment = (searchParams.get('segment') || 'MEGA') as Segment
    const filter = searchParams.get('filter')
    const symbolParam = searchParams.get('symbols')

    let symbols: string[]
    if (symbolParam) {
      symbols = symbolParam.split(',').map(s => s.trim().toUpperCase())
    } else {
      symbols = getSymbols(segment)
    }

    if (symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols to scan' }, { status: 400 })
    }

    const results: Scan200DResult[] = []
    let errorCount = 0
    const concurrency = 15

    const queue = [...symbols]
    let processed = 0

    // Batch quote al (anlık fiyatlar için)
    const quotes = await getBatchQuotes(symbols)

    async function processSymbol(symbol: string): Promise<Scan200DResult | null> {
      try {
        const bars = await getHistorical15Min(symbol)

        // 15dk veriye anlık fiyat ekleme (son bar güncelleme)
        const quote = quotes.get(symbol)
        if (quote && bars.length > 0 && quote.price > 0) {
          const lastBar = bars[bars.length - 1]
          // 15dk verisi tarih+saat formatında olabilir, sadece güncelle
          lastBar.close = quote.price
          lastBar.high = Math.max(lastBar.high, quote.price)
          lastBar.low = Math.min(lastBar.low, quote.price)
          lastBar.volume = quote.volume || lastBar.volume
        }

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
        console.error(`[200D] Error scanning ${symbol}:`, (err as Error).message)
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

        processed++
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker())
    }
    await Promise.all(workers)

    const strongLongs = results
      .filter(r => r.hermes.signalType === 'strong_long')
      .sort((a, b) => a.hermes.score - b.hermes.score)

    const strongShorts = results
      .filter(r => r.hermes.signalType === 'strong_short')
      .sort((a, b) => b.hermes.score - a.hermes.score)

    const longs = results
      .filter(r => r.hermes.signalType === 'long')
      .sort((a, b) => a.hermes.score - b.hermes.score)

    const shorts = results
      .filter(r => r.hermes.signalType === 'short')
      .sort((a, b) => b.hermes.score - a.hermes.score)

    const neutralCount = results.filter(r => r.hermes.signalType === 'neutral').length

    const duration = Date.now() - startTime

    const summary: Scan200DSummary = {
      scanId: `200d-${segment}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      duration,
      totalScanned: results.length,
      strongLongs,
      strongShorts,
      longs,
      shorts,
      neutrals: neutralCount,
      errors: errorCount,
      segment,
    }

    if (filter === 'strong') {
      return NextResponse.json({
        ...summary,
        longs: [],
        shorts: [],
        allResults: undefined,
      })
    }

    return NextResponse.json({
      ...summary,
      allResults: results.sort((a, b) => a.hermes.score - b.hermes.score),
    })

  } catch (error) {
    console.error('[200D] Scan error:', error)
    return NextResponse.json(
      { error: 'Scan failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
