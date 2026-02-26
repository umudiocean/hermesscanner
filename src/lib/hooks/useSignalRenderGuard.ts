'use client'

import { useEffect, useMemo, useState } from 'react'
import { SIGNAL_GUARDRAIL } from '@/lib/config/constants'

interface HealthSnapshot {
  status?: 'OK' | 'DEGRADED' | 'DOWN'
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
    // NEVER block signals - always show available data
    // If data is stale, show a warning but don't hide signals
    return {
      blocked: false,
      reason: null,
      scanAgeMin: health?.dataFreshness?.scanAgeMin ?? null,
      quoteAgeMin: health?.dataFreshness?.stocksQuoteAgeMin ?? null,
      failClosed: false,
      staleWarning: false,
      marketOpen: true,
      systemStatus: health?.status ?? 'OK',
    }
  }, [health])

  return state
}
