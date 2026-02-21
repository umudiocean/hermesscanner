import { NextRequest, NextResponse } from 'next/server'
import { getAllFlags } from '@/lib/feature-flags'

export async function GET(request: NextRequest) {
  const flags = await getAllFlags()

  const token = request.cookies.get('hermes-admin-token')?.value
  const isAdmin = !!(token && token.startsWith('hermes_'))

  return NextResponse.json({ ...flags, _isAdmin: isAdmin }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  })
}
