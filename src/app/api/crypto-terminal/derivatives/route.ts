// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — /api/crypto-terminal/derivatives
// Derivatives data: funding rates, open interest, exchanges
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { fetchDerivatives, fetchDerivativeExchanges } from '@/lib/crypto-terminal/coingecko-client'
import { getCached, CRYPTO_CACHE_TTL } from '@/lib/crypto-terminal/crypto-cache'
import { Derivative, DerivativeExchange } from '@/lib/crypto-terminal/coingecko-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [tickersRes, exchangesRes] = await Promise.allSettled([
      getCached<Derivative[]>(
        'crypto-derivatives-tickers',
        CRYPTO_CACHE_TTL.DERIVATIVES,
        () => fetchDerivatives() as Promise<Derivative[]>,
      ),
      getCached<DerivativeExchange[]>(
        'crypto-derivatives-exchanges',
        CRYPTO_CACHE_TTL.EXCHANGES,
        () => fetchDerivativeExchanges() as Promise<DerivativeExchange[]>,
      ),
    ])

    const tickers = tickersRes.status === 'fulfilled' ? tickersRes.value ?? [] : []
    const exchanges = exchangesRes.status === 'fulfilled' ? exchangesRes.value ?? [] : []

    // Group funding rates by symbol for heatmap
    const perpetuals = tickers.filter(t => t.contract_type === 'perpetual')
    const fundingMap: Record<string, { rates: number[]; avgRate: number; symbol: string; exchanges: string[] }> = {}

    for (const p of perpetuals) {
      const sym = p.symbol?.split('/')[0] || p.symbol
      if (!fundingMap[sym]) {
        fundingMap[sym] = { rates: [], avgRate: 0, symbol: sym, exchanges: [] }
      }
      if (p.funding_rate != null) {
        fundingMap[sym].rates.push(p.funding_rate)
        fundingMap[sym].exchanges.push(p.market)
      }
    }

    // Calculate average funding rate
    const fundingRates = Object.values(fundingMap).map(entry => {
      entry.avgRate = entry.rates.length > 0
        ? entry.rates.reduce((a, b) => a + b) / entry.rates.length
        : 0
      return entry
    }).sort((a, b) => Math.abs(b.avgRate) - Math.abs(a.avgRate))

    // Summary stats
    const totalOI = exchanges.reduce((sum, ex) => sum + (ex.open_interest_btc ?? 0), 0)
    const validFunding = perpetuals.filter(p => p.funding_rate != null && !isNaN(p.funding_rate))
    const avgFundingAll = validFunding.length > 0
      ? validFunding.reduce((s, p) => s + (p.funding_rate ?? 0), 0) / validFunding.length
      : 0

    return NextResponse.json({
      tickers: tickers.slice(0, 100),
      exchanges,
      fundingRates: fundingRates.slice(0, 50),
      perpetualCount: perpetuals.length,
      totalOpenInterestBTC: totalOI,
      avgFundingRate: avgFundingAll,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch derivatives', message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
