// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Scan API Endpoint (Progressive / Streaming)
// GET /api/scan?segment=ALL&symbols=AAPL,MSFT,...
//   mode=stream → NDJSON streaming (Vercel-safe, no timeout)
//   mode=json   → Classic JSON response (default, backward compat)
//
// Streaming keeps the connection alive with per-symbol results,
// bypassing Vercel's 60s response timeout for large scans.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCleanSymbols, computeSegmentFromMarketCap } from '@/lib/symbols'
import { getBatchQuotes, getCompanyProfiles, getHistorical15Min } from '@/lib/fmp-client'
import { calculateHermes } from '@/lib/hermes-engine'
import { saveScanResults } from '@/lib/scan-store'
import { updateTrendFromScanResults, getTrendContext, hasTrendCache } from '@/lib/trend-context'
import { ScanResult, ScanSummary, Segment, OHLCV, PriceTargetData, HermesResult } from '@/lib/types'
import { computeNasdaqTargetFloor } from '@/lib/target-engine'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import { segmentSchema, symbolsParamSchema, validateParams } from '@/lib/validation/schemas'
import { getBarCache } from '@/lib/cache/redis-cache'
import { isRedisAvailable } from '@/lib/cache/redis-client'
import { providerMonitor } from '@/lib/monitor/provider-monitor'

export const maxDuration = 300

// ─── Shared scan logic ──────────────────────────────────────────────

interface ScanContext {
  symbols: string[]
  segment: Segment
  quotes: Map<string, { price: number; change: number; changePercent: number; volume: number; marketCap: number; yearHigh?: number; yearLow?: number }>
  profileMap: Map<string, { sector: string; industry: string; companyName: string }>
}

async function prepareScan(symbols: string[]): Promise<Omit<ScanContext, 'segment'>> {
  const quotes = await getBatchQuotes(symbols)

  let profileMap = new Map<string, { sector: string; industry: string; companyName: string }>()
  try {
    profileMap = await getCompanyProfiles(symbols)
  } catch (err) {
    console.warn('[SCAN] Could not fetch profiles:', (err as Error).message)
  }

  return { symbols, quotes, profileMap }
}

const MIN_SCAN_BARS = 6331

/** Placeholder for symbols without FMP 15dk data — evren 2064 tutarliligi */
function createPlaceholderResult(symbol: string, quote?: { price: number; change: number; changePercent: number; volume: number; marketCap: number }): ScanResult {
  const price = quote?.price ?? 0
  const hermes: HermesResult = {
    score: 50,
    signal: 'NOTR',
    signalType: 'neutral',
    components: { point52w: 50, pointMfi: 50, pointRsi: 50 },
    multipliers: { atrCarpan: 1, adxCarpan: 1, quality: 0.5 },
    rawScore: 50,
    indicators: { rsi: 50, mfi: 50, adx: 0, atr: 0, volRatio: 1 },
    zscores: { zscore52w: 0 },
    bands: { vwap52w: price, upperInner: price, lowerInner: price, upperOuter: price, lowerOuter: price },
    touches: { touchOuterUpper: false, touchOuterLower: false, touchInnerUpper: false, touchInnerLower: false },
    filters: { longFiltersOk: false, shortFiltersOk: false, rsiOk: true, mfiOk: true, adxOk: true },
    price,
    dataPoints: 0,
    hasEnough52w: false,
    error: 'FMP 15dk veri yok',
  }
  return {
    symbol,
    segment: computeSegmentFromMarketCap(quote?.marketCap),
    hermes: hermes as unknown as HermesResult,
    quote: quote ? { price: quote.price, change: quote.change, changePercent: quote.changePercent, volume: quote.volume, marketCap: quote.marketCap } : undefined,
    priceTarget: null,
    timestamp: new Date().toISOString(),
  }
}

