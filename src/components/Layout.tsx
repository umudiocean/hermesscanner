'use client'

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { ScanResult, ScanSummary, Scan200DResult, Scan200DSummary } from '@/lib/types'
import { getWatchlist, getSettings, setCachedResults, getCachedResults, setCached200DResults, getCached200DResults } from '@/lib/store'

// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Main Layout with Module Navigation
// ═══════════════════════════════════════════════════════════════════

export type ModuleId = '200week' | '200day' | 'bestsignals' | 'trend' | 'btctrend' | 'watchlist' | 'heatmap' | 'sectors' | 'backtest'

interface Module {
  id: ModuleId
  label: string
  icon: string
  ready: boolean
}

const MODULES: Module[] = [
  { id: '200week', label: '52 HAFTA', icon: '📊', ready: true },
  { id: '200day', label: '5 GÜN', icon: '🟠', ready: true },
  { id: 'bestsignals', label: 'BEST SIGNALS', icon: '⚡', ready: true },
  { id: 'trend', label: 'TREND', icon: '📉', ready: false },
  { id: 'btctrend', label: 'BTC Trend', icon: '₿', ready: true },
  { id: 'watchlist', label: 'Watchlist', icon: '⭐', ready: true },
  { id: 'heatmap', label: 'Heatmap', icon: '🗺️', ready: true },
  { id: 'sectors', label: 'Sektörler', icon: '🏭', ready: true },
  { id: 'backtest', label: 'Backtest', icon: '🔬', ready: false },
]

// ═══════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════

interface ScanContextType {
  results: ScanResult[]
  summary: ScanSummary | null
  loading: boolean
  error: string | null
  progress: string
  lastRefresh: Date | null
  watchlist: string[]
  sectorMap: Map<string, string>
  runScan: () => Promise<void>
  toggleWatchlistItem: (symbol: string) => void
  isInWatchlist: (symbol: string) => boolean
}

const ScanContext = createContext<ScanContextType | null>(null)

export function useScanContext() {
  const ctx = useContext(ScanContext)
  if (!ctx) throw new Error('useScanContext must be used within Layout')
  return ctx
}

// ═══════════════════════════════════════════════════════════════════
// 200D CONTEXT (15 Dakika Modülü)
// ═══════════════════════════════════════════════════════════════════

interface Scan200DContextType {
  results: Scan200DResult[]
  summary: Scan200DSummary | null
  loading: boolean
  error: string | null
  progress: string
  lastRefresh: Date | null
  watchlist: string[]
  sectorMap: Map<string, string>
  runScan: () => Promise<void>
  toggleWatchlistItem: (symbol: string) => void
  isInWatchlist: (symbol: string) => boolean
}

const Scan200DContext = createContext<Scan200DContextType | null>(null)

export function useScan200DContext() {
  const ctx = useContext(Scan200DContext)
  if (!ctx) throw new Error('useScan200DContext must be used within Layout')
  return ctx
}

