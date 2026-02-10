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
// 200 GÜN Module Types (15 Dakika Timeframe)
// ═══════════════════════════════════════════════════════════════════

export interface Hermes200DConfig {
  // VWAP periods (15-min bars)
  vwap_200d_len: number   // 200 gün ≈ 5000 bar (26 bar/gün)
  vwap_50d_len: number    // 50 gün = 1300 bar
  vwap_halfd_len: number  // yarım gün = 13 bar

  // ATR
  atr_length: number
  atr_mult_200d: number
  atr_mult_50d: number
  atr_mult_halfd: number

  // Band method weights
  atr_weight: number
  calib_weight: number
  rev_weight: number

  // Scoring weights (sum = 100)
  weight_200d: number
  weight_50d: number
  weight_halfd: number
  weight_mfi: number
  weight_rsi: number

  // Indicator periods
  rsi_length: number
  mfi_length: number
  adx_length: number

  // Calibration
  calib_length: number
  pivot_left: number
  pivot_right: number

  // Z-Score windows (15-min bars)
  zscore_len_200d: number
  zscore_len_50d: number
  zscore_len_halfd: number
}

export interface Hermes200DResult {
  score: number
  signal: string
  signalType: SignalType
  components: {
    point200d: number
    point50d: number
    pointHalfd: number
    pointMfi: number
    pointRsi: number
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
    zscore200d: number
    zscore50d: number
    zscoreHalfd: number
  }
  bands: {
    vwap200d: number
    upper200d: number
    lower200d: number
    vwap50d: number
    upper50d: number
    lower50d: number
    vwapHalfd: number
    upperHalfd: number
    lowerHalfd: number
  }
  touches: {
    touch200dUpper: boolean
    touch200dLower: boolean
    touch50dUpper: boolean
    touch50dLower: boolean
    touchHalfdUpper: boolean
    touchHalfdLower: boolean
  }
  price: number
  dataPoints: number
  hasEnough200d: boolean
  hasEnough50d: boolean
  hasEnoughHalfd: boolean
  error?: string
}

export interface Scan200DResult {
  symbol: string
  segment: string
  hermes: Hermes200DResult
  quote?: {
    price: number
    change: number
    changePercent: number
    volume: number
    marketCap: number
  }
  timestamp: string
}

export interface Scan200DSummary {
  scanId: string
  timestamp: string
  duration: number
  totalScanned: number
  strongLongs: Scan200DResult[]
  strongShorts: Scan200DResult[]
  longs: Scan200DResult[]
  shorts: Scan200DResult[]
  neutrals: number
  errors: number
  segment: string
}
