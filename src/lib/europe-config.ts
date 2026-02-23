// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Market Configuration
// 8 Exchanges: LSE, XETRA, Euronext (Paris/Amsterdam), SIX Swiss,
//              Borsa Italiana, BME Madrid, OMX Nordic
// ═══════════════════════════════════════════════════════════════════

export type EuropeExchangeId =
  | 'LSE'
  | 'XETRA'
  | 'EURONEXT_PARIS'
  | 'EURONEXT_AMSTERDAM'
  | 'SIX'
  | 'MIL'
  | 'BME'
  | 'OMX'

export interface ExchangeConfig {
  id: EuropeExchangeId
  name: string
  shortLabel: string
  fmpExchange: string          // FMP company-screener exchange param
  symbolSuffix: string         // .L, .DE, .PA etc.
  currency: string             // GBX, EUR, CHF, SEK
  timezone: string             // IANA timezone
  openHour: number             // Local hour
  openMinute: number
  closeHour: number
  closeMinute: number
  barsPerDay: number           // 15-min bars per session
  flag: string
  indexName: string            // Primary benchmark index
  indexSymbol: string          // FMP index symbol for batch-quote
  country: string              // For economic-calendar filter
}

export const EUROPE_EXCHANGES: Record<EuropeExchangeId, ExchangeConfig> = {
  LSE: {
    id: 'LSE',
    name: 'London Stock Exchange',
    shortLabel: 'LSE',
    fmpExchange: 'LSE',
    symbolSuffix: '.L',
    currency: 'GBp',
    timezone: 'Europe/London',
    openHour: 8, openMinute: 0,
    closeHour: 16, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇬🇧',
    indexName: 'FTSE 100',
    indexSymbol: '^FTSE',
    country: 'GB',
  },
  XETRA: {
    id: 'XETRA',
    name: 'XETRA (Frankfurt)',
    shortLabel: 'XETRA',
    fmpExchange: 'XETRA',
    symbolSuffix: '.DE',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇩🇪',
    indexName: 'DAX 40',
    indexSymbol: '^GDAXI',
    country: 'DE',
  },
  EURONEXT_PARIS: {
    id: 'EURONEXT_PARIS',
    name: 'Euronext Paris',
    shortLabel: 'PARIS',
    fmpExchange: 'EURONEXT',
    symbolSuffix: '.PA',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇫🇷',
    indexName: 'CAC 40',
    indexSymbol: '^FCHI',
    country: 'FR',
  },
  EURONEXT_AMSTERDAM: {
    id: 'EURONEXT_AMSTERDAM',
    name: 'Euronext Amsterdam',
    shortLabel: 'AMS',
    fmpExchange: 'EURONEXT',
    symbolSuffix: '.AS',
    currency: 'EUR',
    timezone: 'Europe/Amsterdam',
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇳🇱',
    indexName: 'AEX 25',
    indexSymbol: '^AEX',
    country: 'NL',
  },
  SIX: {
    id: 'SIX',
    name: 'SIX Swiss Exchange',
    shortLabel: 'SWISS',
    fmpExchange: 'SIX',
    symbolSuffix: '.SW',
    currency: 'CHF',
    timezone: 'Europe/Zurich',
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇨🇭',
    indexName: 'SMI 20',
    indexSymbol: '^SSMI',
    country: 'CH',
  },
  MIL: {
    id: 'MIL',
    name: 'Borsa Italiana',
    shortLabel: 'MILAN',
    fmpExchange: 'MIL',
    symbolSuffix: '.MI',
    currency: 'EUR',
    timezone: 'Europe/Rome',
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇮🇹',
    indexName: 'FTSE MIB',
    indexSymbol: '^FTSEMIB',
    country: 'IT',
  },
  BME: {
    id: 'BME',
    name: 'BME Madrid',
    shortLabel: 'MADRID',
    fmpExchange: 'BME',
    symbolSuffix: '.MC',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇪🇸',
    indexName: 'IBEX 35',
    indexSymbol: '^IBEX',
    country: 'ES',
  },
  OMX: {
    id: 'OMX',
    name: 'OMX Nordic',
    shortLabel: 'NORDIC',
    fmpExchange: 'STO',
    symbolSuffix: '.ST',
    currency: 'SEK',
    timezone: 'Europe/Stockholm',
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    barsPerDay: 34,
    flag: '🇸🇪',
    indexName: 'OMX 30',
    indexSymbol: '^OMX',
    country: 'SE',
  },
}

export const ALL_EXCHANGE_IDS = Object.keys(EUROPE_EXCHANGES) as EuropeExchangeId[]

// Trade AI parameters (from backtest_config.json europe)
export const EUROPE_TRADE_CONFIG = {
  vwapDays: 360,
  zscoreDays: 51,
  zRatio: 7,
  tanhDiv: 7,
  longTh: 35,
  shortTh: 85,
  tp: 1,
  sl: 31,
  bpd: 34,
} as const

// Suffix → exchange lookup
const SUFFIX_TO_EXCHANGE = new Map<string, EuropeExchangeId>()
for (const ex of Object.values(EUROPE_EXCHANGES)) {
  SUFFIX_TO_EXCHANGE.set(ex.symbolSuffix, ex.id)
}

export function getExchangeFromSymbol(symbol: string): EuropeExchangeId | null {
  const dotIdx = symbol.lastIndexOf('.')
  if (dotIdx < 0) return null
  const suffix = symbol.slice(dotIdx)
  return SUFFIX_TO_EXCHANGE.get(suffix) ?? null
}

export function getExchangeConfig(id: EuropeExchangeId): ExchangeConfig {
  return EUROPE_EXCHANGES[id]
}

/**
 * Check if any European market is currently open.
 * Uses Intl.DateTimeFormat for DST-safe timezone conversion.
 */
export function isAnyEuropeMarketOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay()
  if (day === 0 || day === 6) return false

  for (const ex of Object.values(EUROPE_EXCHANGES)) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: ex.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    })
    const parts = fmt.formatToParts(now)
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
    const mins = hour * 60 + minute
    const openMins = ex.openHour * 60 + ex.openMinute
    const closeMins = ex.closeHour * 60 + ex.closeMinute
    if (mins >= openMins && mins < closeMins) return true
  }
  return false
}

export function getEuropeMarketStatus(): { open: boolean; label: string; nextEvent: string } {
  const now = new Date()
  const day = now.getUTCDay()

  if (day === 0 || day === 6) {
    return { open: false, label: 'MARKET CLOSED', nextEvent: 'Opens on weekday' }
  }

  const lseFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    hour: 'numeric', minute: 'numeric', hour12: false,
  })
  const parts = lseFmt.formatToParts(now)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const londonMins = h * 60 + m

  // LSE opens at 08:00 GMT — earliest major EU exchange
  // Continental closes at 17:30 CET = 16:30 GMT (winter) / 15:30 GMT (summer)
  if (londonMins < 480) {
    const diff = 480 - londonMins
    const dh = Math.floor(diff / 60)
    const dm = diff % 60
    return { open: false, label: 'MARKET CLOSED', nextEvent: `Opens in ${dh}h ${dm}m` }
  }

  // After 17:30 CET ~= 16:30 London (approx, varies by DST)
  if (londonMins >= 1050) {
    return { open: false, label: 'MARKET CLOSED', nextEvent: 'Opens tomorrow' }
  }

  const remain = 1050 - londonMins
  const rh = Math.floor(remain / 60)
  const rm = remain % 60
  return { open: true, label: 'MARKET OPEN', nextEvent: `Close in ${rh}h ${rm}m` }
}
