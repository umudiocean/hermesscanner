// Upstash Redis compatibility layer for Hermes Fund
// Re-exports the existing Redis client as named export

import { getRedis } from '@/lib/cache/redis-client'

// Export a getter that provides the redis instance
// The API routes check for null before using
export const redis = getRedis()
