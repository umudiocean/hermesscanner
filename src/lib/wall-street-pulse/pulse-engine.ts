// Wall Street Pulse Engine — 12 Component Composite Index (6 AI Konsensus)
// Hesaplama: server-side, cache-heavy, SWR pattern

import {
  PulseComponent,
  PulseData,
  BreadthData,
  SmartMoneyData,
  EarningsPulseData,
  ShortSqueezeStock,
  AnalystMomentumData,
  SectorRotationData,
  ForecastData,
  ForecastSignal,
  MarketRegime,
  getPulseLevel,
  getPulseLevelLabel,
} from './pulse-types'

// ─── Component Weight Configuration (6 AI Konsensus) ──────────────
const WEIGHTS: Record<string, number> = {
  breadth:       0.15,  // Market Breadth (A/D)
  highLow:       0.08,  // 52W High/Low Position
  vix:           0.10,  // VIX / Volatilite
  treasurySpread:0.10,  // Treasury 2Y-10Y Spread
  insider:       0.08,  // Insider Sentiment
  congressional: 0.03,  // Congressional Trading
  analyst:       0.08,  // Analyst Momentum
  earnings:      0.08,  // Earnings Beat Rate
  sectorRotation:0.08,  // Sector Rotation
  shortInterest: 0.05,  // Short Interest Pressure
  putCall:       0.10,  // Put/Call Ratio
  institutional: 0.07,  // Institutional Flow
}

// ─── Normalization Helpers ────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function normalizeRange(value: number, minBad: number, maxGood: number): number {
  if (value == null || isNaN(value)) return 50
  if (maxGood === minBad) return 50
  const result = ((value - minBad) / (maxGood - minBad)) * 100
  if (isNaN(result)) return 50
  return clamp(result, 0, 100)
}

function directionFromDelta(current: number, previous: number): 'up' | 'down' | 'flat' {
  const diff = current - previous
  if (diff > 1) return 'up'
  if (diff < -1) return 'down'
  return 'flat'
}

// ─── Component Calculators ────────────────────────────────────────

export interface StockQuote {
  symbol: string
  price: number
  changesPercentage: number
  volume: number
  avgVolume: number
  yearHigh: number
  yearLow: number
  marketCap: number
  beta?: number
  sector?: string
  shortFloat?: number
}

export interface InsiderStat {
  symbol: string
  purchases: number
  sales: number
  totalBought: number
  totalSold: number
}

export interface CongressTrade {
  type: string
  amount?: string
}

export interface AnalystConsensus {
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  consensus: string
}

export interface EarningsSurprise {
  symbol: string
  actualEarningResult: number
  estimatedEarning: number
  surprisePercentage?: number
}

export interface TreasuryRate {
  date: string
  year2: number
  year10: number
}

export interface SectorPerf {
  sector: string
  changesPercentage: number
}

// Offensive sectors benefit from risk-on
const OFFENSIVE = ['Technology', 'Consumer Cyclical', 'Communication Services', 'Financial Services', 'Industrials']
const DEFENSIVE = ['Consumer Defensive', 'Utilities', 'Healthcare', 'Real Estate']

// ─── 1. Market Breadth A/D ───────────────────────────────────────
export function computeBreadth(stocks: StockQuote[]): BreadthData {
  const valid = stocks.filter(s => s.price > 0)
  const advancing = valid.filter(s => s.changesPercentage > 0).length
  const declining = valid.filter(s => s.changesPercentage < 0).length
  const unchanged = valid.length - advancing - declining
  const advanceDeclineRatio = declining > 0 ? advancing / declining : advancing > 0 ? 10 : 1

  const newHighs = valid.filter(s => s.yearHigh > 0 && s.price >= s.yearHigh * 0.97).length
  const newLows = valid.filter(s => s.yearLow > 0 && s.price <= s.yearLow * 1.03).length
  const hlTotal = newHighs + newLows
  const highLowRatio = hlTotal > 0 ? newHighs / hlTotal : 0.5

  const aboveMidpoint = valid.filter(s => {
    const mid = (s.yearHigh + s.yearLow) / 2
    return mid > 0 && s.price > mid
  }).length

  return {
    advancing, declining, unchanged, advanceDeclineRatio,
    newHighs, newLows, highLowRatio,
    aboveMidpoint,
    aboveMidpointPct: valid.length > 0 ? aboveMidpoint / valid.length : 0.5,
    total: valid.length,
  }
}

