import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials, getAdminCookieConfig } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body as { username?: string; password?: string }

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const token = verifyCredentials(username, password)
    if (!token) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    const config = getAdminCookieConfig(token)
    response.cookies.set(config)
    return response
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
