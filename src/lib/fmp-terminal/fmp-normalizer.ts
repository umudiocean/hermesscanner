// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Sector-Relative Percentile Normalizer
// Sektör bazlı percentile ranking ile 0-100 normalizasyon
// 5 AI konsensüsü: Percentile rank en güvenilir yöntem
// ═══════════════════════════════════════════════════════════════════

import { CompanyProfile, KeyMetricsTTM, FinancialScores } from './fmp-types'

// ─── Percentile Hesaplama ──────────────────────────────────────────

/**
 * Bir değerin dizi içindeki percentile'ını hesapla (0-100)
 * NaN ve null değerler atlanır
 */
export function percentileRank(value: number, values: number[]): number {
  if (!isFinite(value)) return 50 // Veri yoksa nötr
  const clean = values.filter(v => isFinite(v) && v !== null && v !== undefined)
  if (clean.length === 0) return 50
  
  const sorted = [...clean].sort((a, b) => a - b)
  let rank = 0
  for (const v of sorted) {
    if (v < value) rank++
    else break
  }
  return Math.round((rank / sorted.length) * 100)
}

/**
 * Winsorize: Uç değerleri %1/%99 ile sınırla (outlier dayanıklılık)
 */
export function winsorize(values: number[], lower: number = 0.01, upper: number = 0.99): number[] {
  const clean = values.filter(v => isFinite(v))
  if (clean.length === 0) return values
  
  const sorted = [...clean].sort((a, b) => a - b)
  const lowerBound = sorted[Math.floor(sorted.length * lower)] ?? sorted[0]
  const upperBound = sorted[Math.floor(sorted.length * upper)] ?? sorted[sorted.length - 1]
  
  return values.map(v => {
    if (!isFinite(v)) return v
    return Math.max(lowerBound, Math.min(upperBound, v))
  })
}

// ─── Sektör Gruplaması ─────────────────────────────────────────────

export interface SectorGroup {
  sector: string
  symbols: string[]
  metrics: Map<string, number[]> // metrik adı → tüm sektör değerleri
}

/**
 * Profilleri sektöre göre grupla
 */
export function groupBySector(
  profiles: Map<string, CompanyProfile>
): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  
  for (const [symbol, profile] of profiles) {
    const sector = profile.sector || 'Unknown'
    const list = groups.get(sector) || []
    list.push(symbol)
    groups.set(sector, list)
  }
  
  return groups
}

// ─── Metrik Bazlı Normalizasyon ────────────────────────────────────

export type MetricDirection = 'lower_is_better' | 'higher_is_better'

/**
 * Tek bir metriği sektör içi percentile'a dönüştür
 * direction: 'lower_is_better' → düşük değer yüksek skor (P/E gibi)
 *            'higher_is_better' → yüksek değer yüksek skor (ROE gibi)
 */
export function normalizeMetric(
  value: number,
  sectorValues: number[],
  direction: MetricDirection
): number {
  if (!isFinite(value)) return 50 // Veri yoksa nötr
  
  // Winsorize
  const winsorized = winsorize(sectorValues)
  
  const pct = percentileRank(value, winsorized)
  
  // Yön ayarla
  if (direction === 'lower_is_better') {
    return 100 - pct // Düşük değer = yüksek skor
  }
  return pct // Yüksek değer = yüksek skor
}

// ─── Piecewise Mapping (Özel metrikler) ────────────────────────────

/**
 * Altman Z-Score → 0-100 puan (evrensel eşikler)
 * <1.1 → 0-10 (ciddi iflas riski)
 * 1.1-1.8 → 10-30 (gri bölge)
 * 1.8-3.0 → 30-70 (güvenli bölge)
 * >3.0 → 70-100 (çok güvenli)
 */
