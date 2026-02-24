// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Macro API (ECB, Euro PMI, UK GDP, German IFO)
// Uses FMP economic-calendar filtered for European countries
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { fmpApiFetch } from '@/lib/api/fmpClient'
import { getCached, CACHE_TTL } from '@/lib/fmp-terminal/fmp-cache'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 60

export async function GET(_request: NextRequest) {
  const ip = getClientIP(_request)
  const { allowed, retryAfterMs } = await checkRateLimit(`eu-macro:${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const data = await getCached('europe_macro_dashboard', CACHE_TTL.MARKET, async () => {
      const from = new Date()
      from.setMonth(from.getMonth() - 3)
      const to = new Date()
      to.setMonth(to.getMonth() + 1)

      // Economic calendar for EU countries
      const [euEvents, ukEvents, deEvents, frEvents, news] = await Promise.allSettled([
        fmpApiFetch<Array<Record<string, unknown>>>('/economic-calendar', {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
          country: 'EU',
        }),
        fmpApiFetch<Array<Record<string, unknown>>>('/economic-calendar', {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
          country: 'GB',
        }),
        fmpApiFetch<Array<Record<string, unknown>>>('/economic-calendar', {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
          country: 'DE',
        }),
        fmpApiFetch<Array<Record<string, unknown>>>('/economic-calendar', {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
          country: 'FR',
        }),
        fmpApiFetch<Array<Record<string, unknown>>>('/fmp-articles', { page: '0', limit: '20' }),
      ])

      const val = <T>(r: PromiseSettledResult<T>, d: T): T => r.status === 'fulfilled' ? r.value : d

      const allEvents = [
        ...val(euEvents, []),
        ...val(ukEvents, []),
        ...val(deEvents, []),
        ...val(frEvents, []),
      ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

      const gdpEvents = allEvents.filter(e => String(e.event || '').toLowerCase().includes('gdp')).slice(0, 20)
      const sentimentEvents = allEvents.filter(e => {
        const ev = String(e.event || '').toLowerCase()
        return ev.includes('consumer') || ev.includes('sentiment') || ev.includes('confidence') || ev.includes('pmi')
      }).slice(0, 20)
      const ecbEvents = allEvents.filter(e => {
        const ev = String(e.event || '').toLowerCase()
        return ev.includes('ecb') || ev.includes('interest rate') || ev.includes('boe')
      }).slice(0, 20)

      return {
        gdp: gdpEvents,
        sentiment: sentimentEvents,
        centralBank: ecbEvents,
        allEvents: allEvents.slice(0, 50),
        news: val(news, []).slice(0, 20),
      }
    })

    return NextResponse.json({ ...data, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: 'Failed', message: (error as Error).message }, { status: 500 })
  }
}
