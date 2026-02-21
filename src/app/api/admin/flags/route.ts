import { NextRequest, NextResponse } from 'next/server'
import { getAllFlags, setFlag } from '@/lib/feature-flags'

export async function GET() {
  const flags = await getAllFlags()
  return NextResponse.json(flags)
}

export async function POST(request: NextRequest) {
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
