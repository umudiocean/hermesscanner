// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Terminal Stocks API
// GET /api/europe-terminal/stocks?exchange=LSE (optional filter)
// Same scoring engine as NASDAQ, filtered for European symbols
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCached, CACHE_TTL } from '@/lib/fmp-terminal/fmp-cache'
import { getEuropeSymbols, fetchEuropeSymbolsFromFMP } from '@/lib/europe-symbols'
import { getExchangeFromSymbol, EuropeExchangeId, EUROPE_EXCHANGES } from '@/lib/europe-config'
import { promises as fs } from 'fs'
import path from 'path'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

import {
  computeFMPScore, scoreAllStocks, buildSectorPeerData,
  createDefaultInput, computeRiskScore,
  ScoreInputMetrics, RiskScore
} from '@/lib/fmp-terminal/fmp-score-engine'
import { FMPScore, RedFlag, computeScoreThresholds, StockBadge, OvervaluationResult } from '@/lib/fmp-terminal/fmp-types'
import { computeEuropeTargetFloor } from '@/lib/europe-target-engine'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const SECTORS_FILE = path.join(process.cwd(), 'data', 'europe-sectors.json')

function getApiKey(): string {
  const key = process.env.FMP_API_KEY
  if (!key) throw new Error('API configuration error')
  return key
}

async function fmpFetch(endpoint: string, params: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${FMP_BASE}${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return fetch(url.toString(), { headers: { 'apikey': getApiKey() }, cache: 'no-store' })
}

interface EuropeStockRow {
  symbol: string
  companyName: string
  sector: string
  exchange: string
  exchangeLabel: string
  currency: string
  price: number
  change: number
  changePercent: number
  marketCap: number
  pe: number
  pb: number
  roe: number
  debtEquity: number
  currentRatio: number
  dividendYield: number
  volume: number
  avgVolume: number
  beta: number
  evEbitda: number
  signal: string
  signalScore: number
  categories: {
    valuation: number; health: number; growth: number; analyst: number
    quality: number; momentum: number; sector: number; smartMoney: number
  }
  confidence: number
  redFlags: RedFlag[]
  gated: boolean
  altmanZ: number
  piotroski: number
  dcf: number
  dcfUpside: number
  priceTarget: number
  analystConsensus: string
  analystEpsRevision30d: number
  analystEpsRevision90d: number
  riskScore: number
  riskLevel: string
  valuationScore: number
  valuationLabel: string
  shortFloat: number
  badges: StockBadge[]
  overvalScore: number
  overvalLevel: string
  yearHigh: number
  yearLow: number
  targetPrice?: number
  floorPrice?: number
  riskReward?: number
  zone?: string
  floorAboveTarget?: boolean
}

function parseCSV(csvText: string): Array<Record<string, string>> {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const result: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim())
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }
    result.push(row)
  }
  return result
}

function safeNum(val: string | number | undefined | null): number {
  if (val == null || val === '' || val === 'null' || val === 'undefined') return 0
  const n = typeof val === 'number' ? val : parseFloat(val)
  return isFinite(n) ? n : 0
}

