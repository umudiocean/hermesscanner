// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - TypeScript Type Definitions
// Tüm FMP API veri tipleri + Skor sistemi tipleri
// ═══════════════════════════════════════════════════════════════════

// ─── Score System ──────────────────────────────────────────────────

export type FMPScoreLevel = 'STRONG' | 'GOOD' | 'NEUTRAL' | 'WEAK' | 'BAD'

export interface FMPScoreBreakdown {
  valuation: number       // 0-100 (agirlik: 22%)
  health: number          // 0-100 (agirlik: 20%)
  growth: number          // 0-100 (agirlik: 14%)
  analyst: number         // 0-100 (agirlik: 11%)
  quality: number         // 0-100 (agirlik: 12%)
  momentum: number        // 0-100 (agirlik: 11%)
  sector: number          // 0-100 (agirlik: 5%)
  smartMoney: number      // 0-100 (agirlik: 5%) — Insider+Inst+Congress birlesti
}

export interface FMPScore {
  total: number           // 0-100
  level: FMPScoreLevel
  categories: FMPScoreBreakdown
  redFlags: RedFlag[]
  confidence: number      // Veri tamligi 0-100%
  gated: boolean          // Altman Z < 1.8 gate aktif mi?
  degraded: boolean       // confidence < 50 ise true
  missingInputs: string[] // Eksik veri kategorileri
  badges: StockBadge[]    // V5 badge sistemi
  overvaluation: OvervaluationResult  // V5 short sinyal motoru
  valuationScore: number  // V5 valuation composite 0-100
  valuationLabel: ValuationLabel  // V5 valuation label
  timestamp: string
}

export interface RedFlag {
  severity: 'critical' | 'warning'
  category: string
  message: string
  value?: number
}

// ─── Company Profile ───────────────────────────────────────────────

export interface CompanyProfile {
  symbol: string
  companyName: string
  currency: string
  exchange: string
  exchangeShortName: string
  price: number
  mktCap: number
  changes: number
  changesPercentage: number
  beta: number
  volAvg: number
  lastDiv: number
  range: string           // "123.45-234.56" (52W range)
  sector: string
  industry: string
  country: string
  ipoDate: string
  isEtf: boolean
  isActivelyTrading: boolean
  description: string
  ceo: string
  fullTimeEmployees: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  website: string
  image: string           // Logo URL
  dcf: number
  dcfDiff: number
  // Computed
  dcfUpside?: number      // (dcf - price) / price * 100
}

// ─── Financial Statements ──────────────────────────────────────────

export interface IncomeStatement {
  date: string
  symbol: string
  period: string          // 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
  revenue: number
  costOfRevenue: number
  grossProfit: number
  grossProfitRatio?: number
  operatingExpenses: number
  operatingIncome: number
  operatingIncomeRatio?: number
  netIncome: number
  netIncomeRatio?: number
  eps: number
  epsDiluted: number
  ebitda: number
  researchAndDevelopmentExpenses: number
  sellingGeneralAndAdministrativeExpenses: number
  weightedAverageShsOut: number
  weightedAverageShsOutDil: number
}

export interface BalanceSheet {
  date: string
  symbol: string
  period: string
  totalAssets: number
  totalCurrentAssets: number
  totalCurrentLiabilities: number
  totalLiabilities: number
  totalStockholdersEquity: number
  totalDebt: number
  netDebt: number
  cashAndCashEquivalents: number
  cashAndShortTermInvestments: number
  inventory: number
  goodwill: number
  intangibleAssets: number
  longTermDebt: number
  shortTermDebt: number
  commonStock: number
  retainedEarnings: number
}

export interface CashFlowStatement {
  date: string
  symbol: string
  period: string
  operatingCashFlow: number
  capitalExpenditure: number
  freeCashFlow: number
  netCashUsedForInvestingActivites: number
  netCashUsedProvidedByFinancingActivities: number
  dividendsPaid: number
  stockBasedCompensation: number
  depreciationAndAmortization: number
  netChangeInCash: number
  commonStockRepurchased: number
}

// ─── Key Metrics & Ratios ──────────────────────────────────────────

