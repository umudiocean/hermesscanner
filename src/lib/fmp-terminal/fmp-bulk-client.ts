// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Bulk & Single API Client
// FMP Stable API endpoints with bulk data support
// ═══════════════════════════════════════════════════════════════════

import {
  CompanyProfile, KeyMetricsTTM, RatiosTTM, FinancialScores,
  DCFValuation, AnalystConsensus, PriceTarget, StockGrade,
  AnalystEstimate, InsiderTrade, InsiderStatistics,
  InstitutionalHolder, CongressionalTrade,
  EarningsReport, EarningsSurprise, StockNews,
  SectorPerformance, IndustryPerformance, SectorPE,
  MarketGainerLoser, IndexQuote, TreasuryRate,
  EconomicEvent, ESGRating, ShareFloat,
  StockPriceChange, IncomeStatement, BalanceSheet,
  CashFlowStatement, EarningsTranscript,
  MarketDashboardData, BulkStockSummary,
  // V3 types
  TechnicalDataPoint, TechnicalSummary,
  EarningsCalendarItem, DividendCalendarItem, StockSplitCalendarItem, IPOCalendarItem,
  InstitutionalFiling, HolderPerformanceSummary, IndustryOwnershipSummary,
  StockPeer, CompanyExecutive, ExecutiveCompensation, EmployeeCount,
  HistoricalMarketCap, MergerAcquisition, PressRelease,
  IndexConstituent, AftermarketQuote, GDPData, ConsumerSentiment,
  GeneralNews, ESGBenchmark, ETFStockExposure,
} from './fmp-types'
import { getCached, getStaleWhileRevalidate, CACHE_TTL, setMemoryCache, setDiskCache } from './fmp-cache'
import { fmpApiFetch } from '../api/fmpClient'
import logger from '../logger'

// Internal type for /fmp-articles response
interface FmpArticle {
  title: string
  date: string
  content: string
  tickers: string
  image: string
  link: string
  author: string
  site: string
}

// Alias: economic-calendar returns same shape as EconomicEvent
type EconomicCalendarEvent = EconomicEvent

// Use centralized client for all FMP API calls
async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  return fmpApiFetch<T>(endpoint, params)
}

// ═══════════════════════════════════════════════════════════════════
// BULK APIs (tum hisseler tek seferde)
// ═══════════════════════════════════════════════════════════════════

export async function fetchBulkProfiles(): Promise<CompanyProfile[]> {
  return getCached<CompanyProfile[]>('bulk_profiles', CACHE_TTL.BULK, async () => {
    // FMP bulk profile may require pagination
    const results: CompanyProfile[] = []
    for (let part = 0; part < 5; part++) {
      try {
        const batch = await fmpFetch<CompanyProfile[]>('/profile-bulk', { part: String(part) })
        if (!batch || batch.length === 0) break
        results.push(...batch)
      } catch (err) {
        logger.warn(`Bulk profile pagination stopped at part ${part}`, { module: 'fmpBulkClient', error: err })
        break
      }
    }
    return results
  })
}

export async function fetchBulkKeyMetricsTTM(): Promise<KeyMetricsTTM[]> {
  return getCached<KeyMetricsTTM[]>('bulk_key_metrics_ttm', CACHE_TTL.BULK, async () => {
    return fmpFetch<KeyMetricsTTM[]>('/key-metrics-ttm-bulk')
  })
}

export async function fetchBulkRatiosTTM(): Promise<RatiosTTM[]> {
  return getCached<RatiosTTM[]>('bulk_ratios_ttm', CACHE_TTL.BULK, async () => {
    return fmpFetch<RatiosTTM[]>('/ratios-ttm-bulk')
  })
}

export async function fetchBulkScores(): Promise<FinancialScores[]> {
  return getCached<FinancialScores[]>('bulk_scores', CACHE_TTL.BULK, async () => {
    return fmpFetch<FinancialScores[]>('/scores-bulk')
  })
}

export async function fetchBulkDCF(): Promise<DCFValuation[]> {
  return getCached<DCFValuation[]>('bulk_dcf', CACHE_TTL.BULK, async () => {
    return fmpFetch<DCFValuation[]>('/dcf-bulk')
  })
}

export async function fetchBulkRatings(): Promise<AnalystConsensus[]> {
  return getCached<AnalystConsensus[]>('bulk_ratings', CACHE_TTL.BULK, async () => {
    return fmpFetch<AnalystConsensus[]>('/upgrades-downgrades-consensus-bulk')
  })
}

export async function fetchBulkPriceTargetSummary(): Promise<PriceTarget[]> {
  return getCached<PriceTarget[]>('bulk_price_targets', CACHE_TTL.BULK, async () => {
    return fmpFetch<PriceTarget[]>('/price-target-summary-bulk')
  })
}

