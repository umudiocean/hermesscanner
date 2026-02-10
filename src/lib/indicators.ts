// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Technical Analysis Indicators
// Pine Script ta.* fonksiyonlarinin TypeScript implementasyonu
// Tum fonksiyonlar array-based: input[] → output[] (ayni uzunluk)
// ═══════════════════════════════════════════════════════════════════

/**
 * Rolling Sum - ta.sum() equivalent
 * O(n) performans, sliding window
 */
export function rollingSum(data: number[], period: number): number[] {
  const n = data.length
  const result = new Array(n).fill(NaN)
  if (n === 0 || period <= 0) return result

  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += data[i]
    if (i >= period) sum -= data[i - period]
    if (i >= period - 1) result[i] = sum
  }
  return result
}

/**
 * Simple Moving Average - ta.sma() equivalent
 */
export function sma(data: number[], period: number): number[] {
  const sumArr = rollingSum(data, period)
  return sumArr.map(v => isNaN(v) ? NaN : v / period)
}

/**
 * Wilder's Smoothing (EMA with alpha = 1/period)
 * Pine Script'in RSI, ATR, ADX'de kullandigi smoothing yontemi
 */
export function wilderSmooth(data: number[], period: number): number[] {
  const n = data.length
  const result = new Array(n).fill(NaN)
  if (n < period) return result

  // Ilk deger: SMA
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += isNaN(data[i]) ? 0 : data[i]
  }
  result[period - 1] = sum / period

  // Sonraki degerler: Wilder's smoothing
  for (let i = period; i < n; i++) {
    const val = isNaN(data[i]) ? 0 : data[i]
    result[i] = (result[i - 1] * (period - 1) + val) / period
  }
  return result
}

/**
 * Standard Deviation (Population) - ta.stdev() equivalent
 * Formul: sqrt(E[X^2] - E[X]^2)
 * O(n) performans
 */
export function stdev(data: number[], period: number): number[] {
  const n = data.length
  const result = new Array(n).fill(NaN)
  if (n < period || period <= 1) return result

  const sqData = data.map(d => d * d)
  const sumSq = rollingSum(sqData, period)
  const sumD = rollingSum(data, period)

  for (let i = period - 1; i < n; i++) {
    if (!isNaN(sumSq[i]) && !isNaN(sumD[i])) {
      const meanSq = sumSq[i] / period
      const mean = sumD[i] / period
      const variance = meanSq - mean * mean
      result[i] = Math.sqrt(Math.max(0, variance))
    }
  }
  return result
}

/**
 * True Range
 */
export function trueRange(high: number[], low: number[], close: number[]): number[] {
  const n = high.length
  const result = new Array(n).fill(NaN)
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

/**
 * Average True Range - ta.atr() equivalent
 * Wilder's smoothing of True Range
 */
export function atr(high: number[], low: number[], close: number[], period: number): number[] {
  const tr = trueRange(high, low, close)
  return wilderSmooth(tr, period)
}

/**
 * RSI (Relative Strength Index) - ta.rsi() equivalent
 * Wilder's smoothing for average gain/loss
 */
export function rsi(close: number[], period: number): number[] {
  const n = close.length
  const result = new Array(n).fill(NaN)
  if (n < period + 1) return result

  const gains = new Array(n).fill(0)
  const losses = new Array(n).fill(0)

  for (let i = 1; i < n; i++) {
    const change = close[i] - close[i - 1]
    gains[i] = change > 0 ? change : 0
    losses[i] = change < 0 ? -change : 0
  }

  // Wilder's smoothing starting from index 1 (skip index 0 which has no change)
  const avgGain = wilderSmooth(gains.slice(1), period)
  const avgLoss = wilderSmooth(losses.slice(1), period)

  // Map back to original indices (offset by 1)
  for (let i = 0; i < avgGain.length; i++) {
    const gi = avgGain[i]
    const li = avgLoss[i]
    if (!isNaN(gi) && !isNaN(li)) {
      if (li === 0) {
        result[i + 1] = gi === 0 ? 50 : 100
      } else {
        result[i + 1] = 100 - 100 / (1 + gi / li)
      }
    }
  }
  return result
}

/**
 * MFI (Money Flow Index) - ta.mfi() equivalent
 * Volume-weighted RSI variant
 */
export function mfi(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
  period: number
): number[] {
  const n = close.length
  const result = new Array(n).fill(NaN)
  if (n < period + 1) return result

  // Typical Price
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3)
  // Money Flow
  const mf = tp.map((t, i) => t * (volume[i] || 1))

  for (let i = period; i < n; i++) {
    let posMF = 0
    let negMF = 0
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) {
        posMF += mf[j]
      } else if (tp[j] < tp[j - 1]) {
        negMF += mf[j]
      }
    }
    if (negMF === 0) {
      result[i] = posMF === 0 ? 50 : 100
    } else {
      result[i] = 100 - 100 / (1 + posMF / negMF)
    }
  }
  return result
}

