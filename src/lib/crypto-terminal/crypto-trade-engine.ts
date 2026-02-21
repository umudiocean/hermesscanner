// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Trade AI Engine
// V377_R6.85_Z55 | L30_S90
// Pure Z-Score Mean-Reversion for Crypto Markets
//
// VWAP: 377 gun (gunluk bar) — Volume-Weighted Average Price
// Z-Score: 55 gun lookback — Standart sapma bazli normallestirme
// TANH: 6.85 (Z-Ratio) — Z-Score -> 0-100 skor donusum boleni
// Esikler: LONG <=30, SHORT >=90
//
// Backtest ile birebir ayni formul:
//   dev = close - VWAP
//   z_mean = SMA(dev, 55)
//   z_std = STDEV(dev, 55)  [sample, N-1]
//   zscore = (dev - z_mean) / z_std
//   score = 50 + 50 * tanh(zscore / 6.85)
// ═══════════════════════════════════════════════════════════════════

export interface CryptoDailyBar {
  timestamp: number
  close: number
  volume: number
}

export interface CryptoTradeResult {
  score: number
  signal: string
  signalType: 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'
  zscore: number
  vwap: number
  deviation: number
  std: number
  bands: {
    center: number
    upperInner: number
    lowerInner: number
    upperOuter: number
    lowerOuter: number
  }
  vwapDistPct: number
  price: number
  dataPoints: number
  hasEnoughData: boolean
  error?: string
}

export const CRYPTO_TRADE_CONFIG = {
  VWAP_DAYS: 377,
  ZSCORE_DAYS: 55,
  TANH_DIV: 6.85,
  /** Gunluk veri icin daha hassas — skor dagilimini genisletir (NOTR coklugu cozer) */
  TANH_DIV_DAILY: 4.0,
  LONG_TH: 30,
  SHORT_TH: 90,
  TP_PCT: 1.5,
  SL_PCT: 8.0,
} as const

function tanh(x: number): number {
  const cx = Math.max(-6, Math.min(6, x))
  const e2x = Math.exp(2 * cx)
  return (e2x - 1) / (e2x + 1)
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}

function createNeutral(n: number, price: number, error?: string): CryptoTradeResult {
  return {
    score: 50, signal: 'NOTR', signalType: 'neutral',
    zscore: 0, vwap: 0, deviation: 0, std: 0, vwapDistPct: 0,
    bands: { center: 0, upperInner: 0, lowerInner: 0, upperOuter: 0, lowerOuter: 0 },
    price, dataPoints: n, hasEnoughData: false, error,
  }
}

/** useDailyTanh=true: Gunluk veri icin TANH_DIV_DAILY (4.0) kullanilir — skor dagilimi genisler, daha fazla LONG/SHORT sinyali */
export function calculateCryptoTradeAI(bars: CryptoDailyBar[], useDailyTanh = true): CryptoTradeResult {
  const { VWAP_DAYS, ZSCORE_DAYS, TANH_DIV, TANH_DIV_DAILY, LONG_TH, SHORT_TH } = CRYPTO_TRADE_CONFIG
  const tanhDiv = useDailyTanh ? TANH_DIV_DAILY : TANH_DIV
  const n = bars.length
  const last = n - 1
  const lastPrice = bars[last]?.close || 0

  const minBars = Math.max(ZSCORE_DAYS + Math.floor(VWAP_DAYS / 2), 60)
  if (n < minBars) {
    return createNeutral(n, lastPrice, `Yetersiz veri: ${n} bar (min ${minBars})`)
  }

  const close = bars.map(b => b.close)
  const volume = bars.map(b => b.volume || 1)

  // ═══ VWAP: Rolling Volume-Weighted Average Price ═══
  const effectiveVwapLen = Math.min(VWAP_DAYS, n)
  const cv = close.map((c, i) => c * volume[i])

  const vwapArr = new Array(n).fill(0)
  let sumCV = 0, sumV = 0
  for (let i = 0; i < n; i++) {
    sumCV += cv[i]
    sumV += volume[i]
    if (i >= effectiveVwapLen) {
      sumCV -= cv[i - effectiveVwapLen]
      sumV -= volume[i - effectiveVwapLen]
    }
    vwapArr[i] = sumV > 0 ? sumCV / sumV : close[i]
  }

  // ═══ Z-Score: deviation from VWAP → standardized ═══
  const dev = close.map((c, i) => c - vwapArr[i])

  const zLen = Math.min(ZSCORE_DAYS, n)
  const zStart = Math.max(0, last - zLen + 1)
  const actualZLen = last - zStart + 1

  let sumDev = 0
  for (let i = zStart; i <= last; i++) sumDev += dev[i]
  const zMean = sumDev / actualZLen

  let sumSq = 0
  for (let i = zStart; i <= last; i++) {
    const d = dev[i] - zMean
    sumSq += d * d
  }
  const zStd = actualZLen > 1 ? Math.sqrt(sumSq / (actualZLen - 1)) : 0

  const zscore = zStd > 0 ? (dev[last] - zMean) / zStd : 0

  // ═══ Z-Score Bands ═══
  const center = vwapArr[last] + zMean
  const bands = {
    center: round(center),
    upperInner: round(center + 1.0 * zStd),
    lowerInner: round(center - 1.0 * zStd),
    upperOuter: round(center + 2.0 * zStd),
    lowerOuter: round(center - 2.0 * zStd),
  }

  // ═══ Score: 50 + 50 * tanh(z / tanhDiv) ═══
  const hasEnough = n >= VWAP_DAYS
  const rawScore = 50 + 50 * tanh(zscore / tanhDiv)
  const score = Math.round(Math.max(0, Math.min(100, rawScore)))

  // VWAP distance percentage
  const vwapVal = vwapArr[last]
  const vwapDistPct = vwapVal > 0 ? round((close[last] - vwapVal) / vwapVal * 100) : 0

  // ═══ Signal: L30_S90 ═══
  let signal: string
  let signalType: CryptoTradeResult['signalType']
  if (score <= 20) {
    signal = 'STRONG LONG'; signalType = 'strong_long'
  } else if (score <= LONG_TH) {
    signal = 'LONG'; signalType = 'long'
  } else if (score < 70) {
    signal = 'NOTR'; signalType = 'neutral'
  } else if (score < SHORT_TH) {
    signal = 'SHORT'; signalType = 'short'
  } else {
    signal = 'STRONG SHORT'; signalType = 'strong_short'
  }

  return {
    score, signal, signalType,
    zscore: round(zscore),
    vwap: round(vwapVal),
    deviation: round(dev[last]),
    std: round(zStd),
    vwapDistPct,
    bands,
    price: close[last],
    dataPoints: n,
    hasEnoughData: hasEnough,
  }
}
