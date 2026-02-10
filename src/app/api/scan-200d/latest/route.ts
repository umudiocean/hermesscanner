// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - 5G Latest Scan Results API
// GET /api/scan-200d/latest - En son 5G tarama sonuçlarını döndür
// POST /api/scan-200d/latest - 5G tarama tamamlandığında sonuçları kaydet
// 5G VWAP (5D) + Z-Score LB=12D | 70/15/15 | 20/80
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const SCANS_200D_DIR = path.join(process.cwd(), 'data', 'scans-200d')
const LATEST_200D_FILE = path.join(SCANS_200D_DIR, 'latest.json')

async function ensureDir(): Promise<void> {
  await fs.mkdir(SCANS_200D_DIR, { recursive: true })
}

export async function GET() {
  try {
    const content = await fs.readFile(LATEST_200D_FILE, 'utf-8')
    const data = JSON.parse(content)

    if (data.results && data.results.length > 0) {
      return NextResponse.json({
        results: data.results,
        timestamp: data.timestamp,
        scanId: data.scanId,
        fromCache: true,
        source: 'disk',
      })
    }

    return NextResponse.json({
      results: [],
      fromCache: false,
      message: 'No cached 200D scan results',
    })
  } catch {
    return NextResponse.json({
      results: [],
      fromCache: false,
      message: 'No cached 200D scan results',
    })
  }
}

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

    await ensureDir()
    await fs.writeFile(LATEST_200D_FILE, JSON.stringify({
      scanId: scanId || `200d-full-${Date.now()}`,
      timestamp: new Date().toISOString(),
      totalResults: results.length,
      results,
    }, null, 2))

    console.log(`[SCAN-200D] Saved ${results.length} results to disk`)

    return NextResponse.json({
      success: true,
      savedCount: results.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save 200D results', message: (error as Error).message },
      { status: 500 }
    )
  }
}
