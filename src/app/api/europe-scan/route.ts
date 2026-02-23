// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Trade AI Scan API
// GET /api/europe-scan?symbols=HSBA.L,SAP.DE,...
// Uses hermes-engine with Europe-specific params (V360_Z51, BPD 34)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getEuropeSymbols, fetchEuropeSymbolsFromFMP } from '@/lib/europe-symbols'
import { EUROPE_TRADE_CONFIG } from '@/lib/europe-config'
import { computeSegmentFromMarketCap } from '@/lib/europe-symbols'
import { calculateHermes } from '@/lib/hermes-engine'
import { getBatchQuotes, getHistorical15Min } from '@/lib/fmp-client'
import { ScanResult } from '@/lib/types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 120

async function processSymbol(
  symbol: string,
  quotes: Map<string, { price: number; change: number; changePercent: number; volume: number; marketCap: number }>,
): Promise<ScanResult | null> {
  try {
    const bars = await getHistorical15Min(symbol)
    if (!bars || bars.length < 500) return null

    const quote = quotes.get(symbol)

    const config = {
      vwap_52w_len: EUROPE_TRADE_CONFIG.vwapDays * EUROPE_TRADE_CONFIG.bpd,
      zscore_len_52w: EUROPE_TRADE_CONFIG.zscoreDays * EUROPE_TRADE_CONFIG.bpd,
    }

    const hermes = calculateHermes(bars, config)

    // Sanitize hermes for client (strip internal fields, same as NASDAQ scan)
    const sanitizedHermes = {
      score: hermes.score,
      signal: hermes.signal,
      signalType: hermes.signalType,
      indicators: {
        rsi: Math.round(hermes.indicators.rsi * 10) / 10,
        mfi: Math.round(hermes.indicators.mfi * 10) / 10,
        adx: Math.round(hermes.indicators.adx * 10) / 10,
        atr: hermes.indicators.atr,
        volRatio: Math.round(hermes.indicators.volRatio * 100) / 100,
      },
      bands: hermes.bands,
      touches: hermes.touches,
      price: hermes.price,
      dataPoints: hermes.dataPoints,
      hasEnough52w: hermes.hasEnough52w,
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
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`europe-scan:${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const symbolsParam = request.nextUrl.searchParams.get('symbols')
  let symbols: string[]
  if (symbolsParam) {
    symbols = symbolsParam.split(',').filter(Boolean)
  } else {
    const dynamicSyms = await fetchEuropeSymbolsFromFMP()
    symbols = dynamicSyms.length > 100 ? dynamicSyms : getEuropeSymbols('ALL')
  }

  try {
    const quotes = await getBatchQuotes(symbols)

    const results: ScanResult[] = []
    const BATCH = 10
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(
        batch.map(sym => processSymbol(sym, quotes))
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

    return NextResponse.json({ results, summary })
  } catch (error) {
    console.error('[EU Scan] Error:', (error as Error).message)
    return NextResponse.json({ error: 'Scan failed', message: (error as Error).message }, { status: 500 })
  }
}