export async function fetchBulkEarningsSurprises(year?: number): Promise<EarningsSurprise[]> {
  const y = year || new Date().getFullYear()
  return getCached<EarningsSurprise[]>(`bulk_earnings_surprises_${y}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<EarningsSurprise[]>('/earnings-surprises-bulk', { year: String(y) })
  })
}

// ═══════════════════════════════════════════════════════════════════
// SINGLE STOCK APIs (on-demand, hisse tıklandığında)
// ═══════════════════════════════════════════════════════════════════

// ─── Profile ───────────────────────────────────────────────────────

export async function fetchProfile(symbol: string): Promise<CompanyProfile | null> {
  return getCached<CompanyProfile | null>(`profile_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<CompanyProfile[]>('/profile', { symbol })
    return data?.[0] || null
  })
}

// ─── Financials ────────────────────────────────────────────────────

export async function fetchIncomeStatements(symbol: string, period: 'annual' | 'quarter' = 'annual'): Promise<IncomeStatement[]> {
  return getCached<IncomeStatement[]>(`income_${symbol}_${period}`, CACHE_TTL.FINANCIALS, async () => {
    return fmpFetch<IncomeStatement[]>('/income-statement', { symbol, period, limit: '20' })
  })
}

export async function fetchBalanceSheets(symbol: string, period: 'annual' | 'quarter' = 'annual'): Promise<BalanceSheet[]> {
  return getCached<BalanceSheet[]>(`balance_${symbol}_${period}`, CACHE_TTL.FINANCIALS, async () => {
    return fmpFetch<BalanceSheet[]>('/balance-sheet-statement', { symbol, period, limit: '20' })
  })
}

export async function fetchCashFlowStatements(symbol: string, period: 'annual' | 'quarter' = 'annual'): Promise<CashFlowStatement[]> {
  return getCached<CashFlowStatement[]>(`cashflow_${symbol}_${period}`, CACHE_TTL.FINANCIALS, async () => {
    return fmpFetch<CashFlowStatement[]>('/cash-flow-statement', { symbol, period, limit: '20' })
  })
}

export async function fetchKeyMetrics(symbol: string): Promise<KeyMetricsTTM | null> {
  return getCached<KeyMetricsTTM | null>(`metrics_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<KeyMetricsTTM[]>('/key-metrics-ttm', { symbol })
    return data?.[0] || null
  })
}

export async function fetchRatios(symbol: string): Promise<RatiosTTM | null> {
  return getCached<RatiosTTM | null>(`ratios_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<RatiosTTM[]>('/ratios-ttm', { symbol })
    return data?.[0] || null
  })
}

export async function fetchFinancialScores(symbol: string): Promise<FinancialScores | null> {
  return getCached<FinancialScores | null>(`scores_${symbol}`, CACHE_TTL.SCORES, async () => {
    const data = await fmpFetch<FinancialScores[]>('/financial-scores', { symbol })
    return data?.[0] || null
  })
}

// ─── DCF ───────────────────────────────────────────────────────────

export async function fetchDCF(symbol: string): Promise<DCFValuation | null> {
  return getCached<DCFValuation | null>(`dcf_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<DCFValuation[]>('/discounted-cash-flow', { symbol })
    return data?.[0] || null
  })
}

// ─── Analyst ───────────────────────────────────────────────────────

export async function fetchAnalystConsensus(symbol: string): Promise<AnalystConsensus | null> {
  return getCached<AnalystConsensus | null>(`analyst_consensus_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<AnalystConsensus[]>('/grades-consensus', { symbol })
    return data?.[0] || null
  })
}

export async function fetchPriceTarget(symbol: string): Promise<PriceTarget | null> {
  return getCached<PriceTarget | null>(`price_target_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<PriceTarget[]>('/price-target-consensus', { symbol })
    return data?.[0] || null
  })
}

export async function fetchStockGrades(symbol: string): Promise<StockGrade[]> {
  return getCached<StockGrade[]>(`grades_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<StockGrade[]>('/grades', { symbol, limit: '30' })
  })
}

export async function fetchEstimates(symbol: string): Promise<AnalystEstimate[]> {
  return getCached<AnalystEstimate[]>(`estimates_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<AnalystEstimate[]>('/analyst-estimates', { symbol, period: 'quarter', limit: '8' })
  })
}

// ─── Insider Trades ────────────────────────────────────────────────

export async function fetchInsiderTrades(symbol: string): Promise<InsiderTrade[]> {
  return getCached<InsiderTrade[]>(`insider_${symbol}`, CACHE_TTL.INSIDER, async () => {
    return fmpFetch<InsiderTrade[]>('/insider-trading/search', { symbol, limit: '50' })
  })
}

export async function fetchInsiderStatistics(symbol: string): Promise<InsiderStatistics | null> {
  return getCached<InsiderStatistics | null>(`insider_stats_${symbol}`, CACHE_TTL.INSIDER, async () => {
    const data = await fmpFetch<InsiderStatistics[]>('/insider-trading/statistics', { symbol })
    return data?.[0] || null
  })
}

// ─── Institutional ─────────────────────────────────────────────────

export async function fetchInstitutionalHolders(symbol: string): Promise<InstitutionalHolder[]> {
  return getCached<InstitutionalHolder[]>(`inst_holders_${symbol}`, CACHE_TTL.INSTITUTIONAL, async () => {
    // Use positions summary endpoint
    const data = await fmpFetch<InstitutionalHolder[]>('/institutional-ownership/symbol-positions-summary', {
      symbol,
      year: String(new Date().getFullYear()),
      quarter: String(Math.ceil((new Date().getMonth() + 1) / 3)),
    })
    return data || []
  })
}

// ─── Congressional ─────────────────────────────────────────────────

export async function fetchSenateTrades(symbol: string): Promise<CongressionalTrade[]> {
  return getCached<CongressionalTrade[]>(`senate_${symbol}`, CACHE_TTL.CONGRESSIONAL, async () => {
    return fmpFetch<CongressionalTrade[]>('/senate-trades', { symbol })
  })
}

export async function fetchHouseTrades(symbol: string): Promise<CongressionalTrade[]> {
  return getCached<CongressionalTrade[]>(`house_${symbol}`, CACHE_TTL.CONGRESSIONAL, async () => {
    return fmpFetch<CongressionalTrade[]>('/house-trades', { symbol })
  })
}

// ─── Earnings ──────────────────────────────────────────────────────

export async function fetchEarnings(symbol: string): Promise<EarningsReport[]> {
  return getCached<EarningsReport[]>(`earnings_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<EarningsReport[]>('/earnings', { symbol, limit: '12' })
  })
}

