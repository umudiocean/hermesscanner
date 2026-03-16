// ============================================================================
// REDIS DATA MIGRATION: Old App → New App
// ============================================================================
// One-shot migration endpoint. Reads all hermes:fund:* keys from OLD Redis
// and writes them to the NEW app's Redis.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

// Old app's Redis (source - READ ONLY)
const OLD_REDIS_URL = process.env.OLD_REDIS_URL || ''
const OLD_REDIS_TOKEN = process.env.OLD_REDIS_TOKEN || ''

// Fund Redis key patterns to migrate
const FUND_KEYS = [
  'hermes:fund:v2:stats',
  'hermes:fund:v2:pendingUnstakes',
  'hermes:fund:v2:pendingClaims',
  'hermes:fund:v2:pendingWithdrawals',
  'hermes:fund:v2:transactions',
  'hermes:fund:v2:lastSync',
  'hermes:fund:wallet-nicknames',
]

// Prefix patterns that may have dynamic suffixes
const FUND_PREFIXES = [
  'hermes:fund:v2:user:',
  'hermes:fund:v2:daily:',
]

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!OLD_REDIS_URL || !OLD_REDIS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'OLD_REDIS_URL and OLD_REDIS_TOKEN env vars required'
      }, { status: 400 })
    }

    // Connect to OLD Redis (source)
    const oldRedis = new Redis({
      url: OLD_REDIS_URL,
      token: OLD_REDIS_TOKEN,
    })

    // Connect to NEW Redis (destination) - uses existing env vars
    const { getRedis } = await import('@/lib/cache/redis-client')
    const newRedis = getRedis()

    if (!newRedis) {
      return NextResponse.json({
        success: false,
        error: 'New Redis not available. Check KV_REST_API_URL/TOKEN.'
      }, { status: 500 })
    }

    const migrated: string[] = []
    const errors: string[] = []
    const skipped: string[] = []

    // 1. Migrate fixed keys
    for (const key of FUND_KEYS) {
      try {
        const value = await oldRedis.get(key)
        if (value !== null && value !== undefined) {
          await newRedis.set(key, value)
          migrated.push(key)
        } else {
          skipped.push(`${key} (not found)`)
        }
      } catch (err: any) {
        errors.push(`${key}: ${err.message}`)
      }
    }

    // 2. Migrate list keys (pendingClaims, pendingWithdrawals, pendingUnstakes are Redis lists)
    const listKeys = [
      'hermes:fund:v2:pendingClaims',
      'hermes:fund:v2:pendingWithdrawals',
      'hermes:fund:v2:pendingUnstakes',
      'hermes:fund:v2:transactions',
    ]
    for (const key of listKeys) {
      try {
        const listData = await oldRedis.lrange(key, 0, -1)
        if (listData && listData.length > 0) {
          // Clear existing list in new Redis first
          await newRedis.del(key)
          // Push all items
          for (const item of listData) {
            const serialized = typeof item === 'string' ? item : JSON.stringify(item)
            await newRedis.rpush(key, serialized)
          }
          migrated.push(`${key} (list: ${listData.length} items)`)
        }
      } catch (err: any) {
        // May fail for non-list keys, skip silently
        if (!err.message?.includes('WRONGTYPE')) {
          errors.push(`${key} (list): ${err.message}`)
        }
      }
    }

    // 3. Scan for dynamic keys (user:*, daily:*)
    for (const prefix of FUND_PREFIXES) {
      try {
        let cursor = '0'
        do {
          const result: [string, string[]] = await oldRedis.scan(cursor, { match: `${prefix}*`, count: 100 }) as [string, string[]]
          cursor = result[0]
          const keys = result[1]

          for (const key of keys) {
            try {
              const value = await oldRedis.get(key)
              if (value !== null && value !== undefined) {
                await newRedis.set(key, value)
                migrated.push(key)
              }
            } catch (err: any) {
              errors.push(`${key}: ${err.message}`)
            }
          }
        } while (cursor !== '0')
      } catch (err: any) {
        errors.push(`scan ${prefix}*: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        migrated: migrated.length,
        errors: errors.length,
        skipped: skipped.length,
      },
      migrated,
      errors,
      skipped,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('[MIGRATION] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Migration failed'
    }, { status: 500 })
  }
}

// GET - Check migration status / preview keys in old Redis
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!OLD_REDIS_URL || !OLD_REDIS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'OLD_REDIS_URL and OLD_REDIS_TOKEN env vars required',
        envHint: 'Set OLD_REDIS_URL and OLD_REDIS_TOKEN in Vercel'
      }, { status: 400 })
    }

    const oldRedis = new Redis({
      url: OLD_REDIS_URL,
      token: OLD_REDIS_TOKEN,
    })

    // Scan for all hermes:fund:* keys
    const allKeys: string[] = []
    let cursor = '0'
    do {
      const result: [string, string[]] = await oldRedis.scan(cursor, { match: 'hermes:fund:*', count: 100 }) as [string, string[]]
      cursor = result[0]
      allKeys.push(...result[1])
    } while (cursor !== '0')

    return NextResponse.json({
      success: true,
      oldRedisKeys: allKeys.sort(),
      keyCount: allKeys.length,
      message: 'POST to this endpoint to start migration'
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
