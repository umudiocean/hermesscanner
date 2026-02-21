// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Multi-Market Configuration
// Parametric market definitions: NASDAQ, CRYPTO, EUROPE, BIST, FOREX
// Each market defines its BPD, timezone, holidays, session hours,
// default strategy params, and data source.
// ═══════════════════════════════════════════════════════════════════

export type MarketId = 'nasdaq' | 'crypto' | 'europe' | 'bist100' | 'forex'

export interface MarketSession {
  openMinutes: number   // Minutes from midnight (local tz)
  closeMinutes: number  // Minutes from midnight (local tz)
  is24h: boolean        // Crypto: no session boundaries
}

export interface MarketStrategyDefaults {
  vwapDays: number
  zscoreDays: number
  tanhDiv: number
  tp: number            // % (e.g. 1.5)
  sl: number            // % (e.g. 16)
  longThreshold: number
  shortThreshold: number
  bpd: number           // Bars per day at primary timeframe
}

export interface MarketHoliday {
  date: string          // YYYY-MM-DD
  name?: string
}

export interface MarketConfig {
  id: MarketId
  label: string
  shortLabel: string
  timezone: string
  currency: string
  session: MarketSession
  holidays2026: MarketHoliday[]
  strategy: MarketStrategyDefaults
  timeframe: string     // '15min' | '5min' | '1h'
  dataSource: 'fmp' | 'coingecko' | 'eodhd'
  scanBatch: number     // Symbols per scan batch
  concurrency: number   // Parallel workers
}

// ─── NYSE/NASDAQ ────────────────────────────────────────────────────