async function processSymbol(
  symbol: string,
  ctx: Omit<ScanContext, 'segment'>,
): Promise<ScanResult | null> {
  try {
    let bars: OHLCV[] | null = null

    if (isRedisAvailable()) {
      const cached = await getBarCache(symbol)
      if (cached && cached.length >= MIN_SCAN_BARS) {
        bars = cached
      }
    }

    if (!bars) {
      try {
        bars = await getHistorical15Min(symbol)
      } catch {
        // ignore — symbol will be skipped
      }
    }

    if (!bars || bars.length < 100) return null

    const profile = ctx.profileMap.get(symbol)
    const trendCtx = profile && hasTrendCache()
      ? getTrendContext(symbol, profile.sector, profile.industry)
      : undefined

    const quote = ctx.quotes.get(symbol)
    const hermes = calculateHermes(bars, {}, undefined, trendCtx)

    const sanitizedHermes = {
      ...hermes,
      indicators: {
        rsi: Math.round(hermes.indicators.rsi * 10) / 10,
        mfi: Math.round(hermes.indicators.mfi * 10) / 10,
        adx: Math.round(hermes.indicators.adx * 10) / 10,
        atr: hermes.indicators.atr,
        volRatio: Math.round(hermes.indicators.volRatio * 100) / 100,
      },
    }

    // Compute target/floor price using bands + signal + fmpData (yearHigh/yearLow from batch-quote)
    const priceTarget = computeNasdaqTargetFloor({
      price: hermes.price,
      signalType: hermes.signalType,
      score: hermes.score,
      bands: hermes.bands,
      indicators: {
        rsi: hermes.indicators.rsi,
        mfi: hermes.indicators.mfi,
        atr: hermes.indicators.atr,
      },
      fmpData: quote && (quote.yearHigh != null || quote.yearLow != null)
        ? { yearHigh: quote.yearHigh ?? 0, yearLow: quote.yearLow ?? 0 }
        : undefined,
    }) as PriceTargetData | null

    return {
      symbol,
      segment: computeSegmentFromMarketCap(quote?.marketCap),
      hermes: sanitizedHermes as unknown as typeof hermes,
      quote: quote ? {
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        marketCap: quote.marketCap,
      } : undefined,
      priceTarget,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    // HERMES_FIX: S11 2026-02-19 SEVERITY: MEDIUM — was silently swallowing
    if (err instanceof Error) {
      console.warn(`[SCAN] processSymbol ${symbol} failed: ${err.message}`)
    }
    return null
  }
}

function buildSummary(results: ScanResult[], segment: Segment, duration: number, errorCount: number): ScanSummary {
  return {
    scanId: `${segment}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    duration,
    totalScanned: results.length,
    strongLongs: results.filter(r => r.hermes.signalType === 'strong_long').sort((a, b) => a.hermes.score - b.hermes.score),
    strongShorts: results.filter(r => r.hermes.signalType === 'strong_short').sort((a, b) => b.hermes.score - a.hermes.score),
    longs: results.filter(r => r.hermes.signalType === 'long').sort((a, b) => a.hermes.score - b.hermes.score),
    shorts: results.filter(r => r.hermes.signalType === 'short').sort((a, b) => b.hermes.score - a.hermes.score),
    neutrals: results.filter(r => r.hermes.signalType === 'neutral').length,
    errors: errorCount,
    segment,
  }
}

// ─── GET Handler ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`scan:${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const segmentRaw = searchParams.get('segment') || 'MEGA'
    const segmentResult = validateParams(segmentSchema, segmentRaw)
    const segment = (segmentResult.success ? segmentResult.data : 'MEGA') as Segment
    const filter = searchParams.get('filter')
    const symbolParam = searchParams.get('symbols')
    const mode = searchParams.get('mode') || 'json'  // 'stream' | 'json'

    let symbols: string[]
    if (symbolParam) {
      const parsed = validateParams(symbolsParamSchema, symbolParam)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid symbols', code: 'VALIDATION_ERROR' }, { status: 400 })
      }
      symbols = getCleanSymbols('ALL').filter(s => parsed.data.includes(s))
    } else {
      symbols = getCleanSymbols(segment)
    }

    if (symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols to scan' }, { status: 400 })
    }

    // ═══ STREAMING MODE ═══
    if (mode === 'stream') {
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const ctx = await prepareScan(symbols)
            const concurrency = 15
            const queue = [...symbols]
            const results: ScanResult[] = []
            let errorCount = 0
            let processed = 0

            // Send initial progress
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'progress', total: symbols.length, scanned: 0 }) + '\n'
            ))

            async function worker() {
              while (queue.length > 0) {
                const sym = queue.shift()
                if (!sym) break

                const result = await processSymbol(sym, ctx)
                processed++

                if (result) {
                  results.push(result)
                  controller.enqueue(encoder.encode(
                    JSON.stringify({ type: 'result', data: result }) + '\n'
                  ))
                } else {
                  errorCount++
                  const placeholder = createPlaceholderResult(sym, ctx.quotes.get(sym))
                  results.push(placeholder)
                  controller.enqueue(encoder.encode(
                    JSON.stringify({ type: 'result', data: placeholder }) + '\n'
                  ))
                }

                // Progress every 10 symbols
                if (processed % 10 === 0) {
                  controller.enqueue(encoder.encode(
                    JSON.stringify({ type: 'progress', total: symbols.length, scanned: processed, found: results.length }) + '\n'
                  ))
                }

                await new Promise(r => setTimeout(r, 30))
              }
            }

            const workers: Promise<void>[] = []
            for (let i = 0; i < concurrency; i++) workers.push(worker())
            await Promise.all(workers)

            const duration = Date.now() - startTime
            const summary = buildSummary(results, segment, duration, errorCount)

            saveScanResults(segment, results, summary)

            if (ctx.profileMap.size > 0) {
              updateTrendFromScanResults(results, ctx.profileMap)
            }

            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'done', summary }) + '\n'
            ))
            controller.close()
          } catch (err) {
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'error', message: (err as Error).message }) + '\n'
            ))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': 'chunked',
        },
      })
    }

    // ═══ CLASSIC JSON MODE (backward compatible) ═══
    const ctx = await prepareScan(symbols)
    const results: ScanResult[] = []
    let errorCount = 0
    const concurrency = 15
    const queue = [...symbols]

    async function worker() {
      while (queue.length > 0) {
        const sym = queue.shift()
        if (!sym) break
        const result = await processSymbol(sym, ctx)
        if (result) {
          results.push(result)
        } else {
          errorCount++
          results.push(createPlaceholderResult(sym, ctx.quotes.get(sym)))
        }
        await new Promise(r => setTimeout(r, 30))
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) workers.push(worker())
    await Promise.all(workers)

    const duration = Date.now() - startTime
    const summary = buildSummary(results, segment, duration, errorCount)

    saveScanResults(segment, results, summary)

    // HERMES_FIX: PROVIDER_MONITOR_v1 — Record scan freshness for SLA tracking
    providerMonitor.recordDataFetch('scan').catch(() => {})

    if (ctx.profileMap.size > 0) {
      updateTrendFromScanResults(results, ctx.profileMap)
    }

    if (filter === 'strong') {
      return NextResponse.json({ ...summary, longs: [], shorts: [], allResults: undefined })
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
