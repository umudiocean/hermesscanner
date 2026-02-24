import { NextRequest, NextResponse } from 'next/server'
import { trackPageView, trackUniqueVisitor } from '@/lib/analytics/tracker'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const clientIp = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`admin-track:${clientIp}`, 10, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

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
