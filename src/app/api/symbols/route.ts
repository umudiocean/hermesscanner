// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Symbols API
// Segment bazli sembol listesini dondurur (chunking icin)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSymbols, getSegmentStats } from '@/lib/symbols'
import { Segment } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const segment = (searchParams.get('segment') || 'ALL') as Segment

  const symbols = getSymbols(segment)
  const stats = getSegmentStats()

  return NextResponse.json({ symbols, stats, count: symbols.length })
}
