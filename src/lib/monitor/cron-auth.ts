// HERMES_FIX: CRON_AUTH_v1 — Shared cron authentication logic
// Verifies Vercel cron header OR Bearer token from CRON_SECRET

import { NextRequest } from 'next/server'

export function verifyCronAuth(request: NextRequest | Request): boolean {
  const authHeader = 'headers' in request
    ? (request as NextRequest).headers.get('authorization')
    : null
  const vercelCron = 'headers' in request
    ? (request as NextRequest).headers.get('x-vercel-cron')
    : null
  const internalCron = 'headers' in request
    ? (request as NextRequest).headers.get('x-internal-cron')
    : null
  const cronSecret = process.env.CRON_SECRET

  if (vercelCron === '1') return true

  if (!cronSecret) {
    return process.env.NODE_ENV === 'development'
  }

  if (authHeader === `Bearer ${cronSecret}`) return true
  if (internalCron === cronSecret) return true

  return false
}