const NASDAQ_CONFIG: MarketConfig = {
  id: 'nasdaq',
  label: 'NASDAQ / NYSE',
  shortLabel: 'NASDAQ',
  timezone: 'America/New_York',
  currency: 'USD',
  session: {
    openMinutes: 570,   // 9:30 ET
    closeMinutes: 960,   // 16:00 ET
    is24h: false,
  },
  holidays2026: [
    { date: '2026-01-01', name: 'New Year' },
    { date: '2026-01-19', name: 'MLK Day' },
    { date: '2026-02-16', name: 'Presidents Day' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-05-25', name: 'Memorial Day' },
    { date: '2026-06-19', name: 'Juneteenth' },
    { date: '2026-07-03', name: 'Independence Day' },
    { date: '2026-09-07', name: 'Labor Day' },
    { date: '2026-11-26', name: 'Thanksgiving' },
    { date: '2026-12-25', name: 'Christmas' },
  ],
  strategy: {
    vwapDays: 360,
    zscoreDays: 51,
    tanhDiv: 7,
    tp: 1.5,
    sl: 16,
    longThreshold: 35,
    shortThreshold: 85,
    bpd: 26,
  },
  timeframe: '15min',
  dataSource: 'fmp',
  scanBatch: 500,
  concurrency: 15,
}

// ─── CRYPTO ─────────────────────────────────────────────────────────

const CRYPTO_CONFIG: MarketConfig = {
  id: 'crypto',
  label: 'Crypto',
  shortLabel: 'CRYPTO',
  timezone: 'UTC',
  currency: 'USD',
  session: {
    openMinutes: 0,
    closeMinutes: 1440,
    is24h: true,
  },
  holidays2026: [],
  strategy: {
    vwapDays: 365,
    zscoreDays: 28,
    tanhDiv: 5,
    tp: 0.25,
    sl: 5,
    longThreshold: 35,
    shortThreshold: 90,
    bpd: 288,            // 24h x 12 bars/h (5min)
  },
  timeframe: '5min',
  dataSource: 'coingecko',
  scanBatch: 50,
  concurrency: 5,
}

// ─── EUROPE (DAX / CAC / FTSE) ─────────────────────────────────────

const EUROPE_CONFIG: MarketConfig = {
  id: 'europe',
  label: 'Europe (DAX/CAC/FTSE)',
  shortLabel: 'EUROPE',
  timezone: 'Europe/Berlin',
  currency: 'EUR',
  session: {
    openMinutes: 540,    // 9:00 CET
    closeMinutes: 1050,   // 17:30 CET
    is24h: false,
  },
  holidays2026: [
    { date: '2026-01-01', name: 'New Year' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-12-25', name: 'Christmas' },
    { date: '2026-12-26', name: 'St Stephen' },
  ],
  strategy: {
    vwapDays: 254,
    zscoreDays: 157,
    tanhDiv: 1.24,
    tp: 1,
    sl: 31,
    longThreshold: 25,
    shortThreshold: 95,
    bpd: 34,
  },
  timeframe: '15min',
  dataSource: 'fmp',
  scanBatch: 200,
  concurrency: 10,
}

// ─── BIST 100 ───────────────────────────────────────────────────────

const BIST_CONFIG: MarketConfig = {
  id: 'bist100',
  label: 'BIST 100',
  shortLabel: 'BIST',
  timezone: 'Europe/Istanbul',
  currency: 'TRY',
  session: {
    openMinutes: 600,    // 10:00 TRT
    closeMinutes: 1080,   // 18:00 TRT
    is24h: false,
  },
  holidays2026: [
    { date: '2026-01-01', name: 'New Year' },
    { date: '2026-04-23', name: 'Natl Sovereignty' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-05-19', name: 'Youth Day' },
    { date: '2026-07-15', name: 'Democracy Day' },
    { date: '2026-08-30', name: 'Victory Day' },
    { date: '2026-10-29', name: 'Republic Day' },
  ],
  strategy: {
    vwapDays: 260,
    zscoreDays: 340,
    tanhDiv: 1.0,
    tp: 1.0,
    sl: 15,
    longThreshold: 20,
    shortThreshold: 80,
    bpd: 26,
  },
  timeframe: '15min',
  dataSource: 'fmp',
  scanBatch: 100,
  concurrency: 5,
}

// ─── FOREX ──────────────────────────────────────────────────────────

const FOREX_CONFIG: MarketConfig = {
  id: 'forex',
  label: 'Forex',
  shortLabel: 'FOREX',
  timezone: 'America/New_York',
  currency: 'USD',
  session: {
    openMinutes: 0,      // Sunday 5pm ET → Friday 5pm ET
    closeMinutes: 1440,
    is24h: true,
  },
  holidays2026: [
    { date: '2026-12-25', name: 'Christmas' },
  ],
  strategy: {
    vwapDays: 260,
    zscoreDays: 340,
    tanhDiv: 1.0,
    tp: 0.5,
    sl: 2,
    longThreshold: 25,
    shortThreshold: 75,
    bpd: 96,
  },
  timeframe: '15min',
  dataSource: 'fmp',
  scanBatch: 50,
  concurrency: 5,
}

// ─── Registry ───────────────────────────────────────────────────────

const ALL_MARKETS: Record<MarketId, MarketConfig> = {
  nasdaq: NASDAQ_CONFIG,
  crypto: CRYPTO_CONFIG,
  europe: EUROPE_CONFIG,
  bist100: BIST_CONFIG,
  forex: FOREX_CONFIG,
}

export function getMarketConfig(id: MarketId): MarketConfig {
  const cfg = ALL_MARKETS[id]
  if (!cfg) throw new Error(`Unknown market: ${id}`)
  return cfg
}

export function getAllMarkets(): MarketConfig[] {
  return Object.values(ALL_MARKETS)
}

export function getActiveMarkets(): MarketConfig[] {
  return [ALL_MARKETS.nasdaq, ALL_MARKETS.crypto]
}

/**
 * DST-safe: check if a market is currently in session.
 */
export function isMarketInSession(config: MarketConfig, date?: Date): boolean {
  if (config.session.is24h) {
    if (config.id === 'forex') {
      const now = date || new Date()
      const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
      const etDate = new Date(etStr)
      const day = etDate.getDay()
      // Forex closed Sat 5pm ET → Sun 5pm ET
      if (day === 6) return false
      if (day === 0) {
        const mins = etDate.getHours() * 60 + etDate.getMinutes()
        return mins >= 17 * 60 // After 5pm Sunday
      }
      return true
    }
    return true // Crypto: always open
  }

  const now = date || new Date()
  const tzStr = now.toLocaleString('en-US', { timeZone: config.timezone })
  const localDate = new Date(tzStr)

  const day = localDate.getDay()
  if (day < 1 || day > 5) return false

  const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`
  if (config.holidays2026.some(h => h.date === dateStr)) return false

  const mins = localDate.getHours() * 60 + localDate.getMinutes()
  return mins >= config.session.openMinutes && mins < config.session.closeMinutes
}

/**
 * Convert VWAP days to bars for a given market.
 */
export function daysTobars(config: MarketConfig, days: number): number {
  return days * config.strategy.bpd
}