export async function fetchEarningsTranscript(symbol: string, year: number, quarter: number): Promise<EarningsTranscript | null> {
  return getCached<EarningsTranscript | null>(`transcript_${symbol}_${year}_Q${quarter}`, CACHE_TTL.TRANSCRIPT, async () => {
    const data = await fmpFetch<EarningsTranscript[]>('/earning-call-transcript', {
      symbol,
      year: String(year),
      quarter: String(quarter),
    })
    return data?.[0] || null
  })
}

// ─── News ──────────────────────────────────────────────────────────

export async function fetchStockNews(symbol: string, limit: number = 20): Promise<StockNews[]> {
  return getCached<StockNews[]>(`news_${symbol}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<StockNews[]>('/news/stock', { symbols: symbol, limit: String(limit) })
  })
}

// ─── Share Float ───────────────────────────────────────────────────

export async function fetchShareFloat(symbol: string): Promise<ShareFloat | null> {
  return getCached<ShareFloat | null>(`float_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<ShareFloat[]>('/shares-float', { symbol })
    return data?.[0] || null
  })
}

// ─── Price Change ──────────────────────────────────────────────────

export async function fetchPriceChange(symbol: string): Promise<StockPriceChange | null> {
  return getCached<StockPriceChange | null>(`price_change_${symbol}`, CACHE_TTL.NEWS, async () => {
    const data = await fmpFetch<StockPriceChange[]>('/stock-price-change', { symbol })
    return data?.[0] || null
  })
}

// ─── ESG ───────────────────────────────────────────────────────────

