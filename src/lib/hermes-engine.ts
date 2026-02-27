// ═══════════════════════════════════════════════════════════════════
// HERMES V16 — TRADE AI Engine (Pure Z-Score, 15dk Timeframe)
// V377_Z144 | 3 Sinyal (LONG / BEKLE / SHORT)
//
// PARAMETRELER:
//   Timeframe: 15 Dakika (FMP'den canli cekilir)
//   BPD: 26 (6.5 saat x 4 bar/saat)
//   VWAP: 377 gun (9,802 bar) — Fibonacci
//   Z-Score Lookback: 144 gun (3,744 bar) — Fibonacci
//   LONG esik: Z-Score <= -3.40 → Skor >= 66 (yuksek = ucuz)
//   SHORT esik: Z-Score >= +9.20 → Skor <= 8 (dusuk = pahali)
//   Skor: Z-Score → TERS mapping (Z dusuk → skor yuksek)
//   tanh YOK — dogrudan parcali linear interpolasyon
//
// 3 SINYAL (TERS — yuksek skor = alis, dusuk skor = satis):
//   Skor 66-100 → LONG (yesil, ucuz/oversold)
//   Skor 9-65   → BEKLE (gri)
//   Skor 0-8    → SHORT (kirmizi, pahali/overbought)
// ═══════════════════════════════════════════════════════════════════

import { OHLCV, HermesConfig, HermesResult, SignalType, TrendContext } from './types'

// ═══════════════════════════════════════════════════════════════════
// V16 TRADE AI — PARAMETRELER (2026-02-27)
// 15dk Timeframe — V377_Z144 | 3 Sinyal
// ═══════════════════════════════════════════════════════════════════
const BPD = 26  // 15dk: 6.5 saat x 4 bar/saat
const VWAP_DAYS = 377
const ZSCORE_DAYS = 144

// Z-Score esikleri — Backtest ile dogrulanmis (WR %94)
const Z_LONG_THRESHOLD = -3.40   // bu ve altinda → Skor 0 (LONG bolgesi)
const Z_SHORT_THRESHOLD = 9.20   // bu ve ustunde → Skor 100 (SHORT bolgesi)

const DEFAULT_CONFIG: HermesConfig = {
  // VWAP: 377 gun x 26 bar/gun = 9,802 bar
  vwap_52w_len: VWAP_DAYS * BPD,

  atr_length: 14,

  // Pure Z-Score (%100)
  weight_52w: 100,
  weight_mfi: 0,
  weight_rsi: 0,

  rsi_length: 14,
  mfi_length: 14,
  adx_length: 14,

  // Z-Score: 144 gun x 26 bar/gun = 3,744 bar
  zscore_len_52w: ZSCORE_DAYS * BPD,
}

const DELAY_CONFIG = {
  DELAY_BARS: 1,
  CONFIRM_SCORE_TH: 92,
}

// ═══════════════════════════════════════════════════════════════════
// V16 TRADE AI — GIRIS FILTRELERI (3 sinyal)
// ═══════════════════════════════════════════════════════════════════
const ENTRY_FILTERS = {
  RSI_LONG: 40,
  RSI_SHORT: 60,
  MFI_LONG: 50,
  MFI_SHORT: 70,
  ADX_MAX: 999,
  LONG_TH: 66,   // Skor 66-100 → LONG (yuksek skor = ucuz/oversold)
  SHORT_TH: 8,   // Skor 0-8 → SHORT (dusuk skor = pahali/overbought)
}

export { ENTRY_FILTERS, DELAY_CONFIG }

// ═══════════════════════════════════════════════════════════════════
// V12 TREND ÇARPANI PARAMETRELERİ (ZA1 — Backtest Kazanan)
// ═══════════════════════════════════════════════════════════════════
const TREND_CONFIG = {
  // Sektör avg Z-Score → point mapping divisor (keskin)
  SECTOR_ZSCORE_DIV: 1.0,

  // Asimetrik çarpan aralıkları
  BOOST: 0.25,    // Bullish ortamda max boost (+25%)
  DAMP: 0.15,     // Bearish ortamda max dampen (-15%)

  // Trend composite ağırlıkları
  MARKET_W: 0.33,
  SECTOR_W: 0.34,
  INDUSTRY_W: 0.33,
}