export function normalizeAltmanZ(z: number): number {
  if (!isFinite(z)) return 30 // Veri yoksa düşük-nötr
  
  if (z < 0) return 0
  if (z < 1.1) return Math.round((z / 1.1) * 10)
  if (z < 1.8) return Math.round(10 + ((z - 1.1) / 0.7) * 20)
  if (z < 3.0) return Math.round(30 + ((z - 1.8) / 1.2) * 40)
  if (z < 5.0) return Math.round(70 + ((z - 3.0) / 2.0) * 20)
  return Math.min(100, Math.round(90 + ((z - 5.0) / 5.0) * 10))
}

/**
 * Piotroski Score → 0-100 puan (0-9 arası)
 * 0-2 → 0-15
 * 3-4 → 15-40
 * 5-6 → 40-70
 * 7-8 → 70-90
 * 9   → 90-100
 */
export function normalizePiotroski(score: number): number {
  if (!isFinite(score)) return 40 // Veri yoksa nötr
  
  const s = Math.max(0, Math.min(9, Math.round(score)))
  const map: Record<number, number> = {
    0: 0, 1: 5, 2: 15, 3: 25, 4: 40,
    5: 50, 6: 60, 7: 75, 8: 85, 9: 95,
  }
  return map[s] ?? 40
}

/**
 * DCF Upside → 0-100 puan
 * upside = (dcf - price) / price * 100
 * <-30% → 0-15 (çok pahalı)
 * -30% to 0% → 15-50 (pahalı)
 * 0% to +30% → 50-80 (ucuz)
 * >+30% → 80-100 (çok ucuz)
 */
export function normalizeDCFUpside(upside: number): number {
  if (!isFinite(upside)) return 50
  
  if (upside < -50) return 0
  if (upside < -30) return Math.round(((upside + 50) / 20) * 15)
  if (upside < 0) return Math.round(15 + ((upside + 30) / 30) * 35)
  if (upside < 30) return Math.round(50 + (upside / 30) * 30)
  if (upside < 60) return Math.round(80 + ((upside - 30) / 30) * 15)
  return Math.min(100, Math.round(95 + ((upside - 60) / 40) * 5))
}

/**
 * Analist Consensus → 0-100 puan
 * Strong Buy=5, Buy=4, Hold=3, Sell=2, Strong Sell=1
 */
