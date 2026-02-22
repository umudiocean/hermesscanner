// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Centralized FMP API Client
// Single entry point for ALL FMP API calls
// Features: timeout, retry, dedup, circuit breaker, metrics
// ═══════════════════════════════════════════════════════════════════

import logger, { classifyError } from '../logger'
import { providerMonitor } from '../monitor/provider-monitor'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

// ─── Configuration ──────────────────────────────────────────────────

export interface FMPClientConfig {
  timeoutMs: number
  maxRetries: number
  retryBaseMs: number
  circuitBreakerThreshold: number
  circuitBreakerCooldownMs: number
}

const DEFAULT_CONFIG: FMPClientConfig = {
  timeoutMs: 30_000,             // 30s timeout
  maxRetries: 3,                 // 3 attempts
  retryBaseMs: 1_000,            // 1s, 2s, 4s backoff
  circuitBreakerThreshold: 5,    // 5 consecutive failures
  circuitBreakerCooldownMs: 60_000, // 60s cooldown
}

// ─── Metrics Tracking ───────────────────────────────────────────────

export interface EndpointMetrics {
  calls: number
  errors: number
  totalDurationMs: number
  lastCall: number
  lastError?: string
  consecutiveFailures: number
  circuitOpen: boolean
  circuitOpenUntil: number
}

const metricsMap = new Map<string, EndpointMetrics>()

function getMetrics(endpoint: string): EndpointMetrics {
  let m = metricsMap.get(endpoint)
  if (!m) {
    m = {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      lastCall: 0,
      consecutiveFailures: 0,
      circuitOpen: false,
      circuitOpenUntil: 0,
    }
    metricsMap.set(endpoint, m)
  }
  return m
}

export function getAllMetrics(): Map<string, EndpointMetrics> {
  return new Map(metricsMap)
}

export function getMetricsSummary(): {
  totalCalls: number
  totalErrors: number
  avgDuration: number
  failedEndpoints: string[]
} {
  let totalCalls = 0
  let totalErrors = 0
  let totalDuration = 0
  const failedEndpoints: string[] = []

  for (const [ep, m] of metricsMap) {
    totalCalls += m.calls
    totalErrors += m.errors
    totalDuration += m.totalDurationMs
    if (m.circuitOpen || m.consecutiveFailures > 0) {
      failedEndpoints.push(ep)
    }
  }

  return {
    totalCalls,
    totalErrors,
    avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
    failedEndpoints,
  }
}

// ─── Request Deduplication ──────────────────────────────────────────

const inflightRequests = new Map<string, Promise<unknown>>()

// ─── Circuit Breaker ────────────────────────────────────────────────

function isCircuitOpen(endpoint: string, config: FMPClientConfig): boolean {
  const m = getMetrics(endpoint)
  if (!m.circuitOpen) return false
  if (Date.now() > m.circuitOpenUntil) {
    // Half-open: allow one request through
    m.circuitOpen = false
    m.consecutiveFailures = 0
    return false
  }
  return true
}

function recordSuccess(endpoint: string, durationMs: number): void {
  const m = getMetrics(endpoint)
  m.calls++
  m.totalDurationMs += durationMs
  providerMonitor.recordSuccess('fmp').catch(() => {})
  m.lastCall = Date.now()
  m.consecutiveFailures = 0
  m.circuitOpen = false
}

function recordFailure(endpoint: string, durationMs: number, error: string, config: FMPClientConfig): void {
  const m = getMetrics(endpoint)
  m.calls++
  m.errors++
  providerMonitor.recordError('fmp', 0).catch(() => {})
  m.totalDurationMs += durationMs
  m.lastCall = Date.now()
  m.lastError = error
  m.consecutiveFailures++

  if (m.consecutiveFailures >= config.circuitBreakerThreshold) {
    m.circuitOpen = true
    m.circuitOpenUntil = Date.now() + config.circuitBreakerCooldownMs
    logger.error(`Circuit breaker OPEN for ${endpoint}`, {
      module: 'fmpClient',
      endpoint,
      duration: durationMs,
      consecutiveFailures: m.consecutiveFailures,
    })
  }
}

// ─── Core Fetch with Timeout ────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── API Key ────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.FMP_API_KEY
  if (!key) {
    console.error('[FMP-CLIENT] CFG_MISSING_FMP_KEY — env var not set')
    throw new Error('API configuration error')
  }
  return key
}

