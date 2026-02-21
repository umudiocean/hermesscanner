import { NextResponse } from 'next/server'
import { getAllFlags } from '@/lib/feature-flags'

export async function GET() {
  const flags = await getAllFlags()
  return NextResponse.json(flags, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