export async function fetchESG(symbol: string): Promise<ESGRating | null> {
  return getCached<ESGRating | null>(`esg_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<ESGRating[]>('/esg-ratings', { symbol })
    return data?.[0] || null
  })
}

// ═══════════════════════════════════════════════════════════════════
// MARKET DATA (Dashboard için)
// ═══════════════════════════════════════════════════════════════════

export async function fetchMarketDashboard(): Promise<MarketDashboardData> {
  return getStaleWhileRevalidate<MarketDashboardData>(
    'market_dashboard',
    CACHE_TTL.MARKET,
    CACHE_TTL.MARKET * 3,
    async () => {
      const today = new Date().toISOString().split('T')[0]
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Use batch-quote for indexes (same pattern that works for stocks)
      const [
        gainers,
        losers,
        actives,
        treasury,
        calendar,
      ] = await Promise.allSettled([
        fmpFetch<MarketGainerLoser[]>('/biggest-gainers'),
        fmpFetch<MarketGainerLoser[]>('/biggest-losers'),
        fmpFetch<MarketGainerLoser[]>('/most-actives'),
        fmpFetch<TreasuryRate[]>('/treasury-rates', { limit: '1' }),
        fmpFetch<EconomicEvent[]>('/economic-calendar', { from: today, to: futureDate }),
      ])

      // Fetch indexes using batch-quote (same pattern that works for stocks)
      let indexes: IndexQuote[] = []
      try {
        const data = await fmpFetch<unknown>('/batch-quote', { symbols: '^GSPC,^IXIC,^DJI' })
        const items = Array.isArray(data) ? data : (data as Record<string, unknown>).value ?? []
        indexes = (items as Record<string, unknown>[]).map((item) => ({
          symbol: String(item.symbol ?? ''),
          name: String(item.name ?? item.symbol ?? 'Index'),
          price: Number(item.price ?? 0),
          change: Number(item.change ?? 0),
          changesPercentage: Number(item.changesPercentage ?? item.changePercentage ?? 0),
          dayLow: Number(item.dayLow ?? 0),
          dayHigh: Number(item.dayHigh ?? 0),
          yearHigh: Number(item.yearHigh ?? 0),
          yearLow: Number(item.yearLow ?? 0),
          volume: Number(item.volume ?? 0),
          previousClose: Number(item.previousClose ?? 0),
        }))
      } catch (e) {
        logger.warn('Index batch-quote fetch failed', { module: 'fmpBulkClient', error: e })
      }

      // Sector performance via batch-quote of sector ETFs
      let sectorPerformance: SectorPerformance[] = []
      try {
        const sectorETFs = 'XLK,XLV,XLF,XLY,XLC,XLI,XLP,XLE,XLB,XLRE,XLU'
        const sectorNames: Record<string, string> = {
          XLK: 'Teknoloji', XLV: 'Saglik', XLF: 'Finans', XLY: 'Tuketici',
          XLC: 'Iletisim', XLI: 'Sanayi', XLP: 'Savunma', XLE: 'Enerji',
          XLB: 'Hammadde', XLRE: 'Gayrimenkul', XLU: 'Altyapi',
        }
        const data = await fmpFetch<unknown>('/batch-quote', { symbols: sectorETFs })
        const items = Array.isArray(data) ? data : (data as Record<string, unknown>).value ?? []
        sectorPerformance = (items as Record<string, unknown>[]).map((item) => ({
          sector: sectorNames[String(item.symbol)] ?? String(item.symbol),
          changesPercentage: Number(item.changesPercentage ?? item.changePercentage ?? 0),
        }))
      } catch (e) {
        logger.warn('Sector ETFs batch-quote failed', { module: 'fmpBulkClient', error: e })
      }

      // Fetch Fear & Greed index
      let fearGreed: { value: number; classification: string } | null = null
      try {
        // Market risk premium as proxy — currently unused but kept for future
        void 0 // no-op placeholder
      } catch (err) {
        logger.debug('Fear & Greed proxy fetch skipped', { module: 'fmpBulkClient', error: err })
      }

      // Calculate our own Fear & Greed from available data
      const gainerArr = gainers.status === 'fulfilled' ? gainers.value || [] : []
      const loserArr = losers.status === 'fulfilled' ? losers.value || [] : []
      const activeArr = actives.status === 'fulfilled' ? actives.value || [] : []

      // Composite Fear & Greed calculation (5 component, each normalized 0-100)
      // Component 1: Index momentum (-3% to +3% maps to 0-100)
      const indexAvgChange = indexes.length > 0 ? indexes.reduce((s, i) => s + (i.changesPercentage ?? 0), 0) / indexes.length : 0
      const comp1_indexMomentum = Math.max(0, Math.min(100, 50 + indexAvgChange * (50 / 3)))

      // Component 2: Gainer vs Loser strength ratio (normalized)
      const gainerStrength = gainerArr.slice(0, 10).reduce((s, g) => s + Math.abs(g.changesPercentage ?? 0), 0) / Math.max(1, Math.min(10, gainerArr.length))
      const loserStrength = loserArr.slice(0, 10).reduce((s, l) => s + Math.abs(l.changesPercentage ?? 0), 0) / Math.max(1, Math.min(10, loserArr.length))
      const totalStrength = gainerStrength + loserStrength
      const comp2_momentumSpread = totalStrength > 0 ? (gainerStrength / totalStrength) * 100 : 50

      // Component 3: Sector breadth (% of sectors positive)
      const posSectorRatio = sectorPerformance.length > 0 ? sectorPerformance.filter(s => (s.changesPercentage ?? 0) > 0).length / sectorPerformance.length : 0.5
      const comp3_sectorBreadth = posSectorRatio * 100

      // Component 4: Active volume direction (% of most-active stocks up)
      const activeUpRatio = activeArr.length > 0 ? activeArr.filter(a => (a.changesPercentage ?? 0) > 0).length / activeArr.length : 0.5
      const comp4_activeDir = activeUpRatio * 100

      // Component 5: Market breadth — gainer count vs loser count
      const gainerCount = gainerArr.length
      const loserCount = loserArr.length
      const comp5_breadth = (gainerCount + loserCount) > 0 ? (gainerCount / (gainerCount + loserCount)) * 100 : 50

      // Weighted average (each component 0-100)
      const hasIndexData = indexes.length > 0
      const fgIndexScore = Math.round(
        Math.max(0, Math.min(100,
          (hasIndexData ? comp1_indexMomentum * 0.30 : 0) +
          comp2_momentumSpread * (hasIndexData ? 0.25 : 0.35) +
          comp3_sectorBreadth * (hasIndexData ? 0.20 : 0.25) +
          comp4_activeDir * (hasIndexData ? 0.15 : 0.25) +
          comp5_breadth * (hasIndexData ? 0.10 : 0.15)
        ))
      )

      let fgClassification: string
      if (fgIndexScore <= 20) fgClassification = 'EXTREME FEAR'
      else if (fgIndexScore <= 40) fgClassification = 'FEAR'
      else if (fgIndexScore <= 60) fgClassification = 'NEUTRAL'
      else if (fgIndexScore <= 80) fgClassification = 'GREED'
      else fgClassification = 'EXTREME GREED'

      return {
        indexes,
        sectorPerformance,
        topGainers: gainerArr.slice(0, 10),
        topLosers: loserArr.slice(0, 10),
        mostActive: activeArr.slice(0, 10),
        treasury: treasury.status === 'fulfilled' && treasury.value?.[0] ? treasury.value[0] : null,
        economicCalendar: (calendar.status === 'fulfilled' ? calendar.value || [] : []).slice(0, 20),
        fearGreedIndex: fgIndexScore,
        fearGreedLabel: fgClassification,
        // V3 additions - fetched on demand from /api/fmp-terminal/macro
        gdp: [],
        consumerSentiment: [],
        generalNews: [],
        esgBenchmarks: [],
        timestamp: new Date().toISOString(),
      }
    }
  )
}

// ─── Sector Analysis ───────────────────────────────────────────────

export async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
  return getCached<SectorPerformance[]>('sector_performance', CACHE_TTL.SECTOR, async () => {
    // Son is gunu bul (hafta sonu/tatil duzeltme)
    const now = new Date()
    let d = new Date(now)
    // En son is gunune geri git (max 5 gun)
    for (let i = 0; i < 5; i++) {
      const day = d.getUTCDay()
      if (day === 0) d = new Date(d.getTime() - 2 * 86400000) // Pazar -> Cuma
      else if (day === 6) d = new Date(d.getTime() - 1 * 86400000) // Cumartesi -> Cuma
      else break
    }
    const dateStr = d.toISOString().split('T')[0]
    const data = await fmpFetch<SectorPerformance[]>('/sector-performance-snapshot', { date: dateStr })
    // Bos gelirse bir onceki gun dene
    if (!data || data.length === 0) {
      const prev = new Date(d.getTime() - 86400000)
      const prevStr = prev.toISOString().split('T')[0]
      return fmpFetch<SectorPerformance[]>('/sector-performance-snapshot', { date: prevStr })
    }
    return data
  })
}

export async function fetchIndustryPerformance(): Promise<IndustryPerformance[]> {
  return getCached<IndustryPerformance[]>('industry_performance', CACHE_TTL.SECTOR, async () => {
    return fmpFetch<IndustryPerformance[]>('/industry-performance-snapshot', {
      date: new Date().toISOString().split('T')[0],
    })
  })
}

export async function fetchSectorPE(): Promise<SectorPE[]> {
  return getCached<SectorPE[]>('sector_pe', CACHE_TTL.SECTOR, async () => {
    return fmpFetch<SectorPE[]>('/sector-pe-snapshot', {
      date: new Date().toISOString().split('T')[0],
    })
  })
}

// ═══════════════════════════════════════════════════════════════════
// V3: TECHNICAL INDICATORS (9 endpoint)
// ═══════════════════════════════════════════════════════════════════

async function fetchTechnicalIndicator(indicator: string, symbol: string, periodLength: number, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return getCached<TechnicalDataPoint[]>(`tech_${indicator}_${symbol}_${periodLength}_${timeframe}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<TechnicalDataPoint[]>(`/technical-indicators/${indicator}`, {
      symbol,
      periodLength: String(periodLength),
      timeframe,
    })
  })
}

