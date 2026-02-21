import { NextResponse } from 'next/server'
import { fetchFredDashboard, computeFredFearGreed, fetchFredDetailedSeries } from '@/lib/fred-client'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'dashboard'

    if (mode === 'series') {
      const seriesId = searchParams.get('series')
      const limit = parseInt(searchParams.get('limit') || '60', 10)
      if (!seriesId) {
        return NextResponse.json(
          createApiError('Missing series parameter', 'series query parameter is required', 'VALIDATION_ERROR'),
          { status: 400 }
        )
      }
      const data = await fetchFredDetailedSeries(seriesId, limit)
      return NextResponse.json({ seriesId, data, timestamp: new Date().toISOString() })
    }

    const dashboard = await fetchFredDashboard()
    const fearGreed = computeFredFearGreed(dashboard)

    return NextResponse.json({
      ...dashboard,
      fearGreedV2: fearGreed,
    })
  } catch (error) {
    logger.error('FRED API route error', { module: 'api/fred', error })
    return NextResponse.json(
      createApiError('FRED data fetch failed', String(error), 'FETCH_ERROR'),
      { status: 500 }
    )
  }
}
