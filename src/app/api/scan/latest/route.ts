// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Latest Scan Results API
// GET /api/scan/latest - En son tarama sonuclarini dondur (disk cache)
// POST /api/scan/latest - Tarama tamamlandığında tüm sonuçları kaydet
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { loadLatestScan, saveFullScan, getAllResults } from '@/lib/scan-store'

export async function GET() {
  try {
    // Once memory'den kontrol et
    const memResults = getAllResults()
    if (memResults.length > 0) {
      return NextResponse.json({
        results: memResults,
        timestamp: new Date().toISOString(),
        scanId: 'memory',
        fromCache: true,
        source: 'memory',
      })
    }
    
    // Memory bossa disk'ten oku
    const diskCache = await loadLatestScan()
    
    if (diskCache && diskCache.results && diskCache.results.length > 0) {
      return NextResponse.json({
        results: diskCache.results,
        timestamp: diskCache.timestamp,
        scanId: diskCache.scanId,
        fromCache: true,
        source: 'disk',
      })
    }
    
    return NextResponse.json({ 
      results: [], 
      fromCache: false,
      message: 'No cached scan results'
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load cached results', message: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST - Tarama tamamlandığında tüm sonuçları disk'e kaydet
 * Client tarafından çağrılır
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { results, scanId } = body

    if (!results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Invalid results data' },
        { status: 400 }
      )
    }

    // Disk'e kaydet
    await saveFullScan(results, scanId || `full-${Date.now()}`)

    return NextResponse.json({
      success: true,
      savedCount: results.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save results', message: (error as Error).message },
      { status: 500 }
    )
  }
}