// ═══════════════════════════════════════════════════════════════════
// LAYOUT COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function Layout({ children }: { children: (activeModule: ModuleId) => React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleId>('200week')
  const [results, setResults] = useState<ScanResult[]>([])
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [sectorMap, setSectorMap] = useState<Map<string, string>>(new Map())

  // 200D Module state
  const [results200d, setResults200d] = useState<Scan200DResult[]>([])
  const [summary200d, setSummary200d] = useState<Scan200DSummary | null>(null)
  const [loading200d, setLoading200d] = useState(false)
  const [error200d, setError200d] = useState<string | null>(null)
  const [progress200d, setProgress200d] = useState('')
  const [lastRefresh200d, setLastRefresh200d] = useState<Date | null>(null)

  // Market status & auto-refresh state
  const [marketOpen, setMarketOpen] = useState(false)
  const [marketLabel, setMarketLabel] = useState('Kontrol ediliyor...')
  const [marketNextEvent, setMarketNextEvent] = useState('')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState('')
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const marketCheckTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wasMarketOpenRef = useRef(false)
  const isRefreshingRef = useRef(false)
  const resultsRef = useRef<ScanResult[]>([])
  const results200dRef = useRef<Scan200DResult[]>([])
  const lastAutoRefreshRef = useRef<Date | null>(null)
  const runIncrementalRefreshRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Load watchlist & settings on mount
  useEffect(() => {
    setWatchlist(getWatchlist())
    const settings = getSettings()
    setAutoRefreshEnabled(settings.autoRefresh)
  }, [])

  // Load sectors when results change
  useEffect(() => {
    async function loadSectors() {
      if (results.length === 0) return
      
      // Önce cache'den dene
      try {
        const cacheRes = await fetch('/api/sectors')
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json()
          if (cacheData.sectors && Object.keys(cacheData.sectors).length > 0) {
            const map = new Map<string, string>()
            for (const [symbol, sector] of Object.entries(cacheData.sectors)) {
              map.set(symbol, sector as string)
            }
            setSectorMap(map)
            return
          }
        }
      } catch { /* ignore */ }

      // Cache yoksa FMP'den çek
      try {
        const symbols = results.map(r => r.symbol)
        const res = await fetch('/api/sectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.sectors) {
            const map = new Map<string, string>()
            for (const [symbol, sector] of Object.entries(data.sectors)) {
              map.set(symbol, sector as string)
            }
            setSectorMap(map)
          }
        }
      } catch { /* ignore */ }
    }

    loadSectors()
  }, [results])

  // Toggle watchlist item
  const toggleWatchlistItem = useCallback((symbol: string) => {
    setWatchlist(prev => {
      const newList = prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
      localStorage.setItem('hermes_watchlist', JSON.stringify(newList))
      return newList
    })
  }, [])

  const isInWatchlist = useCallback((symbol: string) => {
    return watchlist.includes(symbol)
  }, [watchlist])

  // Scan function
  const runScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress('Hazırlanıyor...')

    try {
      const segments = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO'] as const
      const allResults: ScanResult[] = []
      const CHUNK_SIZE = 100

      for (const seg of segments) {
        const symRes = await fetch(`/api/symbols?segment=${seg}`)
        if (!symRes.ok) throw new Error(`Failed to get symbols for ${seg}`)
        const symData = await symRes.json()
        const symbols: string[] = symData.symbols

        if (symbols.length === 0) continue

        if (symbols.length <= CHUNK_SIZE) {
          setProgress(`${seg} taranıyor...`)
          const res = await fetch(`/api/scan?segment=${seg}`)
          if (!res.ok) throw new Error(`Scan failed for ${seg}`)
          const data = await res.json()
          if (data.allResults) allResults.push(...data.allResults)
          setResults([...allResults])
        } else {
          for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
            const chunk = symbols.slice(i, i + CHUNK_SIZE)
            const chunkNum = Math.floor(i / CHUNK_SIZE) + 1
            const totalChunks = Math.ceil(symbols.length / CHUNK_SIZE)

            setProgress(`${seg} ${chunkNum}/${totalChunks}`)

            const res = await fetch(`/api/scan?segment=${seg}&symbols=${chunk.join(',')}`)
            if (res.ok) {
              const data = await res.json()
              if (data.allResults) allResults.push(...data.allResults)
              setResults([...allResults])
            }
          }
        }
      }

      const strongLongs = allResults.filter(r => r.hermes.signalType === 'strong_long')
      const strongShorts = allResults.filter(r => r.hermes.signalType === 'strong_short')

      const newSummary: ScanSummary = {
        scanId: `scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 0,
        totalScanned: allResults.length,
        strongLongs,
        strongShorts,
        longs: allResults.filter(r => r.hermes.signalType === 'long'),
        shorts: allResults.filter(r => r.hermes.signalType === 'short'),
        neutrals: allResults.filter(r => r.hermes.signalType === 'neutral').length,
        errors: 0,
        segment: 'ALL',
      }

      setResults(allResults)
      setSummary(newSummary)
      setCachedResults(allResults)
      const now = new Date()
      setLastRefresh(now)
      setLastAutoRefresh(now) // Auto-refresh zamanlayıcısını senkronize et
      setLoading(false)
      setProgress('')

      // Tarama tamamlandığında sonuçları disk'e kaydet (server tarafı)
      // Bu sayede sayfa yenilendiğinde tüm sonuçlar yüklenir
      try {
        await fetch('/api/scan/latest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results: allResults,
            scanId: newSummary.scanId,
          }),
        })
        console.log(`[Layout] Saved ${allResults.length} results to disk cache`)
      } catch (saveErr) {
        console.error('[Layout] Failed to save results to disk:', saveErr)
      }

    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
      setProgress('')
    }
  }, [])

  // 200D Scan function
  const runScan200D = useCallback(async () => {
    setLoading200d(true)
    setError200d(null)
    setProgress200d('Hazırlanıyor (200D)...')

    try {
      const segments = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO'] as const
      const allResults: Scan200DResult[] = []
      const CHUNK_SIZE = 100

      for (const seg of segments) {
        const symRes = await fetch(`/api/symbols?segment=${seg}`)
        if (!symRes.ok) throw new Error(`Failed to get symbols for ${seg}`)
        const symData = await symRes.json()
        const symbols: string[] = symData.symbols

        if (symbols.length === 0) continue

        if (symbols.length <= CHUNK_SIZE) {
          setProgress200d(`${seg} taranıyor (200D)...`)
          const res = await fetch(`/api/scan-200d?segment=${seg}`)
          if (!res.ok) throw new Error(`200D Scan failed for ${seg}`)
          const data = await res.json()
          if (data.allResults) allResults.push(...data.allResults)
          setResults200d([...allResults])
        } else {
          for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
            const chunk = symbols.slice(i, i + CHUNK_SIZE)
            const chunkNum = Math.floor(i / CHUNK_SIZE) + 1
            const totalChunks = Math.ceil(symbols.length / CHUNK_SIZE)

            setProgress200d(`${seg} ${chunkNum}/${totalChunks} (200D)`)

            const res = await fetch(`/api/scan-200d?segment=${seg}&symbols=${chunk.join(',')}`)
            if (res.ok) {
              const data = await res.json()
              if (data.allResults) allResults.push(...data.allResults)
              setResults200d([...allResults])
            }
          }
        }
      }

      const strongLongs = allResults.filter(r => r.hermes.signalType === 'strong_long')
      const strongShorts = allResults.filter(r => r.hermes.signalType === 'strong_short')

      const newSummary: Scan200DSummary = {
        scanId: `200d-scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 0,
        totalScanned: allResults.length,
        strongLongs,
        strongShorts,
        longs: allResults.filter(r => r.hermes.signalType === 'long'),
        shorts: allResults.filter(r => r.hermes.signalType === 'short'),
        neutrals: allResults.filter(r => r.hermes.signalType === 'neutral').length,
        errors: 0,
        segment: 'ALL',
      }

      setResults200d(allResults)
      setSummary200d(newSummary)
      setCached200DResults(allResults)
      const now = new Date()
      setLastRefresh200d(now)
      setLastAutoRefresh(now) // Auto-refresh zamanlayıcısını senkronize et
      setLoading200d(false)
      setProgress200d('')

      // Disk'e kaydet
      try {
        await fetch('/api/scan-200d/latest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results: allResults,
            scanId: newSummary.scanId,
          }),
        })
        console.log(`[Layout] Saved ${allResults.length} 200D results to disk cache`)
      } catch (saveErr) {
        console.error('[Layout] Failed to save 200D results to disk:', saveErr)
      }

    } catch (err) {
      setError200d((err as Error).message)
      setLoading200d(false)
      setProgress200d('')
    }
  }, [])

  // Combined scan handler - routes to active module
  const handleScan = useCallback(async () => {
    if (activeModule === '200day') {
      await runScan200D()
    } else {
      await runScan()
    }
  }, [activeModule, runScan, runScan200D])

  // Load cached results on mount (200W)
  useEffect(() => {
    async function loadInitial() {
      // Check memory cache first
      const cached = getCachedResults()
      if (cached.results.length > 0) {
        setResults(cached.results)
        const ts = new Date(cached.timestamp)
        setLastRefresh(ts)
        setLastAutoRefresh(ts) // Timer senkronize
        return
      }

      // Try disk cache
      try {
        const res = await fetch('/api/scan/latest')
        if (res.ok) {
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setResults(data.results)
            setCachedResults(data.results)
            const ts = new Date(data.timestamp || Date.now())
            setLastRefresh(ts)
            setLastAutoRefresh(ts) // Timer senkronize
            
            const strongLongs = data.results.filter((r: ScanResult) => r.hermes.signalType === 'strong_long')
            const strongShorts = data.results.filter((r: ScanResult) => r.hermes.signalType === 'strong_short')
            setSummary({
              scanId: data.scanId || 'cached',
              timestamp: data.timestamp || new Date().toISOString(),
              duration: 0,
              totalScanned: data.results.length,
              strongLongs,
              strongShorts,
              longs: data.results.filter((r: ScanResult) => r.hermes.signalType === 'long'),
              shorts: data.results.filter((r: ScanResult) => r.hermes.signalType === 'short'),
              neutrals: data.results.filter((r: ScanResult) => r.hermes.signalType === 'neutral').length,
              errors: 0,
              segment: 'ALL',
            })
            return
          }
        }
      } catch { /* ignore */ }

      // No cache, run scan
      runScan()
    }

    loadInitial()
  }, [runScan])

  // Load cached 200D results on mount
  useEffect(() => {
    async function loadInitial200D() {
      // Check memory cache first
      const cached = getCached200DResults()
      if (cached.results.length > 0) {
        setResults200d(cached.results)
        const ts = new Date(cached.timestamp)
        setLastRefresh200d(ts)
        setLastAutoRefresh(prev => prev && prev > ts ? prev : ts) // En son olan zaman damgasını koru
        return
      }

      // Try disk cache
      try {
        const res = await fetch('/api/scan-200d/latest')
        if (res.ok) {
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setResults200d(data.results)
            setCached200DResults(data.results)
            const ts = new Date(data.timestamp || Date.now())
            setLastRefresh200d(ts)
            setLastAutoRefresh(prev => prev && prev > ts ? prev : ts) // En son olan zaman damgasını koru

            const strongLongs = data.results.filter((r: Scan200DResult) => r.hermes.signalType === 'strong_long')
            const strongShorts = data.results.filter((r: Scan200DResult) => r.hermes.signalType === 'strong_short')
            setSummary200d({
              scanId: data.scanId || 'cached-200d',
              timestamp: data.timestamp || new Date().toISOString(),
              duration: 0,
              totalScanned: data.results.length,
              strongLongs,
              strongShorts,
              longs: data.results.filter((r: Scan200DResult) => r.hermes.signalType === 'long'),
              shorts: data.results.filter((r: Scan200DResult) => r.hermes.signalType === 'short'),
              neutrals: data.results.filter((r: Scan200DResult) => r.hermes.signalType === 'neutral').length,
              errors: 0,
              segment: 'ALL',
            })
          }
        }
      } catch { /* ignore */ }
    }

    loadInitial200D()
  }, [])

  // Keep refs in sync with state (for stable useEffect)
  useEffect(() => { resultsRef.current = results }, [results])
  useEffect(() => { results200dRef.current = results200d }, [results200d])
  useEffect(() => { lastAutoRefreshRef.current = lastAutoRefresh }, [lastAutoRefresh])

  // ═══════════════════════════════════════════════════════════════════
  // INCREMENTAL REFRESH (Auto-Refresh için)
  // ═══════════════════════════════════════════════════════════════════

  const runIncrementalRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    setIsAutoRefreshing(true)
    console.log('[AutoRefresh] Starting incremental refresh at', new Date().toLocaleTimeString())

    try {
      // 200W refresh (eğer sonuç varsa)
      if (results.length > 0) {
        setProgress('Yenileniyor (200W)...')
        const BATCH = 500
        const allSymbols = results.map(r => r.symbol)
        const updatedResults: ScanResult[] = []

        for (let i = 0; i < allSymbols.length; i += BATCH) {
          const batch = allSymbols.slice(i, i + BATCH)
          try {
            const res = await fetch(`/api/refresh?symbols=${batch.join(',')}`)
            if (res.ok) {
              const data = await res.json()
              if (data.results) updatedResults.push(...data.results)
            }
          } catch (err) {
            console.error('[AutoRefresh] 200W batch error:', err)
          }
        }

        if (updatedResults.length > 0) {
          // Mevcut sonuçları güncelle (refresh'ten gelen semboller)
          const updateMap = new Map(updatedResults.map(r => [r.symbol, r]))
          const merged = results.map(r => updateMap.get(r.symbol) || r)
          setResults(merged)
          setCachedResults(merged)
          setLastRefresh(new Date())

          // Disk'e kaydet
          try {
            await fetch('/api/scan/latest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ results: merged, scanId: `refresh-${Date.now()}` }),
            })
          } catch { /* ignore */ }

          // Summary güncelle
          const strongLongs = merged.filter(r => r.hermes.signalType === 'strong_long')
          const strongShorts = merged.filter(r => r.hermes.signalType === 'strong_short')
          setSummary({
            scanId: `refresh-${Date.now()}`,
            timestamp: new Date().toISOString(),
            duration: 0,
            totalScanned: merged.length,
            strongLongs,
            strongShorts,
            longs: merged.filter(r => r.hermes.signalType === 'long'),
            shorts: merged.filter(r => r.hermes.signalType === 'short'),
            neutrals: merged.filter(r => r.hermes.signalType === 'neutral').length,
            errors: 0,
            segment: 'ALL',
          })
        }
      }

      // 200D refresh (eğer sonuç varsa)
      if (results200d.length > 0) {
        setProgress200d('Yenileniyor (200D)...')
        const BATCH = 200 // 15dk veri daha ağır, küçük batch
        const allSymbols = results200d.map(r => r.symbol)
        const updatedResults: Scan200DResult[] = []

        for (let i = 0; i < allSymbols.length; i += BATCH) {
          const batch = allSymbols.slice(i, i + BATCH)
          try {
            const res = await fetch(`/api/refresh-200d?symbols=${batch.join(',')}`)
            if (res.ok) {
              const data = await res.json()
              if (data.results) updatedResults.push(...data.results)
            }
          } catch (err) {
            console.error('[AutoRefresh] 200D batch error:', err)
          }
        }

        if (updatedResults.length > 0) {
          const updateMap = new Map(updatedResults.map(r => [r.symbol, r]))
          const merged = results200d.map(r => updateMap.get(r.symbol) || r)
          setResults200d(merged)
          setCached200DResults(merged)
          setLastRefresh200d(new Date())

          // Disk'e kaydet
          try {
            await fetch('/api/scan-200d/latest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ results: merged, scanId: `200d-refresh-${Date.now()}` }),
            })
          } catch { /* ignore */ }

          // Summary güncelle
          const strongLongs = merged.filter(r => r.hermes.signalType === 'strong_long')
          const strongShorts = merged.filter(r => r.hermes.signalType === 'strong_short')
          setSummary200d({
            scanId: `200d-refresh-${Date.now()}`,
            timestamp: new Date().toISOString(),
            duration: 0,
            totalScanned: merged.length,
            strongLongs,
            strongShorts,
            longs: merged.filter(r => r.hermes.signalType === 'long'),
            shorts: merged.filter(r => r.hermes.signalType === 'short'),
            neutrals: merged.filter(r => r.hermes.signalType === 'neutral').length,
            errors: 0,
            segment: 'ALL',
          })
        }
      }

      const now = new Date()
      setLastAutoRefresh(now)
      setLastRefresh(now)
      setLastRefresh200d(now)
      setProgress('')
      setProgress200d('')
      console.log('[AutoRefresh] Completed at', now.toLocaleTimeString())
    } catch (err) {
      console.error('[AutoRefresh] Error:', err)
      // Hata olsa bile lastAutoRefresh'i güncelle ki sonsuz retry loop olmasın
      setLastAutoRefresh(new Date())
      setProgress('')
      setProgress200d('')
    } finally {
      isRefreshingRef.current = false
      setIsAutoRefreshing(false)
    }
  }, [results, results200d])

  // Keep ref in sync
  useEffect(() => { runIncrementalRefreshRef.current = runIncrementalRefresh }, [runIncrementalRefresh])

  // ═══════════════════════════════════════════════════════════════════
  // MARKET STATUS CHECK & AUTO-REFRESH TIMER
  // Stable useEffect - refs kullanarak sık re-render'dan kaçınır
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    const settings = getSettings()
    const refreshIntervalMs = (settings.refreshInterval || 30) * 60 * 1000 // 30 dakika (her 2 mum kapanışı)

    function checkMarketAndRefresh() {
      try {
        // Market durumunu client-side hesapla (Intl timezone API)
        const now = new Date()
        const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
        const etDate = new Date(etStr)
        const hour = etDate.getHours()
        const minute = etDate.getMinutes()
        const dayOfWeek = etDate.getDay()
        const timeInMinutes = hour * 60 + minute
        const isOpen = dayOfWeek >= 1 && dayOfWeek <= 5 && timeInMinutes >= 570 && timeInMinutes < 960

        setMarketOpen(isOpen)

        if (isOpen) {
          const minsLeft = 960 - timeInMinutes
          const h = Math.floor(minsLeft / 60)
          const m = minsLeft % 60
          setMarketLabel('Seans Acik')
          setMarketNextEvent(`Kapanisa ${h}s ${m}dk`)
        } else {
          setMarketLabel('Seans Kapali')
          if (dayOfWeek >= 1 && dayOfWeek <= 5 && timeInMinutes < 570) {
            const minsLeft = 570 - timeInMinutes
            if (minsLeft < 60) {
              setMarketNextEvent(`Acilisa ${minsLeft}dk`)
            } else {
              setMarketNextEvent(`Acilisa ${Math.floor(minsLeft / 60)}s ${minsLeft % 60}dk`)
            }
          } else {
            setMarketNextEvent('Hafta ici acilir')
          }
        }

        // Seans yeni açıldıysa (kapali→açık geçiş) ve sonuç yoksa full scan
        if (isOpen && !wasMarketOpenRef.current) {
          wasMarketOpenRef.current = true
          if (resultsRef.current.length === 0) {
            console.log('[AutoRefresh] Market just opened, triggering full scan (200W)')
            runScan()
          }
          if (results200dRef.current.length === 0) {
            console.log('[AutoRefresh] Market just opened, triggering full scan (200D)')
            runScan200D()
          }
        }

        if (!isOpen) {
          wasMarketOpenRef.current = false
        }

        // Auto-refresh: seans açık, veriler var, 30dk (2 mum) geçmiş
        if (isOpen && autoRefreshEnabled && !isRefreshingRef.current) {
          const timeSinceLastRefresh = lastAutoRefreshRef.current
            ? Date.now() - lastAutoRefreshRef.current.getTime()
            : Infinity

          const timeRemaining = refreshIntervalMs - (timeSinceLastRefresh === Infinity ? refreshIntervalMs : timeSinceLastRefresh)

          if (timeRemaining > 0) {
            const minsLeft = Math.ceil(timeRemaining / 60000)
            const secsLeft = Math.ceil((timeRemaining % 60000) / 1000)
            if (minsLeft > 1) {
              setNextRefreshCountdown(`${minsLeft}dk`)
            } else {
              setNextRefreshCountdown(`${secsLeft}sn`)
            }
          } else {
            setNextRefreshCountdown('')
          }

          if (timeSinceLastRefresh >= refreshIntervalMs) {
            if (resultsRef.current.length > 0 || results200dRef.current.length > 0) {
              console.log('[AutoRefresh] 30min interval reached (2 mum kapanisi), starting incremental refresh')
              runIncrementalRefreshRef.current()
            }
          }
        } else if (!isOpen || !autoRefreshEnabled) {
          setNextRefreshCountdown('')
        }
      } catch (err) {
        console.error('[MarketCheck] Error:', err)
      }
    }

    // İlk kontrol hemen yap
    checkMarketAndRefresh()

    // Her 30 saniyede bir kontrol et (daha hassas zamanlama)
    marketCheckTimerRef.current = setInterval(checkMarketAndRefresh, 30 * 1000)

    return () => {
      if (marketCheckTimerRef.current) {
        clearInterval(marketCheckTimerRef.current)
        marketCheckTimerRef.current = null
      }
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current)
        autoRefreshTimerRef.current = null
      }
    }
  }, [autoRefreshEnabled, runScan, runScan200D])

  const contextValue: ScanContextType = {
    results,
    summary,
    loading,
    error,
    progress,
    lastRefresh,
    watchlist,
    sectorMap,
    runScan,
    toggleWatchlistItem,
    isInWatchlist,
  }

  const context200DValue: Scan200DContextType = {
    results: results200d,
    summary: summary200d,
    loading: loading200d,
    error: error200d,
    progress: progress200d,
    lastRefresh: lastRefresh200d,
    watchlist,
    sectorMap,
    runScan: runScan200D,
    toggleWatchlistItem,
    isInWatchlist,
  }

  // Determine which loading/progress to show in header
  const isAnyLoading = loading || loading200d
  const currentProgress = loading200d ? progress200d : progress

  return (
    <ScanContext.Provider value={contextValue}>
    <Scan200DContext.Provider value={context200DValue}>
      <div className="min-h-screen bg-[#08080C] text-white">
        {/* ═══ HEADER ═══ */}
        <header className="border-b border-white/5 bg-[#0A0A10] sticky top-0 z-50">
          <div className="max-w-[1920px] mx-auto px-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-orange-500 flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/20">
                  H
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">HERMES Scanner</h1>
                  <p className="text-[10px] text-white/70">NASDAQ • 52W VWAP V6 • 2777 Hisse</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Market Status Indicator */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse' : 'bg-red-400/70'}`} />
                  <div className="text-right">
                    <span className={`text-xs font-medium ${marketOpen ? 'text-emerald-400' : 'text-red-400/70'}`}>
                      {marketLabel}
                    </span>
                    {marketNextEvent && (
                      <span className="text-[10px] text-white/60 ml-1.5">
                        {marketNextEvent}
                      </span>
                    )}
                  </div>
                </div>

                {/* Auto-refresh toggle */}
                <button
                  onClick={() => setAutoRefreshEnabled(prev => !prev)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    autoRefreshEnabled 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-white/5 text-white/60 border border-white/10'
                  }`}
                  title={autoRefreshEnabled ? 'Otomatik yenileme aktif (15dk)' : 'Otomatik yenileme kapalı'}
                >
                  {isAutoRefreshing ? (
                    <span className="animate-spin inline-block">⟳</span>
                  ) : autoRefreshEnabled ? '⟳ Oto' : '⏸ Oto'}
                </button>

                <div className="w-px h-6 bg-white/10" />

                <div className="flex flex-col items-end">
                  {(activeModule === '200day' ? lastRefresh200d : lastRefresh) && (
                    <span className="text-xs text-white/70">
                      Son: {(activeModule === '200day' ? lastRefresh200d : lastRefresh)?.toLocaleTimeString('tr-TR')}
                    </span>
                  )}
                  {isAutoRefreshing && (
                    <span className="text-[9px] text-blue-400 animate-pulse">Yenileniyor...</span>
                  )}
                  {!isAutoRefreshing && marketOpen && autoRefreshEnabled && nextRefreshCountdown && (
                    <span className="text-[9px] text-white/55">Sonraki: {nextRefreshCountdown}</span>
                  )}
                </div>
                
                <button
                  onClick={handleScan}
                  disabled={isAnyLoading}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isAnyLoading
                      ? 'bg-white/5 text-white/70 cursor-wait'
                      : 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-500/20'
                  }`}
                >
                  {isAnyLoading ? currentProgress || 'Taranıyor...' : 'Tara'}
                </button>
              </div>
            </div>

            {/* Module Navigation */}
            <nav className="flex items-center gap-1 py-2 overflow-x-auto">
              {MODULES.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                    activeModule === mod.id
                      ? 'bg-white/10 text-white'
                      : mod.ready
                        ? 'text-white/50 hover:text-white/80 hover:bg-white/5'
                        : 'text-white/60 hover:text-white/50 hover:bg-white/5'
                  }`}
                >
                  <span>{mod.icon}</span>
                  <span>{mod.label}</span>
                  {!mod.ready && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">Soon</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* ═══ CONTENT ═══ */}
        <main>
          {children(activeModule)}
        </main>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-white/5 bg-[#0A0A10] py-4 mt-8">
          <div className="max-w-[1920px] mx-auto px-6 flex items-center justify-between text-xs text-white/60">
            <span>HERMES Institutional NASDAQ Scanner V6</span>
            <span>Skor: 0-20 Strong Long • 21-40 Long • 41-59 Nötr • 60-79 Short • 80-100 Strong Short</span>
          </div>
        </footer>
      </div>
    </Scan200DContext.Provider>
    </ScanContext.Provider>
  )
}
