'use client'

import { useEffect, useMemo, useState } from 'react'
import { SIGNAL_GUARDRAIL } from '@/lib/config/constants'

interface HealthSnapshot {
  status?: 'OK' | 'DEGRADED' | 'DOWN'
  sla?: {
    scanBreached?: boolean
    stocksQuoteBreached?: boolean
  }
  dataFreshness?: {
    scanAgeMin?: number | null
    stocksQuoteAgeMin?: number | null
  }
}

export function useSignalRenderGuard() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadHealth() {
      try {
        const res = await fetch('/api/system/health', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setHealth(data)
      } catch {
        // keep last state
      }
    }

    loadHealth()
    const iv = setInterval(loadHealth, SIGNAL_GUARDRAIL.HEALTH_POLL_MS)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  const state = useMemo(() => {
    const scanBreached = !!health?.sla?.scanBreached
    const quoteBreached = !!health?.sla?.stocksQuoteBreached
    const hardDown = health?.status === 'DOWN'

    const blocked = SIGNAL_GUARDRAIL.FAIL_CLOSED && (hardDown || scanBreached || quoteBreached)
    const reason = hardDown
      ? 'SYSTEM_DOWN'
      : scanBreached
        ? 'SCAN_STALE'
        : quoteBreached
          ? 'QUOTE_STALE'
          : null

    return {
      blocked,
      reason,
      scanAgeMin: health?.dataFreshness?.scanAgeMin ?? null,
      quoteAgeMin: health?.dataFreshness?.stocksQuoteAgeMin ?? null,
      failClosed: SIGNAL_GUARDRAIL.FAIL_CLOSED,
    }
  }, [health])

  return state
}