// ─── Main Fetch Function ────────────────────────────────────────────

export interface FMPFetchOptions {
  /** Override default timeout (ms) */
  timeoutMs?: number
  /** Override default retry count */
  maxRetries?: number
  /** Skip deduplication for this request */
  skipDedup?: boolean
  /** Return raw Response instead of parsed JSON */
  rawResponse?: boolean
}

/**
 * Centralized FMP API fetch with timeout, retry, dedup, circuit breaker.
 * All FMP API calls should go through this function.
 */
export async function fmpApiFetch<T = unknown>(
  endpoint: string,
  params: Record<string, string> = {},
  options: FMPFetchOptions = {},
): Promise<T> {
  const config = DEFAULT_CONFIG
  const timeoutMs = options.timeoutMs ?? config.timeoutMs
  const maxRetries = options.maxRetries ?? config.maxRetries

  // Build URL
  const url = new URL(`${FMP_BASE}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const urlString = url.toString()

  // Dedup key (endpoint + sorted params)
  const dedupKey = `${endpoint}?${url.searchParams.toString()}`

  // Circuit breaker check
  if (isCircuitOpen(endpoint, config)) {
    const err = new Error(`Circuit breaker is OPEN for ${endpoint}`)
    logger.warn('Circuit breaker blocked request', { module: 'fmpClient', endpoint })
    throw err
  }

  // Deduplication: if identical request is in-flight, return same promise
  if (!options.skipDedup) {
    const inflight = inflightRequests.get(dedupKey)
    if (inflight) {
      logger.debug('Request deduplicated', { module: 'fmpClient', endpoint })
      return inflight as Promise<T>
    }
  }

  const executeRequest = async (): Promise<T> => {
    let lastError: unknown

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const start = Date.now()

      try {
        const res = await fetchWithTimeout(urlString, { apikey: getApiKey() }, timeoutMs)
        const duration = Date.now() - start

        if (!res.ok) {
          const statusText = `${res.status} ${res.statusText}`

          // Don't retry 4xx client errors (except 429 rate limit)
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            recordFailure(endpoint, duration, statusText, config)
            throw new Error(`FMP API error: ${statusText} for ${endpoint}`)
          }

          // Retry on 429 or 5xx
          lastError = new Error(`FMP API error: ${statusText} for ${endpoint}`)
          recordFailure(endpoint, duration, statusText, config)

          if (attempt < maxRetries - 1) {
            const delay = config.retryBaseMs * Math.pow(2, attempt)
            logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`, {
              module: 'fmpClient',
              endpoint,
              duration,
              error: statusText,
            })
            await new Promise(r => setTimeout(r, delay))
            continue
          }

          throw lastError
        }

        // Success
        recordSuccess(endpoint, duration)

        if (options.rawResponse) {
          return res as unknown as T
        }

        const data = await res.json()

        logger.debug('FMP fetch success', {
          module: 'fmpClient',
          endpoint,
          duration,
          size: JSON.stringify(data).length,
        })

        return data as T
      } catch (err) {
        const duration = Date.now() - start
        const classified = classifyError(err, endpoint)

        // Don't retry hard failures
        if (classified.severity === 'hard') {
          recordFailure(endpoint, duration, classified.message, config)
          throw err
        }

        lastError = err

        if (attempt < maxRetries - 1) {
          const delay = config.retryBaseMs * Math.pow(2, attempt)
          logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`, {
            module: 'fmpClient',
            endpoint,
            duration,
            error: classified.message,
          })
          await new Promise(r => setTimeout(r, delay))
        } else {
          recordFailure(endpoint, duration, classified.message, config)
        }
      }
    }

    throw lastError
  }

  // Register in-flight and execute
  const promise = executeRequest().finally(() => {
    inflightRequests.delete(dedupKey)
  })

  if (!options.skipDedup) {
    inflightRequests.set(dedupKey, promise)
  }

  return promise
}

/**
 * Convenience: fetch and return raw Response (for CSV/text endpoints)
 */
export async function fmpApiFetchRaw(
  endpoint: string,
  params: Record<string, string> = {},
  options: Omit<FMPFetchOptions, 'rawResponse'> = {},
): Promise<Response> {
  return fmpApiFetch<Response>(endpoint, params, { ...options, rawResponse: true })
}

export default fmpApiFetch
