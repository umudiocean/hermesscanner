// ═══════════════════════════════════════════════════════════════════
// Hermes AI Analytics — Redis INCR-based counters
// Lightweight: each tracking call = single Redis INCR (<1ms)
// Data retention: 30 days (keys auto-expire via TTL)
// ═══════════════════════════════════════════════════════════════════

import { getRedis } from '../cache/redis-client'

const TTL_DAYS = 30
const TTL_SEC = TTL_DAYS * 24 * 60 * 60

function today(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

async function incr(key: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    const pipeline = r.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, TTL_SEC)
    await pipeline.exec()
  } catch {
    // non-critical — analytics failure should never break the app
  }
}

// ─── Page View Tracking ─────────────────────────────────────────

export async function trackPageView(path: string, referrer?: string, userAgent?: string): Promise<void> {
  const d = today()
  const promises: Promise<void>[] = []

  // Total daily page views
  promises.push(incr(`hermes:pv:${d}`))

  // Per-path page views
  const safePath = path.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 50) || '/'
  promises.push(incr(`hermes:pv:${d}:${safePath}`))

  // Referrer tracking
  if (referrer) {
    try {
      const domain = new URL(referrer).hostname.replace('www.', '').slice(0, 50)
      promises.push(incr(`hermes:ref:${d}:${domain}`))
    } catch {
      promises.push(incr(`hermes:ref:${d}:direct`))
    }
  } else {
    promises.push(incr(`hermes:ref:${d}:direct`))
  }

  // Device type detection from User-Agent
  if (userAgent) {
    const ua = userAgent.toLowerCase()
    let device = 'desktop'
    if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
      device = /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile'
    }
    promises.push(incr(`hermes:device:${d}:${device}`))
  }

  await Promise.allSettled(promises)
}

// ─── Unique Visitor Tracking (IP-based HyperLogLog) ─────────────

export async function trackUniqueVisitor(ip: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    const key = `hermes:uv:${today()}`
    const pipeline = r.pipeline()
    pipeline.pfadd(key, ip)
    pipeline.expire(key, TTL_SEC)
    await pipeline.exec()
  } catch {
    // non-critical
  }
}

// ─── API Call Tracking ──────────────────────────────────────────

export async function trackApiCall(endpoint: string): Promise<void> {
  const d = today()
  const safeEndpoint = endpoint.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 60)
  await Promise.allSettled([
    incr(`hermes:api:${d}:${safeEndpoint}`),
    incr(`hermes:api:${d}:total`),
  ])
}

export async function trackExternalApi(provider: 'fmp' | 'coingecko' | 'fred'): Promise<void> {
  await incr(`hermes:ext:${today()}:${provider}`)
}

// ─── Read Analytics Data ────────────────────────────────────────

