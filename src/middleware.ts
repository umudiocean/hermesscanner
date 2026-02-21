import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // ─── Analytics: Page View + Unique Visitor ─────────────────────
  // Fire-and-forget tracking for non-API, non-static page requests
  if (!pathname.startsWith('/api/') &&
      !pathname.startsWith('/_next/') &&
      !pathname.startsWith('/admin/login') &&
      !pathname.includes('.')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || 'unknown'
    const referrer = request.headers.get('referer') || undefined
    const ua = request.headers.get('user-agent') || undefined

    // Edge-compatible: use waitUntil if available, otherwise fire-and-forget
    // Middleware runs on Edge, so we use fetch to our own tracking endpoint
    const trackUrl = new URL('/api/admin/track', request.url)
    trackUrl.searchParams.set('p', pathname)
    if (referrer) trackUrl.searchParams.set('r', referrer)
    if (ua) trackUrl.searchParams.set('ua', ua.slice(0, 200))
    trackUrl.searchParams.set('ip', ip)

    // Non-blocking fire-and-forget
    fetch(trackUrl.toString(), { method: 'POST' }).catch(() => {})
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    // Match main pages for analytics
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
