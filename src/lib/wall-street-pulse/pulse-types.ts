// Wall Street Pulse — Type Definitions (6 AI Konsensus)

export type PulseLevel = 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED'

export interface PulseComponent {
  id: string
  name: string
  value: number        // 0-100 normalized
  weight: number       // 0-1 (sum = 1)
  available: boolean
  source: string
  description: string
  direction: 'up' | 'down' | 'flat'
  rawValue?: number
}

export interface ForecastSignal {
  label: string
  type: 'bullish' | 'bearish' | 'info'
  description: string
}

export type MarketRegime = 'EXTREME' | 'HIGH_VOL' | 'LOW_VOL' | 'NORMAL'

export interface ForecastData {
  bias: 'POZITIF' | 'NEGATIF' | 'NOTR'
  confidence: number        // 0-100
  regime: MarketRegime
  specialSignals: ForecastSignal[]
  isGoldenSignal: boolean
  boostApplied: number      // +/- composite boost from special signals
}

export interface PulseData {
  composite: number    // 0-100
  level: PulseLevel
  levelLabel: string
  components: PulseComponent[]
  breadth: BreadthData
  smartMoney: SmartMoneyData
  earnings: EarningsPulseData
  shortSqueeze: ShortSqueezeStock[]
  forecast: ForecastData
  timestamp: string
  marketOpen: boolean
}

export interface BreadthData {
  advancing: number
  declining: number
  unchanged: number
  advanceDeclineRatio: number
  newHighs: number
  newLows: number
  highLowRatio: number
  aboveMidpoint: number
  aboveMidpointPct: number
  total: number
}

export interface SmartMoneyData {
  insiderNetBuys: number
  insiderNetSells: number
  insiderRatio: number      // 0-100 (net buy pct)
  congressBuys: number
  congressSells: number
  congressRatio: number
  institutionalDelta: number
}

export interface EarningsPulseData {
  beatCount: number
  missCount: number
  totalReported: number
  beatRate: number          // 0-100
  avgSurprise: number       // %
  trend: 'improving' | 'stable' | 'declining'
}

export interface ShortSqueezeStock {
  symbol: string
  shortFloat: number
  dayChange: number
  squeezeScore: number
  volume: number
  avgVolume: number
  volumeSpike: number
}

export interface AnalystMomentumData {
  upgrades: number
  downgrades: number
  netUpgrades: number
  ratio: number            // 0-100
  avgTargetUpside: number   // %
}

export interface SectorRotationData {
  offensiveScore: number    // 0-100
  defensiveScore: number
  rotationDirection: 'risk-on' | 'neutral' | 'risk-off'
  sectors: { name: string; change: number; type: 'offensive' | 'defensive' }[]
}

export function getPulseLevel(score: number): PulseLevel {
  if (score <= 20) return 'EXTREME_FEAR'
  if (score <= 40) return 'FEAR'
  if (score <= 60) return 'NEUTRAL'
  if (score <= 80) return 'GREED'
  return 'EXTREME_GREED'
}

export function getPulseLevelLabel(level: PulseLevel): string {
  const labels: Record<PulseLevel, string> = {
    EXTREME_FEAR: 'Asiri Korku',
    FEAR: 'Korku',
    NEUTRAL: 'Notr',
    GREED: 'Hirs',
    EXTREME_GREED: 'Asiri Hirs',
  }
  return labels[level]
}

export function getPulseLevelColor(level: PulseLevel): string {
  const colors: Record<PulseLevel, string> = {
    EXTREME_FEAR: '#dc2626',
    FEAR: '#f87171',
    NEUTRAL: '#94a3b8',
    GREED: '#62cbc1',
    EXTREME_GREED: '#B3945B',
  }
  return colors[level]
}
