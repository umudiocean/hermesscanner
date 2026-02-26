// HERMES_FIX: CRON_HEALTH_v1 — Periodic health verification cron
// Schedule: every 10 min (Vercel cron)
// Purpose: Verify system health, log SLA breaches, record run

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/monitor/cron-auth'
import { sentinelLog } from '@/lib/logger/sentinel-log'
import { getRedis } from '@/lib/cache/redis-client'
import { providerMonitor } from '@/lib/monitor/provider-monitor'

export const maxDuration = 30

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
}

function shouldSelfHeal(health: {
  status?: string
  sla?: Record<string, boolean>
}): boolean {
  if (health.status === 'DOWN') return true
  const sla = health.sla || {}
  return Boolean(sla.scanBreached || sla.stocksQuoteBreached)
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runAt = new Date().toISOString()

  try {
    const appUrl = getAppUrl()

    const healthRes = await fetch(`${appUrl}/api/system/health`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!healthRes.ok) {
      throw new Error(`Health endpoint returned ${healthRes.status}`)
    }

    const health = await healthRes.json()
    await providerMonitor.recordWatchdogRun(health.status)
    if (health?.sla) {
      await providerMonitor.recordSlaSnapshot(health.sla)
    }

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

    let selfHealTriggered = false
    let selfHealSuccess = false

    if (shouldSelfHeal(health)) {
      selfHealTriggered = true
      sentinelLog.warn('CRON_SELF_HEAL_TRIGGERED', {
        status: health.status,
        sla: health.sla,
      })
      try {
        const refreshRes = await fetch(`${appUrl}/api/cron/refresh/stocks?force=1`, {
          headers: {
            'x-vercel-cron': '1',
            'authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
          },
          signal: AbortSignal.timeout(20000),
        })
        selfHealSuccess = refreshRes.ok
        await providerMonitor.recordWatchdogSelfHeal(selfHealSuccess)
        if (selfHealSuccess) {
          sentinelLog.info('CRON_SELF_HEAL_OK', {})
        } else {
          sentinelLog.error('CRON_SELF_HEAL_FAILED', { reason: `refresh_status_${refreshRes.status}` })
        }
      } catch {
        selfHealSuccess = false
        await providerMonitor.recordWatchdogSelfHeal(false)
        sentinelLog.error('CRON_SELF_HEAL_FAILED', { reason: 'refresh_exception' })
      }
    }

    return NextResponse.json({
      ran: true,
      at: runAt,
      systemStatus: health.status,
      selfHealTriggered,
      selfHealSuccess,
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