export { TREND_CONFIG }

/**
 * V12: Breadth → trend point (0-100, düşük=bullish)
 * Backtest ile birebir aynı formül
 */
function breadthToPoint(breadth: number, momentum: number): number {
  const c = (50.0 - breadth) / 25.0
  let b = 50.0 + 40.0 * Math.tanh(c)
  if (breadth > 55 && momentum < -3) b -= Math.min(10, Math.abs(momentum) * 1.5)
  else if (breadth < 45 && momentum > 3) b += Math.min(10, Math.abs(momentum) * 1.5)
  else if (breadth > 55 && momentum > 5) b += Math.min(8, momentum * 0.8)
  else if (breadth < 45 && momentum < -5) b -= Math.min(8, Math.abs(momentum) * 0.8)
  return Math.max(5.0, Math.min(95.0, b))
}

/**
 * V12: Sektör avg Z-Score → trend point (0-100)
 * ZA1 yöntemi: tanh(avg_z / div) mapping
 */
function sectorZScoreToPoint(avgZScore: number): number {
  return 50.0 + 50.0 * Math.tanh(avgZScore / TREND_CONFIG.SECTOR_ZSCORE_DIV)
}

/**
 * V12: Industry relative performance → trend point
 */
function industryRelativeToPoint(rel: number): number {
  return Math.max(5.0, Math.min(95.0, 50.0 - rel * 0.5))
}

/**
 * V12: Trend context → asimetrik çarpan
 * Bullish (composite < 50): score deviation amplified (boost)
 * Bearish (composite > 50): score deviation dampened
 */
function computeTrendMultiplier(trendContext?: TrendContext): {
  multiplier: number
  composite: number
  marketPoint: number
  sectorPoint: number
  industryPoint: number
} {
  if (!trendContext) {
    return { multiplier: 1.0, composite: 50, marketPoint: 50, sectorPoint: 50, industryPoint: 50 }
  }

  const marketPoint = breadthToPoint(trendContext.marketBreadth, trendContext.marketMomentum)
  const sectorPoint = sectorZScoreToPoint(trendContext.sectorAvgZScore)
  const industryPoint = industryRelativeToPoint(trendContext.industryRelative)

  const composite = marketPoint * TREND_CONFIG.MARKET_W +
                    sectorPoint * TREND_CONFIG.SECTOR_W +
                    industryPoint * TREND_CONFIG.INDUSTRY_W

  let multiplier: number
  if (composite < 50) {
    // Bullish: boost
    multiplier = 1.0 + TREND_CONFIG.BOOST * (50 - composite) / 50
  } else {
    // Bearish: damp
    multiplier = 1.0 - TREND_CONFIG.DAMP * (composite - 50) / 50
  }

  return { multiplier, composite, marketPoint, sectorPoint, industryPoint }
}

// ═══════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR — Pine Script ta.* birebir karşılıkları
// ═══════════════════════════════════════════════════════════════════

function rollingSum(data: number[], period: number): number[] {
  const n = data.length
  const result = new Array(n).fill(NaN)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += data[i]
    if (i >= period) sum -= data[i - period]
    if (i >= period - 1) result[i] = sum
  }
  return result
}

function sma(data: number[], period: number): number[] {
  const n = data.length
  const result = new Array(n).fill(NaN)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += data[i]
    if (i >= period) sum -= data[i - period]
    if (i >= period - 1) result[i] = sum / period
  }
  return result
}

function wilderSmooth(data: number[], period: number): number[] {
  const n = data.length
  const result = new Array(n).fill(NaN)
  if (n < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += isNaN(data[i]) ? 0 : data[i]
  }
  result[period - 1] = sum / period
  for (let i = period; i < n; i++) {
    const val = isNaN(data[i]) ? 0 : data[i]
    result[i] = (result[i - 1] * (period - 1) + val) / period
  }
  return result
}

function trueRange(high: number[], low: number[], close: number[]): number[] {
  const n = high.length
  const result = new Array(n).fill(0)
  result[0] = high[0] - low[0]
  for (let i = 1; i < n; i++) {
    result[i] = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    )
  }
  return result
}

