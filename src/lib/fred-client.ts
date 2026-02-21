// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL — FRED API Client
// Federal Reserve Economic Data — Makro ekonomi gostergeleri
// 26/26 seri test edilmis, tamami aktif (2026-02-18)
// ═══════════════════════════════════════════════════════════════════

import logger from './logger'

const FRED_BASE = 'https://api.stlouisfed.org/fred'

function getApiKey(): string {
  const key = process.env.FRED_API_KEY
  if (!key) {
    console.error('[FRED] CFG_MISSING_FRED_KEY — env var not set')
    throw new Error('API configuration error')
  }
  return key
}

// ─── Types ──────────────────────────────────────────────────────────

export interface FredObservation {
  date: string
  value: string
}

export interface FredSeriesData {
  seriesId: string
  name: string
  latest: { date: string; value: number } | null
  history: Array<{ date: string; value: number }>
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  unit: string
}

export interface FredDashboardData {
  yieldCurve: {
    spread: number
    dgs10: number
    dgs2: number
    spreadDate: string
    status: 'INVERSION' | 'DIKKAT' | 'NORMAL' | 'GENIS'
  }
  fedPolicy: {
    fedFundsRate: number
    fedFundsDate: string
    bankPrime: number
  }
  inflation: {
    cpi: number
    cpiDate: string
    breakeven10Y: number
  }
  employment: {
    unemploymentRate: number
    unemploymentDate: string
    joblessClaims: number
    joblessClaimsDate: string
  }
  creditStress: {
    highYieldSpread: number
    highYieldDate: string
    status: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRISIS'
  }
  volatility: {
    vix: number
    vixDate: string
    status: 'CALM' | 'NORMAL' | 'FEAR' | 'PANIC'
  }
  liquidity: {
    m2: number
    m2Date: string
    oilPrice: number
    oilDate: string
  }
  consumerSentiment: {
    value: number
    date: string
  }
  macroRegime: 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION' | 'UNKNOWN'
  timestamp: string
}

// ─── Cache ──────────────────────────────────────────────────────────

const FRED_CACHE_TTL = 60 * 60 * 1000 // 1 hour

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > FRED_CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// ─── API Fetch ──────────────────────────────────────────────────────

