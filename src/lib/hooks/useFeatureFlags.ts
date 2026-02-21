'use client'

import { useState, useEffect } from 'react'

interface FeatureFlags {
  'excel-download': boolean
  'crypto-terminal': boolean
  'ai-signals': boolean
  'share-panel': boolean
  'manifesto-splash': boolean
  _isAdmin: boolean
  [key: string]: boolean
}

const DEFAULT_FLAGS: FeatureFlags = {
  'excel-download': true,
  'crypto-terminal': true,
  'ai-signals': true,
  'share-panel': true,
  'manifesto-splash': true,
  _isAdmin: false,
}

let cachedFlags: FeatureFlags | null = null
let fetchPromise: Promise<FeatureFlags> | null = null

async function fetchFlags(): Promise<FeatureFlags> {
  try {
    const res = await fetch('/api/flags')
    if (res.ok) {
      const data = await res.json()
      const merged: FeatureFlags = { ...DEFAULT_FLAGS, ...data }
      cachedFlags = merged
      return merged
    }
  } catch {
    // silent
  }
  return cachedFlags ?? DEFAULT_FLAGS
}

export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(() => cachedFlags ?? DEFAULT_FLAGS)

  useEffect(() => {
    if (cachedFlags) {
      setFlags(cachedFlags)
      return
    }
    if (!fetchPromise) {
      fetchPromise = fetchFlags().finally(() => { fetchPromise = null })
    }
    fetchPromise.then(f => setFlags(f))
  }, [])

  return flags
}

export function useCanDownloadCSV(): boolean {
  const flags = useFeatureFlags()
  return flags._isAdmin && flags['excel-download']
}
