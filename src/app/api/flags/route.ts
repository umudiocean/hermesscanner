import { NextRequest, NextResponse } from 'next/server'
import { getAllFlags } from '@/lib/feature-flags'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`flags:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const flags = await getAllFlags()

  const token = request.cookies.get('hermes-admin-token')?.value
  const isAdmin = !!(token && token.startsWith('hermes_'))

  return NextResponse.json({ ...flags, _isAdmin: isAdmin }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  })
}