function scoreBreadth(b: BreadthData): number {
  if (b.total === 0) return 50
  const active = b.advancing + b.declining
  if (active === 0) return 50
  const advPct = b.advancing / active
  return clamp(advPct * 100, 0, 100)
}

function scoreHighLow(b: BreadthData): number {
  return clamp(b.highLowRatio * 100, 0, 100)
}

// ─── 2. VIX / Volatility Proxy ────────────────────────────────────
export function scoreVix(vixValue: number | null, stocks: StockQuote[]): number {
  if (vixValue != null && vixValue > 0) {
    // VIX < 12 = extreme greed (100), VIX > 35 = extreme fear (0)
    return clamp(100 - ((vixValue - 12) / 23) * 100, 0, 100)
  }
  // Fallback: beta aggregation proxy
  const betas = stocks.filter(s => s.beta != null && s.beta! > 0).map(s => s.beta!)
  if (betas.length === 0) return 50
  const avgBeta = betas.reduce((a, b) => a + b, 0) / betas.length
  return clamp(100 - ((avgBeta - 0.5) / 1.5) * 100, 0, 100)
}

// ─── 3. Treasury Spread ──────────────────────────────────────────
export function scoreTreasurySpread(rates: TreasuryRate[]): number {
  if (!rates || rates.length === 0) return 50
  const latest = rates[0]
  const spread = (latest.year10 || 0) - (latest.year2 || 0)
  // spread > 2.0 = very bullish (100), spread < -0.5 = inverted (0)
  return clamp(((spread + 0.5) / 2.5) * 100, 0, 100)
}

// ─── 4. Insider Sentiment ─────────────────────────────────────────
export function scoreInsider(stats: InsiderStat[]): { score: number; data: SmartMoneyData } {
  let buys = 0, sells = 0
  for (const s of stats) {
    buys += s.purchases || 0
    sells += s.sales || 0
  }
  const total = buys + sells
  const ratio = total > 0 ? (buys / total) * 100 : 50
  return {
    score: clamp(ratio, 0, 100),
    data: {
      insiderNetBuys: buys, insiderNetSells: sells,
      insiderRatio: ratio,
      congressBuys: 0, congressSells: 0, congressRatio: 50,
      institutionalDelta: 0,
    },
  }
}

// ─── 5. Congressional ────────────────────────────────────────────
export function scoreCongress(trades: CongressTrade[]): { score: number; buys: number; sells: number } {
  let buys = 0, sells = 0
  for (const t of trades) {
    if (t.type === 'purchase' || t.type === 'Purchase') buys++
    else if (t.type === 'sale' || t.type === 'Sale' || t.type === 'sale_full' || t.type === 'Sale (Full)') sells++
  }
  const total = buys + sells
  const ratio = total > 0 ? (buys / total) * 100 : 50
  return { score: clamp(ratio, 0, 100), buys, sells }
}

// ─── 6. Analyst Momentum ─────────────────────────────────────────
export function scoreAnalyst(consensus: AnalystConsensus[]): { score: number; data: AnalystMomentumData } {
  let up = 0, down = 0
  for (const c of consensus) {
    up += (c.strongBuy || 0) + (c.buy || 0)
    down += (c.sell || 0) + (c.strongSell || 0)
  }
  const total = up + down
  const ratio = total > 0 ? (up / total) * 100 : 50
  return {
    score: clamp(ratio, 0, 100),
    data: { upgrades: up, downgrades: down, netUpgrades: up - down, ratio, avgTargetUpside: 0 },
  }
}

