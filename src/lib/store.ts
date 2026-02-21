// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Global State Store
// Watchlist, Alerts, Settings için client-side storage
// ═══════════════════════════════════════════════════════════════════

import { ScanResult } from './types'

const WATCHLIST_KEY = 'hermes_watchlist'
const SETTINGS_KEY = 'hermes_settings'

// ═══════════════════════════════════════════════════════════════════
// WATCHLIST
// ═══════════════════════════════════════════════════════════════════

export function getWatchlist(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(WATCHLIST_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addToWatchlist(symbol: string): string[] {
  const list = getWatchlist()
  if (!list.includes(symbol)) {
    list.push(symbol)
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
  }
  return list
}

export function removeFromWatchlist(symbol: string): string[] {
  let list = getWatchlist()
  list = list.filter(s => s !== symbol)
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
  return list
}

export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().includes(symbol)
}

export function toggleWatchlist(symbol: string): { inWatchlist: boolean; list: string[] } {
  if (isInWatchlist(symbol)) {
    return { inWatchlist: false, list: removeFromWatchlist(symbol) }
  } else {
    return { inWatchlist: true, list: addToWatchlist(symbol) }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

export interface HermesSettings {
  autoRefresh: boolean
  refreshInterval: number // minutes
  defaultModule: string
  theme: 'dark' | 'light'
}

const DEFAULT_SETTINGS: HermesSettings = {
  autoRefresh: true,
  refreshInterval: 30,  // 30 dakika = her 2 mum kapanışında (15dk × 2)
  defaultModule: 'nasdaq-terminal',
  theme: 'dark',
}

export function getSettings(): HermesSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Partial<HermesSettings>): HermesSettings {
  const current = getSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
  return updated
}

// ═══════════════════════════════════════════════════════════════════
// SCAN RESULTS CACHE (Client-side)
// ═══════════════════════════════════════════════════════════════════

let cachedResults: ScanResult[] = []
let cacheTimestamp: number = 0

export function setCachedResults(results: ScanResult[]): void {
  cachedResults = results
  cacheTimestamp = Date.now()
}

export function getCachedResults(): { results: ScanResult[]; timestamp: number } {
  return { results: cachedResults, timestamp: cacheTimestamp }
}

export function hasCachedResults(): boolean {
  return cachedResults.length > 0
}

