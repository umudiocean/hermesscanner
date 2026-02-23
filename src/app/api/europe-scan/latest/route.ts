// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Scan Latest (cache read)
// GET /api/europe-scan/latest
// Returns cached Europe scan results (populated by cron or manual scan)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getMemoryCache } from '@/lib/fmp-terminal/fmp-cache'
import { ScanResult } from '@/lib/types'

export async function GET() {
  const cached = getMemoryCache<{ results: ScanResult[]; summary: unknown }>('europe_scan_latest', 30 * 60 * 1000)
  if (cached && cached.results?.length > 0) {
    return NextResponse.json(cached)
  }
  return NextResponse.json({ results: [], summary: null, message: 'No cached scan — trigger /api/europe-scan first' })
}