function calcAtr(high: number[], low: number[], close: number[], period: number): number[] {
  const tr = trueRange(high, low, close)
  return wilderSmooth(tr, period)
}

function calcRsi(close: number[], period: number): number[] {
  const n = close.length
  const result = new Array(n).fill(50)
  if (n < period + 1) return result
  const gains = new Array(n).fill(0)
  const losses = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const change = close[i] - close[i - 1]
    gains[i] = change > 0 ? change : 0
    losses[i] = change < 0 ? -change : 0
  }
  const avgGain = wilderSmooth(gains.slice(1), period)
  const avgLoss = wilderSmooth(losses.slice(1), period)
  for (let i = 0; i < avgGain.length; i++) {
    const gi = avgGain[i]
    const li = avgLoss[i]
    if (!isNaN(gi) && !isNaN(li)) {
      if (li === 0) result[i + 1] = gi === 0 ? 50 : 100
      else result[i + 1] = 100 - 100 / (1 + gi / li)
    }
  }
  return result
}

function calcMfi(
  high: number[], low: number[], close: number[], volume: number[], period: number
): number[] {
  const n = close.length
  const result = new Array(n).fill(50)
  if (n < period + 1) return result
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3)
  const mf = tp.map((t, i) => t * (volume[i] || 1))
  for (let i = period; i < n; i++) {
    let posMF = 0, negMF = 0
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posMF += mf[j]
      else if (tp[j] < tp[j - 1]) negMF += mf[j]
    }
    if (negMF === 0) result[i] = posMF === 0 ? 50 : 100
    else result[i] = 100 - 100 / (1 + posMF / negMF)
  }
  return result
}

function calcDmi(high: number[], low: number[], close: number[], period: number) {
  const n = high.length
  const adxArr = new Array(n).fill(25)
  if (n < period * 2) return { adx: adxArr }
  const plusDM = new Array(n).fill(0)
  const minusDM = new Array(n).fill(0)
  const tr = trueRange(high, low, close)
  for (let i = 1; i < n; i++) {
    const upMove = high[i] - high[i - 1]
    const downMove = low[i - 1] - low[i]
    plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0
  }
  const smoothTR = wilderSmooth(tr, period)
  const smoothPlusDM = wilderSmooth(plusDM, period)
  const smoothMinusDM = wilderSmooth(minusDM, period)
  const dx = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    if (!isNaN(smoothTR[i]) && smoothTR[i] > 0) {
      const diplus = 100 * (smoothPlusDM[i] || 0) / smoothTR[i]
      const diminus = 100 * (smoothMinusDM[i] || 0) / smoothTR[i]
      const sum = diplus + diminus
      dx[i] = sum > 0 ? 100 * Math.abs(diplus - diminus) / sum : 0
    }
  }
  const adxSmooth = wilderSmooth(dx, period)
  for (let i = 0; i < n; i++) {
    if (!isNaN(adxSmooth[i])) adxArr[i] = adxSmooth[i]
  }
  return { adx: adxArr }
}

/**
 * Z-Score → Skor (0-100) — TERS MAPPING
 * Dusuk Z-Score (ucuz/oversold) = YUKSEK skor (LONG)
 * Yuksek Z-Score (pahali/overbought) = DUSUK skor (SHORT)
 *
 *   Z <= -3.40  → skor 100  (en guclu LONG)
 *   Z = -3.40   → skor 66   (LONG esigi)
 *   Z = 0       → skor 37   (BEKLE ortasi)
 *   Z = +9.20   → skor 8    (SHORT esigi)
 *   Z >= +9.20  → skor 0    (en guclu SHORT)
 *
 * Sinyal esikleri: LONG >= 66, BEKLE 9-65, SHORT <= 8
 */
