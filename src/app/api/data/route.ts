// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Data Management API
// GET /api/data - Veri durumu
// POST /api/data - Verileri locale indir
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getDataStats, listHistoricalSymbols, saveScanToFile, loadLatestScan } from '@/lib/data-store'
import { getCleanSymbols } from '@/lib/symbols'
import { getHistorical15Min, clearCache } from '@/lib/fmp-client'
import { Segment } from '@/lib/types'

export const maxDuration = 300 // 5 dakika timeout

/** GET - Veri durumunu getir */
export async function GET() {
  try {
    const stats = await getDataStats()
    const savedSymbols = await listHistoricalSymbols()
    
    const allSymbols = getCleanSymbols('ALL')
    const coverage = savedSymbols.length / allSymbols.length * 100
    
    return NextResponse.json({
      stats,
      coverage: `${coverage.toFixed(1)}%`,
      savedCount: savedSymbols.length,
      totalCount: allSymbols.length,
      missing: allSymbols.length - savedSymbols.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get data stats', message: (error as Error).message },
      { status: 500 }
    )
  }
}

/** POST - Verileri toplu indir */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json().catch(() => ({}))
    const segment = (body.segment || 'ALL') as Segment
    const forceRefresh = body.forceRefresh === true
    const concurrency = body.concurrency || 10
    
    const symbols = getCleanSymbols(segment)
    const savedSymbols = new Set(await listHistoricalSymbols())
    
    // Force refresh yoksa sadece eksikleri indir
    const toDownload = forceRefresh 
      ? symbols 
      : symbols.filter(s => !savedSymbols.has(s))
    
    if (toDownload.length === 0) {
      return NextResponse.json({
        message: 'All data already downloaded',
        downloaded: 0,
        total: symbols.length,
        duration: Date.now() - startTime,
      })
    }
    
    // Concurrent download
    let downloaded = 0
    let errors = 0
    const queue = [...toDownload]
    
    async function worker() {
      while (queue.length > 0) {
        const symbol = queue.shift()
        if (!symbol) break
        
        try {
          await getHistorical15Min(symbol, forceRefresh)
          downloaded++
          
          // Her 50 hissede progress log
          if (downloaded % 50 === 0) {
            console.log(`[DATA] Downloaded ${downloaded}/${toDownload.length}`)
          }
        } catch (err) {
          errors++
          console.error(`[DATA] Failed ${symbol}:`, (err as Error).message)
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker())
    }
    await Promise.all(workers)
    
    const duration = Date.now() - startTime
    
    return NextResponse.json({
      message: 'Download complete',
      downloaded,
      errors,
      total: toDownload.length,
      duration,
      durationMin: (duration / 60000).toFixed(1),
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Download failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
