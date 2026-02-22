// HERMES_FIX: CRON_HEALTH_v1 — Periodic health verification cron
// Schedule: every 10 min (Vercel cron)
// Purpose: Verify system health, log SLA breaches, record run

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/monitor/cron-auth'
import { sentinelLog } from '@/lib/logger/sentinel-log'
import { getRedis } from '@/lib/cache/redis-client'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runAt = new Date().toISOString()

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const healthRes = await fetch(`${appUrl}/api/system/health`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!healthRes.ok) {
      throw new Error(`Health endpoint returned ${healthRes.status}`)
    }

    const health = await healthRes.json()

    const redis = getRedis()
    if (redis) {
      await redis.set('cron:health-check:lastRunAt', runAt, { ex: 1800 })
    }

    sentinelLog.info('CRON_HEALTH_CHECK', {
      status: health.status,
      slaBreaches: Object.entries(health.sla || {})
        .filter(([, breached]) => breached)
        .map(([key]) => key),
      providerErrors: Object.entries(health.providers || {})
        .filter(([, p]) => !(p as { ok: boolean }).ok)
        .map(([name]) => name),
    })

    if (health.status !== 'OK') {
      sentinelLog.warn('SYSTEM_DEGRADED', {
        status: health.status,
        sla: health.sla,
        freshness: health.dataFreshness,
      })
    }

    return NextResponse.json({
      ran: true,
      at: runAt,
      systemStatus: health.status,
    })
  } catch (err) {
    sentinelLog.error('CRON_HEALTH_CHECK_FAILED', {
      error: err instanceof Error ? err.message : String(err),
      at: runAt,
    })
    return NextResponse.json(
      { ran: false, error: 'Health check failed' },
      { status: 500 },
    )
  }
}
