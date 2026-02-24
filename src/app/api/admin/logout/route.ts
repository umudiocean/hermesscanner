import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`admin-logout:${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
