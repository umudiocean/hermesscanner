// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Latest Scan Results API
// GET /api/scan/latest - En son tarama sonuclarini dondur (disk cache)
// POST /api/scan/latest - Tarama tamamlandığında tüm sonuçları kaydet
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { loadLatestScan, saveFullScan, getAllResults } from '@/lib/scan-store'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import { scanLatestBodySchema, validateParams } from '@/lib/validation/schemas'

function ageMinFromIso(ts: string): number {
  const t = new Date(ts).getTime()
  if (!Number.isFinite(t)) return -1
  return Math.round((Date.now() - t) / 60000)
}

export async function GET() {
  try {
    // Once memory'den kontrol et
    const memResults = getAllResults()
    if (memResults.length > 0) {
      const ts = new Date().toISOString()
      return NextResponse.json({
        results: memResults,
        timestamp: ts,
        scanId: 'memory',
        fromCache: true,
        source: 'memory',
      }, {
        headers: {
          'X-Hermes-Scan-Source': 'memory',
          'X-Hermes-Scan-Timestamp': ts,
          'X-Hermes-Scan-Age-Min': '0',
        },
      })
    }
    
    // Memory bossa disk'ten oku
    const diskCache = await loadLatestScan()
    
    if (diskCache && diskCache.results && diskCache.results.length > 0) {
      const ts = diskCache.timestamp || new Date().toISOString()
      const age = ageMinFromIso(ts)
      return NextResponse.json({
        results: diskCache.results,
        timestamp: ts,
        scanId: diskCache.scanId,
        fromCache: true,
        source: 'disk',
      }, {
        headers: {
          'X-Hermes-Scan-Source': 'disk',
          'X-Hermes-Scan-Timestamp': ts,
          'X-Hermes-Scan-Age-Min': String(age),
        },
      })
    }
    
    return NextResponse.json({ 
      results: [], 
      fromCache: false,
      message: 'No cached scan results'
    }, {
      headers: {
        'X-Hermes-Scan-Source': 'none',
        'X-Hermes-Scan-Age-Min': '-1',
      },
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load cached results', message: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST - Tarama tamamlandiginda tum sonuclari disk'e kaydet
 * Rate-limited + idempotency key ile korunur (cache poisoning onleme)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`scan-save:${ip}`, 3, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json()
    const parsed = validateParams(scanLatestBodySchema, body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    const { results, scanId } = parsed.data

    await saveFullScan(results, scanId || `full-${Date.now()}`)

    return NextResponse.json({
      success: true,
      savedCount: results.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[SCAN-LATEST] Save error:', (error as Error).message)
    return NextResponse.json(
      { error: 'Failed to save results', code: 'SAVE_ERROR' },
      { status: 500 }
    )
  }
}
