// ═══════════════════════════════════════════════════════════════════
// Durable rate limiter — Upstash Redis (sliding window)
// Graceful fallback to in-memory when UPSTASH env vars missing
// Same public API: checkRateLimit(key, max, windowMs)
// ═══════════════════════════════════════════════════════════════════

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ─── Upstash Redis client (singleton) ───────────────────────────

let redis: Redis | null = null
let upstashAvailable = false

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (url && token) {
    try {
      redis = new Redis({ url, token })
      upstashAvailable = true
      return redis
    } catch {
      console.warn('[RATE-LIMITER] Upstash init failed, using in-memory fallback')
    }
  }
  return null
}

// ─── Upstash rate limiters keyed by (max, windowMs) ─────────────

const upstashLimiters = new Map<string, Ratelimit>()

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  const r = getRedis()
  if (!r) return null

  const key = `${maxRequests}:${windowMs}`
  let limiter = upstashLimiters.get(key)
  if (limiter) return limiter

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
  limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
    prefix: 'hermes-rl',
    analytics: false,
  })
  upstashLimiters.set(key, limiter)
  return limiter
}

// ─── In-memory fallback (same as P0) ────────────────────────────

interface RateBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateBucket>()
let cleanupScheduled = false

function scheduleCleanup() {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setTimeout(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets.entries()) {
      if (now > bucket.resetAt) buckets.delete(key)
    }
    cleanupScheduled = false
  }, 60_000)
}

function inMemoryCheck(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    scheduleCleanup()
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 }
  }

  if (bucket.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }

  bucket.count++
  return { allowed: true, remaining: maxRequests - bucket.count, retryAfterMs: 0 }
}

// ─── Public API (unchanged signature) ───────────────────────────

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const limiter = getUpstashLimiter(maxRequests, windowMs)

  if (limiter) {
    try {
      const result = await limiter.limit(key)
      return {
        allowed: result.success,
        remaining: result.remaining,
        retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
      }
    } catch (err) {
      console.warn('[RATE-LIMITER] Upstash call failed, falling back to in-memory:', (err as Error).message)
    }
  }

  return inMemoryCheck(key, maxRequests, windowMs)
}

export function isUpstashActive(): boolean {
  return upstashAvailable
}

export function getClientIP(request: Request): string {
  const headers = new Headers(request.headers)
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

export function rateLimitResponse(retryAfterMs: number) {
  return new Response(
    JSON.stringify({ error: 'Too many requests', retryAfterMs }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      },
    }
  )
}