export async function fetchRSI(symbol: string, period: number = 14, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('rsi', symbol, period, timeframe)
}

export async function fetchSMA(symbol: string, period: number = 50, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('sma', symbol, period, timeframe)
}

export async function fetchEMA(symbol: string, period: number = 20, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('ema', symbol, period, timeframe)
}

export async function fetchADX(symbol: string, period: number = 14, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('adx', symbol, period, timeframe)
}

export async function fetchWilliams(symbol: string, period: number = 14, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('williams', symbol, period, timeframe)
}

export async function fetchDEMA(symbol: string, period: number = 20, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('dema', symbol, period, timeframe)
}

export async function fetchTEMA(symbol: string, period: number = 20, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('tema', symbol, period, timeframe)
}

export async function fetchStdDev(symbol: string, period: number = 20, timeframe: string = '1day'): Promise<TechnicalDataPoint[]> {
  return fetchTechnicalIndicator('standardDeviation', symbol, period, timeframe)
}

export async function fetchAllTechnicals(symbol: string): Promise<TechnicalSummary> {
  const [rsi14, sma50, sma200, ema20, adx14, williams14, dema20, tema20, stdDev20] = await Promise.allSettled([
    fetchRSI(symbol, 14),
    fetchSMA(symbol, 50),
    fetchSMA(symbol, 200),
    fetchEMA(symbol, 20),
    fetchADX(symbol, 14),
    fetchWilliams(symbol, 14),
    fetchDEMA(symbol, 20),
    fetchTEMA(symbol, 20),
    fetchStdDev(symbol, 20),
  ])

  const latest = <T extends TechnicalDataPoint>(r: PromiseSettledResult<T[]>, key: string): number | null => {
    if (r.status === 'fulfilled' && r.value?.length > 0) {
      const v = r.value[0][key]
      return typeof v === 'number' ? v : null
    }
    return null
  }

  const rsiVal = latest(rsi14, 'rsi')
  const sma50Val = latest(sma50, 'sma')
  const sma200Val = latest(sma200, 'sma')
  const ema20Val = latest(ema20, 'ema')
  const adxVal = latest(adx14, 'adx')
  const willVal = latest(williams14, 'williams')

  const price = rsi14.status === 'fulfilled' && rsi14.value?.length > 0 ? rsi14.value[0].close : 0

  // Derived signals
  const goldenCross = sma50Val !== null && sma200Val !== null ? sma50Val > sma200Val : false
  const priceAboveEma20 = ema20Val !== null && price > 0 ? price > ema20Val : false

  let rsiSignal: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT' = 'NEUTRAL'
  if (rsiVal !== null) {
    if (rsiVal < 30) rsiSignal = 'OVERSOLD'
    else if (rsiVal > 70) rsiSignal = 'OVERBOUGHT'
  }

  let trendStrength: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN' = 'NEUTRAL'
  if (adxVal !== null && goldenCross !== undefined) {
    if (adxVal > 25 && goldenCross) trendStrength = 'STRONG_UP'
    else if (goldenCross) trendStrength = 'UP'
    else if (adxVal > 25 && !goldenCross) trendStrength = 'STRONG_DOWN'
    else if (!goldenCross) trendStrength = 'DOWN'
  }

  return {
    rsi14: rsiVal,
    sma50: sma50Val,
    sma200: sma200Val,
    ema20: ema20Val,
    adx14: adxVal,
    williams14: willVal,
    dema20: latest(dema20, 'dema'),
    tema20: latest(tema20, 'tema'),
    stdDev20: latest(stdDev20, 'standardDeviation'),
    goldenCross,
    priceAboveEma20,
    rsiSignal,
    trendStrength,
    timestamp: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════
// V3: CALENDAR & EVENTS (5 endpoint)
// ═══════════════════════════════════════════════════════════════════

export async function fetchEarningsCalendar(from: string, to: string): Promise<EarningsCalendarItem[]> {
  return getCached<EarningsCalendarItem[]>(`earnings_cal_${from}_${to}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<EarningsCalendarItem[]>('/earnings-calendar', { from, to })
  })
}

export async function fetchEarningsConfirmed(from: string, to: string): Promise<EarningsCalendarItem[]> {
  return getCached<EarningsCalendarItem[]>(`earnings_conf_${from}_${to}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<EarningsCalendarItem[]>('/earnings-confirmed', { from, to })
  })
}

export async function fetchDividendCalendar(from: string, to: string): Promise<DividendCalendarItem[]> {
  return getCached<DividendCalendarItem[]>(`div_cal_${from}_${to}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<DividendCalendarItem[]>('/dividends-calendar', { from, to })
  })
}

export async function fetchStockSplitCalendar(from: string, to: string): Promise<StockSplitCalendarItem[]> {
  return getCached<StockSplitCalendarItem[]>(`split_cal_${from}_${to}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<StockSplitCalendarItem[]>('/splits-calendar', { from, to })
  })
}

