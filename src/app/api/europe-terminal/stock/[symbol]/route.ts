// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Stock Detail API
// Proxies to same FMP endpoints as NASDAQ stock detail
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  fetchProfile, fetchKeyMetrics, fetchRatios, fetchFinancialScores,
  fetchDCF, fetchAnalystConsensus, fetchPriceTarget, fetchStockGrades,
  fetchEstimates, fetchInsiderTrades, fetchInsiderStatistics,
  fetchInstitutionalHolders, fetchSenateTrades, fetchHouseTrades,
  fetchEarnings, fetchStockNews, fetchShareFloat, fetchPriceChange, fetchESG,
  fetchIncomeStatements, fetchBalanceSheets, fetchCashFlowStatements,
  fetchSectorPerformance,
} from '@/lib/fmp-terminal/fmp-bulk-client'
import { fmpApiFetch } from '@/lib/api/fmpClient'
import { computeFMPScore, createDefaultInput, type ScoreInputMetrics } from '@/lib/fmp-terminal/fmp-score-engine'
import { getExchangeFromSymbol, EUROPE_EXCHANGES } from '@/lib/europe-config'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol?.toUpperCase()?.trim()
  if (!sym) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  try {
    const profile = await fetchProfile(sym)
    if (!profile) return NextResponse.json({ error: 'Stock not found', symbol: sym }, { status: 404 })

    let quoteEnrich: { marketCap?: number; pe?: number; price?: number; change?: number; changesPercentage?: number } | null = null
    try {
      const q = await fmpApiFetch<unknown[]>('/batch-quote', { symbols: sym })
      const arr = Array.isArray(q) ? q : (q as any)?.value ?? []
      const first = arr.find((x: any) => x?.symbol === sym) || arr[0]
      if (first && first.symbol) {
        quoteEnrich = {
          marketCap: first.marketCap,
          pe: first.pe,
          price: first.price,
          change: first.change,
          changesPercentage: first.changesPercentage ?? first.changePercentage,
        }
      }
    } catch { /* ignore */ }

    const enrichedProfile = {
      ...profile,
      mktCap: (quoteEnrich?.marketCap != null && quoteEnrich.marketCap > 0) ? quoteEnrich.marketCap : profile.mktCap,
      price: quoteEnrich?.price ?? profile.price,
      changes: quoteEnrich?.change ?? profile.changes,
      changesPercentage: quoteEnrich?.changesPercentage ?? profile.changesPercentage,
    }

    const exId = getExchangeFromSymbol(sym)
    const exConfig = exId ? EUROPE_EXCHANGES[exId] : null

    const [metrics, ratios, scores, dcf, analyst, target, grades, estimates,
      insiderTrades, insiderStats, institutional, senateTrades, houseTrades,
      earnings, news, shareFloat, priceChange, esg,
      income, balance, cashflow, sectorPerf
    ] = await Promise.allSettled([
      fetchKeyMetrics(sym), fetchRatios(sym), fetchFinancialScores(sym),
      fetchDCF(sym), fetchAnalystConsensus(sym), fetchPriceTarget(sym),
      fetchStockGrades(sym), fetchEstimates(sym),
      fetchInsiderTrades(sym), fetchInsiderStatistics(sym),
      fetchInstitutionalHolders(sym), fetchSenateTrades(sym), fetchHouseTrades(sym),
      fetchEarnings(sym), fetchStockNews(sym), fetchShareFloat(sym),
      fetchPriceChange(sym), fetchESG(sym),
      fetchIncomeStatements(sym), fetchBalanceSheets(sym), fetchCashFlowStatements(sym),
      fetchSectorPerformance(),
    ])

    const val = <T>(r: PromiseSettledResult<T>, def: T): T => r.status === 'fulfilled' ? r.value : def

    const metricsData = val(metrics, null)
    const ratiosData = val(ratios, null)
    const scoresData = val(scores, null)
    const dcfData = val(dcf, null)
    const analystData = val(analyst, null)
    const targetData = val(target, null)

    const input = createDefaultInput(sym, profile.sector || 'Unknown')
    if (metricsData) {
      input.pe = metricsData.peRatioTTM || 0
      input.pb = metricsData.pbRatioTTM || 0
      input.evEbitda = metricsData.enterpriseValueOverEBITDATTM || 0
    }
    if (scoresData) {
      input.altmanZ = scoresData.altmanZScore || 0
      input.piotroski = scoresData.piotroskiScore || 0
    }
    if (dcfData) { input.dcf = dcfData.dcf || 0 }
    if (analystData) {
      input.analystConsensus = analystData.consensus || ''
      input.strongBuy = analystData.strongBuy || 0
      input.buy = analystData.buy || 0
      input.hold = analystData.hold || 0
      input.sell = analystData.sell || 0
      input.strongSell = analystData.strongSell || 0
    }
    if (targetData) {
      input.priceTarget = targetData.targetConsensus || 0
    }
    const est = val(estimates, [])
    if (est.length > 0) {
      const curr = est[0]?.estimatedEpsAvg ?? 0
      const prev30 = est[1]?.estimatedEpsAvg ?? 0
      const prev90 = est[3]?.estimatedEpsAvg ?? 0
      input.epsRevision30d = prev30 !== 0 ? ((curr - prev30) / Math.abs(prev30)) * 100 : 0
      input.epsRevision90d = prev90 !== 0 ? ((curr - prev90) / Math.abs(prev90)) * 100 : 0
      input.analystRevisionCount = est[0]?.numberAnalystsEstimatedEps ?? 0
    }
    input.price = enrichedProfile.price || profile.price || 0

    const fmpScore = computeFMPScore(input, null)

    return NextResponse.json({
      profile: { ...enrichedProfile, exchange: exConfig?.shortLabel || profile.exchange, currency: exConfig?.currency || profile.currency },
      metrics: metricsData,
      ratios: ratiosData,
      scores: scoresData,
      dcf: dcfData,
      analyst: analystData,
      priceTarget: targetData,
      grades: val(grades, []),
      estimates: val(estimates, []),
      insiderTrades: val(insiderTrades, []),
      insiderStatistics: val(insiderStats, null),
      institutional: val(institutional, []),
      senateTrades: val(senateTrades, []),
      houseTrades: val(houseTrades, []),
      earnings: val(earnings, []),
      news: val(news, []),
      shareFloat: val(shareFloat, null),
      priceChange: val(priceChange, null),
      esg: val(esg, null),
      income: val(income, []),
      balance: val(balance, []),
      cashflow: val(cashflow, []),
      sectorPerformance: val(sectorPerf, []),
      fmpScore,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed', message: (error as Error).message }, { status: 500 })
  }
}