export interface KeyMetricsTTM {
  symbol: string
  peRatioTTM: number
  pbRatioTTM: number
  ptbRatioTTM?: number
  priceToSalesRatioTTM: number
  evToEBITDATTM?: number
  enterpriseValueOverEBITDATTM: number
  evToOperatingCashFlowTTM?: number
  debtToEquityTTM: number
  debtToAssetsTTM?: number
  currentRatioTTM: number
  interestCoverageTTM: number
  roeTTM: number
  roaTTM?: number
  returnOnCapitalEmployedTTM?: number
  roicTTM?: number
  dividendYieldTTM: number
  dividendPerShareTTM?: number
  payoutRatioTTM?: number
  revenuePerShareTTM: number
  netIncomePerShareTTM: number
  freeCashFlowPerShareTTM: number
  bookValuePerShareTTM: number
  marketCapTTM: number
  enterpriseValueTTM: number
  peRatio?: number
  pegRatio?: number
  priceToFreeCashFlowsTTM?: number
  operatingCashFlowPerShareTTM?: number
}

export interface RatiosTTM {
  symbol: string
  grossProfitMarginTTM: number
  operatingProfitMarginTTM: number
  netProfitMarginTTM: number
  returnOnEquityTTM: number
  returnOnAssetsTTM: number
  currentRatioTTM: number
  quickRatioTTM?: number
  debtEquityRatioTTM: number
  interestCoverageTTM?: number
  assetTurnoverTTM?: number
  inventoryTurnoverTTM?: number
  receivablesTurnoverTTM?: number
  freeCashFlowOperatingCashFlowRatioTTM?: number
  priceEarningsRatioTTM: number
  priceToBookRatioTTM: number
  priceToSalesRatioTTM: number
  dividendYieldTTM: number
  payoutRatioTTM?: number
  priceToFreeCashFlowsRatioTTM?: number
  enterpriseValueMultipleTTM?: number
  priceFairValueTTM?: number
}

// ─── Financial Scores (Altman Z, Piotroski) ────────────────────────

export interface FinancialScores {
  symbol: string
  altmanZScore: number
  piotroskiScore: number
  workingCapital?: number
  totalAssets?: number
  retainedEarnings?: number
  ebit?: number
  marketCap?: number
  totalLiabilities?: number
  revenue?: number
}

// ─── DCF Valuation ─────────────────────────────────────────────────

export interface DCFValuation {
  symbol: string
  date: string
  dcf: number
  stockPrice: number
}

// ─── Analyst Data ──────────────────────────────────────────────────

export interface AnalystConsensus {
  symbol: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  consensus: string       // 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
}

export interface PriceTarget {
  symbol: string
  targetHigh: number
  targetLow: number
  targetConsensus: number
  targetMedian: number
}

export interface StockGrade {
  symbol: string
  date: string
  gradingCompany: string
  previousGrade: string
  newGrade: string
}

export interface AnalystEstimate {
  symbol: string
  date: string
  estimatedRevenueAvg: number
  estimatedRevenueHigh: number
  estimatedRevenueLow: number
  estimatedEpsAvg: number
  estimatedEpsHigh: number
  estimatedEpsLow: number
  numberAnalystEstimatedRevenue: number
  numberAnalystsEstimatedEps: number
}

// ─── Insider Trades ────────────────────────────────────────────────

export interface InsiderTrade {
  symbol: string
  filingDate: string
  transactionDate: string
  reportingName: string
  typeOfOwner: string     // 'officer' | 'director' | 'ten percent owner'
  acquistionOrDisposition: string  // 'A' | 'D'
  transactionType: string // 'P-Purchase' | 'S-Sale' | 'M-Exercise' etc.
  securitiesTransacted: number
  price: number
  securitiesOwned: number
  link: string
}

export interface InsiderStatistics {
  symbol: string
  year: number
  quarter: number
  purchases: number
  sales: number
  buySellRatio: number
  totalBought: number
  totalSold: number
  averageBought: number
  averageSold: number
}

// ─── Institutional Ownership ───────────────────────────────────────

export interface InstitutionalHolder {
  holder: string
  shares: number
  dateReported: string
  change: number
  changePercentage?: number
  weight?: number
}

