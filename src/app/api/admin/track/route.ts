import { NextRequest, NextResponse } from 'next/server'
import { trackPageView, trackUniqueVisitor } from '@/lib/analytics/tracker'

export async function POST(request: NextRequest) {
  const p = request.nextUrl.searchParams.get('p') || '/'
  const r = request.nextUrl.searchParams.get('r') || undefined
  const ua = request.nextUrl.searchParams.get('ua') || undefined
  const ip = request.nextUrl.searchParams.get('ip') || 'unknown'

  // Fire-and-forget — no await needed for response
  Promise.allSettled([
    trackPageView(p, r, ua),
    trackUniqueVisitor(ip),
  ]).catch(() => {})

  return new NextResponse(null, { status: 204 })
}
