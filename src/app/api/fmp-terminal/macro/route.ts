import { NextResponse } from 'next/server'
import {
  fetchGDP, fetchConsumerSentiment, fetchGeneralNews,
  fetchESGBenchmark, fetchSP500Constituents,
  fetchNASDAQConstituents, fetchDowJonesConstituents,
} from '@/lib/fmp-terminal/fmp-bulk-client'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`fmp-macro:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const [gdp, sentiment, news, esg, sp500, nasdaq, dow] = await Promise.allSettled([
      fetchGDP(),
      fetchConsumerSentiment(),
      fetchGeneralNews(20),
      fetchESGBenchmark(),
      fetchSP500Constituents(),
      fetchNASDAQConstituents(),
      fetchDowJonesConstituents(),
    ])

    const safe = <T>(r: PromiseSettledResult<T[]>): T[] =>
      r.status === 'fulfilled' ? r.value || [] : []

    // Build index membership map
    const indexMap: Record<string, string[]> = {}
    for (const c of safe(sp500)) {
      const s = (c as { symbol: string }).symbol
      if (s) { indexMap[s] = [...(indexMap[s] || []), 'SP500'] }
    }
    for (const c of safe(nasdaq)) {
      const s = (c as { symbol: string }).symbol
      if (s) { indexMap[s] = [...(indexMap[s] || []), 'NDX100'] }
    }
    for (const c of safe(dow)) {
      const s = (c as { symbol: string }).symbol
      if (s) { indexMap[s] = [...(indexMap[s] || []), 'DJIA'] }
    }

    return NextResponse.json({
      gdp: safe(gdp).slice(0, 20),
      consumerSentiment: safe(sentiment).slice(0, 20),
      generalNews: safe(news),
      esgBenchmarks: safe(esg),
      indexConstituents: {
        sp500: safe(sp500).length,
        nasdaq: safe(nasdaq).length,
        dowjones: safe(dow).length,
      },
      indexMembership: indexMap,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Macro API error', { module: 'api/macro', error })
    return NextResponse.json(
      createApiError('Macro data fetch failed', String(error), 'FETCH_ERROR'),
      { status: 500 }
    )
  }
}
