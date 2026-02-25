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

function isUsMarketOpen(): boolean {
  const now = new Date()
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const et = new Date(etStr)
  const day = et.getDay()
  if (day === 0 || day === 6) return false // Weekend
  const mins = et.getHours() * 60 + et.getMinutes()
  return mins >= 570 && mins <= 960 // 09:30 - 16:00 ET
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
    const marketOpen = isUsMarketOpen()
    
    // Only check SLA breaches if market is OPEN
    // During market hours, stale data is critical
    // Outside market hours, stale data is expected
    const scanBreached = marketOpen && !!health?.sla?.scanBreached
    const quoteBreached = marketOpen && !!health?.sla?.stocksQuoteBreached
    
    const hardDown = health?.status === 'DOWN'

    // Only block signals on hard system DOWN during market hours
    // Outside market hours, use last available data
    const blocked = SIGNAL_GUARDRAIL.FAIL_CLOSED && hardDown && marketOpen
    
    const reason = hardDown && marketOpen
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
      staleWarning: scanBreached || quoteBreached,
      marketOpen,
    }
  }, [health])

  return state
}
