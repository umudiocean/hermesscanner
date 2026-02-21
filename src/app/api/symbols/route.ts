// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Symbols API
// Segment bazli sembol listesini dondurur (chunking icin)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCleanSymbols, getCleanSegmentStats } from '@/lib/symbols'
import { Segment } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const segment = (searchParams.get('segment') || 'ALL') as Segment

  const symbols = getCleanSymbols(segment)
  const stats = getCleanSegmentStats()

  return NextResponse.json({ symbols, stats, count: symbols.length })
}