// ─── 7. Earnings Beat Rate ───────────────────────────────────────
export function scoreEarnings(surprises: EarningsSurprise[]): { score: number; data: EarningsPulseData } {
  if (!surprises || surprises.length === 0) {
    return { score: 50, data: { beatCount: 0, missCount: 0, totalReported: 0, beatRate: 50, avgSurprise: 0, trend: 'stable' } }
  }
  let beats = 0, misses = 0, totalSurprise = 0
  for (const e of surprises) {
    const surprise = e.surprisePercentage ?? ((e.actualEarningResult - e.estimatedEarning) / Math.abs(e.estimatedEarning || 1)) * 100
    totalSurprise += surprise
    if (surprise > 0) beats++
    else if (surprise < 0) misses++
  }
  const total = surprises.length
  const beatRate = total > 0 ? (beats / total) * 100 : 50
  const avg = total > 0 ? totalSurprise / total : 0
  const trend = avg > 5 ? 'improving' : avg < -2 ? 'declining' : 'stable'
  return {
    score: clamp(beatRate, 0, 100),
    data: { beatCount: beats, missCount: misses, totalReported: total, beatRate, avgSurprise: avg, trend },
  }
}

// ─── 8. Sector Rotation ──────────────────────────────────────────
export function scoreSectorRotation(sectors: SectorPerf[]): { score: number; data: SectorRotationData } {
  if (!sectors || sectors.length === 0) {
    return { score: 50, data: { offensiveScore: 50, defensiveScore: 50, rotationDirection: 'neutral', sectors: [] } }
  }
  let offSum = 0, offCount = 0, defSum = 0, defCount = 0
  const mapped = sectors.map(s => {
    const chg = Number(s.changesPercentage) || 0
    const isOff = OFFENSIVE.includes(s.sector)
    const isDef = DEFENSIVE.includes(s.sector)
    if (isOff) { offSum += chg; offCount++ }
    if (isDef) { defSum += chg; defCount++ }
    return { name: s.sector, change: chg, type: (isOff ? 'offensive' : 'defensive') as 'offensive' | 'defensive' }
  })
  const offAvg = offCount > 0 ? offSum / offCount : 0
  const defAvg = defCount > 0 ? defSum / defCount : 0
  const diff = offAvg - defAvg
  if (isNaN(diff)) return { score: 50, data: { offensiveScore: 50, defensiveScore: 50, rotationDirection: 'neutral', sectors: mapped } }
  const direction: 'risk-on' | 'neutral' | 'risk-off' = diff > 0.3 ? 'risk-on' : diff < -0.3 ? 'risk-off' : 'neutral'
  const offScore = normalizeRange(offAvg, -3, 3)
  const defScore = normalizeRange(defAvg, -3, 3)
  const composite = normalizeRange(diff, -3, 3)
  return {
    score: composite,
    data: { offensiveScore: offScore, defensiveScore: defScore, rotationDirection: direction, sectors: mapped },
  }
}

// ─── 9. Short Interest ───────────────────────────────────────────
export function scoreShortInterest(stocks: StockQuote[]): { score: number; squeeze: ShortSqueezeStock[] } {
  const highShort = stocks
    .filter(s => (s.shortFloat ?? 0) > 10)
    .sort((a, b) => (b.shortFloat ?? 0) - (a.shortFloat ?? 0))

  const squeezeList: ShortSqueezeStock[] = highShort.slice(0, 20).map(s => {
    const volumeSpike = s.avgVolume > 0 ? s.volume / s.avgVolume : 1
    const sfScore = clamp(((s.shortFloat ?? 0) - 10) / 30 * 100, 0, 100) * 0.45
    const momScore = clamp(((s.changesPercentage ?? 0) + 5) / 15 * 100, 0, 100) * 0.30
    const volScore = clamp((volumeSpike - 1) / 3 * 100, 0, 100) * 0.25
    return {
      symbol: s.symbol,
      shortFloat: s.shortFloat ?? 0,
      dayChange: s.changesPercentage,
      squeezeScore: Math.round(sfScore + momScore + volScore),
      volume: s.volume,
      avgVolume: s.avgVolume,
      volumeSpike: Math.round(volumeSpike * 100) / 100,
    }
  }).sort((a, b) => b.squeezeScore - a.squeezeScore)

  // Market-wide: very high short = bearish (inverted)
  const avgSF = highShort.length > 0 ? highShort.reduce((s, h) => s + (h.shortFloat ?? 0), 0) / highShort.length : 15
  const score = clamp(100 - ((avgSF - 10) / 25) * 100, 0, 100)
  return { score, squeeze: squeezeList }
}

