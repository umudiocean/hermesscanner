// ============================================================================
// WALLET NICKNAMES API
// ============================================================================
// Store and retrieve nicknames for wallet addresses
// Uses Upstash Redis for persistent storage
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth } from '@/lib/auth/verifyAdminAuth'
import { redis } from '@/lib/upstash'

const NICKNAMES_KEY = 'hermes:fund:wallet-nicknames'

// GET - Fetch all nicknames
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAdminAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    let nicknames: Record<string, string> = {}

    // Redis best-effort: auth already passed, login must succeed even if
    // Redis is down. Nickname persistence falls back to client localStorage.
    if (redis) {
      try {
        const data = await redis.get(NICKNAMES_KEY)
        if (data && typeof data === 'object') {
          nicknames = data as Record<string, string>
        }
      } catch (redisErr) {
        console.error('Wallet nicknames GET redis error (non-fatal):', redisErr)
      }
    }

    return NextResponse.json({
      success: true,
      nicknames
    })

  } catch (error: any) {
    console.error('Wallet nicknames GET error:', error)
    // Auth passed but something else failed — still return success so login works
    return NextResponse.json({
      success: true,
      nicknames: {}
    })
  }
}

// POST - Save nickname
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json()
    const { address, nickname } = body

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 })
    }

    // Normalize address to lowercase
    const normalizedAddress = address.toLowerCase()

    // Get existing nicknames
    let nicknames: Record<string, string> = {}

    // Redis best-effort: client localStorage is the primary fallback.
    if (redis) {
      try {
        const data = await redis.get(NICKNAMES_KEY)
        if (data && typeof data === 'object') {
          nicknames = data as Record<string, string>
        }

        // Update nickname (empty string removes it)
        if (nickname && nickname.trim()) {
          nicknames[normalizedAddress] = nickname.trim()
        } else {
          delete nicknames[normalizedAddress]
        }

        await redis.set(NICKNAMES_KEY, nicknames)
      } catch (redisErr) {
        console.error('Wallet nicknames POST redis error (non-fatal):', redisErr)
        // Reflect the change in the returned object even if Redis write failed
        if (nickname && nickname.trim()) nicknames[normalizedAddress] = nickname.trim()
        else delete nicknames[normalizedAddress]
      }
    }

    return NextResponse.json({
      success: true,
      nicknames
    })

  } catch (error: any) {
    console.error('Wallet nicknames POST error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Bulk update nicknames
export async function PUT(request: NextRequest) {
  try {
    const auth = verifyAdminAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json()
    const { nicknames: newNicknames } = body

    if (!newNicknames || typeof newNicknames !== 'object') {
      return NextResponse.json({ success: false, error: 'Nicknames object required' }, { status: 400 })
    }

    // Normalize all addresses to lowercase
    const normalizedNicknames: Record<string, string> = {}
    for (const [addr, nick] of Object.entries(newNicknames)) {
      if (nick && typeof nick === 'string' && nick.trim()) {
        normalizedNicknames[addr.toLowerCase()] = nick.trim()
      }
    }

    if (redis) {
      await redis.set(NICKNAMES_KEY, normalizedNicknames)
    }

    return NextResponse.json({
      success: true,
      nicknames: normalizedNicknames
    })

  } catch (error: any) {
    console.error('Wallet nicknames PUT error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