export interface InstitutionalSummary {
  symbol: string
  investorsHolding: number
  lastQuarterInvestors?: number
  investorsHoldingChange?: number
  numberOf13Fshares: number
  lastQuarter13FShares?: number
  put13FShares?: number
  call13FShares?: number
}

// ─── Congressional Trades ──────────────────────────────────────────

export interface CongressionalTrade {
  firstName: string
  lastName: string
  office?: string
  link: string
  dateRecieved: string
  transactionDate: string
  owner: string
  assetDescription: string
  assetType: string
  type: string            // 'purchase' | 'sale' | 'sale_partial' | 'sale_full'
  amount: string          // '$1,001 - $15,000' etc.
  symbol: string
  party?: string
  district?: string
  state?: string
}

// ─── Earnings ──────────────────────────────────────────────────────

export interface EarningsReport {
  date: string
  symbol: string
  epsEstimated: number
  epsActual: number | null
  revenueEstimated: number
  revenueActual: number | null
  fiscalDateEnding: string
  updatedFromDate?: string
}

export interface EarningsSurprise {
  symbol: string
  date: string
  epsEstimated: number
  epsActual: number
  epsSurprise?: number
  revenueEstimated: number
  revenueActual: number
}

// ─── News ──────────────────────────────────────────────────────────

export interface StockNews {
  symbol: string
  publishedDate: string
  title: string
  image: string
  site: string
  text: string
  url: string
}

// ─── Sector Performance ────────────────────────────────────────────

export interface SectorPerformance {
  sector: string
  changesPercentage: number
}

export interface IndustryPerformance {
  industry: string
  changesPercentage: number
  exchange?: string
}

export interface SectorPE {
  date: string
  sector: string
  pe: number
}

// ─── Market Overview ───────────────────────────────────────────────

export interface MarketGainerLoser {
  symbol: string
  name: string
  change: number
  price: number
  changesPercentage: number
}

export interface IndexQuote {
  symbol: string
  name: string
  price: number
  changesPercentage: number
  change: number
  dayLow: number
  dayHigh: number
  yearHigh: number
  yearLow: number
  volume: number
  previousClose: number
}

// ─── Treasury & Economics ──────────────────────────────────────────

export interface TreasuryRate {
  date: string
  month1: number
  month2: number
  month3: number
  month6: number
  year1: number
  year2: number
  year3: number
  year5: number
  year7: number
  year10: number
  year20: number
  year30: number
}

export interface EconomicIndicator {
  date: string
  value: number
}

export interface EconomicEvent {
  event: string
  date: string
  country: string
  actual: number | null
  previous: number | null
  change: number | null
  changePercentage: number | null
  estimate: number | null
  impact: string
}

// ─── ESG ───────────────────────────────────────────────────────────

export interface ESGRating {
  symbol: string
  cik: string
  companyName: string
  environmentalScore: number
  socialScore: number
  governanceScore: number
  ESGScore: number
  date: string
}

// ─── Share Float ───────────────────────────────────────────────────

export interface ShareFloat {
  symbol: string
  freeFloat: number
  floatShares: number
  outstandingShares: number
  date: string
}

// ─── Stock Price Change ────────────────────────────────────────────

export interface StockPriceChange {
  symbol: string
  '1D': number
  '5D': number
  '1M': number
  '3M': number
  '6M': number
  ytd: number
  '1Y': number
  '3Y': number
  '5Y': number
  '10Y': number
  max: number
}

// ─── Revenue Segmentation ──────────────────────────────────────────

export interface RevenueSegment {
  [product: string]: number
}

export interface RevenueGeographic {
  [region: string]: number
}

// ─── Earnings Transcript ───────────────────────────────────────────

export interface EarningsTranscript {
  symbol: string
  quarter: number
  year: number
  date: string
  content: string
}

// ─── Combined Stock Data (on-demand) ──────────────────────────────

