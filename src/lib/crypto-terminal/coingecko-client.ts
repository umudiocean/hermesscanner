// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — CoinGecko API Client
// Analyst Plan: REST + retry + circuit breaker + dedup + metrics
// Base: https://pro-api.coingecko.com/api/v3
// Auth: x-cg-pro-api-key header
// ═══════════════════════════════════════════════════════════════════

import logger, { classifyError } from '../logger'
import { providerMonitor } from '../monitor/provider-monitor'

const CG_BASE = 'https://pro-api.coingecko.com/api/v3'
const GT_BASE = 'https://pro-api.coingecko.com/api/v3' // GeckoTerminal via Pro (endpoints include /onchain prefix)

// ─── Configuration ──────────────────────────────────────────────────

interface CGClientConfig {
  timeoutMs: number
  maxRetries: number
  retryBaseMs: number
  circuitBreakerThreshold: number
  circuitBreakerCooldownMs: number
  rateDelayMs: number // Minimum delay between requests
}

const DEFAULT_CONFIG: CGClientConfig = {
  timeoutMs: 30_000,
  maxRetries: 3,
  retryBaseMs: 1_000,
  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 60_000,
  rateDelayMs: 100, // Analyst: 500 req/min = ~120ms, buffer
}

// ─── Metrics ────────────────────────────────────────────────────────

interface EndpointMetrics {
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
      calls: 0, errors: 0, totalDurationMs: 0, lastCall: 0,
      consecutiveFailures: 0, circuitOpen: false, circuitOpenUntil: 0,
    }
    metricsMap.set(endpoint, m)
  }
  return m
}

export function getCGMetricsSummary() {
  let totalCalls = 0, totalErrors = 0, totalDuration = 0
  const failedEndpoints: string[] = []
  for (const [ep, m] of metricsMap) {
    totalCalls += m.calls
    totalErrors += m.errors
    totalDuration += m.totalDurationMs
    if (m.circuitOpen || m.consecutiveFailures > 0) failedEndpoints.push(ep)
  }
  return {
    totalCalls, totalErrors,
    avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
    failedEndpoints,
  }
}

// ─── Rate Limiter (slot-reservation pattern) ────────────────────────
// Atomic slot reservation: each caller claims the next available slot
// BEFORE sleeping, so concurrent calls serialize correctly.
// (Same fix applied to download_crypto_5min_fast.py — lock-outside-sleep)

let nextSlotTime = 0

async function waitForRate(): Promise<void> {
  const now = Date.now()
  const target = Math.max(now, nextSlotTime + DEFAULT_CONFIG.rateDelayMs)
  nextSlotTime = target
  const sleepMs = target - now
  if (sleepMs > 0) {
    await new Promise(r => setTimeout(r, sleepMs))
  }
}

// ─── Request Dedup ──────────────────────────────────────────────────

const inflightRequests = new Map<string, Promise<unknown>>()

// ─── Circuit Breaker ────────────────────────────────────────────────

function isCircuitOpen(endpoint: string): boolean {
  const m = getMetrics(endpoint)
  if (!m.circuitOpen) return false
  if (Date.now() > m.circuitOpenUntil) {
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
  m.lastCall = Date.now()
  m.consecutiveFailures = 0
  m.circuitOpen = false
  // HERMES_FIX: PROVIDER_MONITOR_v1 — Record to Redis for health endpoint
  providerMonitor.recordSuccess('coingecko').catch(() => {})
}

function recordFailure(endpoint: string, durationMs: number, error: string, httpStatus = 0): void {
  const m = getMetrics(endpoint)
  m.calls++
  m.errors++
  m.totalDurationMs += durationMs
  m.lastCall = Date.now()
  m.lastError = error
  m.consecutiveFailures++
  if (m.consecutiveFailures >= DEFAULT_CONFIG.circuitBreakerThreshold) {
    m.circuitOpen = true
    m.circuitOpenUntil = Date.now() + DEFAULT_CONFIG.circuitBreakerCooldownMs
    logger.error(`CG circuit breaker OPEN for ${endpoint}`, {
      module: 'coingeckoClient', endpoint, consecutiveFailures: m.consecutiveFailures,
    })
  }
  // HERMES_FIX: PROVIDER_MONITOR_v1 — Record to Redis for health endpoint
  providerMonitor.recordError('coingecko', httpStatus).catch(() => {})
}

// ─── API Key ────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.COINGECKO_API_KEY
  if (!key) {
    console.error('[COINGECKO] CFG_MISSING_COINGECKO_KEY — env var not set')
    throw new Error('API configuration error')
  }
  return key
}

