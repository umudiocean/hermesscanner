// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Scan API Endpoint
// GET /api/scan?segment=MEGA&filter=strong
// Segment bazli tarama yapar, sonuclari dondurur
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSymbols, getSegment } from '@/lib/symbols'
import { getHistoricalDaily, getBatchQuotes, getHistorical15Min } from '@/lib/fmp-client'
import { calculateHermes } from '@/lib/hermes-engine'
import { saveScanResults } from '@/lib/scan-store'
import { ScanResult, ScanSummary, Segment } from '@/lib/types'

export const maxDuration = 60 // Vercel Pro: 60s timeout

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const segment = (searchParams.get('segment') || 'MEGA') as Segment
    const filter = searchParams.get('filter') // 'strong' | 'all'
    const symbolParam = searchParams.get('symbols') // Virgülle ayrilmis ozel semboller

    // Taranacak sembolleri belirle
    let symbols: string[]
    if (symbolParam) {
      symbols = symbolParam.split(',').map(s => s.trim().toUpperCase())
    } else {
      symbols = getSymbols(segment)
    }

    if (symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols to scan' }, { status: 400 })
    }

    // Tüm hisseler icin paralel historical data fetch
    const results: ScanResult[] = []
    let errorCount = 0
    const concurrency = 15

    // Worker-based concurrent fetching
    const queue = [...symbols]
    let processed = 0

    // Once batch quote al (anlik fiyatlar icin)
    const quotes = await getBatchQuotes(symbols)

    async function processSymbol(symbol: string): Promise<ScanResult | null> {
      try {
        const bars = await getHistoricalDaily(symbol)

        // Anlik fiyat varsa, son bari guncelle
        const quote = quotes.get(symbol)
        if (quote && bars.length > 0) {
          const lastBar = bars[bars.length - 1]
          const today = new Date().toISOString().split('T')[0]

          if (lastBar.date === today) {
            lastBar.high = Math.max(lastBar.high, quote.dayHigh || lastBar.high)
            lastBar.low = Math.min(lastBar.low, quote.dayLow || lastBar.low)
            lastBar.close = quote.price || lastBar.close
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

        // 15dk veri çek (RSI/MFI/ADX/ATR için — Pine Script ile birebir)
        let bars15m = undefined
        try {
          bars15m = await getHistorical15Min(symbol)
        } catch {
          // 15dk veri yoksa daily fallback kullanılır
        }

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
        console.error(`Error scanning ${symbol}:`, (err as Error).message)
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

        processed++
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker())
    }
    await Promise.all(workers)

    // Sonuclari siniflandir
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

    const summary: ScanSummary = {
      scanId: `${segment}-${Date.now()}`,
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

    // Store'a kaydet
    saveScanResults(segment, results, summary)

    // Filtre uygula
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
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Scan failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