function zscoreToScore(zs: number): number {
  if (isNaN(zs) || !isFinite(zs)) return 37

  // Ana bolge: Z_LONG → 66, Z_SHORT → 8
  if (zs >= Z_LONG_THRESHOLD && zs <= Z_SHORT_THRESHOLD) {
    const range = Z_SHORT_THRESHOLD - Z_LONG_THRESHOLD  // 12.60
    const ratio = (zs - Z_LONG_THRESHOLD) / range       // 0..1
    return Math.round(66 - ratio * (66 - 8))             // 66..8
  }

  // Sol kuyruk: z < -3.40 → skor > 66 (LONG bolgesi)
  if (zs < Z_LONG_THRESHOLD) {
    const extentBelow = Z_LONG_THRESHOLD - zs
    const maxExtent = Math.abs(Z_LONG_THRESHOLD)       // 3.40
    const ratio = Math.min(extentBelow / maxExtent, 1)
    return Math.round(66 + ratio * 34)                  // 66..100
  }

  // Sag kuyruk: z > +9.20 → skor < 8 (SHORT bolgesi)
  const extentAbove = zs - Z_SHORT_THRESHOLD
  const maxExtent = Math.abs(Z_LONG_THRESHOLD)         // 3.40
  const ratio = Math.min(extentAbove / maxExtent, 1)
  return Math.round(8 * (1 - ratio))                    // 8..0
}

// V7: RSI nonlinear strong mapping — uçlarda hassas, ortada yumuşak
function mapRsiNonlinear(rsi: number): number {
  const r = Math.max(0, Math.min(100, rsi))
  if (r <= 25) return r * 35 / 25
  if (r <= 75) return 35 + (r - 25) * 30 / 50
  return 65 + (r - 75) * 35 / 25
}

// V7: MFI nonlinear strong mapping
function mapMfiNonlinear(mfi: number): number {
  const m = Math.max(0, Math.min(100, mfi))
  if (m <= 20) return m * 35 / 20
  if (m <= 80) return 35 + (m - 20) * 30 / 60
  return 65 + (m - 80) * 35 / 20
}

// Pine Script ta.stdev kullanır → sample stdev (N-1'e böler)
function computeStdevAt(data: number[], period: number, pos: number): number {
  if (period <= 2 || pos < period - 1) return 0
  const start = pos - period + 1
  let sum = 0
  for (let i = start; i <= pos; i++) {
    sum += data[i]
  }
  const mean = sum / period
  let sumSq = 0
  for (let i = start; i <= pos; i++) {
    const d = data[i] - mean
    sumSq += d * d
  }
  // Pine Script ta.stdev = sample stdev → /(period - 1)
  const variance = sumSq / (period - 1)
  return Math.sqrt(Math.max(0, variance))
}

/** Pine Script ta.sma karşılığı — belirli pozisyondaki ortalama */
function computeMeanAt(data: number[], period: number, pos: number): number {
  if (period <= 0 || pos < period - 1) return 0
  const start = pos - period + 1
  let sum = 0
  for (let i = start; i <= pos; i++) {
    sum += data[i]
  }
  return sum / period
}

