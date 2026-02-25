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
    
    // ✅ Market kapalıyken ASLA blokla (eski veri ile çalış)
    if (!marketOpen) {
      return {
        blocked: false,
        reason: null,
        scanAgeMin: health?.dataFreshness?.scanAgeMin ?? null,
        quoteAgeMin: health?.dataFreshness?.stocksQuoteAgeMin ?? null,
        failClosed: SIGNAL_GUARDRAIL.FAIL_CLOSED,
        staleWarning: false,
        marketOpen: false,
      }
    }

    // ✅ Market açıkken sadece HARD DOWN durumunda blokla
    const hardDown = health?.status === 'DOWN'
    
    if (SIGNAL_GUARDRAIL.FAIL_CLOSED && hardDown) {
      return {
        blocked: true,
        reason: 'SYSTEM_DOWN',
        scanAgeMin: health?.dataFreshness?.scanAgeMin ?? null,
        quoteAgeMin: health?.dataFreshness?.stocksQuoteAgeMin ?? null,
        failClosed: true,
        staleWarning: true,
        marketOpen: true,
      }
    }

    // ✅ Her şey OK veya DEGRADED (sinyalleri göster)
    return {
      blocked: false,
      reason: null,
      scanAgeMin: health?.dataFreshness?.scanAgeMin ?? null,
      quoteAgeMin: health?.dataFreshness?.stocksQuoteAgeMin ?? null,
      failClosed: SIGNAL_GUARDRAIL.FAIL_CLOSED,
      staleWarning: false,
      marketOpen: true,
    }
  }, [health])

  return state
}
