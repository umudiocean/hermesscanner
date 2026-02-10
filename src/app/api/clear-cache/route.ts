// ═══════════════════════════════════════════════════════════════════
// Cache Temizleme API — Split-adjusted veri düzeltmesi sonrası
// POST /api/clear-cache
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { clearAllCaches } from '@/lib/fmp-client'

export async function POST() {
  try {
    const result = await clearAllCaches()
    return NextResponse.json({
      success: true,
      cleared: result,
      message: `Memory: ${result.memory} entry, Disk: ${result.disk} dosya temizlendi. Yeni taramada güncel veri çekilecek.`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Cache temizleme hatası', message: (error as Error).message },
      { status: 500 }
    )
  }
}