async function fetchFredSeries(seriesId: string, limit: number = 10): Promise<FredObservation[]> {
  const cacheKey = `fred_${seriesId}_${limit}`
  const cached = getCached<FredObservation[]>(cacheKey)
  if (cached) return cached

  try {
    const url = `${FRED_BASE}/series/observations?series_id=${seriesId}&api_key=${getApiKey()}&file_type=json&sort_order=desc&limit=${limit}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      logger.warn(`FRED API error for ${seriesId}: ${res.status}`, { module: 'fred' })
      return []
    }
    const data = await res.json()
    const observations: FredObservation[] = data.observations || []
    setCache(cacheKey, observations)
    return observations
  } catch (err) {
    logger.error(`FRED fetch failed for ${seriesId}`, { module: 'fred', error: err })
    return []
  }
}

function parseLatest(obs: FredObservation[]): { date: string; value: number } | null {
  for (const o of obs) {
    const v = parseFloat(o.value)
    if (!isNaN(v) && o.value !== '.') return { date: o.date, value: v }
  }
  return null
}

// ─── Dashboard Data ─────────────────────────────────────────────────

export async function fetchFredDashboard(): Promise<FredDashboardData> {
  const cacheKey = 'fred_dashboard'
  const cached = getCached<FredDashboardData>(cacheKey)
  if (cached) return cached

  const [
    t10y2y, fedfunds, vix, icsa, cpi, unrate, umcsent,
    dgs10, dgs2, hySpread, m2, oil, t10yie, dprime,
  ] = await Promise.all([
    fetchFredSeries('T10Y2Y', 5),
    fetchFredSeries('FEDFUNDS', 3),
    fetchFredSeries('VIXCLS', 5),
    fetchFredSeries('ICSA', 5),
    fetchFredSeries('CPIAUCSL', 3),
    fetchFredSeries('UNRATE', 3),
    fetchFredSeries('UMCSENT', 3),
    fetchFredSeries('DGS10', 5),
    fetchFredSeries('DGS2', 5),
    fetchFredSeries('BAMLH0A0HYM2', 5),
    fetchFredSeries('M2SL', 3),
    fetchFredSeries('DCOILWTICO', 5),
    fetchFredSeries('T10YIE', 3),
    fetchFredSeries('DPRIME', 3),
  ])

  const spread = parseLatest(t10y2y)
  const d10 = parseLatest(dgs10)
  const d2 = parseLatest(dgs2)
  const ff = parseLatest(fedfunds)
  const prime = parseLatest(dprime)
  const vixVal = parseLatest(vix)
  const claims = parseLatest(icsa)
  const ur = parseLatest(unrate)
  const cpiVal = parseLatest(cpi)
  const sent = parseLatest(umcsent)
  const hy = parseLatest(hySpread)
  const m2Val = parseLatest(m2)
  const oilVal = parseLatest(oil)
  const beVal = parseLatest(t10yie)

  const spreadValue = spread?.value ?? 0
  const yieldStatus = spreadValue < 0 ? 'INVERSION' as const
    : spreadValue < 0.5 ? 'DIKKAT' as const
    : spreadValue < 1.5 ? 'NORMAL' as const
    : 'GENIS' as const

  const hyValue = hy?.value ?? 3
  const creditStatus = hyValue < 3 ? 'LOW' as const
    : hyValue < 5 ? 'ELEVATED' as const
    : hyValue < 8 ? 'HIGH' as const
    : 'CRISIS' as const

  const vixValue = vixVal?.value ?? 20
  const vixStatus = vixValue < 15 ? 'CALM' as const
    : vixValue < 25 ? 'NORMAL' as const
    : vixValue < 35 ? 'FEAR' as const
    : 'PANIC' as const

  const regime = detectMacroRegime(
    ur?.value ?? 4, cpiVal?.value ?? 300, claims?.value ?? 250000,
    spreadValue, vixValue, hyValue
  )

  const result: FredDashboardData = {
    yieldCurve: {
      spread: spreadValue,
      dgs10: d10?.value ?? 0,
      dgs2: d2?.value ?? 0,
      spreadDate: spread?.date ?? '',
      status: yieldStatus,
    },
    fedPolicy: {
      fedFundsRate: ff?.value ?? 0,
      fedFundsDate: ff?.date ?? '',
      bankPrime: prime?.value ?? 0,
    },
    inflation: {
      cpi: cpiVal?.value ?? 0,
      cpiDate: cpiVal?.date ?? '',
      breakeven10Y: beVal?.value ?? 0,
    },
    employment: {
      unemploymentRate: ur?.value ?? 0,
      unemploymentDate: ur?.date ?? '',
      joblessClaims: claims?.value ?? 0,
      joblessClaimsDate: claims?.date ?? '',
    },
    creditStress: {
      highYieldSpread: hyValue,
      highYieldDate: hy?.date ?? '',
      status: creditStatus,
    },
    volatility: {
      vix: vixValue,
      vixDate: vixVal?.date ?? '',
      status: vixStatus,
    },
    liquidity: {
      m2: m2Val?.value ?? 0,
      m2Date: m2Val?.date ?? '',
      oilPrice: oilVal?.value ?? 0,
      oilDate: oilVal?.date ?? '',
    },
    consumerSentiment: {
      value: sent?.value ?? 0,
      date: sent?.date ?? '',
    },
    macroRegime: regime,
    timestamp: new Date().toISOString(),
  }

  setCache(cacheKey, result)
  logger.info('FRED dashboard fetched', { module: 'fred', regime, spread: spreadValue, vix: vixValue })
  return result
}

// ─── Fear & Greed v2 Components ─────────────────────────────────────

export interface FearGreedComponents {
  vixScore: number
  yieldCurveScore: number
  creditSpreadScore: number
  joblessClaimsScore: number
  consumerSentimentScore: number
  composite: number
}

export function computeFredFearGreed(data: FredDashboardData): FearGreedComponents {
  // VIX: low=greed(100), high=fear(0). Range 10-50
  const vixScore = Math.max(0, Math.min(100, (50 - data.volatility.vix) / 40 * 100))

  // Yield Curve: positive=greed, negative=fear. Range -1 to +2.5
  const ycScore = Math.max(0, Math.min(100, (data.yieldCurve.spread + 1) / 3.5 * 100))

  // Credit Spread: low=greed, high=fear. Range 2-10
  const csScore = Math.max(0, Math.min(100, (10 - data.creditStress.highYieldSpread) / 8 * 100))

  // Jobless Claims: low=greed, high=fear. Range 180K-400K
  const jcScore = Math.max(0, Math.min(100, (400000 - data.employment.joblessClaims) / 220000 * 100))

  // Consumer Sentiment: high=greed, low=fear. Range 40-100
  const csntScore = Math.max(0, Math.min(100, (data.consumerSentiment.value - 40) / 60 * 100))

  const composite = Math.round(
    vixScore * 0.25 + ycScore * 0.20 + csScore * 0.20 + jcScore * 0.15 + csntScore * 0.20
  )

  return {
    vixScore: Math.round(vixScore),
    yieldCurveScore: Math.round(ycScore),
    creditSpreadScore: Math.round(csScore),
    joblessClaimsScore: Math.round(jcScore),
    consumerSentimentScore: Math.round(csntScore),
    composite: Math.max(0, Math.min(100, composite)),
  }
}

// ─── Macro Regime Detection ─────────────────────────────────────────

function detectMacroRegime(
  unemploymentRate: number, cpi: number, joblessClaims: number,
  yieldSpread: number, vix: number, creditSpread: number
): FredDashboardData['macroRegime'] {
  const stressSignals = [
    yieldSpread < 0,
    vix > 30,
    creditSpread > 5,
    joblessClaims > 300000,
  ].filter(Boolean).length

  const growthSignals = [
    unemploymentRate < 4.5,
    joblessClaims < 250000,
    yieldSpread > 0.5,
  ].filter(Boolean).length

  const inflationHigh = cpi > 310 // rough CPI index level proxy

  if (stressSignals >= 3) return 'STAGFLATION'
  if (stressSignals >= 2 && !inflationHigh) return 'DEFLATION'
  if (growthSignals >= 2 && inflationHigh) return 'REFLATION'
  if (growthSignals >= 2 && !inflationHigh) return 'GOLDILOCKS'
  return 'UNKNOWN'
}

// ─── Fetch for detailed tab (more history) ──────────────────────────

export async function fetchFredDetailedSeries(seriesId: string, limit: number = 60): Promise<Array<{ date: string; value: number }>> {
  const obs = await fetchFredSeries(seriesId, limit)
  return obs
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .filter(o => !isNaN(o.value) && o.value.toString() !== '.')
    .reverse()
}