export async function fetchIPOCalendar(from: string, to: string): Promise<IPOCalendarItem[]> {
  return getCached<IPOCalendarItem[]>(`ipo_cal_${from}_${to}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<IPOCalendarItem[]>('/ipos-calendar', { from, to })
  })
}

// ═══════════════════════════════════════════════════════════════════
// V3: DEEP INSTITUTIONAL / 13F (6 endpoint)
// ═══════════════════════════════════════════════════════════════════

export async function fetchInstitutionalFilingsLatest(page: number = 0): Promise<InstitutionalFiling[]> {
  return getCached<InstitutionalFiling[]>(`inst_filings_latest_${page}`, CACHE_TTL.INSTITUTIONAL, async () => {
    return fmpFetch<InstitutionalFiling[]>('/institutional-ownership/latest', { page: String(page), limit: '100' })
  })
}

export async function fetchHolderPerformance(cik: string): Promise<HolderPerformanceSummary | null> {
  return getCached<HolderPerformanceSummary | null>(`holder_perf_${cik}`, CACHE_TTL.INSTITUTIONAL, async () => {
    const data = await fmpFetch<HolderPerformanceSummary[]>('/institutional-ownership/holder-performance-summary', { cik })
    return data?.[0] || null
  })
}

export async function fetchIndustryOwnership(year: number, quarter: number): Promise<IndustryOwnershipSummary[]> {
  return getCached<IndustryOwnershipSummary[]>(`industry_own_${year}_${quarter}`, CACHE_TTL.INSTITUTIONAL, async () => {
    return fmpFetch<IndustryOwnershipSummary[]>('/institutional-ownership/industry-summary', {
      year: String(year),
      quarter: String(quarter),
    })
  })
}

export async function fetchInstitutionalPortfolio(cik: string): Promise<InstitutionalFiling[]> {
  return getCached<InstitutionalFiling[]>(`inst_portfolio_${cik}`, CACHE_TTL.INSTITUTIONAL, async () => {
    return fmpFetch<InstitutionalFiling[]>('/institutional-ownership/portfolio-summary', { cik })
  })
}

export async function fetchInsiderTradingRSS(): Promise<InsiderTrade[]> {
  return getCached<InsiderTrade[]>('insider_rss', 60 * 1000, async () => {
    return fmpFetch<InsiderTrade[]>('/insider-trading-rss')
  })
}

export async function fetchDetailedPositions(symbol: string): Promise<InstitutionalFiling[]> {
  return getCached<InstitutionalFiling[]>(`inst_positions_${symbol}`, CACHE_TTL.INSTITUTIONAL, async () => {
    return fmpFetch<InstitutionalFiling[]>('/institutional-ownership/positions', { symbol })
  })
}

// ═══════════════════════════════════════════════════════════════════
// V3: COMPANY INTELLIGENCE (8 endpoint)
// ═══════════════════════════════════════════════════════════════════

export async function fetchStockPeers(symbol: string): Promise<string[]> {
  return getCached<string[]>(`peers_${symbol}`, CACHE_TTL.BULK, async () => {
    const data = await fmpFetch<StockPeer[]>('/stock-peers', { symbol })
    return data?.[0]?.peersList || []
  })
}

export async function fetchExecutives(symbol: string): Promise<CompanyExecutive[]> {
  return getCached<CompanyExecutive[]>(`executives_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<CompanyExecutive[]>('/key-executives', { symbol })
  })
}

