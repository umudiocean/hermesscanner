// ═══════════════════════════════════════════════════════════════════
// FMP Terminal - Stock Detail API
// GET /api/fmp-terminal/stock/[symbol]
// Returns full stock detail data including FMP score
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  fetchProfile,
  fetchKeyMetrics,
  fetchRatios,
  fetchFinancialScores,
  fetchDCF,
  fetchAnalystConsensus,
  fetchPriceTarget,
  fetchStockGrades,
  fetchEstimates,
  fetchInsiderTrades,
  fetchInsiderStatistics,
  fetchInstitutionalHolders,
  fetchSenateTrades,
  fetchHouseTrades,
  fetchEarnings,
  fetchStockNews,
  fetchShareFloat,
  fetchPriceChange,
  fetchESG,
  fetchIncomeStatements,
  fetchBalanceSheets,
  fetchCashFlowStatements,
  fetchSectorPerformance,
} from '@/lib/fmp-terminal/fmp-bulk-client'
import { computeFMPScore, createDefaultInput, type ScoreInputMetrics } from '@/lib/fmp-terminal/fmp-score-engine'
import type {
  StockDetailData,
  InsiderTrade,
  CongressionalTrade,
  EarningsSurprise,
} from '@/lib/fmp-terminal/fmp-types'
import { createApiError } from '@/lib/validation/ohlcv-validator'
import logger from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const startTime = Date.now()
  const { symbol } = await params
  const sym = symbol?.toUpperCase()?.trim()

  if (!sym) {
    return NextResponse.json(createApiError('Symbol is required', 'Provide a valid stock symbol', 'VALIDATION'), { status: 400 })
  }

  try {
    // 1. Fetch profile first (needed for sector + score)
    const profile = await fetchProfile(sym)
    if (!profile) {
      return NextResponse.json(
        { error: 'Stock not found', symbol: sym },
        { status: 404 }
      )
    }

    // 2. Fetch sector performance for sectorPerformance1M
    let sectorPerformance1M = 0
    try {
      const sectorPerf = await fetchSectorPerformance()
      const sectorMatch = sectorPerf.find(
        (s) => s.sector?.toLowerCase() === (profile.sector || '').toLowerCase()
      )
      if (sectorMatch && isFinite(sectorMatch.changesPercentage)) {
        sectorPerformance1M = sectorMatch.changesPercentage
      }
    } catch {
      // ignore
    }

    // 3. Fetch all stock data in parallel
    const results = await Promise.allSettled([
      fetchKeyMetrics(sym),
      fetchRatios(sym),
      fetchFinancialScores(sym),
      fetchDCF(sym),
      fetchAnalystConsensus(sym),
      fetchPriceTarget(sym),
      fetchStockGrades(sym),
      fetchEstimates(sym),
      fetchInsiderTrades(sym),
      fetchInsiderStatistics(sym),
      fetchInstitutionalHolders(sym),
      fetchSenateTrades(sym),
      fetchHouseTrades(sym),
      fetchEarnings(sym),
      fetchStockNews(sym, 20),
      fetchShareFloat(sym),
      fetchPriceChange(sym),
      fetchESG(sym),
      fetchIncomeStatements(sym, 'annual'),
      fetchIncomeStatements(sym, 'quarter'),
      fetchBalanceSheets(sym, 'annual'),
      fetchBalanceSheets(sym, 'quarter'),
      fetchCashFlowStatements(sym, 'annual'),
      fetchCashFlowStatements(sym, 'quarter'),
    ])

    const unwrap = <T>(r: PromiseSettledResult<T>, def: T): T =>
      r.status === 'fulfilled' ? (r.value ?? def) : def

    const rawKeyMetrics = unwrap(results[0], null)
    const ratios = unwrap(results[1], null)
    const scores = unwrap(results[2], null)
    const dcf = unwrap(results[3], null)
    const analystConsensus = unwrap(results[4], null)
    const priceTarget = unwrap(results[5], null)
    const grades = unwrap(results[6], [] as Awaited<ReturnType<typeof fetchStockGrades>>)
    const estimates = unwrap(results[7], [] as Awaited<ReturnType<typeof fetchEstimates>>)
    const insiderTrades = unwrap(results[8], [] as InsiderTrade[])
    const insiderStats = unwrap(results[9], null)
    const institutionalHolders = unwrap(results[10], [] as Awaited<ReturnType<typeof fetchInstitutionalHolders>>)
    const senateTrades = unwrap(results[11], [] as CongressionalTrade[])
    const houseTrades = unwrap(results[12], [] as CongressionalTrade[])
    const earnings = unwrap(results[13], [] as Awaited<ReturnType<typeof fetchEarnings>>)
    const news = unwrap(results[14], [] as Awaited<ReturnType<typeof fetchStockNews>>)
    const shareFloat = unwrap(results[15], null)
    const priceChange = unwrap(results[16], null)
    const esg = unwrap(results[17], null)
    const incomeAnnual = unwrap(results[18], [] as Awaited<ReturnType<typeof fetchIncomeStatements>>)
    const incomeQuarter = unwrap(results[19], [] as Awaited<ReturnType<typeof fetchIncomeStatements>>)
    const balanceAnnual = unwrap(results[20], [] as Awaited<ReturnType<typeof fetchBalanceSheets>>)
    const balanceQuarter = unwrap(results[21], [] as Awaited<ReturnType<typeof fetchBalanceSheets>>)
    const cashflowAnnual = unwrap(results[22], [] as Awaited<ReturnType<typeof fetchCashFlowStatements>>)
    const cashflowQuarter = unwrap(results[23], [] as Awaited<ReturnType<typeof fetchCashFlowStatements>>)

    const congressionalTrades: CongressionalTrade[] = [...senateTrades, ...houseTrades]

    // V4 FIX: Stable API alan isimleri V3'ten farkli. keyMetrics + ratios birlestir.
    // Stable /key-metrics-ttm: returnOnEquityTTM, currentRatioTTM, freeCashFlowPerShareTTM, enterpriseValueOverEBITDATTM
    // Stable /ratios-ttm: priceToEarningsRatioTTM, priceToBookRatioTTM, debtToEquityRatioTTM, dividendYieldTTM, interestCoverageRatioTTM
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = ratios as Record<string, any> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const km = rawKeyMetrics as Record<string, any> | null
    const keyMetrics = {
      symbol: sym,
      // PE: ratios has priceToEarningsRatioTTM, keyMetrics may have peRatioTTM (V3 compat)
      peRatioTTM: km?.peRatioTTM || r?.priceToEarningsRatioTTM || r?.priceEarningsRatioTTM || 0,
      pbRatioTTM: km?.pbRatioTTM || r?.priceToBookRatioTTM || 0,
      priceToSalesRatioTTM: km?.priceToSalesRatioTTM || r?.priceToSalesRatioTTM || 0,
      enterpriseValueOverEBITDATTM: km?.enterpriseValueOverEBITDATTM || km?.evToEBITDATTM || r?.enterpriseValueMultipleTTM || 0,
      debtToEquityTTM: km?.debtToEquityTTM || r?.debtToEquityRatioTTM || r?.debtEquityRatioTTM || 0,
      currentRatioTTM: km?.currentRatioTTM || r?.currentRatioTTM || 0,
      interestCoverageTTM: km?.interestCoverageTTM || r?.interestCoverageRatioTTM || 0,
      roeTTM: km?.roeTTM || km?.returnOnEquityTTM || r?.returnOnEquityTTM || 0,
      dividendYieldTTM: km?.dividendYieldTTM || r?.dividendYieldTTM || 0,
      revenuePerShareTTM: km?.revenuePerShareTTM || r?.revenuePerShareTTM || 0,
      netIncomePerShareTTM: km?.netIncomePerShareTTM || r?.netIncomePerShareTTM || 0,
      freeCashFlowPerShareTTM: km?.freeCashFlowPerShareTTM || r?.freeCashFlowPerShareTTM || 0,
      bookValuePerShareTTM: km?.bookValuePerShareTTM || r?.bookValuePerShareTTM || 0,
      marketCapTTM: km?.marketCap || profile?.mktCap || 0,
      enterpriseValueTTM: km?.enterpriseValueTTM || r?.enterpriseValueTTM || 0,
      pegRatio: km?.pegRatio || r?.priceToEarningsGrowthRatioTTM || 0,
      priceToFreeCashFlowsTTM: km?.priceToFreeCashFlowsTTM || r?.priceToFreeCashFlowRatioTTM || r?.priceToFreeCashFlowsRatioTTM || 0,
      operatingCashFlowPerShareTTM: km?.operatingCashFlowPerShareTTM || r?.operatingCashFlowPerShareTTM || 0,
    } as any

    // 4. Compute institutional ownership % and flow
    let institutionalOwnershipPct = 50
    let institutionalFlowDirection = 0
    const outstanding = shareFloat?.outstandingShares ?? (profile?.mktCap && profile?.price ? profile.mktCap / profile.price : 0)
    if (outstanding > 0 && institutionalHolders.length > 0) {
      const totalInstShares = institutionalHolders.reduce((sum, h) => sum + (h.shares || 0), 0)
      institutionalOwnershipPct = (totalInstShares / outstanding) * 100
      const netChange = institutionalHolders.reduce((sum, h) => sum + (h.change || 0), 0)
      institutionalFlowDirection = netChange > 0 ? 1 : netChange < 0 ? -1 : 0
    }

    // 5. Earnings surprises: single-stock endpoint not in client, use empty
    const earningsSurprises: EarningsSurprise[] = []

    // 6. Build score input and calculate V2 FMP score
    const scoreInput = createDefaultInput(sym, profile.sector || 'Unknown')

    // Valuation
    scoreInput.pe = keyMetrics?.peRatioTTM ?? 0
    scoreInput.pb = keyMetrics?.pbRatioTTM ?? 0
    scoreInput.evEbitda = keyMetrics?.enterpriseValueOverEBITDATTM ?? 0
    scoreInput.dcf = dcf?.dcf ?? 0
    scoreInput.price = profile.price ?? 0
    scoreInput.pegRatio = keyMetrics?.pegRatio ?? 0
    scoreInput.pfcf = keyMetrics?.priceToFreeCashFlowsTTM ?? 0

    // Health
    scoreInput.altmanZ = scores?.altmanZScore ?? 0
    scoreInput.piotroski = scores?.piotroskiScore ?? 0
    scoreInput.debtEquity = keyMetrics?.debtToEquityTTM ?? 0
    scoreInput.currentRatio = keyMetrics?.currentRatioTTM ?? 0
    scoreInput.interestCoverage = keyMetrics?.interestCoverageTTM ?? 0
    scoreInput.fcfPerShare = keyMetrics?.freeCashFlowPerShareTTM ?? 0

    // Analyst
    if (analystConsensus) {
      scoreInput.analystConsensus = analystConsensus.consensus || ''
      scoreInput.strongBuy = analystConsensus.strongBuy ?? 0
      scoreInput.buy = analystConsensus.buy ?? 0
      scoreInput.hold = analystConsensus.hold ?? 0
      scoreInput.sell = analystConsensus.sell ?? 0
      scoreInput.strongSell = analystConsensus.strongSell ?? 0
    }
    if (priceTarget) {
      scoreInput.priceTarget = priceTarget.targetConsensus ?? 0
    }

    // Insider
    if (insiderStats) {
      scoreInput.insiderNetBuys = (insiderStats.purchases ?? 0) - (insiderStats.sales ?? 0)
      scoreInput.insiderNetValue = (insiderStats.totalBought ?? 0) - (insiderStats.totalSold ?? 0)
    }
    // Check for C-suite buying in insider trades
    const cSuiteTrades = insiderTrades.filter(t =>
      t.acquistionOrDisposition === 'A' &&
      (t.typeOfOwner?.toLowerCase().includes('officer') || t.reportingName?.toLowerCase().includes('ceo') || t.reportingName?.toLowerCase().includes('cfo'))
    )
    scoreInput.cSuiteBuying = cSuiteTrades.length > 0
    const recentBuyers = new Set(insiderTrades.filter(t => t.acquistionOrDisposition === 'A').map(t => t.reportingName))
    scoreInput.clusterBuy = recentBuyers.size >= 3

    // Institutional
    scoreInput.institutionalOwnership = institutionalOwnershipPct
    scoreInput.institutionalChange = institutionalFlowDirection * 5 // rough proxy

    // Congressional
    const congressBuys = congressionalTrades.filter(t => t.type === 'purchase').length
    const congressSells = congressionalTrades.filter(t => t.type?.startsWith('sale')).length
    scoreInput.congressNetBuys = congressBuys - congressSells
    scoreInput.congressMultiple = new Set(congressionalTrades.filter(t => t.type === 'purchase').map(t => t.lastName)).size >= 2

    // Sector & Meta
    scoreInput.sectorPerformance1M = sectorPerformance1M
    scoreInput.changePercent = profile.changesPercentage ?? 0
    scoreInput.marketCap = profile.mktCap ?? 0
    scoreInput.beta = profile.beta ?? 0

    // 52W Range + P/S from profile.range and keyMetrics
    if (profile.range) {
      const parts = profile.range.split('-')
      const lo = parseFloat(parts[0])
      const hi = parseFloat(parts[1])
      if (!isNaN(lo) && lo > 0) scoreInput.yearLow = lo
      if (!isNaN(hi) && hi > 0) scoreInput.yearHigh = hi
    }
    scoreInput.priceToSales = keyMetrics?.priceToSalesRatioTTM ?? 0

    const fmpScore = computeFMPScore(scoreInput)

    const detail: StockDetailData = {
      profile,
      keyMetrics,
      ratios,
      scores,
      dcf,
      analystConsensus,
      priceTarget,
      insiderTrades,
      insiderStats,
      institutionalSummary: null,
      institutionalHolders,
      congressionalTrades,
      earnings,
      earningsSurprises,
      news,
      grades,
      estimates,
      incomeStatements: incomeAnnual,
      balanceSheets: balanceAnnual,
      cashFlowStatements: cashflowAnnual,
      priceChange,
      shareFloat,
      esg,
      fmpScore,
      // V3 additions — fetched on demand by specific tabs
      technicalSummary: null,
      peers: [],
      executives: [],
      executiveCompensation: [],
      employeeHistory: [],
      historicalMarketCap: [],
      mergersAcquisitions: [],
      pressReleases: [],
      indexMembership: [],
      etfExposure: [],
    }

    const duration = Date.now() - startTime
    logger.info(`Stock detail fetched in ${duration}ms`, { module: 'api/stock', symbol: sym, duration })

    return NextResponse.json(detail)
  } catch (error) {
    logger.error('Stock detail API error', { module: 'api/stock', symbol: sym, error })
    return NextResponse.json(
      createApiError('Stock data fetch failed', (error as Error).message, 'FETCH_ERROR'),
      { status: 500 }
    )
  }
}
