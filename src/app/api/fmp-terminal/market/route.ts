// ═══════════════════════════════════════════════════════════════════
// FMP Terminal - Market Dashboard API
// GET /api/fmp-terminal/market
// Returns market dashboard data (indexes, sectors, gainers, etc.)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketDashboard } from '@/lib/fmp-terminal/fmp-bulk-client'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const data = await fetchMarketDashboard()

    const duration = Date.now() - startTime
    console.log(`[FMP Terminal /market] Fetched in ${duration}ms`)

    return NextResponse.json(data)
  } catch (error) {
    console.error('[FMP Terminal /market] Error:', (error as Error).message)
    return NextResponse.json(
      {
        error: 'Failed to fetch market dashboard',
        message: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
