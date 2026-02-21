// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Application Constants
// Single source of truth for all configurable values
// ═══════════════════════════════════════════════════════════════════

// ─── Market Hours (NYSE/NASDAQ, Eastern Time) ───────────────────────

export const MARKET = {
  /** Market open: 9:30 ET = 570 minutes from midnight */
  OPEN_MINUTES: 570,
  /** Market close: 16:00 ET = 960 minutes from midnight */
  CLOSE_MINUTES: 960,
  /** Timezone for market hours */
  TIMEZONE: 'America/New_York',
  /** Market check interval in client (ms) */
  CHECK_INTERVAL_MS: 30 * 1000, // 30 seconds
} as const

// ─── Refresh Intervals ──────────────────────────────────────────────

export const REFRESH = {
  /** Default auto-refresh interval (minutes) */
  DEFAULT_INTERVAL_MIN: 30,
  /** 52W scan batch size */
  SCAN_52W_BATCH: 500,
  /** 5D scan batch size */
  SCAN_5D_BATCH: 200,
  /** Concurrent fetch workers for scan */
  SCAN_CONCURRENCY: 20,
  /** Delay between rate-limited requests (ms) */
  RATE_LIMIT_DELAY_MS: 30,
} as const

// ─── Cache TTLs (milliseconds) ─────────────────────────────────────

export const CACHE = {
  BULK: 24 * 60 * 60 * 1000,         // 24h
  QUOTE: 5 * 60 * 1000,              // 5m
  INSIDER: 15 * 60 * 1000,           // 15m
  NEWS: 60 * 60 * 1000,              // 1h
  INSTITUTIONAL: 6 * 60 * 60 * 1000, // 6h
  CONGRESSIONAL: 60 * 60 * 1000,     // 1h
  FINANCIALS: 24 * 60 * 60 * 1000,   // 24h
  SECTOR: 24 * 60 * 60 * 1000,       // 24h
  MARKET: 5 * 60 * 1000,             // 5m
  TREASURY: 12 * 60 * 60 * 1000,     // 12h
  SCORES: 24 * 60 * 60 * 1000,       // 24h
  TRANSCRIPT: 7 * 24 * 60 * 60 * 1000, // 7d
  TECHNICAL: 5 * 60 * 1000,          // 5m
  DISK_STALE_MULTIPLIER: 3,          // Disk TTL = Memory TTL * this
} as const

// ─── Scoring ────────────────────────────────────────────────────────

export const SCORING = {
  /** Total number of monitored stocks (yatirim fonlari cikarildi) */
  TOTAL_STOCKS: 2197,
  /** V15 Z-Score lookback (days) — V377_R6.85_Z55 */
  ZSCORE_LOOKBACK_DAYS: 55,
  /** V15 VWAP period (days) — V377_R6.85_Z55 */
  VWAP_PERIOD_DAYS: 377,
  /** Score weights — Pure Z-Score */
  WEIGHTS: { zscore: 100, rsi: 0, mfi: 0 } as Record<string, number>,
  /** Entry thresholds — L30_S90 */
  LONG_THRESHOLD: 30,
  SHORT_THRESHOLD: 90,
} as const

// ─── FMP API ────────────────────────────────────────────────────────

export const FMP = {
  BASE_URL: 'https://financialmodelingprep.com/stable',
  /** Default request timeout (ms) */
  TIMEOUT_MS: 30_000,
  /** Max retries per request */
  MAX_RETRIES: 3,
  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_MS: 1_000,
  /** Circuit breaker: consecutive failures to open circuit */
  CIRCUIT_BREAKER_THRESHOLD: 5,
  /** Circuit breaker: cooldown before half-open (ms) */
  CIRCUIT_BREAKER_COOLDOWN_MS: 60_000,
} as const

// ─── UI ─────────────────────────────────────────────────────────────

export const UI = {
  /** Max watchlist items */
  MAX_WATCHLIST: 100,
  /** Max compare stocks */
  MAX_COMPARE: 4,
  /** Stocks table default page size */
  DEFAULT_PAGE_SIZE: 50,
} as const

// ─── NYSE Holidays 2026 ─────────────────────────────────────────────

export const NYSE_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
] as const
