// HERMES_FIX: SENTINEL_LOGGER_v1 — Structured observability for sentinel events
// Purpose: Machine-parseable JSON logging for cron, health, SLA, guard events
// Security: Strips secrets via regex filter. No API keys in output.

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export type EventType =
  | 'CRON_HEALTH_CHECK'
  | 'CRON_HEALTH_CHECK_FAILED'
  | 'CRON_CRYPTO_REFRESH_OK'
  | 'CRON_CRYPTO_REFRESH_FAILED'
  | 'CRON_CRYPTO_BUDGET_EXCEEDED'
  | 'CRON_STOCKS_REFRESH_OK'
  | 'CRON_STOCKS_REFRESH_FAILED'
  | 'SYSTEM_DEGRADED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_SUCCESS'
  | 'DATA_STALE'
  | 'SLA_BREACH'
  | 'SQUEEZE_BLOCKED'
  | 'RATE_LIMIT_HIT'
  | 'REGRESSION_FAILURE'
  | 'CACHE_READ'
  | 'CACHE_WRITE'

interface SentinelLogEntry {
  level: LogLevel
  event: EventType
  timestamp: string
  env: string
  data: Record<string, unknown>
}

const SECRET_PATTERNS = /key|secret|token|password|auth|CG-|bearer|apikey/i

function stripSecrets(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => !SECRET_PATTERNS.test(k))
  )
}

function log(level: LogLevel, event: EventType, data: Record<string, unknown>) {
  const safe = stripSecrets(data)

  const entry: SentinelLogEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'unknown',
    data: safe,
  }

  const output = JSON.stringify(entry)

  if (level === 'ERROR') console.error(output)
  else if (level === 'WARN') console.warn(output)
  else console.log(output)
}

export const sentinelLog = {
  debug: (event: EventType, data: Record<string, unknown> = {}) => log('DEBUG', event, data),
  info: (event: EventType, data: Record<string, unknown> = {}) => log('INFO', event, data),
  warn: (event: EventType, data: Record<string, unknown> = {}) => log('WARN', event, data),
  error: (event: EventType, data: Record<string, unknown> = {}) => log('ERROR', event, data),
}
