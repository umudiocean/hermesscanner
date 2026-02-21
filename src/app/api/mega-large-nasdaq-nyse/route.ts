/**
 * GET /api/mega-large-nasdaq-nyse
 * FMP API company-screener uzerinden NASDAQ ve NYSE'deki MEGA ve LARGE sirketlerin sayisi ve listesi
 *
 * Segment: MEGA >= $200B | LARGE $10B-$200B
 */

import { NextResponse } from 'next/server'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

async function fetchScreener(exchange: string, marketCapMoreThan: number, marketCapLowerThan?: number) {
  const key = process.env.FMP_API_KEY
  if (!key) {
    console.error('[MEGA-LARGE] CFG_MISSING_FMP_KEY — env var not set')
    throw new Error('API configuration error')
  }
  const params = new URLSearchParams({
    exchange,
    marketCapMoreThan: String(marketCapMoreThan),
    limit: '5000',
  })
  if (marketCapLowerThan != null) params.set('marketCapLowerThan', String(marketCapLowerThan))
  const res = await fetch(`${FMP_BASE}/company-screener?${params}`, {
    headers: { apikey: key },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`FMP API ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

const MEGA_MIN = 200_000_000_000  // marketCapMoreThan 199999999999
const LARGE_MAX = 200_000_000_000

export async function GET() {
  try {
    const [nasdaqMega, nasdaqLarge, nyseMega, nyseLarge] = await Promise.all([
      fetchScreener('NASDAQ', 199999999999),
      fetchScreener('NASDAQ', 9999999999, LARGE_MAX),
      fetchScreener('NYSE', 199999999999),
      fetchScreener('NYSE', 9999999999, LARGE_MAX),
    ])

    const sortByMcap = (a: { marketCap: number }, b: { marketCap: number }) => b.marketCap - a.marketCap
    nasdaqMega.sort(sortByMcap)
    nasdaqLarge.sort(sortByMcap)
    nyseMega.sort(sortByMcap)
    nyseLarge.sort(sortByMcap)

    return NextResponse.json({
      summary: {
        nasdaq: { mega: nasdaqMega.length, large: nasdaqLarge.length, total: nasdaqMega.length + nasdaqLarge.length },
        nyse: { mega: nyseMega.length, large: nyseLarge.length, total: nyseMega.length + nyseLarge.length },
        totalMega: nasdaqMega.length + nyseMega.length,
        totalLarge: nasdaqLarge.length + nyseLarge.length,
        total: nasdaqMega.length + nasdaqLarge.length + nyseMega.length + nyseLarge.length,
      },
      nasdaqMega,
      nasdaqLarge,
      nyseMega,
      nyseLarge,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
