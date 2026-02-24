'use client'

import { useEffect, useMemo, useState } from 'react'

type FreshnessLevel = 'good' | 'warn' | 'bad'

interface HealthSnapshot {
  status: 'OK' | 'DEGRADED' | 'DOWN'
  dataFreshness?: {
    scanAgeMin?: number | null
    stocksQuoteAgeMin?: number | null
  }
  sla?: {
    scanBreached?: boolean
    stocksQuoteBreached?: boolean
  }
  sloTrend1h?: {
    totalChecks1h: number
    breachCounts1h: {
      scan: number
      stocksQuote: number
    }
  }
}

export default function SystemFreshnessBadge({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<HealthSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/system/health', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) {
          setHealth({
            status: data.status,
            dataFreshness: {
              scanAgeMin: data?.dataFreshness?.scanAgeMin ?? null,
              stocksQuoteAgeMin: data?.dataFreshness?.stocksQuoteAgeMin ?? null,
            },
            sla: {
              scanBreached: !!data?.sla?.scanBreached,
              stocksQuoteBreached: !!data?.sla?.stocksQuoteBreached,
            },
            sloTrend1h: {
              totalChecks1h: data?.sloTrend1h?.totalChecks1h ?? 0,
              breachCounts1h: {
                scan: data?.sloTrend1h?.breachCounts1h?.scan ?? 0,
                stocksQuote: data?.sloTrend1h?.breachCounts1h?.stocksQuote ?? 0,
              },
            },
          })
        }
      } catch {
        // non-blocking visual indicator
      }
    }

    load()
    const iv = setInterval(load, 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  const view = useMemo(() => {
    const scanAge = health?.dataFreshness?.scanAgeMin ?? null
    const quoteAge = health?.dataFreshness?.stocksQuoteAgeMin ?? null
    const level: FreshnessLevel = (
      health?.status === 'DOWN'
      || !!health?.sla?.scanBreached
      || !!health?.sla?.stocksQuoteBreached
    )
      ? 'bad'
      : (
        (scanAge !== null && scanAge > 60)
        || (quoteAge !== null && quoteAge > 10)
      )
        ? 'warn'
        : 'good'

    return {
      level,
      scanAge,
      quoteAge,
      checks1h: health?.sloTrend1h?.totalChecks1h ?? 0,
      scanBreach1h: health?.sloTrend1h?.breachCounts1h.scan ?? 0,
      quoteBreach1h: health?.sloTrend1h?.breachCounts1h.stocksQuote ?? 0,
    }
  }, [health])

  if (!health) return null

  const classes = view.level === 'bad'
    ? 'bg-red-500/12 text-red-300 border-red-500/30'
    : view.level === 'warn'
      ? 'bg-amber-500/12 text-amber-300 border-amber-500/30'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'

  const label = view.level === 'bad' ? 'FRESHNESS BAD' : view.level === 'warn' ? 'FRESHNESS WARN' : 'FRESHNESS OK'

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${classes}`}
      title={
        `Freshness Guardrail | ScanAge=${view.scanAge ?? 'n/a'}m | QuoteAge=${view.quoteAge ?? 'n/a'}m | `
        + `SLO1h scan=${view.scanBreach1h}, quote=${view.quoteBreach1h}, checks=${view.checks1h}`
      }
    >
      <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide">{label}</span>
      {!compact && (
        <span className="hidden xl:inline text-[10px] opacity-80">
          SLO1h {view.scanBreach1h}/{view.quoteBreach1h}
        </span>
      )}
    </div>
  )
}
