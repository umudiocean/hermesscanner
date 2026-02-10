// ═══════════════════════════════════════════════════════════════════
// HERMES V8 — 52 HAFTA Scoring Engine (Dual-Timeframe)
// Pine Script ile BİREBİR AYNI hesaplama mantığı:
//   VWAP + Z-Score → Daily veriden (request.security("D"))
//   RSI / MFI / ADX / ATR → 15dk native (14 bar)
//
// 3 Bileşen: Z-Score (%70) + MFI (%15) + RSI (%15)
// 2 Çarpan: ATR Sigmoid + ADX Sigmoid
// V8: Sinyal Eşikleri: ≤20 S.LONG / 21-40 LONG / 41-59 NOTR / 60-84 SHORT / ≥85 S.SHORT
// V8: 4 bar gecikme onayı (scanner'da state yönetimi ile)
//
// Backtest V8 (494 sembol, 15dk, ~5 yıl):
//   PF: 1.916 | WR: 97.0% | 4,270 trade | SL: 73
// ═══════════════════════════════════════════════════════════════════

import { OHLCV, HermesConfig, HermesResult, SignalType } from './types'

// ═══════════════════════════════════════════════════════════════════
// BACKTEST KİLİTLİ PARAMETRELER
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG: HermesConfig = {
  // VWAP: 52 Hafta = 260 işgünü (daily veriden)
  vwap_52w_len: 260,

  // ATR periyodu (15dk native)
  atr_length: 14,

  // Puanlama Ağırlıkları: Z-Score %70, MFI %15, RSI %15
  weight_52w: 70,
  weight_mfi: 15,
  weight_rsi: 15,

  // Gösterge Periyotları (14 bar — 15dk native)
  rsi_length: 14,
  mfi_length: 14,
  adx_length: 14,

  // Z-Score Lookback: 340 gün (daily veriden, backtest optimal)
  zscore_len_52w: 340,
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
    score: 50, signal: 'NOTR', signalType: 'neutral',
    components: { point52w: 50, pointMfi: 50, pointRsi: 50 },
    multipliers: { atrCarpan: 1, adxCarpan: 1, quality: 1 },
    rawScore: 50,
    indicators: { rsi: 50, mfi: 50, adx: 25, atr: 0, volRatio: 1 },
    zscores: { zscore52w: 0 },
    bands: { vwap52w: 0, upperInner: 0, lowerInner: 0, upperOuter: 0, lowerOuter: 0 },
    touches: { touchOuterUpper: false, touchOuterLower: false, touchInnerUpper: false, touchInnerLower: false },
    price: 0, dataPoints: 0, hasEnough52w: false, error: reason,
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANA HESAPLAMA FONKSİYONU — DUAL TIMEFRAME
//
// dailyBars: Günlük OHLCV → VWAP + Z-Score hesabı (Pine: request.security("D"))
// bars15m:   15dk OHLCV → RSI, MFI, ADX, ATR hesabı (Pine: native 15dk)
//
// Eğer bars15m verilmezse, dailyBars'tan tüm göstergeler hesaplanır
// (geriye uyumluluk — ama skorlar Pine'dan farklı olur)
// ═══════════════════════════════════════════════════════════════════

export function calculateHermes(
  dailyBars: OHLCV[],
  config: Partial<HermesConfig> = {},
  bars15m?: OHLCV[]
): HermesResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const nDaily = dailyBars.length

  if (nDaily < 50) {
    return createNeutralResult(`Yetersiz daily veri: ${nDaily} bar (min 50)`)
  }

  // ═══ DAILY VERİDEN: VWAP + Z-SCORE ═══

  const closeDaily = dailyBars.map(b => b.close)
  const volumeDaily = dailyBars.map(b => b.volume || 1)
  const lastDaily = nDaily - 1

  // 52W VWAP
  const cv = closeDaily.map((c, i) => c * volumeDaily[i])
  const sumCV = rollingSum(cv, cfg.vwap_52w_len)
  const sumV = rollingSum(volumeDaily, cfg.vwap_52w_len)
  const vwap52w = sumCV.map((scv, i) =>
    isNaN(scv) || isNaN(sumV[i]) || sumV[i] === 0 ? closeDaily[i] : scv / sumV[i]
  )

  // Pine Script'te ta.sma(dev, zscore_lb) ve ta.stdev(dev, zscore_lb) ancak
  // vwap_len + zscore_len bar olduktan sonra na olmayan değer döndürür.
  // İlk vwap_len bar'da VWAP henüz oluşmaz → dev undefined.
  // Sonraki zscore_len bar'da ta.sma/stdev oluşur.
  // Toplam minimum: vwap_len + zscore_len bar (260 + 340 = 600)
  const hasEnough52w = nDaily >= cfg.vwap_52w_len + cfg.zscore_len_52w

  // Z-Score (daily) — Pine Script ile BİREBİR:
  //   float dev = close - vw
  //   float m  = ta.sma(dev, zscore_lb)     ← MEAN
  //   float s  = ta.stdev(dev, zscore_lb)   ← STDEV (sample)
  //   float zs = s > 0 ? (dev - m) / s : 0  ← Z-SCORE = (dev - mean) / stdev
  const dev52w = closeDaily.map((c, i) => c - vwap52w[i])
  const zLen = Math.min(cfg.zscore_len_52w, lastDaily + 1)
  const zStd = zLen > 10 ? computeStdevAt(dev52w, zLen, lastDaily) : 0
  const zMean = zLen > 10 ? computeMeanAt(dev52w, zLen, lastDaily) : 0
  const zscore52w = zStd > 0 ? (dev52w[lastDaily] - zMean) / zStd : 0

  // Z-Score bazlı bantlar — Pine Script ile BİREBİR:
  //   float zs_center = _vwap + _mean   ← Z=0 merkezi
  //   inner = zs_center ± band_inner * _std
  //   outer = zs_center ± band_outer * _std
  const zsCenter = vwap52w[lastDaily] + zMean
  const upperInner = zsCenter + 1.0 * zStd
  const lowerInner = zsCenter - 1.0 * zStd
  const upperOuter = zsCenter + 2.0 * zStd
  const lowerOuter = zsCenter - 2.0 * zStd

  // Z-Score bileşeni
  const point52w = hasEnough52w ? zscoreTo100(zscore52w) : 50

  // ═══ 15DK VERİDEN (VEYA DAILY FALLBACK): RSI / MFI / ADX / ATR ═══

  let rsiVal: number
  let mfiVal: number
  let adxVal: number
  let atrVal: number
  let volRatio: number
  let indicatorDataPoints: number

  if (bars15m && bars15m.length >= 30) {
    // *** DUAL TIMEFRAME: 15dk native göstergeler (Pine Script ile birebir) ***
    const high15 = bars15m.map(b => b.high)
    const low15 = bars15m.map(b => b.low)
    const close15 = bars15m.map(b => b.close)
    const volume15 = bars15m.map(b => b.volume || 1)
    const last15 = bars15m.length - 1

    const rsiArr = calcRsi(close15, cfg.rsi_length)
    const mfiArr = calcMfi(high15, low15, close15, volume15, cfg.mfi_length)
    const { adx: adxArr } = calcDmi(high15, low15, close15, cfg.adx_length)
    const atrArr = calcAtr(high15, low15, close15, cfg.atr_length)

    rsiVal = rsiArr[last15] ?? 50
    mfiVal = mfiArr[last15] ?? 50
    adxVal = adxArr[last15] ?? 25
    atrVal = atrArr[last15] || 0

    // ATR vol_ratio (15dk native)
    const atrClean = atrArr.map(v => isNaN(v) ? 0 : v)
    const atrSma100 = sma(atrClean, Math.min(100, bars15m.length))
    volRatio = (!isNaN(atrSma100[last15]) && atrSma100[last15] > 0)
      ? atrVal / atrSma100[last15] : 1

    indicatorDataPoints = bars15m.length
  } else {
    // *** FALLBACK: Daily'den hesapla (15dk veri yoksa) ***
    const highD = dailyBars.map(b => b.high)
    const lowD = dailyBars.map(b => b.low)

    const rsiArr = calcRsi(closeDaily, cfg.rsi_length)
    const mfiArr = calcMfi(highD, lowD, closeDaily, volumeDaily, cfg.mfi_length)
    const { adx: adxArr } = calcDmi(highD, lowD, closeDaily, cfg.adx_length)
    const atrArr = calcAtr(highD, lowD, closeDaily, cfg.atr_length)

    rsiVal = rsiArr[lastDaily] ?? 50
    mfiVal = mfiArr[lastDaily] ?? 50
    adxVal = adxArr[lastDaily] ?? 25
    atrVal = atrArr[lastDaily] || 0

    const atrClean = atrArr.map(v => isNaN(v) ? 0 : v)
    const atrSma100 = sma(atrClean, Math.min(100, nDaily))
    volRatio = (!isNaN(atrSma100[lastDaily]) && atrSma100[lastDaily] > 0)
      ? atrVal / atrSma100[lastDaily] : 1

    indicatorDataPoints = nDaily
  }

  // ═══ PUANLAMA V7 ═══

  const pointMfi = mapMfiNonlinear(mfiVal)  // V7: nonlinear
  const pointRsi = mapRsiNonlinear(rsiVal)  // V7: nonlinear

  const weightTotal = cfg.weight_52w + cfg.weight_mfi + cfg.weight_rsi
  const rawScore = (
    point52w * cfg.weight_52w +
    pointMfi * cfg.weight_mfi +
    pointRsi * cfg.weight_rsi
  ) / weightTotal

  // ═══ ÇARPANLAR V7 ═══

  const atrCarpan = 0.5 + 0.5 / (1 + Math.exp(-5 * (volRatio - 0.5)))   // V7: center 0.5
  const adxCarpan = 1.15 - 0.50 / (1 + Math.exp(-0.15 * (adxVal - 25)))  // V7: height 0.50
  const quality = atrCarpan * adxCarpan

  // ═══ FİNAL SKOR ═══

  const totalScore = Math.max(0, Math.min(100, 50 + (rawScore - 50) * quality))

  // ═══ V8 SİNYAL KADEMELERİ (20/85) + 4 bar gecikme ═══
  // Not: 4 bar gecikme onayı scanner state'inde uygulanır (bu fonksiyon tek bar hesaplar)
  // Raw sinyal eşikleri: LONG ≤ 20, SHORT ≥ 85

  let signal: string
  let signalType: SignalType

  if (totalScore <= 20) { signal = 'STRONG LONG'; signalType = 'strong_long' }
  else if (totalScore <= 40) { signal = 'LONG'; signalType = 'long' }
  else if (totalScore < 60) { signal = 'NOTR'; signalType = 'neutral' }
  else if (totalScore < 85) { signal = 'SHORT'; signalType = 'short' }
  else { signal = 'STRONG SHORT'; signalType = 'strong_short' }

  // ═══ TEMAS SİNYALLERİ ═══

  const highDaily = dailyBars.map(b => b.high)
  const lowDaily = dailyBars.map(b => b.low)

  const touches = {
    touchOuterUpper: lastDaily > 0 && highDaily[lastDaily] >= upperOuter && highDaily[lastDaily - 1] < upperOuter,
    touchOuterLower: lastDaily > 0 && lowDaily[lastDaily] <= lowerOuter && lowDaily[lastDaily - 1] > lowerOuter,
    touchInnerUpper: lastDaily > 0 && highDaily[lastDaily] >= upperInner && highDaily[lastDaily - 1] < upperInner,
    touchInnerLower: lastDaily > 0 && lowDaily[lastDaily] <= lowerInner && lowDaily[lastDaily - 1] > lowerInner,
  }

  const r = (v: number) => Math.round(v * 100) / 100

  return {
    score: r(totalScore),
    signal,
    signalType,
    components: { point52w: r(point52w), pointMfi: r(pointMfi), pointRsi: r(pointRsi) },
    multipliers: { atrCarpan: r(atrCarpan), adxCarpan: r(adxCarpan), quality: r(quality) },
    rawScore: r(rawScore),
    indicators: { rsi: r(rsiVal), mfi: r(mfiVal), adx: r(adxVal), atr: r(atrVal), volRatio: r(volRatio) },
    zscores: { zscore52w: r(zscore52w) },
    bands: {
      vwap52w: r(vwap52w[lastDaily]),
      upperInner: r(upperInner), lowerInner: r(lowerInner),
      upperOuter: r(upperOuter), lowerOuter: r(lowerOuter),
    },
    touches,
    price: closeDaily[lastDaily],
    dataPoints: indicatorDataPoints,
    hasEnough52w,
  }
}
