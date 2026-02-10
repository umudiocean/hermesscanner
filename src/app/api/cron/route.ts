// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Cron Endpoint
// Vercel Cron tarafindan tetiklenir
// Market saatlerinde otomatik tarama yapar
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSymbols, getSegment } from '@/lib/symbols'
import { getHistoricalDaily, getBatchQuotes } from '@/lib/fmp-client'
import { calculateHermes } from '@/lib/hermes-engine'
import { saveScanResults } from '@/lib/scan-store'
import { ScanResult, ScanSummary } from '@/lib/types'

export const maxDuration = 300 // Vercel Pro background: 5 dakika

// NASDAQ market saatleri (ET)
function isMarketHours(): boolean {
  const now = new Date()
  // ET timezone offset hesapla (EST=-5, EDT=-4)
  const etOffset = getETOffset()
  const etHour = (now.getUTCHours() + etOffset + 24) % 24
  const etMinute = now.getUTCMinutes()
  const day = now.getUTCDay() // 0=Pazar, 6=Cumartesi

  // Hafta ici mi?
  if (day === 0 || day === 6) return false

  // 09:00 - 16:30 ET arasi mi? (biraz genis tutuyoruz)
  const etTime = etHour * 60 + etMinute
  return etTime >= 540 && etTime <= 990 // 09:00 - 16:30
}

function getETOffset(): number {
  // DST kontrolu (Mart'in 2. Pazari - Kasim'in 1. Pazari arasi EDT)
  const now = new Date()
  const jan = new Date(now.getFullYear(), 0, 1)
  const jul = new Date(now.getFullYear(), 6, 1)
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())

  // UTC-5 (EST) veya UTC-4 (EDT)
  // Basit yontem: JS Date ile kontrol
  const testDate = new Date()
  const month = testDate.getUTCMonth() // 0-11
  // Mart-Kasim arasi EDT (-4), digerleri EST (-5)
  if (month >= 2 && month <= 10) return -4
  return -5
}

function getScanContext(): string {
  const now = new Date()
  const etOffset = getETOffset()
  const etHour = (now.getUTCHours() + etOffset + 24) % 24
  const etMinute = now.getUTCMinutes()
  const etTime = etHour * 60 + etMinute

  if (etTime >= 570 && etTime <= 600) return 'AÇILIŞ'           // 09:30
  if (etTime >= 630 && etTime <= 660) return 'AÇILIŞTAN 1 SAAT' // 10:30
  if (etTime >= 840 && etTime <= 870) return 'KAPANIŞA 2 SAAT'  // 14:00
  if (etTime >= 930 && etTime <= 960) return 'KAPANIŞA 30 DAK'  // 15:30
  return `ET ${etHour}:${etMinute.toString().padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Cron secret kontrolu (guvenlik)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Vercel cron header kontrolu
    const vercelCron = request.headers.get('x-vercel-cron')
    if (!vercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Market saatleri kontrolu
  if (!isMarketHours()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Market kapali',
      timestamp: new Date().toISOString(),
    })
  }

  const context = getScanContext()
  console.log(`[HERMES CRON] ${context} taramas basliyor...`)

  try {
    // Tum segmentleri tara (MEGA oncelikli)
    const segments: Array<'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO'> = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO']

    const allStrongLongs: ScanResult[] = []
    const allStrongShorts: ScanResult[] = []
    let totalScanned = 0
    let totalErrors = 0

    for (const segment of segments) {
      const symbols = getSymbols(segment)
      if (symbols.length === 0) continue

      const results: ScanResult[] = []
      let errorCount = 0

      // Batch quotes
      const quotes = await getBatchQuotes(symbols)

      // Concurrent processing
      const queue = [...symbols]
      const concurrency = 10

      async function processSymbol(symbol: string): Promise<ScanResult | null> {
        try {
          const bars = await getHistoricalDaily(symbol)
          const quote = quotes.get(symbol)

          if (quote && bars.length > 0) {
            const today = new Date().toISOString().split('T')[0]
            const lastBar = bars[bars.length - 1]

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

          const hermes = calculateHermes(bars)
          return {
            symbol,
            segment,
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
        } catch {
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
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      const workers = Array.from({ length: concurrency }, () => worker())
      await Promise.all(workers)

      // Sonuclari kaydet
      const strongLongs = results.filter(r => r.hermes.signalType === 'strong_long')
      const strongShorts = results.filter(r => r.hermes.signalType === 'strong_short')

      const summary: ScanSummary = {
        scanId: `cron-${segment}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        totalScanned: results.length,
        strongLongs,
        strongShorts,
        longs: results.filter(r => r.hermes.signalType === 'long'),
        shorts: results.filter(r => r.hermes.signalType === 'short'),
        neutrals: results.filter(r => r.hermes.signalType === 'neutral').length,
        errors: errorCount,
        segment,
      }

      saveScanResults(segment, results, summary)

      allStrongLongs.push(...strongLongs)
      allStrongShorts.push(...strongShorts)
      totalScanned += results.length
      totalErrors += errorCount

      console.log(`[HERMES CRON] ${segment}: ${results.length} tarandı, ${strongLongs.length} STRONG LONG, ${strongShorts.length} STRONG SHORT`)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      status: 'completed',
      context,
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
      totalScanned,
      totalErrors,
      strongLongs: allStrongLongs.map(r => ({
        symbol: r.symbol,
        score: r.hermes.score,
        price: r.hermes.price,
        segment: r.segment,
      })),
      strongShorts: allStrongShorts.map(r => ({
        symbol: r.symbol,
        score: r.hermes.score,
        price: r.hermes.price,
        segment: r.segment,
      })),
    })

  } catch (error) {
    console.error('[HERMES CRON] Error:', error)
    return NextResponse.json(
      { status: 'error', message: (error as Error).message },
      { status: 500 }
    )
  }
}