export function normalizeAnalystConsensus(
  strongBuy: number, buy: number, hold: number, sell: number, strongSell: number
): number {
  const total = strongBuy + buy + hold + sell + strongSell
  if (total === 0) return 50 // Veri yoksa nötr
  
  const weighted = (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / total
  // weighted: 1-5 → 0-100
  return Math.round(((weighted - 1) / 4) * 100)
}

/**
 * Price Target Upside → 0-100 puan
 */
export function normalizePriceTargetUpside(upside: number): number {
  if (!isFinite(upside)) return 50
  
  // -30% → 0, 0% → 40, +30% → 80, +60% → 100
  if (upside < -30) return 0
  if (upside < 0) return Math.round(((upside + 30) / 30) * 40)
  if (upside < 30) return Math.round(40 + (upside / 30) * 40)
  if (upside < 60) return Math.round(80 + ((upside - 30) / 30) * 15)
  return Math.min(100, 95)
}

/**
 * Insider Net Buy Ratio → 0-100 puan
 * Net buy olarak pozitifse iyi, negatifse kötü
 */
export function normalizeInsiderActivity(
  purchases: number, sales: number, ceoActivity: boolean
): number {
  if (purchases === 0 && sales === 0) return 50 // Aktivite yok → nötr
  
  const total = purchases + sales
  const buyRatio = purchases / total
  
  // Base score from buy ratio
  let score = Math.round(buyRatio * 80)
  
  // CEO/CFO alımı bonus
  if (ceoActivity && purchases > 0) {
    score = Math.min(100, score + 15)
  }
  
  // Hiç alım yok sadece satış → düşük
  if (purchases === 0 && sales > 0) {
    score = 20
  }
  
  return Math.max(0, Math.min(100, score))
}

/**
 * Institutional Ownership → 0-100 puan
 * %0-20 → 10-30 (düşük kurumsal ilgi)
 * %20-50 → 30-60
 * %50-80 → 60-80
 * %80-100 → 70-90 (çok yoğun → crowding riski)
 */
export function normalizeInstitutionalOwnership(ownershipPct: number, flowDirection: number): number {
  if (!isFinite(ownershipPct)) return 50
  
  let score: number
  if (ownershipPct < 20) score = 10 + (ownershipPct / 20) * 20
  else if (ownershipPct < 50) score = 30 + ((ownershipPct - 20) / 30) * 30
  else if (ownershipPct < 80) score = 60 + ((ownershipPct - 50) / 30) * 20
  else score = 70 + Math.min(20, ((ownershipPct - 80) / 20) * 20)
  
  // Flow direction bonus/penalty
  if (flowDirection > 0) score = Math.min(100, score + 10)
  if (flowDirection < 0) score = Math.max(0, score - 10)
  
  return Math.round(score)
}

/**
 * Earnings Beat Rate → 0-100 puan
 * Son 4 çeyrek beat/miss → her beat 25 puan
 */
export function normalizeEarningsBeat(beats: number, total: number): number {
  if (total === 0) return 50
  return Math.round((beats / total) * 100)
}

/**
 * Congressional Activity → 0-100 puan
 * Alım var → pozitif, satış → negatif, hiç yok → nötr (50, penalize etme)
 */
export function normalizeCongressional(buys: number, sells: number): number {
  if (buys === 0 && sells === 0) return 50 // Veri yok → nötr
  
  const total = buys + sells
  const buyRatio = buys / total
  
  // Cluster buying bonus
  if (buys >= 3) return Math.min(100, Math.round(70 + buys * 5))
  if (buys > 0 && sells === 0) return 75
  
  return Math.round(20 + buyRatio * 60)
}

// ─── Sektör Metrikleri Toplama ─────────────────────────────────────

export interface SectorMetrics {
  pe: number[]
  pb: number[]
  evEbitda: number[]
  roe: number[]
  debtEquity: number[]
  currentRatio: number[]
  revenueGrowth: number[]
  epsGrowth: number[]
  grossMargin: number[]
  operatingMargin: number[]
  netMargin: number[]
  fcfYield: number[]
  dividendYield: number[]
}

/**
 * Sektör bazlı metrik dizileri oluştur (percentile hesaplaması için)
 */
export function buildSectorMetrics(
  sectorSymbols: string[],
  keyMetrics: Map<string, KeyMetricsTTM>,
): SectorMetrics {
  const metrics: SectorMetrics = {
    pe: [], pb: [], evEbitda: [], roe: [],
    debtEquity: [], currentRatio: [],
    revenueGrowth: [], epsGrowth: [],
    grossMargin: [], operatingMargin: [], netMargin: [],
    fcfYield: [], dividendYield: [],
  }
  
  for (const sym of sectorSymbols) {
    const km = keyMetrics.get(sym)
    if (!km) continue
    
    if (isFinite(km.peRatioTTM) && km.peRatioTTM > 0) metrics.pe.push(km.peRatioTTM)
    if (isFinite(km.pbRatioTTM)) metrics.pb.push(km.pbRatioTTM)
    if (isFinite(km.enterpriseValueOverEBITDATTM)) metrics.evEbitda.push(km.enterpriseValueOverEBITDATTM)
    if (isFinite(km.roeTTM)) metrics.roe.push(km.roeTTM)
    if (isFinite(km.debtToEquityTTM)) metrics.debtEquity.push(km.debtToEquityTTM)
    if (isFinite(km.currentRatioTTM)) metrics.currentRatio.push(km.currentRatioTTM)
    if (isFinite(km.dividendYieldTTM)) metrics.dividendYield.push(km.dividendYieldTTM)
    if (isFinite(km.freeCashFlowPerShareTTM) && isFinite(km.peRatioTTM) && km.peRatioTTM > 0) {
      metrics.fcfYield.push(km.freeCashFlowPerShareTTM / (km.netIncomePerShareTTM || 1) * (1 / km.peRatioTTM) * 100)
    }
  }
  
  return metrics
}