// ─── Core Fetch ─────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { headers, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Main Fetch Function ────────────────────────────────────────────

export interface CGFetchOptions {
  timeoutMs?: number
  maxRetries?: number
  skipDedup?: boolean
  base?: 'cg' | 'gt' // cg = CoinGecko, gt = GeckoTerminal
}

export async function cgApiFetch<T = unknown>(
  endpoint: string,
  params: Record<string, string> = {},
  options: CGFetchOptions = {},
): Promise<T> {
  const config = DEFAULT_CONFIG
  const timeoutMs = options.timeoutMs ?? config.timeoutMs
  const maxRetries = options.maxRetries ?? config.maxRetries
  const base = options.base === 'gt' ? GT_BASE : CG_BASE

  const url = new URL(`${base}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const urlString = url.toString()
  const dedupKey = `${endpoint}?${url.searchParams.toString()}`

  if (isCircuitOpen(endpoint)) {
    throw new Error(`Circuit breaker is OPEN for CG ${endpoint}`)
  }

  if (!options.skipDedup) {
    const inflight = inflightRequests.get(dedupKey)
    if (inflight) {
      logger.debug('CG request deduplicated', { module: 'coingeckoClient', endpoint })
      return inflight as Promise<T>
    }
  }

  const executeRequest = async (): Promise<T> => {
    let lastError: unknown

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await waitForRate()
      const start = Date.now()

      try {
        const res = await fetchWithTimeout(urlString, {
          'x-cg-pro-api-key': getApiKey(),
          'Accept': 'application/json',
        }, timeoutMs)
        const duration = Date.now() - start

        if (res.status === 429) {
          // Rate limited — wait and retry
          const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10) * 1000
          logger.warn(`CG rate limited, waiting ${retryAfter}ms`, { module: 'coingeckoClient', endpoint })
          await new Promise(r => setTimeout(r, retryAfter))
          recordFailure(endpoint, duration, '429 Rate Limited', 429)
          continue
        }

        if (!res.ok) {
          const statusText = `${res.status} ${res.statusText}`
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            recordFailure(endpoint, duration, statusText, res.status)
            throw new Error(`CG API error: ${statusText} for ${endpoint}`)
          }
          lastError = new Error(`CG API error: ${statusText} for ${endpoint}`)
          recordFailure(endpoint, duration, statusText, res.status)
          if (attempt < maxRetries - 1) {
            const delay = config.retryBaseMs * Math.pow(2, attempt)
            logger.warn(`CG retry ${attempt + 1}/${maxRetries} after ${delay}ms`, {
              module: 'coingeckoClient', endpoint, error: statusText,
            })
            await new Promise(r => setTimeout(r, delay))
            continue
          }
          throw lastError
        }

        recordSuccess(endpoint, duration)
        const data = await res.json()
        logger.debug('CG fetch success', { module: 'coingeckoClient', endpoint, duration })
        return data as T
      } catch (err) {
        const duration = Date.now() - start
        const classified = classifyError(err, endpoint)
        if (classified.severity === 'hard') {
          recordFailure(endpoint, duration, classified.message)
          throw err
        }
        lastError = err
        if (attempt < maxRetries - 1) {
          const delay = config.retryBaseMs * Math.pow(2, attempt)
          await new Promise(r => setTimeout(r, delay))
        } else {
          recordFailure(endpoint, duration, classified.message)
        }
      }
    }
    // HERMES_FIX: CG-ERR 2026-02-19 SEVERITY: HIGH — lastError could be undefined
    throw lastError ?? new Error(`CG API failed after ${maxRetries} retries: ${endpoint}`)
  }

  const promise = executeRequest().finally(() => {
    inflightRequests.delete(dedupKey)
  })

  if (!options.skipDedup) {
    inflightRequests.set(dedupKey, promise)
  }

  return promise
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS — CoinGecko Endpoints
// ═══════════════════════════════════════════════════════════════════

/** Top coins by market cap */
export async function fetchCoinsMarkets(
  page = 1,
  perPage = 250,
  sparkline = true,
  priceChangePercentage = '1h,24h,7d,14d,30d,200d,1y',
): Promise<unknown[]> {
  return cgApiFetch<unknown[]>('/coins/markets', {
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: String(perPage),
    page: String(page),
    sparkline: String(sparkline),
    price_change_percentage: priceChangePercentage,
    locale: 'en',
    precision: '8',
  })
}

/** Coin detail */
export async function fetchCoinDetail(id: string): Promise<unknown> {
  return cgApiFetch(`/coins/${id}`, {
    localization: 'false',
    tickers: 'true',
    market_data: 'true',
    community_data: 'true',
    developer_data: 'true',
    sparkline: 'true',
  })
}

/** Global market data */
export async function fetchGlobalData(): Promise<unknown> {
  return cgApiFetch('/global')
}

/** Global DeFi data */
export async function fetchGlobalDeFi(): Promise<unknown> {
  return cgApiFetch('/global/decentralized_finance_defi')
}

/** Trending */
export async function fetchTrending(): Promise<unknown> {
  return cgApiFetch('/search/trending')
}

/** Categories */
export async function fetchCategories(): Promise<unknown[]> {
  return cgApiFetch<unknown[]>('/coins/categories', {
    order: 'market_cap_desc',
  })
}

/** Exchanges */
export async function fetchExchanges(perPage = 100, page = 1): Promise<unknown[]> {
  return cgApiFetch<unknown[]>('/exchanges', {
    per_page: String(perPage),
    page: String(page),
  })
}

/** Exchange detail */
export async function fetchExchangeDetail(id: string): Promise<unknown> {
  return cgApiFetch(`/exchanges/${id}`)
}

/** Derivatives tickers */
export async function fetchDerivatives(): Promise<unknown[]> {
  return cgApiFetch<unknown[]>('/derivatives')
}

/** Derivative exchanges */
export async function fetchDerivativeExchanges(): Promise<unknown[]> {
  return cgApiFetch<unknown[]>('/derivatives/exchanges', {
    order: 'open_interest_btc_desc',
    per_page: '100',
  })
}

/** Public treasury */
export async function fetchPublicTreasury(coinId: 'bitcoin' | 'ethereum'): Promise<unknown> {
  return cgApiFetch(`/companies/public_treasury/${coinId}`)
}

/** OHLC data */
export async function fetchOHLC(id: string, days: string): Promise<unknown> {
  return cgApiFetch(`/coins/${id}/ohlc`, {
    vs_currency: 'usd',
    days,
  })
}

/** OHLC range (Analyst plan) */
export async function fetchOHLCRange(id: string, from: number, to: number): Promise<unknown> {
  return cgApiFetch(`/coins/${id}/ohlc/range`, {
    vs_currency: 'usd',
    from: String(from),
    to: String(to),
  })
}

/** Market chart */
export async function fetchMarketChart(id: string, days: string): Promise<unknown> {
  return cgApiFetch(`/coins/${id}/market_chart`, {
    vs_currency: 'usd',
    days,
    precision: '8',
  })
}

/** Newly listed coins */
export async function fetchNewlyListed(): Promise<unknown[]> {
  return cgApiFetch<unknown[]>('/coins/list/new')
}

/** Top gainers / losers (Analyst plan) */
export async function fetchTopGainersLosers(duration = '24h'): Promise<unknown> {
  return cgApiFetch('/coins/top_gainers_losers', {
    vs_currency: 'usd',
    duration,
  })
}

/** Coin history (specific date) */
export async function fetchCoinHistory(id: string, date: string): Promise<unknown> {
  return cgApiFetch(`/coins/${id}/history`, {
    date, // dd-mm-yyyy
    localization: 'false',
  })
}

/** API key usage info */
export async function fetchKeyInfo(): Promise<unknown> {
  return cgApiFetch('/key')
}

// ─── GeckoTerminal (On-Chain DEX) ──────────────────────────────────

/** Trending pools across all networks */
export async function fetchTrendingPools(): Promise<unknown> {
  return cgApiFetch('/onchain/networks/trending_pools', {}, { base: 'gt' })
}

/** Top pools for a specific network */
export async function fetchNetworkPools(network: string, page = 1): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/pools`, {
    page: String(page),
    sort: 'h24_volume_usd_liquidity_desc',
  }, { base: 'gt' })
}