export async function fetchExecutiveCompensation(symbol: string): Promise<ExecutiveCompensation[]> {
  return getCached<ExecutiveCompensation[]>(`exec_comp_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<ExecutiveCompensation[]>('/governance-executive-compensation', { symbol })
  })
}

export async function fetchEmployeeCount(symbol: string): Promise<EmployeeCount[]> {
  return getCached<EmployeeCount[]>(`employee_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<EmployeeCount[]>('/historical-employee-count', { symbol })
  })
}

export async function fetchHistoricalMarketCap(symbol: string): Promise<HistoricalMarketCap[]> {
  return getCached<HistoricalMarketCap[]>(`hist_mcap_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<HistoricalMarketCap[]>('/historical-market-capitalization', { symbol })
  })
}

export async function fetchMergersAcquisitions(name: string): Promise<MergerAcquisition[]> {
  return getCached<MergerAcquisition[]>(`ma_${name}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<MergerAcquisition[]>('/mergers-acquisitions-search', { name })
  })
}

export async function fetchPressReleases(symbol: string, limit: number = 10): Promise<PressRelease[]> {
  return getCached<PressRelease[]>(`press_${symbol}`, CACHE_TTL.NEWS, async () => {
    return fmpFetch<PressRelease[]>('/press-releases', { symbol, limit: String(limit) })
  })
}

// ═══════════════════════════════════════════════════════════════════
// V3: MACRO & INDEX DATA (11 endpoint)
// ═══════════════════════════════════════════════════════════════════

export async function fetchSP500Constituents(): Promise<IndexConstituent[]> {
  return getCached<IndexConstituent[]>('sp500_constituents', CACHE_TTL.BULK, async () => {
    return fmpFetch<IndexConstituent[]>('/sp500-constituent')
  })
}

export async function fetchNASDAQConstituents(): Promise<IndexConstituent[]> {
  return getCached<IndexConstituent[]>('nasdaq_constituents', CACHE_TTL.BULK, async () => {
    return fmpFetch<IndexConstituent[]>('/nasdaq-constituent')
  })
}

export async function fetchDowJonesConstituents(): Promise<IndexConstituent[]> {
  return getCached<IndexConstituent[]>('dowjones_constituents', CACHE_TTL.BULK, async () => {
    return fmpFetch<IndexConstituent[]>('/dowjones-constituent')
  })
}

export async function fetchAftermarketQuote(symbol: string): Promise<AftermarketQuote | null> {
  return getCached<AftermarketQuote | null>(`aftermarket_${symbol}`, 60 * 1000, async () => {
    const data = await fmpFetch<AftermarketQuote[]>('/aftermarket-quote', { symbol })
    return data?.[0] || null
  })
}

export async function fetchBatchAftermarketQuotes(symbols: string[]): Promise<AftermarketQuote[]> {
  return getCached<AftermarketQuote[]>(`aftermarket_batch_${symbols.slice(0,5).join(',')}`, 60 * 1000, async () => {
    return fmpFetch<AftermarketQuote[]>('/batch-aftermarket-quote', { symbols: symbols.join(',') })
  })
}

export async function fetchDetailedQuote(symbol: string): Promise<IndexQuote | null> {
  return getCached<IndexQuote | null>(`quote_detail_${symbol}`, 30 * 1000, async () => {
    const data = await fmpFetch<IndexQuote[]>('/quote', { symbol })
    return data?.[0] || null
  })
}

export async function fetchGDP(): Promise<GDPData[]> {
  return getCached<GDPData[]>('gdp_data', CACHE_TTL.BULK, async () => {
    // /gdp endpoint Stable API'de yok. /economic-calendar'dan GDP eventlerini filtrele
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
    const events = await fmpFetch<EconomicCalendarEvent[]>('/economic-calendar', { from: fromDate, to: toDate })
    if (!Array.isArray(events)) return []
    // GDP eventlerini filtrele (US only) ve GDPData formatina cevir
    return events
      .filter(e => e.country === 'US' && e.event && /GDP/i.test(e.event) && e.actual != null)
      .slice(0, 20)
      .map(e => ({
        date: e.date?.split(' ')[0] || '',
        value: e.actual ?? e.estimate ?? 0,
        name: e.event || 'GDP',
      }))
  })
}

