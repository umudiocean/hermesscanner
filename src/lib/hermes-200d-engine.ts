// ═══════════════════════════════════════════════════════════════════
// HERMES V8 — 5 GÜN Scoring Engine (15dk Native)
// Pine Script ile BİREBİR AYNI hesaplama mantığı:
//   VWAP + Z-Score → 15dk mumlardan doğrudan (request.security gerekmez)
//   RSI / MFI / ADX / ATR → 15dk native (14 bar)
//
// 3 Bileşen: Z-Score (%70) + MFI (%15) + RSI (%15)
// 2 Çarpan: ATR Sigmoid + ADX Sigmoid
// V8: Sinyal Eşikleri: ≤20 S.LONG / 21-40 LONG / 41-59 NOTR / 60-84 SHORT / ≥85 S.SHORT
// V8: 3 bar gecikme onayı (scanner'da state yönetimi ile)
//
// Backtest V8 (500 sembol, 15dk, 5 yıl):
//   PF: 1.727 | WR: 96.6% | 11,442 trade | SL: 260
//
// 52W ile AYNI mimari, tek fark: VWAP=5D, Z-Score=12D, 15dk native
// ═══════════════════════════════════════════════════════════════════

import { OHLCV, Hermes200DConfig, Hermes200DResult, SignalType } from './types'

// ═══════════════════════════════════════════════════════════════════
// BACKTEST KİLİTLİ PARAMETRELER — 5 GÜN (15dk)
//
// NASDAQ: 6.5 saat/gün = 26 bar/gün (15dk)
// 5 Gün = 5 × 26 = 130 bar (VWAP)
// Z-Score LB = 12 gün × 26 = 312 bar
// ═══════════════════════════════════════════════════════════════════

const BARS_PER_DAY = 26

