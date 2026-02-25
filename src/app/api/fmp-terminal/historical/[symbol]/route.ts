// HERMES AI TERMINAL — Historical Price Data Endpoint
// Serves last 30 days of OHLCV data for PDF charts

import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 3600 // 1 hour cache

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  const params = await context.params
  const symbol = params.symbol?.toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
  }

  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get('days') || '30')

  try {
    // Simple fetch with FMP API key
    const FMP_API_KEY = process.env.FMP_API_KEY
    if (!FMP_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const url = `https://financialmodelingprep.com/stable/historical-price-eod/${symbol}?limit=${days}`
    const headers = { apikey: FMP_API_KEY }

    const res = await fetch(url, { headers, next: { revalidate: 3600 } })
    if (!res.ok) {
      throw new Error(`FMP API error: ${res.status}`)
    }

    const data = await res.json()

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json([], { status: 200 })
    }

    // Return sorted (oldest first) for chart drawing
    const sorted = data.reverse()

    return NextResponse.json(sorted, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch historical data', message: error.message },
      { status: 500 }
    )
  }
}