export async function fetchConsumerSentiment(): Promise<ConsumerSentiment[]> {
  return getCached<ConsumerSentiment[]>('consumer_sentiment', CACHE_TTL.BULK, async () => {
    // /consumer-sentiment endpoint Stable API'de yok. /economic-calendar'dan filtrele
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
    const events = await fmpFetch<EconomicCalendarEvent[]>('/economic-calendar', { from: fromDate, to: toDate })
    if (!Array.isArray(events)) return []
    return events
      .filter(e => e.country === 'US' && e.event && /Consumer (Confidence|Sentiment)/i.test(e.event) && e.actual != null)
      .slice(0, 20)
      .map(e => ({
        date: e.date?.split(' ')[0] || '',
        value: e.actual ?? e.estimate ?? 0,
        name: e.event || 'Consumer Sentiment',
      }))
  })
}

export async function fetchGeneralNews(limit: number = 20): Promise<GeneralNews[]> {
  return getCached<GeneralNews[]>('general_news', CACHE_TTL.NEWS, async () => {
    // /news/general Stable API'de yok. /fmp-articles kullan
    const articles = await fmpFetch<FmpArticle[]>('/fmp-articles', { page: '0', limit: String(limit) })
    if (!Array.isArray(articles)) return []
    return articles.map(a => ({
      publishedDate: a.date || '',
      title: a.title || '',
      text: (a.content || '').replace(/<[^>]+>/g, '').slice(0, 300),
      url: a.link || '',
      image: a.image || '',
      site: a.site || a.author || 'FMP',
      symbol: a.tickers || '',
    }))
  })
}

export async function fetchESGBenchmark(): Promise<ESGBenchmark[]> {
  return getCached<ESGBenchmark[]>('esg_benchmark', CACHE_TTL.BULK, async () => {
    return fmpFetch<ESGBenchmark[]>('/esg-benchmark')
  })
}

export async function fetchETFStockExposure(symbol: string): Promise<ETFStockExposure[]> {
  return getCached<ETFStockExposure[]>(`etf_exposure_${symbol}`, CACHE_TTL.BULK, async () => {
    return fmpFetch<ETFStockExposure[]>('/etf-stock-exposure', { symbol })
  })
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITE: All Bulk Data in One Call
// ═══════════════════════════════════════════════════════════════════

export interface AllBulkData {
  profiles: Map<string, CompanyProfile>
  keyMetrics: Map<string, KeyMetricsTTM>
  ratios: Map<string, RatiosTTM>
  scores: Map<string, FinancialScores>
  dcf: Map<string, DCFValuation>
  analystConsensus: Map<string, AnalystConsensus>
  priceTargets: Map<string, PriceTarget>
  earningsSurprises: Map<string, EarningsSurprise[]>
  timestamp: string
}

export async function fetchAllBulkData(): Promise<AllBulkData> {
  console.log('[FMP Terminal] Starting bulk data refresh...')
  const start = Date.now()

  const [
    profilesRaw,
    metricsRaw,
    ratiosRaw,
    scoresRaw,
    dcfRaw,
    ratingsRaw,
    targetsRaw,
    surprisesRaw,
  ] = await Promise.allSettled([
    fetchBulkProfiles(),
    fetchBulkKeyMetricsTTM(),
    fetchBulkRatiosTTM(),
    fetchBulkScores(),
    fetchBulkDCF(),
    fetchBulkRatings(),
    fetchBulkPriceTargetSummary(),
    fetchBulkEarningsSurprises(),
  ])

  const toMap = <T extends { symbol: string }>(result: PromiseSettledResult<T[]>): Map<string, T> => {
    const map = new Map<string, T>()
    if (result.status === 'fulfilled' && result.value) {
      for (const item of result.value) {
        if (item.symbol) map.set(item.symbol, item)
      }
    }
    return map
  }

  // Earnings surprises are grouped by symbol (multiple quarters)
  const surprisesMap = new Map<string, EarningsSurprise[]>()
  if (surprisesRaw.status === 'fulfilled' && surprisesRaw.value) {
    for (const s of surprisesRaw.value) {
      const list = surprisesMap.get(s.symbol) || []
      list.push(s)
      surprisesMap.set(s.symbol, list)
    }
  }

  const elapsed = Date.now() - start
  console.log(`[FMP Terminal] Bulk data refresh completed in ${elapsed}ms`)

  const result: AllBulkData = {
    profiles: toMap(profilesRaw),
    keyMetrics: toMap(metricsRaw),
    ratios: toMap(ratiosRaw),
    scores: toMap(scoresRaw),
    dcf: toMap(dcfRaw),
    analystConsensus: toMap(ratingsRaw),
    priceTargets: toMap(targetsRaw),
    earningsSurprises: surprisesMap,
    timestamp: new Date().toISOString(),
  }

  // Save composite to cache
  setMemoryCache('all_bulk_data', result)
  await setDiskCache('all_bulk_data', {
    ...result,
    profiles: Object.fromEntries(result.profiles),
    keyMetrics: Object.fromEntries(result.keyMetrics),
    ratios: Object.fromEntries(result.ratios),
    scores: Object.fromEntries(result.scores),
    dcf: Object.fromEntries(result.dcf),
    analystConsensus: Object.fromEntries(result.analystConsensus),
    priceTargets: Object.fromEntries(result.priceTargets),
    earningsSurprises: Object.fromEntries(result.earningsSurprises),
  })

  return result
}
