// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - TypeScript Types
// ═══════════════════════════════════════════════════════════════════

export interface OHLCV {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface HermesConfig {
  // VWAP period (daily bars) - Tek kanal: 52 Hafta
  vwap_52w_len: number   // 52 hafta × 5 işgünü = 260 daily bar

  // ATR
  atr_length: number

  // Scoring weights (sum = 100) - 70/15/15 backtest optimal
  weight_52w: number     // Z-Score ağırlığı: %70
  weight_mfi: number     // MFI ağırlığı: %15
  weight_rsi: number     // RSI ağırlığı: %15

  // Indicator periods
  rsi_length: number
  mfi_length: number
  adx_length: number

  // Z-Score window (daily bars) - Backtest optimal: 340
  zscore_len_52w: number
}

export type SignalType = 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short'

export interface HermesResult {
  score: number
  signal: string
  signalType: SignalType
  components: {
    point52w: number     // Z-Score bileşeni (70%)
    pointMfi: number     // MFI bileşeni (15%)
    pointRsi: number     // RSI bileşeni (15%)
  }
  multipliers: {
    atrCarpan: number
    adxCarpan: number
    quality: number
  }
  rawScore: number
  indicators: {
    rsi: number
    mfi: number
    adx: number
    atr: number
    volRatio: number
  }
  zscores: {
    zscore52w: number
  }
  bands: {
    vwap52w: number
    upperInner: number   // Z = +1 iç üst bant
    lowerInner: number   // Z = -1 iç alt bant
    upperOuter: number   // Z = +2 dış üst bant
    lowerOuter: number   // Z = -2 dış alt bant
  }
  touches: {
    touchOuterUpper: boolean
    touchOuterLower: boolean
    touchInnerUpper: boolean
    touchInnerLower: boolean
  }
  // V10: Giriş filtreleri durumu
  filters: {
    longFiltersOk: boolean    // RSI ≤40 && MFI ≤50 && ADX ≤25
    shortFiltersOk: boolean   // RSI ≥60 && MFI ≥70 && ADX ≤25
    rsiOk: boolean
    mfiOk: boolean
    adxOk: boolean
  }
  // V10: Delay confirmation durumu
  delay?: {
    barsRemaining: number     // Kalan gecikme barı (0 = confirmed)
    triggerScore: number      // İlk trigger skorı
    confirmed: boolean        // Confirmation başarılı mı
    waitingForConfirm: boolean // Trigger oldu, confirm bekleniyor
  }
  // V12: Trend çarpanı bilgisi
  trend?: {
    multiplier: number        // Uygulanan trend çarpanı (1.0 = nötr)
    composite: number         // Trend composite skoru (0-100, düşük=bullish)
    marketPoint: number       // Market trend puanı
    sectorPoint: number       // Sektör trend puanı
    industryPoint: number     // Industry trend puanı
  }
  price: number
  dataPoints: number
  hasEnough52w: boolean
  error?: string
}

export interface ScanResult {
  symbol: string
  segment: string
  hermes: HermesResult
  quote?: {
    price: number
    change: number
    changePercent: number
    volume: number
    marketCap: number
  }
  timestamp: string
}

export interface ScanSummary {
  scanId: string
  timestamp: string
  duration: number
  totalScanned: number
  strongLongs: ScanResult[]
  strongShorts: ScanResult[]
  longs: ScanResult[]
  shorts: ScanResult[]
  neutrals: number
  errors: number
  segment: string
}

export type Segment = 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO' | 'ALL'

// ═══════════════════════════════════════════════════════════════════
// V12 Trend Context — Sektör/Market/Industry Trend Çarpanı
// ═══════════════════════════════════════════════════════════════════

export interface TrendContext {
  // Market breadth: tüm hisselerin yüzdesi (Z < 0 = bullish taraf)
  marketBreadth: number    // 0-100, 50=nötr
  marketMomentum: number   // breadth'in değişim hızı

  // Sektör ortalama Z-Score (ZA1: en iyi yöntem)
  sectorAvgZScore: number  // negatif=bullish, pozitif=bearish

  // Industry relative performance
  industryRelative: number // sektöre göre sapma
}