// ─── 10. Put/Call Ratio ──────────────────────────────────────────
export function scorePutCall(ratio: number | null): number {
  if (ratio == null || ratio <= 0) return 50
  // P/C < 0.7 = extreme greed (100), P/C > 1.3 = extreme fear (0)
  return clamp(100 - ((ratio - 0.7) / 0.6) * 100, 0, 100)
}

// ─── 11. Institutional Flow ──────────────────────────────────────
export function scoreInstitutional(delta: number): number {
  // delta > 0 = net buying = bullish, delta < 0 = selling
  return clamp(50 + delta * 50, 0, 100)
}

// ─── COMPOSITE CALCULATOR ────────────────────────────────────────

export interface PulseInputs {
  stocks: StockQuote[]
  insiderStats: InsiderStat[]
  congressTrades: CongressTrade[]
  analystConsensus: AnalystConsensus[]
  earningsSurprises: EarningsSurprise[]
  treasuryRates: TreasuryRate[]
  sectorPerformance: SectorPerf[]
  vixValue: number | null
  putCallRatio: number | null
  institutionalDelta: number
  marketOpen: boolean
}

export function calculatePulse(inputs: PulseInputs): PulseData {
  const breadth = computeBreadth(inputs.stocks)
  const breadthScore = scoreBreadth(breadth)
  const highLowScore = scoreHighLow(breadth)
  const vixScore = scoreVix(inputs.vixValue, inputs.stocks)
  const treasuryScore = scoreTreasurySpread(inputs.treasuryRates)
  const { score: insiderScore, data: smartMoneyBase } = scoreInsider(inputs.insiderStats)
  const congressResult = scoreCongress(inputs.congressTrades)
  const { score: analystScore, data: analystData } = scoreAnalyst(inputs.analystConsensus)
  const { score: earningsScore, data: earningsData } = scoreEarnings(inputs.earningsSurprises)
  const { score: sectorScore } = scoreSectorRotation(inputs.sectorPerformance)
  const { score: shortScore, squeeze } = scoreShortInterest(inputs.stocks)
  const putCallScore = scorePutCall(inputs.putCallRatio)
  const instScore = scoreInstitutional(inputs.institutionalDelta)

  const smartMoney: SmartMoneyData = {
    ...smartMoneyBase,
    congressBuys: congressResult.buys,
    congressSells: congressResult.sells,
    congressRatio: congressResult.score,
    institutionalDelta: inputs.institutionalDelta,
  }

  const components: PulseComponent[] = [
    { id: 'breadth', name: 'Piyasa Genisligi', value: breadthScore, weight: WEIGHTS.breadth, available: true, source: 'FMP batch-quote', description: 'Yukselen / Dusen hisse orani', direction: 'flat', rawValue: breadth.advanceDeclineRatio },
    { id: 'highLow', name: '52H Zirve/Dip', value: highLowScore, weight: WEIGHTS.highLow, available: true, source: 'FMP batch-quote', description: '52 hafta zirvesine yakin / dibe yakin', direction: 'flat', rawValue: breadth.highLowRatio },
    { id: 'vix', name: 'Volatilite (VIX)', value: vixScore, weight: WEIGHTS.vix, available: inputs.vixValue != null, source: inputs.vixValue != null ? 'FRED/Finnhub' : 'Beta proxy', description: 'Piyasa korku endeksi', direction: 'flat', rawValue: inputs.vixValue ?? undefined },
    { id: 'treasurySpread', name: 'Hazine Spread', value: treasuryScore, weight: WEIGHTS.treasurySpread, available: inputs.treasuryRates.length > 0, source: 'FMP treasury-rates', description: '10Y-2Y verim egrisi farki', direction: 'flat' },
    { id: 'insider', name: 'Insider Alis', value: insiderScore, weight: WEIGHTS.insider, available: inputs.insiderStats.length > 0, source: 'FMP insider-trading', description: 'Net insider alis/satis orani', direction: 'flat' },
    { id: 'congressional', name: 'Kongre', value: congressResult.score, weight: WEIGHTS.congressional, available: inputs.congressTrades.length > 0, source: 'FMP senate/house', description: 'Kongre uyeleri net alis/satis', direction: 'flat' },
    { id: 'analyst', name: 'Analist Ivme', value: analystScore, weight: WEIGHTS.analyst, available: inputs.analystConsensus.length > 0, source: 'FMP consensus-bulk', description: 'Net upgrade / downgrade orani', direction: 'flat' },
    { id: 'earnings', name: 'Kazanc Nabzi', value: earningsScore, weight: WEIGHTS.earnings, available: inputs.earningsSurprises.length > 0, source: 'FMP earnings-surprises', description: 'Son 30 gun kazanc beat orani', direction: 'flat' },
    { id: 'sectorRotation', name: 'Sektor Rotasyonu', value: sectorScore, weight: WEIGHTS.sectorRotation, available: inputs.sectorPerformance.length > 0, source: 'FMP sector-snapshot', description: 'Saldirgan vs savunma sektor performansi', direction: 'flat' },
    { id: 'shortInterest', name: 'Aciga Satis', value: shortScore, weight: WEIGHTS.shortInterest, available: true, source: 'FMP shares-float', description: 'Piyasa geneli short float baskisi', direction: 'flat' },
    { id: 'putCall', name: 'Put/Call', value: putCallScore, weight: WEIGHTS.putCall, available: inputs.putCallRatio != null, source: 'CBOE', description: 'Opsiyon put/call orani', direction: 'flat', rawValue: inputs.putCallRatio ?? undefined },
    { id: 'institutional', name: 'Kurumsal Akis', value: instScore, weight: WEIGHTS.institutional, available: Math.abs(inputs.institutionalDelta) > 0.001, source: 'FMP institutional', description: 'Net kurumsal alis/satis degisimi', direction: 'flat' },
  ]

  // NaN guard: force all values to valid numbers
  for (const c of components) {
    if (c.value == null || isNaN(c.value)) c.value = 50
  }

  // Adaptive weighting: skip unavailable components
  const active = components.filter(c => c.available)
  const totalWeight = active.reduce((s, c) => s + c.weight, 0)

  let composite = 50
  if (totalWeight > 0) {
    const raw = active.reduce((s, c) => s + c.value * (c.weight / totalWeight), 0)
    composite = isNaN(raw) ? 50 : raw
  }
  composite = Math.round(clamp(composite, 0, 100))

  const level = getPulseLevel(composite)

  // V4 Forecast Intelligence
  const forecast = computeForecast(composite, breadth, earningsData, inputs.vixValue, vixScore, inputs.sectorPerformance)

  return {
    composite,
    level,
    levelLabel: getPulseLevelLabel(level),
    components,
    breadth,
    smartMoney,
    earnings: earningsData,
    shortSqueeze: squeeze,
    forecast,
    timestamp: new Date().toISOString(),
    marketOpen: inputs.marketOpen,
  }
}