/** Trending pools for a specific network */
export async function fetchNetworkTrendingPools(network: string): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/trending_pools`, {}, { base: 'gt' })
}

/** Search pools */
export async function fetchSearchPools(query: string): Promise<unknown> {
  return cgApiFetch('/onchain/search/pools', { query }, { base: 'gt' })
}

/** Search coins, categories, exchanges, NFTs */
export async function fetchSearch(query: string): Promise<unknown> {
  return cgApiFetch('/search', { query })
}

/** Coins list (id, symbol, name, platforms) — includes contract addresses for search */
export async function fetchCoinsList(): Promise<{ id: string; symbol: string; name: string; platforms?: Record<string, string> }[]> {
  return cgApiFetch('/coins/list', { include_platform: 'true' }) as Promise<{ id: string; symbol: string; name: string; platforms?: Record<string, string> }[]>
}

/** Token info on a network */
export async function fetchTokenInfo(network: string, address: string): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/tokens/${address}`, {}, { base: 'gt' })
}

/** Token pools on a network */
export async function fetchTokenPools(network: string, address: string): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/tokens/${address}/pools`, {
    sort: 'h24_volume_usd_liquidity_desc',
  }, { base: 'gt' })
}

// ─── On-Chain Analyst Endpoints (K2: Real On-Chain Score) ───────────

/** Top holders for a token on a network (Analyst plan) */
export async function fetchTopHolders(network: string, address: string): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/tokens/${address}/top_holders`, {}, { base: 'gt' })
}

