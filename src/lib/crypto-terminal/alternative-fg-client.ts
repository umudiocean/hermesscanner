// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Alternative.me Fear & Greed Client
// 100% free, no API key required
// Provides independent Fear & Greed Index (separate from our calc)
// ═══════════════════════════════════════════════════════════════════

import logger from '../logger'

const FG_BASE = 'https://api.alternative.me/fng'

export interface AlternativeFGEntry {
  value: number         // 0-100
  value_classification: string // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: string     // Unix timestamp (seconds)
}

export interface AlternativeFGResponse {
  data: AlternativeFGEntry[]
  metadata: { error: string | null }
}

export interface AlternativeFearGreed {
  current: number
  label: string
  yesterday: number | null
  weekAgo: number | null
  monthAgo: number | null
  history: Array<{ date: string; value: number; label: string }>
}

/**
 * Fetch Fear & Greed Index from Alternative.me
 * limit=30 gives 30 days of history for trend analysis
 */
export async function fetchAlternativeFearGreed(limit = 30): Promise<AlternativeFearGreed | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(`${FG_BASE}/?limit=${limit}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      logger.warn(`Alternative.me F&G returned ${res.status}`, { module: 'alt-fg' })
      return null
    }

    const json = await res.json() as AlternativeFGResponse
    if (!json.data || json.data.length === 0) return null

    const entries = json.data
    const current = entries[0]
    const yesterday = entries.length > 1 ? entries[1] : null
    const weekAgo = entries.length > 7 ? entries[7] : null
    const monthAgo = entries.length > 29 ? entries[29] : null

    const history = entries.map(e => ({
      date: new Date(parseInt(e.timestamp) * 1000).toISOString().split('T')[0],
      value: Number(e.value),
      label: e.value_classification,
    }))

    return {
      current: Number(current.value),
      label: current.value_classification,
      yesterday: yesterday ? Number(yesterday.value) : null,
      weekAgo: weekAgo ? Number(weekAgo.value) : null,
      monthAgo: monthAgo ? Number(monthAgo.value) : null,
      history,
    }
  } catch (err) {
    logger.error('Alternative.me F&G fetch failed', {
      module: 'alt-fg',
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
