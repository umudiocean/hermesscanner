'use client'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// StatusPills — small reusable header pills for market state
// ═══════════════════════════════════════════════════════════════════

export function MarketPill({
  open,
  label,
  nextEvent,
}: {
  open: boolean
  label: string
  nextEvent?: string
}) {
  return (
    <Badge
      tone={open ? 'success' : 'neutral'}
      size="sm"
      dot
      pulse={open}
      className="font-mono"
      title={nextEvent ? `Next: ${nextEvent}` : undefined}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{open ? 'OPEN' : 'CLOSED'}</span>
    </Badge>
  )
}

export function FreshnessPill({
  level,
  scanAgeMin,
  quoteAgeMin,
}: {
  level: 'good' | 'warn' | 'bad'
  scanAgeMin: number | null
  quoteAgeMin: number | null
}) {
  const tone = level === 'bad' ? 'danger' : level === 'warn' ? 'warning' : 'success'
  const text = level === 'bad' ? 'FRESHNESS BAD' : level === 'warn' ? 'FRESHNESS WARN' : 'FRESHNESS OK'
  return (
    <Badge
      tone={tone}
      size="sm"
      title={`Scan age: ${scanAgeMin ?? 'n/a'}m | Quote age: ${quoteAgeMin ?? 'n/a'}m`}
    >
      <span className="hidden md:inline">{text}</span>
      <span className="md:hidden">{level.toUpperCase()}</span>
    </Badge>
  )
}

export function RegimePill({
  regime,
  vix,
}: {
  regime: 'RISK_ON' | 'CAUTION' | 'RISK_OFF' | 'CRISIS'
  vix: number | null
}) {
  if (regime === 'RISK_ON') return null
  const tone = regime === 'CRISIS' ? 'danger' : regime === 'RISK_OFF' ? 'warning' : 'warning'
  return (
    <Badge tone={tone} size="sm" pulse={regime === 'CRISIS'} dot>
      <span className="hidden sm:inline">{regime.replace('_', ' ')}</span>
      {vix !== null && (
        <span className="font-mono opacity-70 ml-1">VIX {vix.toFixed(0)}</span>
      )}
    </Badge>
  )
}

export function LastRefreshIndicator({
  lastRefresh,
  lastPriceRefresh,
  isRefreshing,
  marketOpen,
  autoEnabled,
  countdown,
}: {
  lastRefresh: Date | null
  lastPriceRefresh: Date | null
  isRefreshing: boolean
  marketOpen: boolean
  autoEnabled: boolean
  countdown: string
}) {
  return (
    <div className="hidden lg:flex flex-col items-end gap-0.5 leading-none">
      {lastRefresh && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-50 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-400" />
          </span>
          <span className="text-2xs text-text-tertiary font-mono">
            {lastRefresh.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      )}
      {lastPriceRefresh && (
        <span className="text-2xs text-text-quaternary font-mono">
          PX {lastPriceRefresh.toLocaleTimeString('en-US', { hour12: false })}
        </span>
      )}
      {isRefreshing && (
        <span className="text-2xs text-gold-400 animate-pulse">syncing…</span>
      )}
      {!isRefreshing && marketOpen && autoEnabled && countdown && (
        <span className={cn('text-2xs text-text-quaternary font-mono')}>next {countdown}</span>
      )}
    </div>
  )
}
