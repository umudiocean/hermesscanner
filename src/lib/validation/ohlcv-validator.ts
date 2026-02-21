// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — OHLCV Data Validator
// Validates price bar data before passing to scoring engines
// ═══════════════════════════════════════════════════════════════════

import logger from '../logger'

export interface OHLCVBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ValidationResult {
  valid: boolean
  cleanBars: OHLCVBar[]
  removedCount: number
  warnings: string[]
}

/**
 * Validate a single OHLCV bar
 */
export function isValidBar(bar: OHLCVBar): boolean {
  if (!bar) return false
  if (!isFinite(bar.close) || bar.close <= 0) return false
  if (!isFinite(bar.high) || bar.high <= 0) return false
  if (!isFinite(bar.low) || bar.low <= 0) return false
  if (!isFinite(bar.open) || bar.open <= 0) return false
  if (!isFinite(bar.volume) || bar.volume < 0) return false
  if (bar.high < bar.low) return false
  return true
}

/**
 * Validate and clean an array of OHLCV bars.
 * Removes invalid bars and logs warnings.
 */
export function validateOHLCVBars(
  bars: OHLCVBar[],
  symbol: string,
  minBars: number = 50,
): ValidationResult {
  const warnings: string[] = []
  const cleanBars: OHLCVBar[] = []
  let removedCount = 0

  for (const bar of bars) {
    if (isValidBar(bar)) {
      cleanBars.push(bar)
    } else {
      removedCount++
    }
  }

  if (removedCount > 0) {
    const pct = ((removedCount / bars.length) * 100).toFixed(1)
    const msg = `${symbol}: Removed ${removedCount}/${bars.length} invalid bars (${pct}%)`
    warnings.push(msg)
    logger.warn(msg, { module: 'ohlcvValidator', symbol, removedCount, totalBars: bars.length })
  }

  if (cleanBars.length < minBars) {
    const msg = `${symbol}: Insufficient data after validation (${cleanBars.length} < ${minBars})`
    warnings.push(msg)
    logger.warn(msg, { module: 'ohlcvValidator', symbol, cleanBars: cleanBars.length, minBars })
  }

  return {
    valid: cleanBars.length >= minBars,
    cleanBars,
    removedCount,
    warnings,
  }
}

/**
 * Validate a quote price before using it to update bars
 */
export function isValidQuote(quote: { price?: number; volume?: number }): boolean {
  if (!quote) return false
  if (typeof quote.price !== 'number' || !isFinite(quote.price) || quote.price <= 0) return false
  if (quote.volume !== undefined && (typeof quote.volume !== 'number' || !isFinite(quote.volume) || quote.volume < 0)) return false
  return true
}

/**
 * Standardized API error response
 */
export interface ApiErrorResponse {
  error: string
  message: string
  code: string
  timestamp: string
}

export function createApiError(
  error: string,
  message: string,
  code: string = 'INTERNAL_ERROR',
): ApiErrorResponse {
  return {
    error,
    message,
    code,
    timestamp: new Date().toISOString(),
  }
}