export interface StockDetailData {
  profile: CompanyProfile | null
  keyMetrics: KeyMetricsTTM | null
  ratios: RatiosTTM | null
  scores: FinancialScores | null
  dcf: DCFValuation | null
  analystConsensus: AnalystConsensus | null
  priceTarget: PriceTarget | null
  insiderTrades: InsiderTrade[]
  insiderStats: InsiderStatistics | null
  institutionalSummary: InstitutionalSummary | null
  institutionalHolders: InstitutionalHolder[]
  congressionalTrades: CongressionalTrade[]
  earnings: EarningsReport[]
  earningsSurprises: EarningsSurprise[]
  news: StockNews[]
  grades: StockGrade[]
  estimates: AnalystEstimate[]
  incomeStatements: IncomeStatement[]
  balanceSheets: BalanceSheet[]
  cashFlowStatements: CashFlowStatement[]
  priceChange: StockPriceChange | null
  shareFloat: ShareFloat | null
  esg: ESGRating | null
  fmpScore: FMPScore | null
  // V3 additions
  technicalSummary: TechnicalSummary | null
  peers: string[]
  executives: CompanyExecutive[]
  executiveCompensation: ExecutiveCompensation[]
  employeeHistory: EmployeeCount[]
  historicalMarketCap: HistoricalMarketCap[]
  mergersAcquisitions: MergerAcquisition[]
  pressReleases: PressRelease[]
  indexMembership: string[]     // ['SP500', 'NDX100', etc.]
  etfExposure: ETFStockExposure[]
}

// ─── Bulk Data (pre-computed) ──────────────────────────────────────

export interface BulkStockSummary {
  symbol: string
  companyName: string
  sector: string
  industry: string
  mktCap: number
  price: number
  changes: number
  changesPercentage: number
  beta: number
  // Key metrics
  pe: number
  pb: number
  evEbitda: number
  roe: number
  debtEquity: number
  currentRatio: number
  dividendYield: number
  freeCashFlowPerShare: number
  // Scores
  altmanZ: number
  piotroski: number
  // DCF
  dcf: number
  dcfDiff: number
  // FMP Score
  fmpScore: FMPScore | null
}

// ─── Market Dashboard Data ─────────────────────────────────────────

export interface MarketDashboardData {
  indexes: IndexQuote[]
  sectorPerformance: SectorPerformance[]
  topGainers: MarketGainerLoser[]
  topLosers: MarketGainerLoser[]
  mostActive: MarketGainerLoser[]
  treasury: TreasuryRate | null
  economicCalendar: EconomicEvent[]
  fearGreedIndex: number
  fearGreedLabel: string
  // V3 additions
  gdp: GDPData[]
  consumerSentiment: ConsumerSentiment[]
  generalNews: GeneralNews[]
  esgBenchmarks: ESGBenchmark[]
  timestamp: string
}

// ─── Comparison Data ───────────────────────────────────────────────

export interface ComparisonItem {
  symbol: string
  companyName: string
  sector: string
  price: number
  changesPercentage: number
  pe: number
  pb: number
  roe: number
  debtEquity: number
  revenueGrowth: number
  epsGrowth: number
  dcfUpside: number
  fmpScore: FMPScore | null
}

// ─── Score Engine Config ───────────────────────────────────────────

export const FMP_SCORE_WEIGHTS = {
  valuation: 0.22,
  health: 0.20,
  growth: 0.14,
  analyst: 0.11,
  quality: 0.12,
  momentum: 0.11,
  sector: 0.05,
  smartMoney: 0.05,
} as const

/** Sabit sinyal esikleri (2026-02-18 KILITLI) */
export interface ScoreThresholds {
  strong: number   // >= 75 = STRONG
  good: number     // >= 60 = GOOD
  weak: number     // <= 39 = WEAK
  bad: number      // <= 24 = BAD
}

/** Sabit esikler — piyasa kosulundan bagimsiz, tutarli sinyal */
export const FIXED_SCORE_THRESHOLDS: ScoreThresholds = {
  strong: 75,  // 75-100: STRONG
  good: 60,    // 60-74:  GOOD
  weak: 39,    // 25-39:  WEAK
  bad: 24,     // 0-24:   BAD
} as const

/** Geriye uyumluluk icin eski fonksiyon — artik sabit deger doner */
export function computeScoreThresholds(_allScores: number[]): ScoreThresholds {
  return { ...FIXED_SCORE_THRESHOLDS }
}

