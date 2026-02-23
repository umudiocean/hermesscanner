// Admin-only: Bootstrap tetikleme (Redis gerekli)
// Cron secret ile /api/cron/bootstrap cagirir

import { NextResponse } from 'next/server'

export const maxDuration = 320

export async function POST() {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET yok' }, { status: 500 })
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 270_000)

  try {
    const res = await fetch(`${baseUrl}/api/cron/bootstrap`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cronSecret}` },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    let data: Record<string, unknown> = {}
    try {
      data = await res.json()
    } catch {
      data = { error: `HTTP ${res.status}` }
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: (data.error as string) || data.message || `Bootstrap hata: ${res.status}` },
        { status: res.status }
      )
    }
    return NextResponse.json(data)
  } catch (err) {
    clearTimeout(timeout)
    const msg = (err as Error).message
    const isAbort = msg?.includes('abort') || (err as Error).name === 'AbortError'
    return NextResponse.json(
      {
        error: isAbort ? 'Bootstrap zamanaşimi (270sn). Redis ve CRON_SECRET dogrulayin.' : 'Bootstrap cagrisi basarisiz',
        message: msg,
      },
      { status: 500 }
    )
  }
}
