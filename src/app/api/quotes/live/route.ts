import { NextRequest, NextResponse } from 'next/server'
import { getBatchQuotes } from '@/lib/fmp-client'
import { getClientIP, checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter'
import { providerMonitor } from '@/lib/monitor/provider-monitor'

type Body = {
  symbols?: string[]
}

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`quotes-live:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = (await request.json()) as Body
    const rawSymbols = Array.isArray(body.symbols) ? body.symbols : []

    const symbols = Array.from(
      new Set(
        rawSymbols
          .map(s => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
          .filter(Boolean),
      ),
    ).slice(0, 2500)

    if (symbols.length === 0) {
      const ts = new Date().toISOString()
      return NextResponse.json({ quotes: {}, count: 0, timestamp: ts }, {
        headers: {
          'X-Hermes-Quote-Timestamp': ts,
          'X-Hermes-Quote-Count': '0',
        },
      })
    }

    const quotesMap = await getBatchQuotes(symbols)
    await providerMonitor.recordDataFetch('stocksQuote')
    const quotes: Record<string, { price: number; change: number; changePercent: number; volume: number; marketCap: number }> = {}

    for (const [symbol, q] of quotesMap.entries()) {
      quotes[symbol] = {
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume,
        marketCap: q.marketCap,
      }
    }

    const ts = new Date().toISOString()
    return NextResponse.json({
      quotes,
      count: Object.keys(quotes).length,
      timestamp: ts,
    }, {
      headers: {
        'X-Hermes-Quote-Timestamp': ts,
        'X-Hermes-Quote-Count': String(Object.keys(quotes).length),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Live quotes refresh failed', message: (error as Error).message },
      { status: 500 },
    )
  }
}