/** Puana gore sinyal seviyesi doner. Sabit esikler. */
export function getScoreLevel(score: number, _thresholds?: ScoreThresholds): FMPScoreLevel {
  if (score >= 75) return 'STRONG'
  if (score >= 60) return 'GOOD'
  if (score >= 40) return 'NEUTRAL'
  if (score >= 25) return 'WEAK'
  return 'BAD'
}

export function getScoreColor(level: FMPScoreLevel): string {
  switch (level) {
    case 'STRONG': return 'text-yellow-400'
    case 'GOOD': return 'text-emerald-400'
    case 'NEUTRAL': return 'text-slate-400'
    case 'WEAK': return 'text-orange-400'
    case 'BAD': return 'text-red-400'
  }
}

export function getScoreBgColor(level: FMPScoreLevel): string {
  switch (level) {
    case 'STRONG': return 'bg-yellow-500/20 border-yellow-500/30'
    case 'GOOD': return 'bg-emerald-500/20 border-emerald-500/30'
    case 'NEUTRAL': return 'bg-slate-500/20 border-slate-500/30'
    case 'WEAK': return 'bg-orange-500/20 border-orange-500/30'
    case 'BAD': return 'bg-red-500/20 border-red-500/30'
  }
}

export function getScoreGradient(level: FMPScoreLevel): string {
  switch (level) {
    case 'STRONG': return 'from-yellow-400 to-amber-500'
    case 'GOOD': return 'from-emerald-400 to-green-500'
    case 'NEUTRAL': return 'from-slate-400 to-gray-500'
    case 'WEAK': return 'from-orange-400 to-amber-600'
    case 'BAD': return 'from-red-500 to-rose-600'
  }
}

export function getScoreGlow(level: FMPScoreLevel): string {
  switch (level) {
    case 'STRONG': return 'shadow-yellow-500/20'
    case 'GOOD': return 'shadow-emerald-500/20'
    case 'NEUTRAL': return 'shadow-slate-500/10'
    case 'WEAK': return 'shadow-orange-500/20'
    case 'BAD': return 'shadow-red-500/20'
  }
}

// ─── Technical Indicators ─────────────────────────────────────────

export interface TechnicalDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  [key: string]: number | string  // indicator value (rsi, sma, ema, etc.)
}

export interface TechnicalSummary {
  rsi14: number | null
  sma50: number | null
  sma200: number | null
  ema20: number | null
  adx14: number | null
  williams14: number | null
  dema20: number | null
  tema20: number | null
  stdDev20: number | null
  // Derived signals
  goldenCross: boolean        // SMA50 > SMA200
  priceAboveEma20: boolean    // price > EMA20
  rsiSignal: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT'
  trendStrength: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN'
  timestamp: string
}

// ─── Calendar & Events ────────────────────────────────────────────

export interface EarningsCalendarItem {
  date: string
  symbol: string
  eps: number | null
  epsEstimated: number | null
  revenue: number | null
  revenueEstimated: number | null
  time: string               // 'bmo' | 'amc' | 'dmh' (before/after/during market hours)
  fiscalDateEnding: string
  updatedFromDate?: string
}

export interface DividendCalendarItem {
  date: string                // ex-dividend date
  symbol: string
  label: string
  adjDividend: number
  dividend: number
  recordDate: string
  paymentDate: string
  declarationDate: string
}

export interface StockSplitCalendarItem {
  date: string
  symbol: string
  numerator: number
  denominator: number
}

export interface IPOCalendarItem {
  date: string
  company: string
  symbol: string
  exchange: string
  actions: string
  shares: number | null
  priceRange: string
  marketCap: number | null
}

// ─── Deep Institutional (13F) ─────────────────────────────────────

export interface InstitutionalFiling {
  cik: string
  filingDate: string
  investorName: string
  symbol: string
  securityName: string
  sharesNumber: number
  sharesNumberChange?: number
  marketValue: number
  avgPricePaid?: number
  ownership: number
  lastOwnership?: number
  changeInOwnership?: number
  isNew: boolean
  isSoldOut: boolean
  isCountedForNewOrSoldOut?: boolean
}