/** Top traders for a token on a network (Analyst plan) */
export async function fetchTopTraders(network: string, address: string, duration = '24h'): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/tokens/${address}/top_traders`, {
    duration,
  }, { base: 'gt' })
}

/** Holders chart for a token (Analyst plan) */
export async function fetchHoldersChart(network: string, address: string, duration = '30d'): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/tokens/${address}/holders_chart`, {
    duration,
  }, { base: 'gt' })
}

/** Recent trades for a token pool (Analyst plan) */
export async function fetchPoolTrades(network: string, poolAddress: string): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/pools/${poolAddress}/trades`, {}, { base: 'gt' })
}

/** Pool OHLCV data (Analyst plan) */
export async function fetchPoolOHLCV(network: string, poolAddress: string, timeframe = 'day', aggregate = '1'): Promise<unknown> {
  return cgApiFetch(`/onchain/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}`, {
    aggregate,
    limit: '100',
  }, { base: 'gt' })
}

/** Megafilter — advanced DEX pool filtering (Analyst plan) */
export async function fetchMegafilter(params: Record<string, string> = {}): Promise<unknown> {
  return cgApiFetch('/onchain/pools/megafilter', {
    page: '1',
    duration: '24h',
    sort: 'h24_volume_usd_desc',
    ...params,
  }, { base: 'gt' })
}

/** New pools across all networks */
export async function fetchNewPools(): Promise<unknown> {
  return cgApiFetch('/onchain/networks/new_pools', {}, { base: 'gt' })
}

/** Global market cap chart (Analyst plan) */
export async function fetchGlobalMarketCapChart(days: string): Promise<unknown> {
  return cgApiFetch('/global/market_cap_chart', {
    days,
    vs_currency: 'usd',
  })
}

/** Coin tickers (all exchanges where a coin trades) */
export async function fetchCoinTickers(id: string, page = 1): Promise<unknown> {
  return cgApiFetch(`/coins/${id}/tickers`, {
    include_exchange_logo: 'true',
    page: String(page),
    order: 'volume_desc',
    depth: 'true',
  })
}

/** Market chart with custom range (Analyst plan) */
export async function fetchMarketChartRange(id: string, from: number, to: number): Promise<unknown> {
  return cgApiFetch(`/coins/${id}/market_chart/range`, {
    vs_currency: 'usd',
    from: String(from),
    to: String(to),
    precision: '8',
  })
}

export default cgApiFetch
