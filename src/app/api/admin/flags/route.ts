import { NextRequest, NextResponse } from 'next/server'
import { getAllFlags, setFlag } from '@/lib/feature-flags'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`admin-flags:${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const flags = await getAllFlags()
  return NextResponse.json(flags)
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`admin-flags:${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json()
    const { key, enabled } = body as { key?: string; enabled?: boolean }

    if (!key || typeof key !== 'string' || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    await setFlag(key, enabled)
    return NextResponse.json({ success: true, key, enabled })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
