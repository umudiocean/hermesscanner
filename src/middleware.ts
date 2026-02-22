import { NextRequest, NextResponse } from 'next/server'

// HERMES_FIX: DISTRIBUTED_RATE_LIMIT 2026-02-19 SEVERITY: HIGH
// Replaced in-memory Map rate limiter with Upstash Redis (distributed).
// In serverless, each function instance has separate memory — in-memory Map
// is ineffective. Upstash @upstash/ratelimit provides atomic sliding window
// shared across all instances.
//
// Graceful fallback: If Redis unavailable → in-memory (same as before).
// Bot blocking remains synchronous (no Redis dependency).

import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  // ─── Admin Auth Protection ─────────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('hermes-admin-token')?.value
    if (!token || !token.startsWith('hermes_')) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (pathname.startsWith('/api/admin/') &&
      !pathname.startsWith('/api/admin/login') &&
      !pathname.startsWith('/api/admin/logout') &&
      !pathname.startsWith('/api/admin/track')) {
    const token = request.cookies.get('hermes-admin-token')?.value
    if (!token || !token.startsWith('hermes_')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ─── Bot Blocking on Sensitive API Routes (synchronous, no Redis) ──
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/admin/')) {
    const ua = request.headers.get('user-agent') || ''
    const isBot = /bot|crawler|spider|scraper|python-requests|httpie|curl\/|wget\//i.test(ua)
    if (isBot) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // HERMES_FIX: DISTRIBUTED_RATE_LIMIT — Redis-backed sliding window (60 req/min per IP+route)
    // Falls back to in-memory if Redis unavailable
    const ip = getClientIP(request)
    const routeGroup = pathname.split('/').slice(0, 4).join('/')
    const rlResult = await checkRateLimit(`${ip}:${routeGroup}`, 60, 60_000)

    if (!rlResult.allowed) {
      return rateLimitResponse(rlResult.retryAfterMs)
    }
  }

  // ─── Analytics: Page View + Unique Visitor ─────────────────────
  if (!pathname.startsWith('/api/') &&
      !pathname.startsWith('/_next/') &&
      !pathname.startsWith('/admin/login') &&
      !pathname.includes('.')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || 'unknown'
    const referrer = request.headers.get('referer') || undefined
    const ua = request.headers.get('user-agent') || undefined

    const trackUrl = new URL('/api/admin/track', request.url)
    trackUrl.searchParams.set('p', pathname)
    if (referrer) trackUrl.searchParams.set('r', referrer)
    if (ua) trackUrl.searchParams.set('ua', ua.slice(0, 200))
    trackUrl.searchParams.set('ip', ip)

    fetch(trackUrl.toString(), { method: 'POST' }).catch(() => {})
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