function isCSV(text: string): boolean {
  return text.length > 0 && !text.startsWith('[') && !text.startsWith('{')
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`europe-stocks:${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const startTime = Date.now()
  const exchangeFilter = request.nextUrl.searchParams.get('exchange') as EuropeExchangeId | null

  try {
    // Dynamically fetch symbols from FMP company-screener (cached 24h)
    const dynamicSymbols = await fetchEuropeSymbolsFromFMP()
    const allEuSymbols = exchangeFilter
      ? dynamicSymbols.filter(s => {
          const suffix = EUROPE_EXCHANGES[exchangeFilter]?.symbolSuffix
          return suffix ? s.endsWith(suffix) : true
        })
      : dynamicSymbols
    const europeSymbols = new Set(allEuSymbols)

    const cacheKey = `europe_stocks_v5${exchangeFilter ? `_${exchangeFilter}` : ''}`

    const stocks = await getCached<EuropeStockRow[]>(cacheKey, CACHE_TTL.QUOTE, async () => {
      console.log(`[EU Stocks] Fetching bulk data for ${europeSymbols.size} European stocks...`)

      // STEP 1: SECTORS
      const sectorsMap = new Map<string, string>()
      try {
        const content = await fs.readFile(SECTORS_FILE, 'utf-8')
        const data = JSON.parse(content)
        if (data.sectors) {
          for (const [sym, sec] of Object.entries(data.sectors)) {
            sectorsMap.set(sym, sec as string)
          }
        }
      } catch { /* first run — no cache yet */ }

      // STEP 2: BULK DATA (parallel — same endpoints as NASDAQ, filtered differently)
      type MetricsData = { pe: number; pb: number; roe: number; de: number; cr: number; dy: number; evEbitda: number; pfcf: number; ic: number; fcfps: number; pegRatio: number; netIncPerShare: number; bvPerShare: number; grossProfitMargin: number; priceToSales: number }
      type ScoreData = { altmanZ: number; piotroski: number }
      type DCFData = { dcf: number; stockPrice: number }
      type AnalystData = { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number; consensus: string }
      type PriceTargetData = { targetConsensus: number }
      type GrowthData = { revenueGrowth: number; epsGrowth: number; netIncomeGrowth: number }
      type AnalystEstimateData = { epsRevision30d: number; epsRevision90d: number; estimateCount: number }

      const metricsMap = new Map<string, MetricsData>()
      const scoresMap = new Map<string, ScoreData>()
      const dcfMap = new Map<string, DCFData>()
      const analystMap = new Map<string, AnalystData>()
      const targetMap = new Map<string, PriceTargetData>()
      const growthMap = new Map<string, GrowthData>()
      const analystEstimateMap = new Map<string, AnalystEstimateData>()

      const [ratiosRes, scoresRes, dcfRes, analystRes, targetRes, growthRes, keyMetricsRes, sectorPerfRes, earningsSurprisesRes, analystEstimatesRes] = await Promise.allSettled([
        fmpFetch('/ratios-ttm-bulk'),
        fmpFetch('/scores-bulk'),
        fmpFetch('/dcf-bulk'),
        fmpFetch('/upgrades-downgrades-consensus-bulk'),
        fmpFetch('/price-target-summary-bulk'),
        fmpFetch('/income-statement-growth-bulk', { year: String(new Date().getFullYear() - 1), period: 'annual' }),
        fmpFetch('/key-metrics-ttm-bulk'),
        (() => {
          const d = new Date()
          for (let i = 0; i <= 5; i++) {
            const check = new Date(d)
            check.setDate(check.getDate() - i)
            if (check.getDay() !== 0 && check.getDay() !== 6) {
              return fmpFetch('/sector-performance-snapshot', { date: check.toISOString().split('T')[0] })
            }
          }
          return fmpFetch('/sector-performance-snapshot', { date: d.toISOString().split('T')[0] })
        })(),
        fmpFetch('/earnings-surprises-bulk'),
        fmpFetch('/analyst-estimates-bulk'),
      ])

      // Parse all bulk data — identical to NASDAQ but filtering with europeSymbols
      const parseBulkMap = <T>(res: PromiseSettledResult<Response>, label: string, mapper: (row: Record<string, string>) => T | null, mapperJson: (item: Record<string, unknown>) => T | null): Map<string, T> => {
        const map = new Map<string, T>()
        if (res.status !== 'fulfilled' || !res.value.ok) return map
        try {
          const text = (res.value as any)._textCache
          if (!text) return map
        } catch { /* will parse below */ }
        return map
      }

      // Parse Ratios TTM Bulk
      if (ratiosRes.status === 'fulfilled' && ratiosRes.value.ok) {
        const text = await ratiosRes.value.text()
        const parseRow = (row: Record<string, string | number>) => {
          const sym = String(row.symbol || '')
          if (!sym || !europeSymbols.has(sym)) return
          const nips = safeNum(row.netIncomePerShareTTM)
          const bvps = safeNum(row.bookValuePerShareTTM)
          metricsMap.set(sym, {
            pe: safeNum(row.priceToEarningsRatioTTM || row.priceEarningsRatioTTM),
            pb: safeNum(row.priceToBookRatioTTM),
            roe: bvps > 0 ? nips / bvps : 0,
            de: safeNum(row.debtToEquityRatioTTM || row.debtEquityRatioTTM),
            cr: safeNum(row.currentRatioTTM),
            dy: safeNum(row.dividendYieldTTM),
            evEbitda: safeNum(row.enterpriseValueMultipleTTM),
            pfcf: safeNum(row.priceToFreeCashFlowsRatioTTM),
            ic: safeNum(row.interestCoverageTTM),
            fcfps: safeNum(row.freeCashFlowPerShareTTM),
            pegRatio: safeNum(row.pegRatioTTM),
            netIncPerShare: nips,
            bvPerShare: bvps,
            grossProfitMargin: safeNum(row.grossProfitMarginTTM),
            priceToSales: safeNum(row.priceToSalesRatioTTM),
          })
        }
        if (isCSV(text)) { for (const r of parseCSV(text)) parseRow(r as any) }
        else if (text.startsWith('[')) { for (const r of JSON.parse(text)) parseRow(r) }
        console.log(`[EU] Ratios: ${metricsMap.size} stocks`)
      }

      // Parse Scores Bulk
      if (scoresRes.status === 'fulfilled' && scoresRes.value.ok) {
        try {
          const text = await scoresRes.value.text()
          const parse = (row: Record<string, string | number>) => {
            const sym = String(row.symbol || '')
            if (sym && europeSymbols.has(sym)) {
              scoresMap.set(sym, { altmanZ: safeNum(row.altmanZScore), piotroski: safeNum(row.piotroskiScore) })
            }
          }
          if (isCSV(text)) { for (const r of parseCSV(text)) parse(r as any) }
          else if (text.startsWith('[')) { for (const r of JSON.parse(text)) parse(r) }
          console.log(`[EU] Scores: ${scoresMap.size}`)
        } catch (e) { console.warn('[EU] Scores error:', e) }
      }

      // Parse DCF Bulk
      if (dcfRes.status === 'fulfilled' && dcfRes.value.ok) {
        try {
          const text = await dcfRes.value.text()
          const parse = (row: Record<string, string | number>) => {
            const sym = String(row.symbol || '')
            if (sym && europeSymbols.has(sym)) {
              dcfMap.set(sym, { dcf: safeNum(row.dcf), stockPrice: safeNum((row as any)['Stock Price'] || row.stockPrice) })
            }
          }
          if (isCSV(text)) { for (const r of parseCSV(text)) parse(r as any) }
          else if (text.startsWith('[')) { for (const r of JSON.parse(text)) parse(r) }
          console.log(`[EU] DCF: ${dcfMap.size}`)
        } catch (e) { console.warn('[EU] DCF error:', e) }
      }

      // Parse Analyst Consensus Bulk
      if (analystRes.status === 'fulfilled' && analystRes.value.ok) {
        try {
          const text = await analystRes.value.text()
          const parse = (row: Record<string, string | number>) => {
            const sym = String(row.symbol || '')
            if (sym && europeSymbols.has(sym)) {
              analystMap.set(sym, {
                strongBuy: safeNum(row.strongBuy), buy: safeNum(row.buy), hold: safeNum(row.hold),
                sell: safeNum(row.sell), strongSell: safeNum(row.strongSell),
                consensus: String(row.consensus || '').replace(/"/g, ''),
              })
            }
          }
          if (isCSV(text)) { for (const r of parseCSV(text)) parse(r as any) }
          else if (text.startsWith('[')) { for (const r of JSON.parse(text)) parse(r) }
          console.log(`[EU] Analyst: ${analystMap.size}`)
        } catch (e) { console.warn('[EU] Analyst error:', e) }
      }

      // Parse Price Targets Bulk
      if (targetRes.status === 'fulfilled' && targetRes.value.ok) {
        try {
          const text = await targetRes.value.text()
          const parse = (row: Record<string, string | number>) => {
            const sym = String(row.symbol || '')
            if (sym && europeSymbols.has(sym)) {
              targetMap.set(sym, { targetConsensus: safeNum(row.lastMonthAvgPriceTarget || row.lastQuarterAvgPriceTarget || row.allTimeAvgPriceTarget || row.targetConsensus) })
            }
          }
          if (isCSV(text)) { for (const r of parseCSV(text)) parse(r as any) }
          else if (text.startsWith('[')) { for (const r of JSON.parse(text)) parse(r) }
          console.log(`[EU] Targets: ${targetMap.size}`)
        } catch (e) { console.warn('[EU] Targets error:', e) }
      }

      // Parse Growth Bulk
      if (growthRes.status === 'fulfilled' && growthRes.value.ok) {
        try {
          const text = await growthRes.value.text()
          const parse = (row: Record<string, string | number>) => {
            const sym = String(row.symbol || '')
            if (sym && europeSymbols.has(sym) && !growthMap.has(sym)) {
              growthMap.set(sym, {
                revenueGrowth: safeNum(row.growthRevenue) * 100,
                epsGrowth: safeNum(row.growthEPS) * 100,
                netIncomeGrowth: safeNum(row.growthNetIncome) * 100,
              })
            }
          }
          if (isCSV(text)) { for (const r of parseCSV(text)) parse(r as any) }
          else if (text.startsWith('[')) { for (const r of JSON.parse(text)) parse(r) }
          console.log(`[EU] Growth: ${growthMap.size}`)
        } catch (e) { console.warn('[EU] Growth error:', e) }
      }

      // Parse Key Metrics TTM Bulk
      type KM = { roeTTM: number; roicTTM: number; earningsYieldTTM: number; freeCashFlowYieldTTM: number; currentRatioTTM: number }
      const kmMap = new Map<string, KM>()
      if (keyMetricsRes.status === 'fulfilled' && keyMetricsRes.value.ok) {
        try {
          const text = await keyMetricsRes.value.text()
          const parse = (row: Record<string, string | number>) => {
            const sym = String(row.symbol || '')
            if (sym && europeSymbols.has(sym)) {
              kmMap.set(sym, {
                roeTTM: safeNum(row.returnOnEquityTTM),
                roicTTM: safeNum(row.returnOnInvestedCapitalTTM),
                earningsYieldTTM: safeNum(row.earningsYieldTTM),
                freeCashFlowYieldTTM: safeNum(row.freeCashFlowYieldTTM),
                currentRatioTTM: safeNum(row.currentRatioTTM),
              })
            }
          }
          if (isCSV(text)) { for (const r of parseCSV(text)) parse(r as any) }
          else if (text.startsWith('[')) { for (const r of JSON.parse(text)) parse(r) }
          console.log(`[EU] Key Metrics: ${kmMap.size}`)
        } catch (e) { console.warn('[EU] Key Metrics error:', e) }
      }

      // Sector Performance
      const sectorPerfMap = new Map<string, number>()
      if (sectorPerfRes.status === 'fulfilled' && sectorPerfRes.value.ok) {
        try {
          const text = await sectorPerfRes.value.text()
          if (text.startsWith('[')) {
            for (const s of JSON.parse(text)) {
              if (s.sector && (s.averageChange !== undefined || s.changesPercentage !== undefined)) {
                sectorPerfMap.set(s.sector, safeNum(s.averageChange ?? s.changesPercentage))
              }
            }
          }
        } catch { /* ignore */ }
      }

      // Earnings Surprises
      type EarningsData = { beatCount: number; missCount: number; lastSurprise: number }
      const earningsMap = new Map<string, EarningsData>()
      if (earningsSurprisesRes.status === 'fulfilled' && earningsSurprisesRes.value.ok) {
        try {
          const text = await earningsSurprisesRes.value.text()
          const rawMap = new Map<string, Array<{ actual: number; estimated: number }>>()
          const parseRows = (rows: Array<Record<string, string | number>>) => {
            for (const row of rows) {
              const sym = String(row.symbol || '')
              if (!sym || !europeSymbols.has(sym)) continue
              if (!rawMap.has(sym)) rawMap.set(sym, [])
              const arr = rawMap.get(sym)!
              if (arr.length < 4) arr.push({ actual: safeNum(row.actualEarningResult ?? row.actual), estimated: safeNum(row.estimatedEarning ?? row.estimated) })
            }
          }
          if (isCSV(text)) parseRows(parseCSV(text) as any)
          else if (text.startsWith('[')) parseRows(JSON.parse(text))
          for (const [sym, quarters] of rawMap) {
            let beat = 0, miss = 0, lastSurp = 0
            for (let qi = 0; qi < quarters.length; qi++) {
              const q = quarters[qi]
              if (q.estimated !== 0) {
                if (q.actual - q.estimated > 0) beat++
                else if (q.actual - q.estimated < 0) miss++
                if (qi === 0) lastSurp = q.estimated !== 0 ? ((q.actual - q.estimated) / Math.abs(q.estimated)) * 100 : 0
              }
            }
            earningsMap.set(sym, { beatCount: beat, missCount: miss, lastSurprise: lastSurp })
          }
        } catch { /* ignore */ }
      }

      // Analyst Estimates Bulk (EPS revision momentum proxy)
      if (analystEstimatesRes.status === 'fulfilled' && analystEstimatesRes.value.ok) {
        try {
          const text = await analystEstimatesRes.value.text()

          const getNum = (row: Record<string, string | number>, keys: string[]): number => {
            for (const k of keys) {
              if (k in row) {
                const n = safeNum(row[k] as string | number)
                if (isFinite(n)) return n
              }
            }
            return 0
          }

          const parse = (row: Record<string, string | number>) => {
            const sym = String(row.symbol || '')
            if (!sym || !europeSymbols.has(sym) || analystEstimateMap.has(sym)) return

            const curr = getNum(row, ['estimatedEpsAvg', 'epsAvg', 'estimatedEPSAvg', 'epsEstimateAvg'])
            const prev30 = getNum(row, ['estimatedEpsAvg30DaysAgo', 'epsAvg30DaysAgo', 'estimatedEPSAvg30DaysAgo'])
            const prev90 = getNum(row, ['estimatedEpsAvg90DaysAgo', 'epsAvg90DaysAgo', 'estimatedEPSAvg90DaysAgo'])
            const count = getNum(row, ['numberAnalystsEstimatedEps', 'numberAnalystEstimatedEps', 'analystCount'])

            const rev30 = prev30 !== 0 ? ((curr - prev30) / Math.abs(prev30)) * 100 : 0
            const rev90 = prev90 !== 0 ? ((curr - prev90) / Math.abs(prev90)) * 100 : 0

            analystEstimateMap.set(sym, {
              epsRevision30d: Math.max(-100, Math.min(100, rev30)),
              epsRevision90d: Math.max(-100, Math.min(100, rev90)),
              estimateCount: Math.max(0, Math.round(count)),
            })
          }

          if (isCSV(text)) { for (const row of parseCSV(text) as unknown as Array<Record<string, string | number>>) parse(row) }
          else if (text.startsWith('[')) { for (const row of JSON.parse(text)) parse(row) }
          console.log(`[EU] Analyst estimates: ${analystEstimateMap.size}`)
        } catch (e) { console.warn('[EU] Analyst estimates error:', e) }
      }

      // Share Float
      const shareFloatMap = new Map<string, { freeFloat: number }>()
      try {
        let pageIdx = 0
        while (pageIdx < 30) {
          const sfRes = await fmpFetch('/shares-float-all', { limit: '1000', page: String(pageIdx) })
          if (!sfRes.ok) break
          const data = await sfRes.json()
          if (!Array.isArray(data) || data.length === 0) break
          for (const sf of data) {
            if (sf.symbol && europeSymbols.has(sf.symbol)) {
              const ff = safeNum(sf.freeFloat)
              shareFloatMap.set(sf.symbol, { freeFloat: ff > 0 && ff <= 1 ? ff * 100 : ff })
            }
          }
          if (data.length < 1000) break
          pageIdx++
        }
      } catch { /* ignore */ }

      // STEP 3: SECTORS from company-screener (per exchange)
      const missingCount = Array.from(europeSymbols).filter(s => !sectorsMap.has(s)).length
      if (missingCount > 50) {
        const exchangeCodes = new Set<string>()
        for (const ex of Object.values(EUROPE_EXCHANGES)) exchangeCodes.add(ex.fmpExchange)
        for (const exCode of exchangeCodes) {
          try {
            const res = await fmpFetch('/company-screener', { exchange: exCode, limit: '5000' })
            if (res.ok) {
              const text = await res.text()
              if (text.startsWith('[')) {
                for (const item of JSON.parse(text)) {
                  if (item.symbol && item.sector && europeSymbols.has(item.symbol)) {
                    sectorsMap.set(item.symbol, item.sector)
                  }
                }
              }
            }
          } catch { /* continue with other exchanges */ }
        }
        try {
          const obj: Record<string, string> = {}
          for (const [k, v] of sectorsMap) obj[k] = v
          await fs.mkdir(path.dirname(SECTORS_FILE), { recursive: true })
          await fs.writeFile(SECTORS_FILE, JSON.stringify({ sectors: obj, updated: new Date().toISOString() }))
        } catch { /* ignore */ }
        console.log(`[EU] Sectors: ${sectorsMap.size}`)
      }

      // STEP 4: BATCH QUOTES
      const quotesMap = new Map<string, {
        symbol: string; price: number; change: number; changePercent: number
        volume: number; avgVolume: number; name: string; marketCap: number; pe: number; beta: number
        yearHigh: number; yearLow: number
      }>()
      try {
        const allSyms = Array.from(europeSymbols)
        const batchPromises: Promise<void>[] = []
        for (let i = 0; i < allSyms.length; i += 100) {
          const batch = allSyms.slice(i, i + 100)
          batchPromises.push((async () => {
            const res = await fmpFetch('/batch-quote', { symbols: batch.join(',') })
            if (res.ok) {
              const data = await res.json()
              const quotes = Array.isArray(data) ? data : data.value ?? []
              for (const q of quotes) {
                if (q.symbol) {
                  quotesMap.set(q.symbol, {
                    symbol: q.symbol, price: safeNum(q.price), change: safeNum(q.change),
                    changePercent: safeNum(q.changesPercentage ?? q.changePercentage),
                    volume: safeNum(q.volume), avgVolume: safeNum(q.avgVolume),
                    name: q.name ?? q.symbol, marketCap: safeNum(q.marketCap),
                    pe: safeNum(q.pe), beta: safeNum(q.beta),
                    yearHigh: safeNum(q.yearHigh), yearLow: safeNum(q.yearLow),
                  })
                }
              }
            }
          })())
        }
        await Promise.all(batchPromises)
        console.log(`[EU] Quotes: ${quotesMap.size}`)
      } catch { /* ignore */ }

      // STEP 5: BUILD SCORE INPUTS
      const allInputs = new Map<string, ScoreInputMetrics>()
      for (const sym of europeSymbols) {
        const quote = quotesMap.get(sym)
        if (!quote) continue
        const sector = sectorsMap.get(sym) || 'Unknown'
        const met = metricsMap.get(sym)
        const scores = scoresMap.get(sym)
        const dcf = dcfMap.get(sym)
        const analyst = analystMap.get(sym)
        const target = targetMap.get(sym)
        const growth = growthMap.get(sym)
        const km = kmMap.get(sym)

        const input = createDefaultInput(sym, sector)
        input.pe = met?.pe || safeNum(quote.pe); input.pb = met?.pb || 0
        input.evEbitda = met?.evEbitda || 0; input.dcf = dcf?.dcf || 0
        input.price = quote.price; input.pegRatio = met?.pegRatio || 0; input.pfcf = met?.pfcf || 0
        input.altmanZ = scores?.altmanZ || 0; input.piotroski = scores?.piotroski || 0
        input.debtEquity = met?.de || 0; input.currentRatio = met?.cr || km?.currentRatioTTM || 0
        input.interestCoverage = met?.ic || 0; input.fcfPerShare = met?.fcfps || 0
        input.revenueGrowth = growth?.revenueGrowth || 0; input.epsGrowth = growth?.epsGrowth || 0
        input.netIncomeGrowth = growth?.netIncomeGrowth || 0
        input.analystConsensus = analyst?.consensus || ''
        input.strongBuy = analyst?.strongBuy || 0; input.buy = analyst?.buy || 0
        input.hold = analyst?.hold || 0; input.sell = analyst?.sell || 0; input.strongSell = analyst?.strongSell || 0
        input.priceTarget = target?.targetConsensus || 0
        input.epsRevision30d = analystEstimateMap.get(sym)?.epsRevision30d || 0
        input.epsRevision90d = analystEstimateMap.get(sym)?.epsRevision90d || 0
        input.analystRevisionCount = analystEstimateMap.get(sym)?.estimateCount || 0
        input.roic = km?.roicTTM || 0; input.grossMargin = met?.grossProfitMargin || 0
        input.fcfToNetIncome = (met?.netIncPerShare || 0) > 0 ? (met?.fcfps || 0) / met!.netIncPerShare : 0
        input.changePercent = quote.changePercent; input.priceChange1M = quote.changePercent
        input.volumeRatio = quote.avgVolume > 0 ? quote.volume / quote.avgVolume : 0
        input.yearHigh = quote.yearHigh; input.yearLow = quote.yearLow
        if (quote.yearHigh > 0 && quote.yearLow > 0 && quote.yearHigh > quote.yearLow) {
          input.priceChange6M = ((quote.price - (quote.yearHigh + quote.yearLow) / 2) / ((quote.yearHigh + quote.yearLow) / 2)) * 60
        }
        input.priceToSales = met?.priceToSales || 0
        const earn = earningsMap.get(sym)
        input.earningsBeatCount = earn?.beatCount || 0; input.earningsMissCount = earn?.missCount || 0
        input.lastEpsSurprise = earn?.lastSurprise || 0
        input.shortFloat = Math.min(100, shareFloatMap.get(sym)?.freeFloat || 0)
        input.sectorPerformance1M = sectorPerfMap.get(sector) || 0
        input.marketCap = quote.marketCap; input.beta = quote.beta
        allInputs.set(sym, input)
      }

      const { scores: allScores, thresholds } = scoreAllStocks(allInputs)
      console.log(`[EU] Scored: ${allScores.size} | STRONG>=${thresholds.strong} GOOD>=${thresholds.good}`)

      // STEP 6: BUILD RESULT
      const result: EuropeStockRow[] = []
      for (const sym of europeSymbols) {
        const quote = quotesMap.get(sym)
        if (!quote) continue
        const met = metricsMap.get(sym)
        const scores = scoresMap.get(sym)
        const dcf = dcfMap.get(sym)
        const analyst = analystMap.get(sym)
        const target = targetMap.get(sym)
        const fmpScore = allScores.get(sym)
        const inputForRisk = allInputs.get(sym)

        const exId = getExchangeFromSymbol(sym)
        const exConfig = exId ? EUROPE_EXCHANGES[exId] : null

        const dcfVal = dcf?.dcf || 0
        const dcfUpside = dcfVal > 0 && quote.price > 0 ? ((dcfVal - quote.price) / quote.price) * 100 : 0

        const pt = computeEuropeTargetFloor({
          price: quote.price,
          signal: fmpScore?.level || 'NEUTRAL',
          signalScore: fmpScore?.total || 50,
          priceTarget: target?.targetConsensus || 0,
          dcf: dcfVal,
          yearHigh: quote.yearHigh,
          yearLow: quote.yearLow,
          beta: quote.beta,
          altmanZ: scores?.altmanZ,
          piotroski: scores?.piotroski,
        })

        // RULE-R2: 5+ red flags -> riskLevel cannot be LOW
        const rawRisk = inputForRisk ? computeRiskScore(inputForRisk) : { total: 50, level: 'MODERATE' as const }
        const risk = rawRisk.level === 'LOW' && (fmpScore?.redFlags?.length ?? 0) >= 5
          ? { ...rawRisk, level: 'MODERATE' as const }
          : rawRisk

        // RULE-P1: price < floorPrice -> valuation CANNOT be NORMAL/OVERVALUED
        let valuationLabel = fmpScore?.valuationLabel ?? 'NORMAL'
        if (pt?.floorPrice && quote.price > 0 && quote.price < pt.floorPrice) {
          if (valuationLabel === 'NORMAL' || valuationLabel === 'PAHALI' || valuationLabel === 'COK PAHALI') {
            valuationLabel = 'UCUZ'
          }
        }

        result.push({
          symbol: sym,
          companyName: quote.name || sym,
          sector: sectorsMap.get(sym) || 'Unknown',
          exchange: exId || 'UNKNOWN',
          exchangeLabel: exConfig?.shortLabel || '',
          currency: exConfig?.currency || 'EUR',
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          marketCap: quote.marketCap,
          pe: met?.pe || safeNum(quote.pe),
          pb: met?.pb || 0,
          roe: met?.roe || kmMap.get(sym)?.roeTTM || 0,
          debtEquity: met?.de || 0,
          currentRatio: met?.cr || 0,
          dividendYield: met?.dy || 0,
          volume: quote.volume,
          avgVolume: quote.avgVolume,
          beta: quote.beta || 0,
          evEbitda: met?.evEbitda || 0,
          signal: fmpScore?.level || 'NEUTRAL',
          signalScore: fmpScore?.total || 50,
          categories: fmpScore?.categories || { valuation: 50, health: 50, growth: 50, analyst: 50, quality: 50, momentum: 50, sector: 50, smartMoney: 50 },
          confidence: fmpScore?.confidence || 30,
          redFlags: fmpScore?.redFlags || [],
          gated: fmpScore?.gated || false,
          altmanZ: scores?.altmanZ || 0,
          piotroski: scores?.piotroski || 0,
          dcf: dcfVal,
          dcfUpside: Math.round(dcfUpside * 10) / 10,
          priceTarget: target?.targetConsensus || 0,
          analystConsensus: analyst?.consensus || '',
          analystEpsRevision30d: analystEstimateMap.get(sym)?.epsRevision30d || 0,
          analystEpsRevision90d: analystEstimateMap.get(sym)?.epsRevision90d || 0,
          riskScore: risk.total,
          riskLevel: risk.level,
          valuationScore: fmpScore?.valuationScore ?? 50,
          valuationLabel,
          shortFloat: Math.min(100, shareFloatMap.get(sym)?.freeFloat || 0),
          badges: fmpScore?.badges || [],
          overvalScore: fmpScore?.overvaluation?.score ?? 0,
          overvalLevel: fmpScore?.overvaluation?.level ?? 'LOW' as const,
          yearHigh: quote.yearHigh,
          yearLow: quote.yearLow,
          targetPrice: pt?.targetPrice,
          floorPrice: pt?.floorPrice,
          riskReward: pt?.riskReward,
          zone: pt?.zone,
          floorAboveTarget: pt?.floorAboveTarget,
        })
      }

      console.log(`[EU] Final: ${result.length} stocks in ${Date.now() - startTime}ms`)
      return result
    })

    const currentThresholds = computeScoreThresholds(stocks.map(s => s.signalScore))

    return NextResponse.json({
      stocks,
      count: stocks.length,
      thresholds: currentThresholds,
      timestamp: new Date().toISOString(),
      version: 'europe-v5-8cat',
    })
  } catch (error) {
    console.error('[EU Terminal /stocks] Error:', (error as Error).message)
    return NextResponse.json(
      { error: 'Failed to fetch European stocks', message: (error as Error).message },
      { status: 500 }
    )
  }
}
