// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Market Hours Utility
// DST-safe timezone handling for NYSE/NASDAQ
// Single source of truth for market schedule logic
// ═══════════════════════════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import logger from '../logger'
import { MARKET, NYSE_HOLIDAYS_2026 } from '../config/constants'

// ─── Time Conversion (DST-safe via Intl API) ───────────────────────

/**
 * Get current time in Eastern Time, DST-safe.
 * Uses Intl.DateTimeFormat instead of manual UTC offset.
 */
export function getNowET(): Date {
  const now = new Date()
  const etStr = now.toLocaleString('en-US', { timeZone: MARKET.TIMEZONE })
  return new Date(etStr)
}

/**
 * Get minutes since midnight in ET
 */
export function getETMinutes(date?: Date): number {
  const et = date || getNowET()
  return et.getHours() * 60 + et.getMinutes()
}

/**
 * Get current ET date as YYYY-MM-DD
 */
export function getETDate(date?: Date): string {
  const et = date || getNowET()
  const y = et.getFullYear()
  const m = String(et.getMonth() + 1).padStart(2, '0')
  const d = String(et.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Market Status ──────────────────────────────────────────────────

/**
 * Check if today is a NYSE holiday
 */
export function isHoliday(date?: Date): boolean {
  const dateStr = getETDate(date)
  return (NYSE_HOLIDAYS_2026 as readonly string[]).includes(dateStr)
}

/**
 * Check if today is a weekday (Mon-Fri)
 */
export function isWeekday(date?: Date): boolean {
  const et = date || getNowET()
  const day = et.getDay()
  return day >= 1 && day <= 5
}

/**
 * Check if the US stock market is currently open.
 * Returns true during NYSE trading hours (9:30-16:00 ET, weekdays, non-holidays).
 */
export function isMarketOpen(date?: Date): boolean {
  const et = date || getNowET()
  if (!isWeekday(et)) return false
  if (isHoliday(et)) return false

  const minutes = getETMinutes(et)
  return minutes >= MARKET.OPEN_MINUTES && minutes < MARKET.CLOSE_MINUTES
}

/**
 * Get minutes since market open (negative if before open)
 */
export function getMinutesSinceOpen(date?: Date): number {
  const minutes = getETMinutes(date)
  return minutes - MARKET.OPEN_MINUTES
}

/**
 * Get minutes until market close (negative if after close)
 */
export function getMinutesUntilClose(date?: Date): number {
  const minutes = getETMinutes(date)
  return MARKET.CLOSE_MINUTES - minutes
}

/**
 * Get market status summary
 */
export function getMarketStatus(): {
  isOpen: boolean
  isWeekday: boolean
  isHoliday: boolean
  currentET: string
  minutesSinceOpen: number
  minutesUntilClose: number
} {
  const et = getNowET()
  return {
    isOpen: isMarketOpen(et),
    isWeekday: isWeekday(et),
    isHoliday: isHoliday(et),
    currentET: et.toISOString(),
    minutesSinceOpen: getMinutesSinceOpen(et),
    minutesUntilClose: getMinutesUntilClose(et),
  }
}

// ─── Execution Lock ─────────────────────────────────────────────────

const LOCK_DIR = path.join(process.cwd(), '.next', 'cache', 'hermes')
const LOCK_FILE = path.join(LOCK_DIR, 'refresh.lock')
const LOCK_EXPIRE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Try to acquire the refresh lock.
 * Returns true if lock acquired, false if already locked.
 */
export async function acquireRefreshLock(): Promise<boolean> {
  try {
    await fs.mkdir(LOCK_DIR, { recursive: true })

    // Check if lock exists and is not expired
    try {
      const stat = await fs.stat(LOCK_FILE)
      const age = Date.now() - stat.mtimeMs
      if (age < LOCK_EXPIRE_MS) {
        logger.debug('Refresh lock already held', { module: 'scheduler', lockAge: age })
        return false
      }
      // Lock expired, remove it
      logger.info('Removing expired refresh lock', { module: 'scheduler', lockAge: age })
    } catch {
      // Lock file doesn't exist — good, we can create it
    }

    // Create/update lock file
    await fs.writeFile(LOCK_FILE, JSON.stringify({
      pid: process.pid,
      timestamp: new Date().toISOString(),
      acquiredAt: Date.now(),
    }))

    logger.debug('Refresh lock acquired', { module: 'scheduler' })
    return true
  } catch (err) {
    logger.warn('Failed to acquire refresh lock', { module: 'scheduler', error: err })
    return false
  }
}

/**
 * Release the refresh lock.
 */
export async function releaseRefreshLock(): Promise<void> {
  try {
    await fs.unlink(LOCK_FILE)
    logger.debug('Refresh lock released', { module: 'scheduler' })
  } catch {
    // Lock may already be released — acceptable
  }
}