/**
 * DMI + ADX - ta.dmi() equivalent
 * Directional Movement Index with Average Directional Index
 */
export function dmi(
  high: number[],
  low: number[],
  close: number[],
  period: number
): { diplus: number[]; diminus: number[]; adx: number[] } {
  const n = high.length
  const diplus = new Array(n).fill(NaN)
  const diminus = new Array(n).fill(NaN)
  const adx = new Array(n).fill(NaN)

  if (n < period * 2) return { diplus, diminus, adx }

  // Directional Movement
  const plusDM = new Array(n).fill(0)
  const minusDM = new Array(n).fill(0)
  const tr = trueRange(high, low, close)

  for (let i = 1; i < n; i++) {
    const upMove = high[i] - high[i - 1]
    const downMove = low[i - 1] - low[i]
    plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0
  }

  // Wilder's smoothing
  const smoothTR = wilderSmooth(tr, period)
  const smoothPlusDM = wilderSmooth(plusDM, period)
  const smoothMinusDM = wilderSmooth(minusDM, period)

  // DI+ ve DI-
  const dx = new Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    if (!isNaN(smoothTR[i]) && smoothTR[i] > 0) {
      diplus[i] = 100 * (smoothPlusDM[i] || 0) / smoothTR[i]
      diminus[i] = 100 * (smoothMinusDM[i] || 0) / smoothTR[i]
      const sum = diplus[i] + diminus[i]
      dx[i] = sum > 0 ? 100 * Math.abs(diplus[i] - diminus[i]) / sum : 0
    }
  }

  // ADX = Wilder's smooth of DX
  const adxSmooth = wilderSmooth(
    dx.map(v => isNaN(v) ? 0 : v),
    period
  )
  for (let i = 0; i < n; i++) {
    if (!isNaN(adxSmooth[i])) adx[i] = adxSmooth[i]
  }

  return { diplus, diminus, adx }
}

/**
 * VWAP - Volume Weighted Average Price
 * Pine Script'teki gibi: len = min(period, bar_index + 1)
 * Erken barlar: kumulatif VWAP (tum mevcut veriyi kullan)
 * Yeterli bar sonrasi: sliding window VWAP
 * Bu sayede period > n bile olsa her bar icin deger uretilir
 */
export function vwap(close: number[], volume: number[], maxPeriod: number): number[] {
  const n = close.length
  const result = new Array(n).fill(0)
  const vol = volume.map(v => v || 1) // Fallback to 1 (Pine: nz(volume, 1.0))

  let sumCV = 0
  let sumV = 0

  for (let i = 0; i < n; i++) {
    sumCV += close[i] * vol[i]
    sumV += vol[i]

    // maxPeriod'u asinc en eski bari cikar (sliding window)
    if (i >= maxPeriod) {
      sumCV -= close[i - maxPeriod] * vol[i - maxPeriod]
      sumV -= vol[i - maxPeriod]
    }

    result[i] = sumV > 0 ? sumCV / sumV : close[i]
  }

  return result
}

/**
 * Pivot High - ta.pivothigh() equivalent
 * Returns the pivot value at confirmation bar (delayed by rightBars)
 */
export function pivotHigh(
  high: number[],
  leftBars: number,
  rightBars: number
): (number | null)[] {
  const n = high.length
  const result: (number | null)[] = new Array(n).fill(null)

  for (let i = leftBars; i < n - rightBars; i++) {
    let isPivot = true
    // Sol taraf kontrolu
    for (let j = i - leftBars; j < i; j++) {
      if (high[j] >= high[i]) { isPivot = false; break }
    }
    if (!isPivot) continue
    // Sag taraf kontrolu
    for (let j = i + 1; j <= i + rightBars; j++) {
      if (high[j] >= high[i]) { isPivot = false; break }
    }
    if (isPivot) {
      // Pine'da pivot, rightBars sonra onaylanir
      result[i + rightBars] = high[i]
    }
  }
  return result
}

/**
 * Pivot Low - ta.pivotlow() equivalent
 */
export function pivotLow(
  low: number[],
  leftBars: number,
  rightBars: number
): (number | null)[] {
  const n = low.length
  const result: (number | null)[] = new Array(n).fill(null)

  for (let i = leftBars; i < n - rightBars; i++) {
    let isPivot = true
    for (let j = i - leftBars; j < i; j++) {
      if (low[j] <= low[i]) { isPivot = false; break }
    }
    if (!isPivot) continue
    for (let j = i + 1; j <= i + rightBars; j++) {
      if (low[j] <= low[i]) { isPivot = false; break }
    }
    if (isPivot) {
      result[i + rightBars] = low[i]
    }
  }
  return result
}
