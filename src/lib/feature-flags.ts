// ═══════════════════════════════════════════════════════════════════
// Feature Flags — Redis-backed toggle system
// Default: all flags enabled (true)
// Admin can disable individual features from /admin panel
// ═══════════════════════════════════════════════════════════════════

import { getRedis } from './cache/redis-client'

const PREFIX = 'hermes:flag:'

const DEFAULT_FLAGS: Record<string, boolean> = {
  'excel-download': true,
  'crypto-terminal': true,
  'ai-signals': true,
  'share-panel': true,
  'manifesto-splash': true,
}

export async function getAllFlags(): Promise<Record<string, boolean>> {
  const r = getRedis()
  if (!r) return { ...DEFAULT_FLAGS }

  try {
    const keys = Object.keys(DEFAULT_FLAGS)
    const pipeline = r.pipeline()
    for (const k of keys) pipeline.get(PREFIX + k)
    const results = await pipeline.exec()

    const flags: Record<string, boolean> = {}
    for (let i = 0; i < keys.length; i++) {
      const val = results[i]
      // If key doesn't exist in Redis, use default (true)
      flags[keys[i]] = val === null || val === undefined ? DEFAULT_FLAGS[keys[i]] : val === 'true' || val === true
    }
    return flags
  } catch {
    return { ...DEFAULT_FLAGS }
  }
}

export async function getFlag(key: string): Promise<boolean> {
  const r = getRedis()
  if (!r) return DEFAULT_FLAGS[key] ?? true

  try {
    const val = await r.get(PREFIX + key)
    if (val === null || val === undefined) return DEFAULT_FLAGS[key] ?? true
    return val === 'true' || val === true
  } catch {
    return DEFAULT_FLAGS[key] ?? true
  }
}

export async function setFlag(key: string, enabled: boolean): Promise<void> {
  const r = getRedis()
  if (!r) return

  try {
    await r.set(PREFIX + key, String(enabled))
  } catch {
    // silent
  }
}

export function getDefaultFlags(): Record<string, boolean> {
  return { ...DEFAULT_FLAGS }
}
