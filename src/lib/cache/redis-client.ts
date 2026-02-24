// ═══════════════════════════════════════════════════════════════════
// Shared Upstash Redis client (singleton)
// Used by: rate-limiter, redis-cache, analytics, feature-flags
// ═══════════════════════════════════════════════════════════════════

import { Redis } from '@upstash/redis'

let redis: Redis | null = null
let available = false

export function isRedisRequired(): boolean {
  return process.env.REQUIRE_REDIS === 'true'
}

export function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (url && token) {
    try {
      redis = new Redis({ url, token })
      available = true
      return redis
    } catch {
      console.warn('[REDIS] Upstash init failed')
    }
  }
  return null
}

export function isRedisAvailable(): boolean {
  if (!available) getRedis()
  return available
}

export function assertRedisAvailableOrThrow(context: string): void {
  if (!isRedisRequired()) return
  if (!isRedisAvailable()) {
    throw new Error(`REDIS_REQUIRED_UNAVAILABLE: ${context}`)
  }
}