export async function getAnalytics(days: number = 7): Promise<{
  pageViews: { date: string; count: number }[]
  uniqueVisitors: { date: string; count: number }[]
  topPages: { path: string; count: number }[]
  referrers: { source: string; count: number }[]
  devices: { type: string; count: number }[]
  apiCalls: { endpoint: string; count: number }[]
  externalApis: { provider: string; count: number }[]
  totals: { pv: number; uv: number; api: number }
}> {
  const r = getRedis()
  if (!r) {
    return {
      pageViews: [], uniqueVisitors: [], topPages: [],
      referrers: [], devices: [], apiCalls: [], externalApis: [],
      totals: { pv: 0, uv: 0, api: 0 },
    }
  }

  try {
    const dates: string[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().slice(0, 10))
    }

    // Page views per day
    const pvPipeline = r.pipeline()
    for (const d of dates) pvPipeline.get(`hermes:pv:${d}`)
    const pvResults = await pvPipeline.exec()
    const pageViews = dates.map((d, i) => ({ date: d, count: Number(pvResults[i]) || 0 }))

    // Unique visitors per day (HyperLogLog)
    const uvPipeline = r.pipeline()
    for (const d of dates) uvPipeline.pfcount(`hermes:uv:${d}`)
    const uvResults = await uvPipeline.exec()
    const uniqueVisitors = dates.map((d, i) => ({ date: d, count: Number(uvResults[i]) || 0 }))

    // Top pages (today)
    const todayDate = today()
    const pageKeys = await r.keys(`hermes:pv:${todayDate}:*`)
    const topPages: { path: string; count: number }[] = []
    if (pageKeys.length > 0) {
      const pagePipeline = r.pipeline()
      for (const k of pageKeys) pagePipeline.get(k)
      const pageResults = await pagePipeline.exec()
      for (let i = 0; i < pageKeys.length; i++) {
        const path = pageKeys[i].replace(`hermes:pv:${todayDate}:`, '')
        topPages.push({ path, count: Number(pageResults[i]) || 0 })
      }
      topPages.sort((a, b) => b.count - a.count)
    }

    // Referrers (today)
    const refKeys = await r.keys(`hermes:ref:${todayDate}:*`)
    const referrers: { source: string; count: number }[] = []
    if (refKeys.length > 0) {
      const refPipeline = r.pipeline()
      for (const k of refKeys) refPipeline.get(k)
      const refResults = await refPipeline.exec()
      for (let i = 0; i < refKeys.length; i++) {
        const source = refKeys[i].replace(`hermes:ref:${todayDate}:`, '')
        referrers.push({ source, count: Number(refResults[i]) || 0 })
      }
      referrers.sort((a, b) => b.count - a.count)
    }

    // Devices (today)
    const deviceKeys = await r.keys(`hermes:device:${todayDate}:*`)
    const devices: { type: string; count: number }[] = []
    if (deviceKeys.length > 0) {
      const devPipeline = r.pipeline()
      for (const k of deviceKeys) devPipeline.get(k)
      const devResults = await devPipeline.exec()
      for (let i = 0; i < deviceKeys.length; i++) {
        const type = deviceKeys[i].replace(`hermes:device:${todayDate}:`, '')
        devices.push({ type, count: Number(devResults[i]) || 0 })
      }
    }

    // API calls (today)
    const apiKeys = await r.keys(`hermes:api:${todayDate}:*`)
    const apiCalls: { endpoint: string; count: number }[] = []
    if (apiKeys.length > 0) {
      const apiPipeline = r.pipeline()
      for (const k of apiKeys) apiPipeline.get(k)
      const apiResults = await apiPipeline.exec()
      for (let i = 0; i < apiKeys.length; i++) {
        const endpoint = apiKeys[i].replace(`hermes:api:${todayDate}:`, '')
        if (endpoint !== 'total') {
          apiCalls.push({ endpoint, count: Number(apiResults[i]) || 0 })
        }
      }
      apiCalls.sort((a, b) => b.count - a.count)
    }

    // External API calls (today)
    const extKeys = await r.keys(`hermes:ext:${todayDate}:*`)
    const externalApis: { provider: string; count: number }[] = []
    if (extKeys.length > 0) {
      const extPipeline = r.pipeline()
      for (const k of extKeys) extPipeline.get(k)
      const extResults = await extPipeline.exec()
      for (let i = 0; i < extKeys.length; i++) {
        const provider = extKeys[i].replace(`hermes:ext:${todayDate}:`, '')
        externalApis.push({ provider, count: Number(extResults[i]) || 0 })
      }
    }

    // Totals
    const totalPV = pageViews.reduce((s, d) => s + d.count, 0)
    const totalUV = uniqueVisitors.reduce((s, d) => s + d.count, 0)
    const totalAPI = Number(await r.get(`hermes:api:${todayDate}:total`)) || 0

    return {
      pageViews, uniqueVisitors, topPages,
      referrers, devices, apiCalls, externalApis,
      totals: { pv: totalPV, uv: totalUV, api: totalAPI },
    }
  } catch {
    return {
      pageViews: [], uniqueVisitors: [], topPages: [],
      referrers: [], devices: [], apiCalls: [], externalApis: [],
      totals: { pv: 0, uv: 0, api: 0 },
    }
  }
}