const DEFAULT_5G_CONFIG = {
  // VWAP: 5 Gün = 130 bar (15dk native)
  vwap_5g_len: 5 * BARS_PER_DAY,     // 130

  // Z-Score Lookback: 12 gün = 312 bar (backtest optimal)
  zscore_5g_len: 12 * BARS_PER_DAY,  // 312

  // ATR periyodu (15dk native)
  atr_length: 14,

  // Puanlama Ağırlıkları: Z-Score %70, MFI %15, RSI %15
  weight_5g: 70,
  weight_mfi: 15,
  weight_rsi: 15,

  // Gösterge Periyotları (14 bar — 15dk native)
  rsi_length: 14,
  mfi_length: 14,
  adx_length: 14,
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

function tanh(x: number): number {
  // V7: clamp(-6, 6) overflow fix
  const cx = Math.max(-6, Math.min(6, x))
  const e2x = Math.exp(2 * cx)
  return (e2x - 1) / (e2x + 1)
}

function zscoreTo100(zs: number): number {
  return 50 + 50 * tanh(zs / 1.8)
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
  if (period <= 1 || pos < period - 1) return 0
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

/** Nötr sonuç — Hermes200DResult arayüzüne uyumlu */
function createNeutralResult(reason: string): Hermes200DResult {
  return {
    score: 50, signal: 'NOTR', signalType: 'neutral',
    components: { point200d: 50, point50d: 50, pointHalfd: 50, pointMfi: 50, pointRsi: 50 },
    multipliers: { atrCarpan: 1, adxCarpan: 1, quality: 1 },
    rawScore: 50,
    indicators: { rsi: 50, mfi: 50, adx: 25, atr: 0, volRatio: 1 },
    zscores: { zscore200d: 0, zscore50d: 0, zscoreHalfd: 0 },
    bands: {
      vwap200d: 0, upper200d: 0, lower200d: 0,
      vwap50d: 0, upper50d: 0, lower50d: 0,
      vwapHalfd: 0, upperHalfd: 0, lowerHalfd: 0,
    },
    touches: {
      touch200dUpper: false, touch200dLower: false,
      touch50dUpper: false, touch50dLower: false,
      touchHalfdUpper: false, touchHalfdLower: false,
    },
    price: 0, dataPoints: 0,
    hasEnough200d: false, hasEnough50d: false, hasEnoughHalfd: false,
    error: reason,
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANA HESAPLAMA FONKSİYONU — 5 GÜN (15dk Native)
//
// bars: 15dk OHLCV → VWAP + Z-Score + RSI + MFI + ADX + ATR
// Her şey 15dk mumlardan hesaplanır (request.security yok)
//
// Hermes200DResult arayüzü korunuyor (UI uyumluluğu için).
// Eski 200D/50D/HalfD alanları yeniden kullanılıyor:
//   point200d → 5G Z-Score puanı (%70)
//   point50d  → 0 (kullanılmıyor)
//   pointHalfd → 0 (kullanılmıyor)
//   zscore200d → 5G Z-Score
//   vwap200d → 5G VWAP
//   upper200d / lower200d → Z=±1 iç bant
//   vwap50d → Z=0 merkez
//   upper50d / lower50d → Z=±2 dış bant
// ═══════════════════════════════════════════════════════════════════

export function calculateHermes200D(
  bars: OHLCV[],
  config: Partial<Hermes200DConfig> = {}
): Hermes200DResult {
  const n = bars.length

  if (n < 50) {
    return createNeutralResult(`Yetersiz veri: ${n} bar (min 50)`)
  }

  // Array'leri çıkart
  const high = bars.map(b => b.high)
  const low = bars.map(b => b.low)
  const close = bars.map(b => b.close)
  const volume = bars.map(b => b.volume || 1)
  const last = n - 1

  // ═══════════════════════════════════════════════════════════════
  // 5G VWAP (15dk native — 130 bar)
  // ═══════════════════════════════════════════════════════════════

  const cv = close.map((c, i) => c * volume[i])
  const sumCV = rollingSum(cv, DEFAULT_5G_CONFIG.vwap_5g_len)
  const sumV = rollingSum(volume, DEFAULT_5G_CONFIG.vwap_5g_len)

  const vwap5g = sumCV.map((scv, i) =>
    isNaN(scv) || isNaN(sumV[i]) || sumV[i] === 0 ? close[i] : scv / sumV[i]
  )

  // Pine Script'te VWAP geçerli olduktan sonra ta.sma/stdev oluşması için
  // vwap_len + zscore_len bar gerekir (130 + 312 = 442 bar minimum)
  const hasEnough = n >= DEFAULT_5G_CONFIG.vwap_5g_len + DEFAULT_5G_CONFIG.zscore_5g_len

  // ═══════════════════════════════════════════════════════════════
  // Z-SCORE (15dk native — 312 bar lookback)
  // ═══════════════════════════════════════════════════════════════

  const dev5g = close.map((c, i) => c - vwap5g[i])
  const zLen = Math.min(DEFAULT_5G_CONFIG.zscore_5g_len, last + 1)
  const zStd = zLen > 10 ? computeStdevAt(dev5g, zLen, last) : 0
  const zMean = zLen > 10 ? computeMeanAt(dev5g, zLen, last) : 0
  const zscore5g = zStd > 0 ? (dev5g[last] - zMean) / zStd : 0

  // Z-Score bazlı bantlar (Pine Script ile birebir)
  const zsCenter = vwap5g[last] + zMean
  const innerUpper = zsCenter + 1.0 * zStd    // Z = +1
  const innerLower = zsCenter - 1.0 * zStd    // Z = -1
  const outerUpper = zsCenter + 2.0 * zStd    // Z = +2
  const outerLower = zsCenter - 2.0 * zStd    // Z = -2

  // Z-Score bileşeni
  const point5g = hasEnough ? zscoreTo100(zscore5g) : 50

  // ═══════════════════════════════════════════════════════════════
  // GÖSTERGELER (15dk native)
  // ═══════════════════════════════════════════════════════════════

  const rsiArr = calcRsi(close, DEFAULT_5G_CONFIG.rsi_length)
  const mfiArr = calcMfi(high, low, close, volume, DEFAULT_5G_CONFIG.mfi_length)
  const { adx: adxArr } = calcDmi(high, low, close, DEFAULT_5G_CONFIG.adx_length)
  const atrArr = calcAtr(high, low, close, DEFAULT_5G_CONFIG.atr_length)

  const rsiVal = rsiArr[last] ?? 50
  const mfiVal = mfiArr[last] ?? 50
  const adxVal = adxArr[last] ?? 25
  const atrVal = atrArr[last] || 0

  const atrClean = atrArr.map(v => isNaN(v) ? 0 : v)
  const atrSma100 = sma(atrClean, Math.min(100, n))
  const volRatio = (!isNaN(atrSma100[last]) && atrSma100[last] > 0)
    ? atrVal / atrSma100[last] : 1

  // ═══════════════════════════════════════════════════════════════
  // PUANLAMA — 52W ile BİREBİR AYNI formül
  // ═══════════════════════════════════════════════════════════════

  const pointMfi = mapMfiNonlinear(mfiVal)  // V7: nonlinear
  const pointRsi = mapRsiNonlinear(rsiVal)  // V7: nonlinear

  const weightTotal = DEFAULT_5G_CONFIG.weight_5g + DEFAULT_5G_CONFIG.weight_mfi + DEFAULT_5G_CONFIG.weight_rsi
  const rawScore = (
    point5g * DEFAULT_5G_CONFIG.weight_5g +
    pointMfi * DEFAULT_5G_CONFIG.weight_mfi +
    pointRsi * DEFAULT_5G_CONFIG.weight_rsi
  ) / weightTotal

  // V7 Çarpanlar
  const atrCarpan = 0.5 + 0.5 / (1 + Math.exp(-5 * (volRatio - 0.5)))   // V7: center 0.5
  const adxCarpan = 1.15 - 0.50 / (1 + Math.exp(-0.15 * (adxVal - 25)))  // V7: height 0.50
  const quality = atrCarpan * adxCarpan

  // Final skor
  const totalScore = Math.max(0, Math.min(100, 50 + (rawScore - 50) * quality))

  // ═══════════════════════════════════════════════════════════════
  // V8 SİNYAL KADEMELERİ (20/85) + 3 bar gecikme
  // Not: 3 bar gecikme onayı scanner state'inde uygulanır
  // ═══════════════════════════════════════════════════════════════

  let signal: string
  let signalType: SignalType

  if (totalScore <= 20) { signal = 'STRONG LONG'; signalType = 'strong_long' }
  else if (totalScore <= 40) { signal = 'LONG'; signalType = 'long' }
  else if (totalScore < 60) { signal = 'NOTR'; signalType = 'neutral' }
  else if (totalScore < 85) { signal = 'SHORT'; signalType = 'short' }
  else { signal = 'STRONG SHORT'; signalType = 'strong_short' }

  // ═══════════════════════════════════════════════════════════════
  // TEMAS SİNYALLERİ
  // ═══════════════════════════════════════════════════════════════

  const touches = {
    // İç bant temas (Z=±1)
    touch200dUpper: last > 0 && high[last] >= innerUpper && high[last - 1] < innerUpper,
    touch200dLower: last > 0 && low[last] <= innerLower && low[last - 1] > innerLower,
    // Dış bant temas (Z=±2)
    touch50dUpper: last > 0 && high[last] >= outerUpper && high[last - 1] < outerUpper,
    touch50dLower: last > 0 && low[last] <= outerLower && low[last - 1] > outerLower,
    // Kullanılmıyor ama interface uyumu için
    touchHalfdUpper: false,
    touchHalfdLower: false,
  }

  const r = (v: number) => Math.round(v * 100) / 100

  // Hermes200DResult arayüzüne uyumlu dönüş
  // Eski alanları yeniden kullanıyoruz:
  return {
    score: r(totalScore),
    signal,
    signalType,
    components: {
      point200d: r(point5g),      // 5G Z-Score puanı (%70)
      point50d: 0,                 // kullanılmıyor
      pointHalfd: 0,               // kullanılmıyor
      pointMfi: r(pointMfi),
      pointRsi: r(pointRsi),
    },
    multipliers: {
      atrCarpan: r(atrCarpan),
      adxCarpan: r(adxCarpan),
      quality: r(quality),
    },
    rawScore: r(rawScore),
    indicators: {
      rsi: r(rsiVal),
      mfi: r(mfiVal),
      adx: r(adxVal),
      atr: r(atrVal),
      volRatio: r(volRatio),
    },
    zscores: {
      zscore200d: r(zscore5g),     // 5G Z-Score
      zscore50d: 0,                 // kullanılmıyor
      zscoreHalfd: 0,              // kullanılmıyor
    },
    bands: {
      vwap200d: r(vwap5g[last]),   // 5G VWAP
      upper200d: r(innerUpper),     // Z = +1 iç üst bant
      lower200d: r(innerLower),     // Z = -1 iç alt bant
      vwap50d: r(zsCenter),         // Z = 0 merkez
      upper50d: r(outerUpper),      // Z = +2 dış üst bant
      lower50d: r(outerLower),      // Z = -2 dış alt bant
      vwapHalfd: 0, upperHalfd: 0, lowerHalfd: 0,  // kullanılmıyor
    },
    touches,
    price: close[last],
    dataPoints: n,
    hasEnough200d: hasEnough,      // 5G veri yeterli mi
    hasEnough50d: false,
    hasEnoughHalfd: false,
  }
}

/** Belirli bir pozisyondaki ortalamayı hesapla */
function computeMeanAt(data: number[], period: number, pos: number): number {
  if (period <= 0 || pos < period - 1) return 0
  const start = pos - period + 1
  let sum = 0
  for (let i = start; i <= pos; i++) {
    sum += data[i]
  }
  return sum / period
}
