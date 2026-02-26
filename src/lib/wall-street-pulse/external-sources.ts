// Wall Street Pulse — External Data Sources (CBOE, Finnhub, Alternative.me)

import logger from '../logger'

const LOG_TAG = '[Pulse:External]'

// ─── CBOE VIX (CSV) ──────────────────────────────────────────────
// CBOE publishes daily VIX close as CSV
// Fallback: FRED VIXCLS series

export async function fetchVIXValue(): Promise<number | null> {
  // Layer 1: FRED VIXCLS (most reliable, 1-day lag)
  try {
    const fredKey = process.env.FRED_API_KEY
    if (fredKey) {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${fredKey}&file_type=json&sort_order=desc&limit=5`
      const res = await fetch(url, { next: { revalidate: 3600 } })
      if (res.ok) {
        const data = await res.json()
        const obs = data?.observations
        if (obs && obs.length > 0) {
          for (const o of obs) {
            const v = parseFloat(o.value)
            if (!isNaN(v) && v > 0) {
              logger.info(`${LOG_TAG} VIX from FRED: ${v}`)
              return v
            }
          }
        }
      }
    }
  } catch (e) {
    logger.warn(`${LOG_TAG} FRED VIX fetch failed: ${(e as Error).message}`)
  }

  // Layer 2: Finnhub (real-time, 60 req/min)
  try {
    const fhKey = process.env.FINNHUB_API_KEY
    if (fhKey) {
      const url = `https://finnhub.io/api/v1/quote?symbol=VIX&token=${fhKey}`
      const res = await fetch(url, { next: { revalidate: 300 } })
      if (res.ok) {
        const data = await res.json()
        if (data?.c && data.c > 0) {
          logger.info(`${LOG_TAG} VIX from Finnhub: ${data.c}`)
          return data.c
        }
      }
    }
  } catch (e) {
    logger.warn(`${LOG_TAG} Finnhub VIX fetch failed: ${(e as Error).message}`)
  }

  // Layer 3: FMP batch-quote for ^VIX
  try {
    const fmpKey = process.env.FMP_API_KEY
    if (fmpKey) {
      const res = await fetch(`https://financialmodelingprep.com/stable/batch-quote?symbols=%5EVIX`, {
        headers: { 'apikey': fmpKey },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0 && data[0].price > 0) {
          logger.info(`${LOG_TAG} VIX from FMP: ${data[0].price}`)
          return data[0].price
        }
      }
    }
  } catch (e) {
    logger.warn(`${LOG_TAG} FMP VIX fetch failed: ${(e as Error).message}`)
  }

  logger.warn(`${LOG_TAG} VIX unavailable from all sources`)
  return null
}

// ─── CBOE Put/Call Ratio (CSV) ───────────────────────────────────

export async function fetchPutCallRatio(): Promise<number | null> {
  try {
    const url = 'https://www.cboe.com/publish/scheduledtask/mktdata/datahouse/totalpc.csv'
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.trim().split('\n')
    if (lines.length < 3) return null
    // Last data line — format: DATE, CALLS, PUTS, TOTAL, PUT/CALL RATIO
    for (let i = lines.length - 1; i >= 2; i--) {
      const parts = lines[i].split(',')
      if (parts.length >= 5) {
        const ratio = parseFloat(parts[4])
        if (!isNaN(ratio) && ratio > 0 && ratio < 5) {
          logger.info(`${LOG_TAG} Put/Call ratio from CBOE: ${ratio}`)
          return ratio
        }
      }
    }
  } catch (e) {
    logger.warn(`${LOG_TAG} CBOE Put/Call fetch failed: ${(e as Error).message}`)
  }
  return null
}

// ─── FRED High Yield Spread (Credit Stress) ─────────────────────

export async function fetchHighYieldSpread(): Promise<number | null> {
  try {
    const fredKey = process.env.FRED_API_KEY
    if (!fredKey) return null
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=BAMLH0A0HYM2&api_key=${fredKey}&file_type=json&sort_order=desc&limit=5`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json()
    const obs = data?.observations
    if (obs) {
      for (const o of obs) {
        const v = parseFloat(o.value)
        if (!isNaN(v) && v > 0) {
          logger.info(`${LOG_TAG} HY Spread from FRED: ${v}`)
          return v
        }
      }
    }
  } catch (e) {
    logger.warn(`${LOG_TAG} FRED HY Spread failed: ${(e as Error).message}`)
  }
  return null
}

// ─── FRED Dollar Index DXY ──────────────────────────────────────

export async function fetchDollarIndex(): Promise<number | null> {
  try {
    const fredKey = process.env.FRED_API_KEY
    if (!fredKey) return null
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${fredKey}&file_type=json&sort_order=desc&limit=5`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json()
    const obs = data?.observations
    if (obs) {
      for (const o of obs) {
        const v = parseFloat(o.value)
        if (!isNaN(v) && v > 0) return v
      }
    }
  } catch (e) {
    logger.warn(`${LOG_TAG} FRED DXY failed: ${(e as Error).message}`)
  }
  return null
}
