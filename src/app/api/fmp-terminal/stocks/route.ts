// ═══════════════════════════════════════════════════════════════════
// FMP Terminal - All Stocks List API (V2 — 8-Category Scoring)
// GET /api/fmp-terminal/stocks
// Returns all stocks with 8-category percentile-based scoring
// 6 AI Consensus: Percentile normalization, Altman Z gate, DCF reliability
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getCached, CACHE_TTL } from '@/lib/fmp-terminal/fmp-cache'
import { getSymbols } from '@/lib/symbols'
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
import { FMPScore, RedFlag, computeScoreThresholds } from '@/lib/fmp-terminal/fmp-types'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const SECTORS_FILE = path.join(process.cwd(), 'data', 'sectors.json')

function getApiKey(): string {
  const key = process.env.FMP_API_KEY
  if (!key) {
    console.error('[FMP-STOCKS] CFG_MISSING_FMP_KEY — env var not set')
    throw new Error('API configuration error')
  }
  return key
}

async function fmpFetch(endpoint: string, params: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${FMP_BASE}${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return fetch(url.toString(), { headers: { 'apikey': getApiKey() }, cache: 'no-store' })
}

interface StockRow {
  symbol: string
  companyName: string
  sector: string
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
  // V2 Scoring
  signal: string
  signalScore: number
  // V4 8-Category Breakdown (Technical kaldirildi)
  categories: {
    valuation: number
    health: number
    growth: number
    analyst: number
    quality: number
    insider: number
    institutional: number
    momentum: number
    sector: number
    congressional: number
  }
  confidence: number
  redFlags: RedFlag[]
  gated: boolean
  // Extra metrics
  altmanZ: number
  piotroski: number
  dcf: number
  dcfUpside: number
  priceTarget: number
  analystConsensus: string
  // Risk
  riskScore: number
  riskLevel: string
  // Valuation Label (Ucuzluk/Pahalik)
  valuationScore: number
  valuationLabel: string
  // Short Interest
  shortFloat: number
}

// ─── CSV Parser ────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════
// MAIN API HANDLER
// ═══════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`fmp-stocks:${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  const startTime = Date.now()

  try {
    const hermesSymbols = new Set(getSymbols('ALL'))

    const stocks = await getCached<StockRow[]>('fmp_stocks_v6_fixed_thresholds', CACHE_TTL.QUOTE, async () => {
      console.log('[FMP Stocks V2] Fetching bulk data for 8-category scoring...')

      // ═══════════════════════════════════════════════════════════
      // STEP 1: SECTORS (disk cache)
      // ═══════════════════════════════════════════════════════════
      const sectorsMap = new Map<string, string>()
      try {
        const content = await fs.readFile(SECTORS_FILE, 'utf-8')
        const data = JSON.parse(content)
        if (data.sectors) {
          for (const [sym, sec] of Object.entries(data.sectors)) {
            sectorsMap.set(sym, sec as string)
          }
        }
        console.log(`[V2] Sectors loaded: ${sectorsMap.size}`)
      } catch { /* ignore */ }

      // ═══════════════════════════════════════════════════════════
      // STEP 2: BULK DATA FETCHES (parallel)
      // ═══════════════════════════════════════════════════════════
      type MetricsData = { pe: number; pb: number; roe: number; de: number; cr: number; dy: number; evEbitda: number; pfcf: number; ic: number; fcfps: number; pegRatio: number; netIncPerShare: number; bvPerShare: number; grossProfitMargin: number }
      type ScoreData = { altmanZ: number; piotroski: number }
      type DCFData = { dcf: number; stockPrice: number }
      type AnalystData = { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number; consensus: string }
      type PriceTargetData = { targetConsensus: number }
      type GrowthData = { revenueGrowth: number; epsGrowth: number; netIncomeGrowth: number }

      const metricsMap = new Map<string, MetricsData>()
      const scoresMap = new Map<string, ScoreData>()
      const dcfMap = new Map<string, DCFData>()
      const analystMap = new Map<string, AnalystData>()
      const targetMap = new Map<string, PriceTargetData>()
      const growthMap = new Map<string, GrowthData>()

      // Parallel fetch: ratios, scores, dcf, analyst, price-targets, growth, key-metrics, sector-perf
      const [ratiosRes, scoresRes, dcfRes, analystRes, targetRes, growthRes, keyMetricsRes, sectorPerfRes] = await Promise.allSettled([
        fmpFetch('/ratios-ttm-bulk'),
        fmpFetch('/scores-bulk'),
        fmpFetch('/dcf-bulk'),
        fmpFetch('/upgrades-downgrades-consensus-bulk'),
        fmpFetch('/price-target-summary-bulk'),
        // Fetch growth data — use previous year for most complete dataset
        // (current year has very few stocks since most haven't reported yet)
        fmpFetch('/income-statement-growth-bulk', { year: String(new Date().getFullYear() - 1), period: 'annual' }),
        fmpFetch('/key-metrics-ttm-bulk'),
        // Sector performance — find last weekday
        (() => {
          const d = new Date()
          // Go back to find last weekday
          for (let i = 0; i <= 5; i++) {
            const check = new Date(d)
            check.setDate(check.getDate() - i)
            if (check.getDay() !== 0 && check.getDay() !== 6) {
              return fmpFetch('/sector-performance-snapshot', { date: check.toISOString().split('T')[0] })
            }
          }
          return fmpFetch('/sector-performance-snapshot', { date: d.toISOString().split('T')[0] })
        })(),
      ])

      // Parse Ratios TTM Bulk
      if (ratiosRes.status === 'fulfilled' && ratiosRes.value.ok) {
        const text = await ratiosRes.value.text()
        if (isCSV(text)) {
          const rows = parseCSV(text)
          for (const row of rows) {
            const sym = row.symbol
            if (sym && hermesSymbols.has(sym)) {
              const nips = safeNum(row.netIncomePerShareTTM)
              const bvps = safeNum(row.bookValuePerShareTTM)
              const roe = bvps > 0 ? nips / bvps : 0
              metricsMap.set(sym, {
                pe: safeNum(row.priceToEarningsRatioTTM || row.priceEarningsRatioTTM),
                pb: safeNum(row.priceToBookRatioTTM),
                roe,
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
              })
            }
          }
          console.log(`[V2] Ratios CSV: ${metricsMap.size} stocks`)
        } else if (text.startsWith('[')) {
          const data = JSON.parse(text)
          for (const m of data) {
            if (m.symbol && hermesSymbols.has(m.symbol)) {
              const nips = safeNum(m.netIncomePerShareTTM)
              const bvps = safeNum(m.bookValuePerShareTTM)
              metricsMap.set(m.symbol, {
                pe: safeNum(m.priceEarningsRatioTTM || m.priceToEarningsRatioTTM),
                pb: safeNum(m.priceToBookRatioTTM),
                roe: bvps > 0 ? nips / bvps : 0,
                de: safeNum(m.debtEquityRatioTTM || m.debtToEquityRatioTTM),
                cr: safeNum(m.currentRatioTTM),
                dy: safeNum(m.dividendYieldTTM),
                evEbitda: safeNum(m.enterpriseValueMultipleTTM),
                pfcf: safeNum(m.priceToFreeCashFlowsRatioTTM),
                ic: safeNum(m.interestCoverageTTM),
                fcfps: safeNum(m.freeCashFlowPerShareTTM),
                pegRatio: safeNum(m.pegRatioTTM),
                netIncPerShare: nips,
                bvPerShare: bvps,
                grossProfitMargin: safeNum(m.grossProfitMarginTTM),
              })
            }
          }
          console.log(`[V2] Ratios JSON: ${metricsMap.size} stocks`)
        }
      }

      // Parse Scores Bulk (Altman Z + Piotroski) — CSV format
      if (scoresRes.status === 'fulfilled' && scoresRes.value.ok) {
        try {
          const text = await scoresRes.value.text()
          if (isCSV(text)) {
            const rows = parseCSV(text)
            for (const row of rows) {
              const sym = row.symbol
              if (sym && hermesSymbols.has(sym)) {
                scoresMap.set(sym, {
                  altmanZ: safeNum(row.altmanZScore),
                  piotroski: safeNum(row.piotroskiScore),
                })
              }
            }
          } else if (text.startsWith('[')) {
            const data = JSON.parse(text)
            for (const s of data) {
              if (s.symbol && hermesSymbols.has(s.symbol)) {
                scoresMap.set(s.symbol, {
                  altmanZ: safeNum(s.altmanZScore),
                  piotroski: safeNum(s.piotroskiScore),
                })
              }
            }
          }
          console.log(`[V2] Scores bulk: ${scoresMap.size} stocks`)
        } catch (e) { console.warn('[V2] Scores parse error:', e) }
      }

      // Parse DCF Bulk — CSV format ("Stock Price" has space in header)
      if (dcfRes.status === 'fulfilled' && dcfRes.value.ok) {
        try {
          const text = await dcfRes.value.text()
          if (isCSV(text)) {
            const rows = parseCSV(text)
            for (const row of rows) {
              const sym = row.symbol
              if (sym && hermesSymbols.has(sym)) {
                dcfMap.set(sym, {
                  dcf: safeNum(row.dcf),
                  stockPrice: safeNum(row['Stock Price'] || row.stockPrice),
                })
              }
            }
          } else if (text.startsWith('[')) {
            const data = JSON.parse(text)
            for (const d of data) {
              if (d.symbol && hermesSymbols.has(d.symbol)) {
                dcfMap.set(d.symbol, {
                  dcf: safeNum(d.dcf),
                  stockPrice: safeNum(d.stockPrice),
                })
              }
            }
          }
          console.log(`[V2] DCF bulk: ${dcfMap.size} stocks`)
        } catch (e) { console.warn('[V2] DCF parse error:', e) }
      }

      // Parse Analyst Consensus Bulk — CSV format
      if (analystRes.status === 'fulfilled' && analystRes.value.ok) {
        try {
          const text = await analystRes.value.text()
          if (isCSV(text)) {
            const rows = parseCSV(text)
            for (const row of rows) {
              const sym = row.symbol
              if (sym && hermesSymbols.has(sym)) {
                analystMap.set(sym, {
                  strongBuy: safeNum(row.strongBuy),
                  buy: safeNum(row.buy),
                  hold: safeNum(row.hold),
                  sell: safeNum(row.sell),
                  strongSell: safeNum(row.strongSell),
                  consensus: (row.consensus || '').replace(/"/g, ''),
                })
              }
            }
          } else if (text.startsWith('[')) {
            const data = JSON.parse(text)
            for (const a of data) {
              if (a.symbol && hermesSymbols.has(a.symbol)) {
                analystMap.set(a.symbol, {
                  strongBuy: safeNum(a.strongBuy),
                  buy: safeNum(a.buy),
                  hold: safeNum(a.hold),
                  sell: safeNum(a.sell),
                  strongSell: safeNum(a.strongSell),
                  consensus: a.consensus || '',
                })
              }
            }
          }
          console.log(`[V2] Analyst bulk: ${analystMap.size} stocks`)
        } catch (e) { console.warn('[V2] Analyst parse error:', e) }
      }

      // Parse Price Target Bulk — CSV format
      if (targetRes.status === 'fulfilled' && targetRes.value.ok) {
        try {
          const text = await targetRes.value.text()
          if (isCSV(text)) {
            const rows = parseCSV(text)
            for (const row of rows) {
              const sym = row.symbol
              if (sym && hermesSymbols.has(sym)) {
                targetMap.set(sym, {
                  targetConsensus: safeNum(row.lastMonthAvgPriceTarget || row.lastQuarterAvgPriceTarget || row.allTimeAvgPriceTarget),
                })
              }
            }
          } else if (text.startsWith('[')) {
            const data = JSON.parse(text)
            for (const t of data) {
              if (t.symbol && hermesSymbols.has(t.symbol)) {
                targetMap.set(t.symbol, {
                  targetConsensus: safeNum(t.targetConsensus || t.lastMonthAvgPriceTarget || t.lastQuarterAvgPriceTarget),
                })
              }
            }
          }
          console.log(`[V2] Price targets bulk: ${targetMap.size} stocks`)
        } catch (e) { console.warn('[V2] Targets parse error:', e) }
      }

      // Parse Income Statement Growth Bulk (Revenue/EPS/NetIncome growth)
      if (growthRes.status === 'fulfilled' && growthRes.value.ok) {
        try {
          const text = await growthRes.value.text()
          if (isCSV(text)) {
            const rows = parseCSV(text)
            for (const row of rows) {
              const sym = row.symbol
              if (sym && hermesSymbols.has(sym) && !growthMap.has(sym)) {
                growthMap.set(sym, {
                  revenueGrowth: safeNum(row.growthRevenue) * 100,
                  epsGrowth: safeNum(row.growthEPS) * 100,
                  netIncomeGrowth: safeNum(row.growthNetIncome) * 100,
                })
              }
            }
          } else if (text.startsWith('[')) {
            const data = JSON.parse(text)
            for (const g of data) {
              if (g.symbol && hermesSymbols.has(g.symbol) && !growthMap.has(g.symbol)) {
                growthMap.set(g.symbol, {
                  revenueGrowth: safeNum(g.growthRevenue) * 100,
                  epsGrowth: safeNum(g.growthEPS) * 100,
                  netIncomeGrowth: safeNum(g.growthNetIncome) * 100,
                })
              }
            }
          }
          console.log(`[V3] Growth bulk: ${growthMap.size} stocks`)
        } catch (e) { console.warn('[V3] Growth parse error:', e) }
      }

      // Parse Share Float — paginated /shares-float-all endpoint
      const shareFloatMap = new Map<string, { freeFloat: number; floatShares: number; outstandingShares: number }>()
      try {
        const PAGE_LIMIT = 1000
        const MAX_PAGES = 30
        let pageIdx = 0
        while (pageIdx < MAX_PAGES) {
          const sfRes = await fmpFetch('/shares-float-all', { limit: String(PAGE_LIMIT), page: String(pageIdx) })
          if (!sfRes.ok) break
          const data = await sfRes.json()
          if (!Array.isArray(data) || data.length === 0) break
          for (const sf of data) {
            const sym = sf.symbol
            if (sym && hermesSymbols.has(sym)) {
              const ff = safeNum(sf.freeFloat)
              shareFloatMap.set(sym, {
                freeFloat: ff > 0 && ff <= 1 ? ff * 100 : ff,
                floatShares: safeNum(sf.floatShares),
                outstandingShares: safeNum(sf.outstandingShares),
              })
            }
          }
          if (data.length < PAGE_LIMIT) break
          pageIdx++
        }
        console.log(`[V3] Share float: ${shareFloatMap.size} stocks (${pageIdx + 1} pages)`)
      } catch (e) { console.warn('[V3] Share float error:', e) }

      // Parse Key Metrics TTM Bulk (extra valuation + profitability data)
      // CSV field names use TTM suffix: returnOnEquityTTM, earningsYieldTTM, etc.
      type KeyMetricsTTMData = { roeTTM: number; roicTTM: number; earningsYieldTTM: number; freeCashFlowYieldTTM: number; currentRatioTTM: number }
      const keyMetricsTTMMap = new Map<string, KeyMetricsTTMData>()
      if (keyMetricsRes.status === 'fulfilled' && keyMetricsRes.value.ok) {
        try {
          const text = await keyMetricsRes.value.text()
          if (isCSV(text)) {
            const rows = parseCSV(text)
            for (const row of rows) {
              const sym = row.symbol
              if (sym && hermesSymbols.has(sym)) {
                keyMetricsTTMMap.set(sym, {
                  roeTTM: safeNum(row.returnOnEquityTTM),
                  roicTTM: safeNum(row.returnOnInvestedCapitalTTM),
                  earningsYieldTTM: safeNum(row.earningsYieldTTM),
                  freeCashFlowYieldTTM: safeNum(row.freeCashFlowYieldTTM),
                  currentRatioTTM: safeNum(row.currentRatioTTM),
                })
              }
            }
          } else if (text.startsWith('[')) {
            const data = JSON.parse(text)
            for (const km of data) {
              if (km.symbol && hermesSymbols.has(km.symbol)) {
                keyMetricsTTMMap.set(km.symbol, {
                  roeTTM: safeNum(km.returnOnEquityTTM),
                  roicTTM: safeNum(km.returnOnInvestedCapitalTTM),
                  earningsYieldTTM: safeNum(km.earningsYieldTTM),
                  freeCashFlowYieldTTM: safeNum(km.freeCashFlowYieldTTM),
                  currentRatioTTM: safeNum(km.currentRatioTTM),
                })
              }
            }
          }
          console.log(`[V3] Key Metrics TTM bulk: ${keyMetricsTTMMap.size} stocks`)
        } catch (e) { console.warn('[V3] Key Metrics TTM parse error:', e) }
      }

      // Parse Sector Performance (for sector scoring)
      const sectorPerfMap = new Map<string, number>()
      if (sectorPerfRes.status === 'fulfilled' && sectorPerfRes.value.ok) {
        try {
          const text = await sectorPerfRes.value.text()
          if (text.startsWith('[')) {
            const data = JSON.parse(text)
            for (const s of data) {
              if (s.sector && (s.averageChange !== undefined || s.changesPercentage !== undefined)) {
                sectorPerfMap.set(s.sector, safeNum(s.averageChange ?? s.changesPercentage))
              }
            }
          }
          console.log(`[V3] Sector performance: ${sectorPerfMap.size} sectors`)
        } catch (e) { console.warn('[V3] Sector perf parse error:', e) }
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 3: COMPANY SCREENER (missing sectors)
      // ═══════════════════════════════════════════════════════════
      try {
        const missingCount = Array.from(hermesSymbols).filter(s => !sectorsMap.has(s)).length
        if (missingCount > 100) {
          console.log(`[V2] Fetching company-screener for ${missingCount} missing sectors...`)
          const res = await fmpFetch('/company-screener', { limit: '10000' })
          if (res.ok) {
            const text = await res.text()
            if (text.startsWith('[')) {
              const screenerData = JSON.parse(text) as Array<{ symbol: string; sector?: string }>
              let matched = 0
              for (const item of screenerData) {
                if (item.symbol && item.sector && hermesSymbols.has(item.symbol) && !sectorsMap.has(item.symbol)) {
                  sectorsMap.set(item.symbol, item.sector)
                  matched++
                }
              }
              console.log(`[V2] Screener matched ${matched} sectors (total: ${sectorsMap.size})`)
            }
          }
          // Save sectors to disk
          try {
            const obj: Record<string, string> = {}
            for (const [k, v] of sectorsMap) obj[k] = v
            await fs.mkdir(path.dirname(SECTORS_FILE), { recursive: true })
            await fs.writeFile(SECTORS_FILE, JSON.stringify({ sectors: obj, updated: new Date().toISOString() }))
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }

      // ═══════════════════════════════════════════════════════════
      // STEP 4: BATCH QUOTES (live prices)
      // ═══════════════════════════════════════════════════════════
      const quotesMap = new Map<string, {
        symbol: string; price: number; change: number; changePercent: number
        volume: number; avgVolume: number; name: string; marketCap: number; pe: number; beta: number
      }>()

      try {
        const allSymbols = Array.from(hermesSymbols)
        const batchSize = 100
        const batchPromises: Promise<void>[] = []

        for (let i = 0; i < allSymbols.length; i += batchSize) {
          const batch = allSymbols.slice(i, i + batchSize)
          batchPromises.push((async () => {
            const res = await fmpFetch('/batch-quote', { symbols: batch.join(',') })
            if (res.ok) {
              const data = await res.json()
              const quotes = Array.isArray(data) ? data : data.value ?? []
              for (const q of quotes) {
                if (q.symbol) {
                  quotesMap.set(q.symbol, {
                    symbol: q.symbol,
                    price: safeNum(q.price),
                    change: safeNum(q.change),
                    changePercent: safeNum(q.changesPercentage ?? q.changePercentage),
                    volume: safeNum(q.volume),
                    avgVolume: safeNum(q.avgVolume),
                    name: q.name ?? q.symbol,
                    marketCap: safeNum(q.marketCap),
                    pe: safeNum(q.pe),
                    beta: safeNum(q.beta),
                  })
                }
              }
            }
          })())
        }
        await Promise.all(batchPromises)
        console.log(`[V2] Quotes loaded: ${quotesMap.size}`)
      } catch (err) {
        console.warn('[V2] Quotes fetch failed:', err)
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 5: BUILD INPUT METRICS + SCORE
      // ═══════════════════════════════════════════════════════════
      const allInputs = new Map<string, ScoreInputMetrics>()

      for (const sym of hermesSymbols) {
        const quote = quotesMap.get(sym)
        if (!quote) continue

        const sector = sectorsMap.get(sym) || 'Unknown'
        const met = metricsMap.get(sym)
        const scores = scoresMap.get(sym)
        const dcf = dcfMap.get(sym)
        const analyst = analystMap.get(sym)
        const target = targetMap.get(sym)
        const growth = growthMap.get(sym)
        const km = keyMetricsTTMMap.get(sym)

        const input = createDefaultInput(sym, sector)

        // Valuation
        input.pe = met?.pe || safeNum(quote.pe)
        input.pb = met?.pb || 0
        input.evEbitda = met?.evEbitda || 0
        input.dcf = dcf?.dcf || 0
        input.price = quote.price
        input.pegRatio = met?.pegRatio || 0
        input.pfcf = met?.pfcf || 0

        // Health
        input.altmanZ = scores?.altmanZ || 0
        input.piotroski = scores?.piotroski || 0
        input.debtEquity = met?.de || 0
        input.currentRatio = met?.cr || km?.currentRatioTTM || 0
        input.interestCoverage = met?.ic || 0
        input.fcfPerShare = met?.fcfps || 0

        // Growth — from income-statement-growth-bulk
        input.revenueGrowth = growth?.revenueGrowth || 0
        input.epsGrowth = growth?.epsGrowth || 0
        input.netIncomeGrowth = growth?.netIncomeGrowth || 0

        // Analyst
        input.analystConsensus = analyst?.consensus || ''
        input.strongBuy = analyst?.strongBuy || 0
        input.buy = analyst?.buy || 0
        input.hold = analyst?.hold || 0
        input.sell = analyst?.sell || 0
        input.strongSell = analyst?.strongSell || 0
        input.priceTarget = target?.targetConsensus || 0

        // Quality
        input.roic = km?.roicTTM || 0
        input.grossMargin = met?.grossProfitMargin || 0
        const fcfPerShare = met?.fcfps || 0
        const nips = met?.netIncPerShare || 0
        input.fcfToNetIncome = nips > 0 ? fcfPerShare / nips : 0

        // Momentum — from batch-quote data
        input.changePercent = quote.changePercent
        input.priceChange1M = quote.changePercent  // Use daily change as proxy for now
        input.volumeRatio = quote.avgVolume > 0 ? quote.volume / quote.avgVolume : 0

        // Sector — from sector-performance-snapshot
        input.sectorPerformance1M = sectorPerfMap.get(sector) || 0

        // Meta
        input.marketCap = quote.marketCap
        input.beta = quote.beta

        allInputs.set(sym, input)
      }

      // Score all stocks with sector peer context
      const { scores: allScores, thresholds } = scoreAllStocks(allInputs)
      console.log(`[V3] Scored: ${allScores.size} stocks | Thresholds: STRONG>=${thresholds.strong} GOOD>=${thresholds.good} WEAK<=${thresholds.weak} BAD<=${thresholds.bad}`)

      // ═══════════════════════════════════════════════════════════
      // STEP 5.5: SECTOR MEDIANS (for valuation z-scores)
      // ═══════════════════════════════════════════════════════════
      const sectorPEs: Record<string, number[]> = {}
      const sectorEvEbitdas: Record<string, number[]> = {}
      for (const sym of hermesSymbols) {
        const sec = sectorsMap.get(sym) || 'Unknown'
        const met2 = metricsMap.get(sym)
        if (met2?.pe && met2.pe > 0 && met2.pe < 500) {
          if (!sectorPEs[sec]) sectorPEs[sec] = []
          sectorPEs[sec].push(met2.pe)
        }
        if (met2?.evEbitda && met2.evEbitda > 0 && met2.evEbitda < 200) {
          if (!sectorEvEbitdas[sec]) sectorEvEbitdas[sec] = []
          sectorEvEbitdas[sec].push(met2.evEbitda)
        }
      }
      function median(arr: number[]): number {
        if (arr.length === 0) return 0
        const s = [...arr].sort((a, b) => a - b)
        const mid = Math.floor(s.length / 2)
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
      }
      function stddev(arr: number[]): number {
        if (arr.length < 2) return 1
        const m = arr.reduce((s, v) => s + v, 0) / arr.length
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) || 1
      }
      const sectorPEMedian: Record<string, number> = {}
      const sectorPEStd: Record<string, number> = {}
      const sectorEvMedian: Record<string, number> = {}
      const sectorEvStd: Record<string, number> = {}
      for (const sec of Object.keys(sectorPEs)) {
        sectorPEMedian[sec] = median(sectorPEs[sec])
        sectorPEStd[sec] = stddev(sectorPEs[sec])
      }
      for (const sec of Object.keys(sectorEvEbitdas)) {
        sectorEvMedian[sec] = median(sectorEvEbitdas[sec])
        sectorEvStd[sec] = stddev(sectorEvEbitdas[sec])
      }

      function computeValuationComposite(
        sym2: string, price2: number, dcfVal2: number,
        pe2: number, pegRatio2: number, evEbitda2: number,
        fcfYield2: number, sector2: string
      ): { score: number; label: string } {
        let total = 0
        let weightUsed = 0

        // DCF Upside (30%)
        if (dcfVal2 > 0 && price2 > 0) {
          const upside = ((dcfVal2 - price2) / price2) * 100
          const norm = Math.max(0, Math.min(100, 50 + upside * 0.5))
          total += norm * 0.30
          weightUsed += 0.30
        }

        // PE sector z-score (25%) — inverted: lower PE = higher score
        if (pe2 > 0 && pe2 < 500 && sectorPEMedian[sector2]) {
          const z = (pe2 - sectorPEMedian[sector2]) / (sectorPEStd[sector2] || 1)
          const norm = Math.max(0, Math.min(100, 50 - z * 20))
          total += norm * 0.25
          weightUsed += 0.25
        }

        // PEG (20%) — lower is better
        if (pegRatio2 > 0 && pegRatio2 < 10) {
          const norm = Math.max(0, Math.min(100, 100 - pegRatio2 * 25))
          total += norm * 0.20
          weightUsed += 0.20
        }

        // EV/EBITDA sector z-score (15%) — inverted
        if (evEbitda2 > 0 && evEbitda2 < 200 && sectorEvMedian[sector2]) {
          const z = (evEbitda2 - sectorEvMedian[sector2]) / (sectorEvStd[sector2] || 1)
          const norm = Math.max(0, Math.min(100, 50 - z * 20))
          total += norm * 0.15
          weightUsed += 0.15
        }

        // FCF Yield (10%) — higher is better
        if (fcfYield2 > 0) {
          const norm = Math.max(0, Math.min(100, fcfYield2 * 10))
          total += norm * 0.10
          weightUsed += 0.10
        }

        const score = weightUsed > 0 ? Math.round(total / weightUsed) : 50
        let label: string
        if (score >= 80) label = 'COK UCUZ'
        else if (score >= 65) label = 'UCUZ'
        else if (score >= 40) label = 'NORMAL'
        else if (score >= 25) label = 'PAHALI'
        else label = 'COK PAHALI'

        return { score, label }
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 6: BUILD FINAL RESULT
      // ═══════════════════════════════════════════════════════════
      const result: StockRow[] = []

      for (const sym of hermesSymbols) {
        const quote = quotesMap.get(sym)
        if (!quote) continue

        const met = metricsMap.get(sym)
        const scores = scoresMap.get(sym)
        const dcf = dcfMap.get(sym)
        const analyst = analystMap.get(sym)
        const target = targetMap.get(sym)
        const kmResult = keyMetricsTTMMap.get(sym)
        const fmpScore = allScores.get(sym)
        const inputForRisk = allInputs.get(sym)
        const risk = inputForRisk ? computeRiskScore(inputForRisk) : { total: 50, level: 'MODERATE' as const }

        const pe = met?.pe || safeNum(quote.pe)
        const dcfVal = dcf?.dcf || 0
        const dcfUpside = dcfVal > 0 && quote.price > 0 ? ((dcfVal - quote.price) / quote.price) * 100 : 0

        const sector = sectorsMap.get(sym) || 'Unknown'
        const valuation = computeValuationComposite(
          sym, quote.price, dcfVal, pe,
          met?.pegRatio || 0, met?.evEbitda || 0,
          kmResult?.freeCashFlowYieldTTM || 0, sector
        )

        result.push({
          symbol: sym,
          companyName: quote.name || sym,
          sector: sectorsMap.get(sym) || 'Unknown',
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          marketCap: quote.marketCap,
          pe,
          pb: met?.pb || 0,
          roe: met?.roe || kmResult?.roeTTM || 0,
          debtEquity: met?.de || 0,
          currentRatio: met?.cr || 0,
          dividendYield: met?.dy || 0,
          volume: quote.volume,
          avgVolume: quote.avgVolume,
          beta: quote.beta || 0,
          evEbitda: met?.evEbitda || 0,
          // V2 Score
          signal: fmpScore?.level || 'NEUTRAL',
          signalScore: fmpScore?.total || 50,
          categories: fmpScore?.categories || {
            valuation: 50, health: 50, growth: 50, analyst: 50, quality: 50,
            insider: 50, institutional: 50, momentum: 50, sector: 50, congressional: 50,
          },
          confidence: fmpScore?.confidence || 30,
          redFlags: fmpScore?.redFlags || [],
          gated: fmpScore?.gated || false,
          // Extra metrics
          altmanZ: scores?.altmanZ || 0,
          piotroski: scores?.piotroski || 0,
          dcf: dcfVal,
          dcfUpside: Math.round(dcfUpside * 10) / 10,
          priceTarget: target?.targetConsensus || 0,
          analystConsensus: analyst?.consensus || '',
          riskScore: risk.total,
          riskLevel: risk.level,
          valuationScore: valuation.score,
          valuationLabel: valuation.label,
          shortFloat: Math.min(100, shareFloatMap.get(sym)?.freeFloat || 0),
        })
      }

      const elapsed = Date.now() - startTime
      console.log(`[V2] Final: ${result.length} stocks scored in ${elapsed}ms`)
      return result
    })

    // Percentile esiklerini cache disinda hesapla (stocks cache'den gelebilir)
    const currentThresholds = computeScoreThresholds(stocks.map(s => s.signalScore))

    return NextResponse.json({
      stocks,
      count: stocks.length,
      thresholds: currentThresholds,
      timestamp: new Date().toISOString(),
      version: 'v3-10cat-percentile',
    })
  } catch (error) {
    console.error('[FMP Terminal /stocks V2] Error:', (error as Error).message)
    return NextResponse.json(
      { error: 'Failed to fetch stocks', message: (error as Error).message },
      { status: 500 }
    )
  }
}
