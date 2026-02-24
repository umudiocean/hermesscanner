// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Bulk Refresh API
// POST /api/europe-terminal/bulk-refresh
// Clears Europe caches and triggers fresh data fetch
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { clearMemoryCache } from '@/lib/fmp-terminal/fmp-cache'

export const maxDuration = 120

export async function POST(_request: NextRequest) {
  try {
    clearMemoryCache()
    return NextResponse.json({ success: true, message: 'Europe cache cleared', timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: 'Failed', message: (error as Error).message }, { status: 500 })
  }
}
