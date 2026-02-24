// Admin-only: Trade-ready vs insufficient symbols (scan sonuclarindan)
// Son taramada gorunen = trade-ready, digerleri FMP 15dk verisi yetersiz (evren 2064)

import { NextResponse } from 'next/server'
import { getCleanSymbols } from '@/lib/symbols'
import { loadLatestScan } from '@/lib/scan-store'

export const maxDuration = 30

export async function GET() {
  const latest = await loadLatestScan()
  const allSymbols = getCleanSymbols('ALL')
  const tradeReadySet = new Set<string>()

  if (latest?.results?.length) {
    for (const r of latest.results) tradeReadySet.add(r.symbol)
  }

  const tradeReady = allSymbols.filter(s => tradeReadySet.has(s))
  const insufficient = allSymbols.filter(s => !tradeReadySet.has(s))

  return NextResponse.json({
    tradeReady,
    insufficient,
    tradeReadyCount: tradeReady.length,
    insufficientCount: insufficient.length,
    totalInList: allSymbols.length,
    scanTimestamp: latest?.timestamp ?? null,
  })
}