// ─── V4 FORECAST INTELLIGENCE ────────────────────────────────────

function computeForecast(
  composite: number,
  breadth: BreadthData,
  earnings: EarningsPulseData,
  vixRaw: number | null,
  vixScore: number,
  sectorPerf: SectorPerf[],
): ForecastData {
  // Regime detection
  let regime: MarketRegime = 'NORMAL'
  if (vixRaw != null) {
    if (vixRaw >= 30) regime = 'EXTREME'
    else if (vixRaw >= 22) regime = 'HIGH_VOL'
    else if (vixRaw <= 13) regime = 'LOW_VOL'
  } else {
    if (vixScore <= 20) regime = 'EXTREME'
    else if (vixScore <= 40) regime = 'HIGH_VOL'
    else if (vixScore >= 85) regime = 'LOW_VOL'
  }

  // Special signals
  const specials: ForecastSignal[] = []
  const advPct = breadth.total > 0 ? (breadth.advancing / breadth.total) * 100 : 50

  if (advPct < 25) specials.push({ label: 'BREADTH < 25%', type: 'bullish', description: 'Extreme low breadth — mean reversion potential' })
  if (advPct > 80) specials.push({ label: 'EUPHORIA', type: 'bearish', description: 'Extreme optimism — contrarian caution' })
  if (regime === 'EXTREME') specials.push({ label: 'EXTREME VOL', type: 'bullish', description: 'VIX 30+ — panic environment, buying opportunity' })
  if (regime === 'LOW_VOL') specials.push({ label: 'LOW VOL', type: 'info', description: 'VIX < 13 — complacency, volatility may spike' })
  if (breadth.newLows > breadth.newHighs * 3 && breadth.newLows > 20) {
    specials.push({ label: 'CAPITULATION', type: 'bullish', description: `${breadth.newLows} stocks near 52W low` })
  }
  if (breadth.newHighs > breadth.newLows * 3 && breadth.newHighs > 30) {
    specials.push({ label: 'BREAKOUT WAVE', type: 'info', description: `${breadth.newHighs} stocks at 52W high` })
  }
  if (earnings.beatRate > 75) specials.push({ label: 'EARNINGS STRONG', type: 'bullish', description: `Beat rate ${earnings.beatRate.toFixed(0)}%` })
  if (earnings.beatRate < 40) specials.push({ label: 'EARNINGS WEAK', type: 'bearish', description: `Beat rate ${earnings.beatRate.toFixed(0)}%` })

  // Sector rotation signal
  let offSum = 0, defSum = 0, offN = 0, defN = 0
  for (const s of sectorPerf) {
    const chg = Number(s.changesPercentage) || 0
    if (OFFENSIVE.includes(s.sector)) { offSum += chg; offN++ }
    if (DEFENSIVE.includes(s.sector)) { defSum += chg; defN++ }
  }
  const riskAppetite = (offN > 0 ? offSum / offN : 0) - (defN > 0 ? defSum / defN : 0)
  if (riskAppetite < -1.5) specials.push({ label: 'RISK-OFF', type: 'bearish', description: 'Defensive sectors outperforming' })
  if (riskAppetite > 1.5) specials.push({ label: 'RISK-ON', type: 'bullish', description: 'Offensive sectors leading' })

  // Confidence
  const bullishCount = specials.filter(s => s.type === 'bullish').length
  const bearishCount = specials.filter(s => s.type === 'bearish').length
  const maxAlign = Math.max(bullishCount, bearishCount)
  const totalPossible = Math.max(specials.length, 1)
  const confidence = clamp(Math.round((maxAlign / totalPossible) * 100), 10, 100)

  // Boost from special signals
  let boost = 0
  if (bullishCount >= 2) boost = 15
  else if (bullishCount === 1) boost = 8
  if (bearishCount >= 2) boost = -15
  else if (bearishCount === 1 && boost === 0) boost = -8

  const adjustedComposite = clamp(composite + boost, 0, 100)
  const isGoldenSignal = specials.length >= 3 && bullishCount >= 2

  let bias: 'POZITIF' | 'NEGATIF' | 'NOTR' = 'NOTR'
  if (adjustedComposite >= 65 && confidence >= 50) bias = 'POZITIF'
  else if (adjustedComposite >= 72 && confidence >= 37) bias = 'POZITIF'
  else if (adjustedComposite <= 35 && confidence >= 50) bias = 'NEGATIF'
  else if (adjustedComposite <= 28 && confidence >= 37) bias = 'NEGATIF'
  else if (isGoldenSignal) bias = 'POZITIF'

  return {
    bias,
    confidence,
    regime,
    specialSignals: specials,
    isGoldenSignal,
    boostApplied: boost,
  }
}