export interface HolderPerformanceSummary {
  investorName: string
  cik: string
  performancePercentage: number
  averageHoldingPeriod?: number
  turnoverPercentage?: number
  totalValue?: number
  numberOfStocks?: number
}

export interface IndustryOwnershipSummary {
  industry: string
  totalInvestors: number
  totalShares: number
  totalValue: number
  changeInShares?: number
  changeInValue?: number
}

// ─── Company Intelligence ─────────────────────────────────────────

export interface StockPeer {
  symbol: string
  peersList: string[]
}

export interface CompanyExecutive {
  title: string
  name: string
  pay: number | null
  currencyPay: string
  gender: string
  yearBorn: number | null
  titleSince: string | null
}

export interface ExecutiveCompensation {
  symbol: string
  cik: string
  companyName: string
  filingDate: string
  acceptedDate: string
  nameAndPosition: string
  year: number
  salary: number
  bonus: number
  stockAward: number
  optionAward: number
  incentivePlanCompensation: number
  allOtherCompensation: number
  total: number
  url: string
}

export interface EmployeeCount {
  symbol: string
  cik: string
  acceptanceTime: string
  periodOfReport: string
  companyName: string
  formType: string
  filingDate: string
  employeeCount: number
  source: string
}

export interface HistoricalMarketCap {
  symbol: string
  date: string
  marketCap: number
}

export interface MergerAcquisition {
  companyName: string
  targetedCompanyName: string
  transactionDate: string
  acceptanceTime?: string
  url: string
}

export interface PressRelease {
  symbol: string
  date: string
  title: string
  text: string
}

// ─── Macro & Index Data ───────────────────────────────────────────

export interface IndexConstituent {
  symbol: string
  name: string
  sector: string
  subSector?: string
  headQuarter?: string
  dateFirstAdded?: string
  cik?: string
  founded?: string
}

export interface AftermarketQuote {
  symbol: string
  price: number
  changesPercentage: number
  change: number
  volume?: number
  timestamp?: string
}

export interface GDPData {
  date: string
  value: number
  name?: string
}

export interface ConsumerSentiment {
  date: string
  value: number
  name?: string
}

export interface GeneralNews {
  publishedDate: string
  title: string
  image: string
  site: string
  text: string
  url: string
  symbol?: string
}

export interface ESGBenchmark {
  year: number
  sector: string
  environmentalScore: number
  socialScore: number
  governanceScore: number
  ESGScore: number
}

export interface ETFStockExposure {
  etfSymbol: string
  assetExposure: string   // stock symbol
  sharesNumber: number
  weightPercentage: number
  marketValue: number
}

// ─── HERMES AI Score Labels ────────────────────────────────────

export const SCORE_LABELS: Record<FMPScoreLevel, string> = {
  STRONG: 'GUCLU',
  GOOD: 'IYI',
  NEUTRAL: 'NOTR',
  WEAK: 'ZAYIF',
  BAD: 'KOTU',
}

export const CATEGORY_LABELS: Record<keyof FMPScoreBreakdown, string> = {
  valuation: 'Degerleme',
  health: 'Finansal Saglik',
  growth: 'Buyume',
  analyst: 'Analist Gorusu',
  quality: 'Kalite',
  momentum: 'Momentum',
  sector: 'Sektor Momentum',
  smartMoney: 'Akilli Para',
}

// V5 Badge types
export type BadgeType =
  | 'KAZANC_GUCLU' | 'KAZANC_ZAYIF'
  | 'BUBBLE_RISKI' | 'SQUEEZE_RISKI'
  | 'AKIN_YUKSELIS' | 'AKIN_DUSUS'
  | 'HEDEF_YUKARI' | 'HEDEF_ASAGI'
  | 'GENIS_MOAT' | 'DAR_MOAT'
  | 'VALUE_TRAP'

export interface StockBadge {
  type: BadgeType
  label: string
  color: string
  tooltip?: string
}

export type ValuationLabel = 'COK UCUZ' | 'UCUZ' | 'NORMAL' | 'PAHALI' | 'COK PAHALI'

export interface OvervaluationResult {
  score: number
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  triggers: string[]
}
