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

  try {
    const res = await fetch(`${baseUrl}/api/cron/bootstrap`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cronSecret}` },
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: 'Bootstrap cagrisi basarisiz', message: (err as Error).message },
      { status: 500 }
    )
  }
}