function createNeutralResult(reason: string): HermesResult {
  return {
    score: 50, signal: 'BEKLE', signalType: 'neutral',
    components: { point52w: 50, pointMfi: 50, pointRsi: 50 },
    multipliers: { atrCarpan: 1, adxCarpan: 1, quality: 1 },
    rawScore: 50,
    indicators: { rsi: 50, mfi: 50, adx: 25, atr: 0, volRatio: 1 },
    zscores: { zscore52w: 0 },
    bands: { vwap52w: 0, upperInner: 0, lowerInner: 0, upperOuter: 0, lowerOuter: 0 },
    touches: { touchOuterUpper: false, touchOuterLower: false, touchInnerUpper: false, touchInnerLower: false },
    filters: { longFiltersOk: false, shortFiltersOk: false, rsiOk: false, mfiOk: false, adxOk: false },
    price: 0, dataPoints: 0, hasEnough52w: false, error: reason,
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANA HESAPLAMA FONKSIYONU — TEK TIMEFRAME (15dk)
//
// bars: 15dk OHLCV → VWAP + Z-Score + RSI + MFI + ADX + ATR
// Backtest ile BIREBIR ayni hesaplama.
// Daily veri GEREKMEZ — her sey 15dk bardan hesaplanir.
// ═══════════════════════════════════════════════════════════════════

export function calculateHermes(
  bars: OHLCV[],
  config: Partial<HermesConfig> = {},
  _bars15m?: OHLCV[],
  trendContext?: TrendContext
): HermesResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const n = bars.length
  const last = n - 1

  // VWAP 377 gun = 9,802 bar gerekli. Eksik veri ile skor GUVENILMEZ.
  // Minimum: tam VWAP periodu (377 gun x BPD) gerekli
  const minBars = cfg.vwap_52w_len
  if (n < minBars) {
    return createNeutralResult(`Yetersiz veri: ${n}/${minBars} bar (${Math.round(minBars / BPD)} gun VWAP gerekli)`)
  }

  const close = bars.map(b => b.close)
  const volume = bars.map(b => b.volume || 1)
  const high = bars.map(b => b.high)
  const low = bars.map(b => b.low)

  // ═══ VWAP (Volume-Weighted Average Price) ═══
  // Use available data length if less than configured VWAP period
  const effectiveVwapLen = Math.min(cfg.vwap_52w_len, n)
  const cv = close.map((c, i) => c * volume[i])
  const sumCV = rollingSum(cv, effectiveVwapLen)
  const sumV = rollingSum(volume, effectiveVwapLen)
  const vwap = sumCV.map((scv, i) =>
    isNaN(scv) || isNaN(sumV[i]) || sumV[i] === 0 ? close[i] : scv / sumV[i]
  )

  // VWAP kisiyla calisabilir ama Z-Score icin minimum zscore period dolmus olmali
  const hasEnough = n >= cfg.zscore_len_52w * 2

  // ═══ Z-Score — Backtest ile BIREBIR ═══
  // dev = close - VWAP
  // z_mean = rolling_mean(dev, zscore_len)
  // z_std = rolling_stdev(dev, zscore_len)  [sample stdev, ddof=1]
  // zscore = (dev - z_mean) / z_std
  const dev = close.map((c, i) => c - vwap[i])
  const zLen = Math.min(cfg.zscore_len_52w, last + 1)
  const minZLen = Math.min(cfg.zscore_len_52w, Math.max(10, Math.floor(cfg.zscore_len_52w * 0.5)))
  const zStd = zLen >= minZLen ? computeStdevAt(dev, zLen, last) : 0
  const zMean = zLen >= minZLen ? computeMeanAt(dev, zLen, last) : 0
  // stdev minimum esik: fiyatin %0.1'inden kucukse Z-Score guvenilmez
  const minStd = close[last] * 0.001
  const zRaw = zStd > minStd ? (dev[last] - zMean) / zStd : 0
  // Z-Score clamp: -10..+10 arasi mantikli, disi istatistiksel anormallik
  const zscore = (isNaN(zRaw) || !isFinite(zRaw)) ? 0 : Math.max(-10, Math.min(10, zRaw))

  // Z-Score bazli bantlar
  const zsCenter = vwap[last] + zMean
  const upperInner = zsCenter + 1.0 * zStd
  const lowerInner = zsCenter - 1.0 * zStd
  const upperOuter = zsCenter + 2.0 * zStd
  const lowerOuter = zsCenter - 2.0 * zStd

  // Z-Score → skor (linear mapping, tanh yok)
  const point52w = hasEnough ? zscoreToScore(zscore) : 50

  // ═══ GOSTERGELER (15dk bardan — bilgi amacli) ═══
  const rsiArr = calcRsi(close, cfg.rsi_length)
  const mfiArr = calcMfi(high, low, close, volume, cfg.mfi_length)
  const { adx: adxArr } = calcDmi(high, low, close, cfg.adx_length)
  const atrArr = calcAtr(high, low, close, cfg.atr_length)

  const rsiVal = rsiArr[last] ?? 50
  const mfiVal = mfiArr[last] ?? 50
  const adxVal = adxArr[last] ?? 25
  const atrVal = atrArr[last] || 0

  const atrClean = atrArr.map(v => isNaN(v) ? 0 : v)
  const atrSma100 = sma(atrClean, Math.min(100, n))
  const volRatio = (!isNaN(atrSma100[last]) && atrSma100[last] > 0)
    ? atrVal / atrSma100[last] : 1

  // ═══ PUANLAMA: PURE Z-SCORE ═══
  const pointMfi = mapMfiNonlinear(mfiVal)
  const pointRsi = mapRsiNonlinear(rsiVal)

  const weightTotal = cfg.weight_52w + cfg.weight_mfi + cfg.weight_rsi
  const rawScore = weightTotal > 0 ? (
    point52w * cfg.weight_52w +
    pointMfi * cfg.weight_mfi +
    pointRsi * cfg.weight_rsi
  ) / weightTotal : point52w

  // ═══ TREND CARPANI ═══
  const trend = computeTrendMultiplier(trendContext)

  // ═══ FINAL SKOR ═══
  const rawTotal = 50 + (rawScore - 50) * trend.multiplier
  const totalScore = (isNaN(rawTotal) || !isFinite(rawTotal)) ? 50 : Math.max(0, Math.min(100, rawTotal))

  // ═══ SINYAL BELIRLEME ═══
  let signal: string
  let signalType: SignalType
  let delayInfo: { barsRemaining: number; triggerScore: number; confirmed: boolean; waitingForConfirm: boolean } | undefined

  const longFiltersOk = rsiVal <= ENTRY_FILTERS.RSI_LONG &&
                        mfiVal <= ENTRY_FILTERS.MFI_LONG &&
                        adxVal <= ENTRY_FILTERS.ADX_MAX

  const shortFiltersOk = rsiVal >= ENTRY_FILTERS.RSI_SHORT &&
                         mfiVal >= ENTRY_FILTERS.MFI_SHORT &&
                         adxVal <= ENTRY_FILTERS.ADX_MAX

  // 3 sinyal sistemi (TERS): LONG (66-100) / BEKLE (9-65) / SHORT (0-8)
  // Yuksek skor = ucuz = LONG, dusuk skor = pahali = SHORT
  const longTh = cfg.long_th ?? ENTRY_FILTERS.LONG_TH   // 66
  const shortTh = cfg.short_th ?? ENTRY_FILTERS.SHORT_TH // 8

  if (totalScore >= longTh) {
    signal = 'LONG'
    signalType = 'long'
  } else if (totalScore <= shortTh) {
    signal = 'SHORT'
    signalType = 'short'
  } else {
    signal = 'BEKLE'
    signalType = 'neutral'
  }

  // Band Inner temas (bilgi amacli)
  const touchInnerUpper = last > 0 && high[last] >= upperInner && high[last - 1] < upperInner
  const touchInnerLower = last > 0 && low[last] <= lowerInner && low[last - 1] > lowerInner

  const touches = {
    touchOuterUpper: false,
    touchOuterLower: false,
    touchInnerUpper,
    touchInnerLower,
  }

  const r = (v: number) => Math.round(v * 100) / 100
  const adxOk = adxVal <= ENTRY_FILTERS.ADX_MAX

  return {
    score: r(totalScore),
    signal,
    signalType,
    components: { point52w: r(point52w), pointMfi: r(pointMfi), pointRsi: r(pointRsi) },
    multipliers: { atrCarpan: 1, adxCarpan: 1, quality: 1 },
    rawScore: r(rawScore),
    indicators: { rsi: r(rsiVal), mfi: r(mfiVal), adx: r(adxVal), atr: r(atrVal), volRatio: r(volRatio) },
    zscores: { zscore52w: r(zscore) },
    bands: {
      vwap52w: r(vwap[last]),
      upperInner: r(upperInner), lowerInner: r(lowerInner),
      upperOuter: r(upperOuter), lowerOuter: r(lowerOuter),
    },
    touches,
    filters: {
      longFiltersOk,
      shortFiltersOk,
      rsiOk: true,
      mfiOk: true,
      adxOk,
    },
    delay: delayInfo,
    trend: trendContext ? {
      multiplier: r(trend.multiplier),
      composite: r(trend.composite),
      marketPoint: r(trend.marketPoint),
      sectorPoint: r(trend.sectorPoint),
      industryPoint: r(trend.industryPoint),
    } : undefined,
    price: close[last],
    dataPoints: n,
    hasEnough52w: hasEnough,
  }
}
