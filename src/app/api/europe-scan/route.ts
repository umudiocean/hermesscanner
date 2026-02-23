// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Trade AI Scan API
// GET /api/europe-scan?symbols=HSBA.L,SAP.DE,...
// Uses hermes-engine with Europe DAILY data (FMP 15min EU limited)
// V360_Z51, BPD 1 (daily) — minBars ~231, daily data always available
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getEuropeSymbols, fetchEuropeSymbolsFromFMP } from '@/lib/europe-symbols'
import { EUROPE_TRADE_CONFIG } from '@/lib/europe-config'
import { computeSegmentFromMarketCap } from '@/lib/europe-symbols'
import { calculateHermes } from '@/lib/hermes-engine'
import { getBatchQuotes, getHistoricalDaily } from '@/lib/fmp-client'
import { ScanResult } from '@/lib/types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import { setMemoryCache } from '@/lib/fmp-terminal/fmp-cache'

export const maxDuration = 120

// Europe: DAILY bars (BPD=1) — FMP 15min for EU symbols often limited/empty
// vwap 360d, zscore 51d → minBars = 51 + 180 = 231
const EUROPE_DAILY_CONFIG = {
  vwap_52w_len: EUROPE_TRADE_CONFIG.vwapDays * 1,     // 360 bars
  zscore_len_52w: EUROPE_TRADE_CONFIG.zscoreDays * 1,  // 51 bars
  tanh_div: EUROPE_TRADE_CONFIG.tanhDiv,               // 7
  long_th: EUROPE_TRADE_CONFIG.longTh,                 // 35
  short_th: EUROPE_TRADE_CONFIG.shortTh,               // 85
}

const MIN_BARS_EUROPE = 231 // zscore 51 + vwap 360/2

async function processSymbol(
  symbol: string,
  quotes: Map<string, { price: number; change: number; changePercent: number; volume: number; marketCap: number }>,
  failLog: { count: number; samples: Array<{ symbol: string; err: string }> },
): Promise<ScanResult | null> {
  try {
    let bars = await getHistoricalDaily(symbol, 1500)
    // If cached data is too short, force refresh to get longer history
    if (bars && bars.length < EUROPE_DAILY_CONFIG.vwap_52w_len + EUROPE_DAILY_CONFIG.zscore_len_52w) {
      bars = await getHistoricalDaily(symbol, 1500, true)
    }
    if (!bars || bars.length < MIN_BARS_EUROPE) {
      if (failLog.count < 5) {
        failLog.samples.push({ symbol, err: bars ? `bars=${bars.length}<${MIN_BARS_EUROPE}` : 'no bars' })
        failLog.count++
      }
      return null
    }

    const quote = quotes.get(symbol)

    const hermes = calculateHermes(bars, EUROPE_DAILY_CONFIG)

    // Include all hermes fields (same structure as NASDAQ scan)
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

    return {
      symbol,
      segment: computeSegmentFromMarketCap(quote?.marketCap),
      hermes: sanitizedHermes as ScanResult['hermes'],
      quote: quote
        ? {
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
          }
        : undefined,
      priceTarget: null,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    if (failLog.count < 5) {
      failLog.samples.push({ symbol, err: (err as Error).message })
      failLog.count++
    }
    return null
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`europe-scan:${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const symbolsParam = request.nextUrl.searchParams.get('symbols')
  const limitParam = request.nextUrl.searchParams.get('limit')
  let symbols: string[]
  if (symbolsParam) {
    symbols = symbolsParam.split(',').filter(Boolean)
  } else {
    const dynamicSyms = await fetchEuropeSymbolsFromFMP()
    symbols = dynamicSyms.length > 100 ? dynamicSyms : getEuropeSymbols('ALL')
  }
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 0, 200) : 0
  if (limit > 0) symbols = symbols.slice(0, limit)

  const failLog = { count: 0, samples: [] as Array<{ symbol: string; err: string }> }

  try {
    const quotes = await getBatchQuotes(symbols)

    const results: ScanResult[] = []
    const BATCH = 10
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(
        batch.map(sym => processSymbol(sym, quotes, failLog))
      )
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      }
    }

    const summary = {
      scanId: `eu-${Date.now()}`,
      totalSymbols: symbols.length,
      scannedSymbols: results.length,
      strongLong: results.filter(r => r.hermes.signalType === 'strong_long').length,
      long: results.filter(r => r.hermes.signalType === 'long').length,
      neutral: results.filter(r => r.hermes.signalType === 'neutral').length,
      short: results.filter(r => r.hermes.signalType === 'short').length,
      strongShort: results.filter(r => r.hermes.signalType === 'strong_short').length,
      timestamp: new Date().toISOString(),
    }

    if (results.length > 0) {
      setMemoryCache('europe_scan_latest', { results, summary })
    } else if (failLog.samples.length > 0) {
      console.warn('[EU Scan] 0 results. Sample failures:', JSON.stringify(failLog.samples))
    }

    return NextResponse.json({ results, summary })
  } catch (error) {
    console.error('[EU Scan] Error:', (error as Error).message)
    return NextResponse.json({ error: 'Scan failed', message: (error as Error).message }, { status: 500 })
  }
}
