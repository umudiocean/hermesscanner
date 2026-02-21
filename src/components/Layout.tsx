'use client'

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { ScanResult, ScanSummary } from '@/lib/types'
import { getWatchlist, getSettings, setCachedResults, getCachedResults } from '@/lib/store'

// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Main Layout with Module Navigation
// ═══════════════════════════════════════════════════════════════════

export type ModuleId = 'nasdaq-terminal' | 'nasdaq-trade' | 'nasdaq-signals' | 'nasdaq-watchlist' | 'hermes-index'

interface Module {
  id: ModuleId
  label: string
  icon: string
  ready: boolean
}

const MODULES: Module[] = [
  { id: 'nasdaq-terminal', label: 'NASDAQ TERMINAL AI', icon: '🧠', ready: true },
  { id: 'nasdaq-trade', label: 'TRADE AI', icon: '📊', ready: true },
  { id: 'nasdaq-signals', label: 'AI SIGNALS', icon: '⚡', ready: true },
  { id: 'nasdaq-watchlist', label: 'Watchlist', icon: '⭐', ready: true },
  { id: 'hermes-index', label: 'HERMES AI INDEX', icon: '💎', ready: true },
]

// ═══════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════

export interface FmpLookupItem {
  confidence: number
  valuationScore: number
  valuationLabel: string
  /** Terminal AI signal: STRONG | GOOD | NEUTRAL | WEAK | BAD */
  signal?: string
  /** Risk score 0-100 (for AI Signal confluence logic) */
  riskScore?: number
}

interface ScanContextType {
  results: ScanResult[]
  summary: ScanSummary | null
  loading: boolean
  error: string | null
  progress: string
  lastRefresh: Date | null
  watchlist: string[]
  sectorMap: Map<string, string>
  fmpStocksMap: Map<string, FmpLookupItem>
  runScan: () => Promise<void>
  toggleWatchlistItem: (symbol: string) => void
  isInWatchlist: (symbol: string) => boolean
  marketRegime: 'RISK_ON' | 'CAUTION' | 'RISK_OFF' | 'CRISIS'
  vixValue: number | null
  signalsPaused: boolean
  pauseReason: string | null
  positionSizeMultiplier: number
}

const ScanContext = createContext<ScanContextType | null>(null)

export function useNasdaqTradeContext() {
  const ctx = useContext(ScanContext)
  if (!ctx) throw new Error('useNasdaqTradeContext must be used within Layout')
  return ctx
}

// Backward compat alias
export const useScanContext = useNasdaqTradeContext

// ═══════════════════════════════════════════════════════════════════
// SCROLL TO TOP BUTTON — global, appears after 400px scroll
// ═══════════════════════════════════════════════════════════════════

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-[#0d0d0d] shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
      title="Basa Don"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-0.5 transition-transform">
        <path d="M18 15l-6-6-6 6" />
        <path d="M18 9l-6-6-6 6" />
      </svg>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════
// LAYOUT COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function Layout({ children, onBack }: { children: (activeModule: ModuleId) => React.ReactNode; onBack?: () => void }) {
  const [activeModule, setActiveModule] = useState<ModuleId>('nasdaq-terminal')
  const [results, setResults] = useState<ScanResult[]>([])
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [sectorMap, setSectorMap] = useState<Map<string, string>>(new Map())
  const [fmpStocksMap, setFmpStocksMap] = useState<Map<string, FmpLookupItem>>(new Map())

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

  // Market Risk / Regime state
  const [marketRegime, setMarketRegime] = useState<'RISK_ON' | 'CAUTION' | 'RISK_OFF' | 'CRISIS'>('RISK_ON')
  const [vixValue, setVixValue] = useState<number | null>(null)
  const [signalsPaused, setSignalsPaused] = useState(false)
  const [pauseReason, setPauseReason] = useState<string | null>(null)
  const [positionSizeMultiplier, setPositionSizeMultiplier] = useState(1.0)
  const resultsRef = useRef<ScanResult[]>([])
  const lastAutoRefreshRef = useRef<Date | null>(null)
  const runIncrementalRefreshRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Load watchlist & settings on mount
  useEffect(() => {
    setWatchlist(getWatchlist())
    const settings = getSettings()
    setAutoRefreshEnabled(settings.autoRefresh)
  }, [])

  // Market Risk / Regime fetch (every 5 min)
  useEffect(() => {
    let cancelled = false
    async function fetchRisk() {
      try {
        const res = await fetch('/api/risk')
        if (!res.ok || cancelled) return
        const data = await res.json()
        setMarketRegime(data.regime || 'RISK_ON')
        setVixValue(data.vix ?? null)
        setSignalsPaused(!!data.signalsPaused)
        setPauseReason(data.pauseReason || null)
        setPositionSizeMultiplier(data.positionSizeMultiplier ?? 1.0)
      } catch { /* silent — risk data is advisory */ }
    }
    fetchRisk()
    const iv = setInterval(fetchRisk, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  // FMP stocks (GUVEN/FIYATLAMA) — NASDAQ Terminal Hisseler ile ayni kaynak
  useEffect(() => {
    let cancelled = false
    async function fetchFmpStocks() {
      try {
        const res = await fetch('/api/fmp-terminal/stocks')
        if (!res.ok || cancelled) return
        const data = await res.json()
        const map = new Map<string, FmpLookupItem>()
        for (const s of (data.stocks || [])) {
          map.set(s.symbol, {
            confidence: s.confidence || 0,
            valuationScore: s.valuationScore || 0,
            valuationLabel: s.valuationLabel || '',
            signal: s.signal || 'NEUTRAL',
            riskScore: s.riskScore ?? 50,
          })
        }
        if (!cancelled) setFmpStocksMap(map)
      } catch { /* silent */ }
    }
    fetchFmpStocks()
    return () => { cancelled = true }
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
  const MIN_TRUSTED_CACHE = 1500

  const runScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress('Loading...')

    try {
      // Read from pre-computed cache (cron fills these)
      const cachedRes = await fetch('/api/scan/latest')
      if (cachedRes.ok) {
        const cached = await cachedRes.json()
        const resultCount = cached.results?.length ?? 0
        if (resultCount > 0 && resultCount >= MIN_TRUSTED_CACHE) {
          const allResults: ScanResult[] = cached.results

          const newSummary: ScanSummary = {
            scanId: cached.scanId || `cache-${Date.now()}`,
            timestamp: cached.timestamp || new Date().toISOString(),
            duration: 0,
            totalScanned: allResults.length,
            strongLongs: allResults.filter((r: ScanResult) => r.hermes.signalType === 'strong_long'),
            strongShorts: allResults.filter((r: ScanResult) => r.hermes.signalType === 'strong_short'),
            longs: allResults.filter((r: ScanResult) => r.hermes.signalType === 'long'),
            shorts: allResults.filter((r: ScanResult) => r.hermes.signalType === 'short'),
            neutrals: allResults.filter((r: ScanResult) => r.hermes.signalType === 'neutral').length,
            errors: 0,
            segment: 'ALL',
          }

          setResults(allResults)
          setSummary(newSummary)
          setCachedResults(allResults)
          const now = new Date()
          setLastRefresh(now)
          setLastAutoRefresh(now)
          setLoading(false)
          setProgress('')
          console.log(`[Layout] Loaded ${allResults.length} results from cache (source: ${cached.source || 'redis'})`)
          return
        }
      }

      // No cached results — trigger a server-side scan via cron endpoint
      setProgress('Generating scores from Redis data...')
      console.log('[Layout] No cached results — triggering server-side scan')

      const scanRes = await fetch('/api/scan?segment=ALL&mode=json')
      if (scanRes.ok) {
        const data = await scanRes.json()
        const allResults: ScanResult[] = data.allResults || []

        if (allResults.length > 0) {
          const newSummary: ScanSummary = {
            scanId: data.scanId || `scan-${Date.now()}`,
            timestamp: new Date().toISOString(),
            duration: data.duration || 0,
            totalScanned: allResults.length,
            strongLongs: allResults.filter((r: ScanResult) => r.hermes.signalType === 'strong_long'),
            strongShorts: allResults.filter((r: ScanResult) => r.hermes.signalType === 'strong_short'),
            longs: allResults.filter((r: ScanResult) => r.hermes.signalType === 'long'),
            shorts: allResults.filter((r: ScanResult) => r.hermes.signalType === 'short'),
            neutrals: allResults.filter((r: ScanResult) => r.hermes.signalType === 'neutral').length,
            errors: data.errors || 0,
            segment: 'ALL',
          }

          setResults(allResults)
          setSummary(newSummary)
          setCachedResults(allResults)
          const now = new Date()
          setLastRefresh(now)
          setLastAutoRefresh(now)
          console.log(`[Layout] Scan complete: ${allResults.length} results`)
        } else {
          setError('No scan results — bootstrap may not be complete yet. Check admin panel.')
        }
      } else {
        setError('Scan failed — server returned an error')
      }

      setLoading(false)
      setProgress('')

    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
      setProgress('')
    }
  }, [])

  // Scan handler
  const handleScan = useCallback(async () => {
    await runScan()
  }, [runScan])

  // Load cached results on mount (52W)
  useEffect(() => {
    async function loadInitial() {
      // Check memory cache first
      const cached = getCachedResults()
      if (cached.results.length >= MIN_TRUSTED_CACHE) {
        setResults(cached.results)
        const ts = new Date(cached.timestamp)
        setLastRefresh(ts)
        setLastAutoRefresh(ts) // Timer senkronize
        return
      }

      // Try disk/Redis cache
      try {
        const res = await fetch('/api/scan/latest')
        if (res.ok) {
          const data = await res.json()
          const n = data.results?.length ?? 0
          if (n >= MIN_TRUSTED_CACHE) {
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


  // Keep refs in sync with state (for stable useEffect)
  useEffect(() => { resultsRef.current = results }, [results])
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
      // 52W refresh (eğer sonuç varsa)
      if (results.length > 0) {
        setProgress('Yenileniyor (52W)...')
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
            console.error('[AutoRefresh] 52W batch error:', err)
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

      const now = new Date()
      setLastAutoRefresh(now)
      setLastRefresh(now)
      setProgress('')
      console.log('[AutoRefresh] Completed at', now.toLocaleTimeString())
    } catch (err) {
      console.error('[AutoRefresh] Error:', err)
      // Hata olsa bile lastAutoRefresh'i güncelle ki sonsuz retry loop olmasın
      setLastAutoRefresh(new Date())
      setProgress('')
    } finally {
      isRefreshingRef.current = false
      setIsAutoRefreshing(false)
    }
  }, [results])

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
          setMarketLabel('MARKET OPEN')
          setMarketNextEvent(`Close in ${h}h ${m}m`)
        } else {
          setMarketLabel('MARKET CLOSED')
          if (dayOfWeek >= 1 && dayOfWeek <= 5 && timeInMinutes < 570) {
            const minsLeft = 570 - timeInMinutes
            if (minsLeft < 60) {
              setMarketNextEvent(`Opens in ${minsLeft}m`)
            } else {
              setMarketNextEvent(`Opens in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`)
            }
          } else {
            setMarketNextEvent('Opens on weekday')
          }
        }

        // Seans yeni açıldıysa (kapali→açık geçiş) ve sonuç yoksa full scan
        if (isOpen && !wasMarketOpenRef.current) {
          wasMarketOpenRef.current = true
          if (resultsRef.current.length === 0) {
            console.log('[AutoRefresh] Market just opened, triggering full scan (52W)')
            runScan()
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
            if (resultsRef.current.length > 0) {
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
  }, [autoRefreshEnabled, runScan])

  const contextValue: ScanContextType = {
    results,
    summary,
    loading,
    error,
    progress,
    lastRefresh,
    watchlist,
    sectorMap,
    fmpStocksMap,
    runScan,
    toggleWatchlistItem,
    isInWatchlist,
    marketRegime,
    vixValue,
    signalsPaused,
    pauseReason,
    positionSizeMultiplier,
  }

  // Determine which loading/progress to show in header
  const isAnyLoading = loading
  const currentProgress = progress

  return (
    <ScanContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#0d0d0d] text-white">
        {/* ═══ HEADER — Midnight Gold Professional ═══ */}
        <header className="sticky top-0 z-50 border-b border-gold-400/10 bg-[#111111]/95 backdrop-blur-xl safe-top">
          <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between h-12 sm:h-14">
              {/* Logo & Brand */}
              <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-midnight-50/50 border border-gold-400/10 flex items-center justify-center text-white/40 hover:text-gold-300 hover:border-gold-400/30 transition-all duration-200 shrink-0"
                    title="Back to Markets"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] sm:rounded-[12px] bg-[#1e2028] flex items-center justify-center hermes-logo overflow-hidden shrink-0"
                  style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                  <svg className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] relative z-10" viewBox="0 0 32 32" fill="none">
                    <line x1="6" y1="10" x2="16" y2="7" stroke="rgba(120,160,255,0.25)" strokeWidth="0.8" />
                    <line x1="16" y1="7" x2="26" y2="12" stroke="rgba(120,160,255,0.25)" strokeWidth="0.8" />
                    <line x1="6" y1="10" x2="10" y2="18" stroke="rgba(120,160,255,0.2)" strokeWidth="0.7" />
                    <line x1="16" y1="7" x2="10" y2="18" stroke="rgba(120,160,255,0.2)" strokeWidth="0.7" />
                    <line x1="16" y1="7" x2="22" y2="16" stroke="rgba(120,160,255,0.2)" strokeWidth="0.7" />
                    <line x1="26" y1="12" x2="22" y2="16" stroke="rgba(120,160,255,0.2)" strokeWidth="0.7" />
                    <line x1="10" y1="18" x2="22" y2="16" stroke="rgba(120,160,255,0.15)" strokeWidth="0.6" />
                    <path d="M4 22 L8.5 17 L13 19.5 L18 13 L22.5 16 L28 10" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="6" cy="10" r="1.8" fill="rgba(120,160,255,0.5)" />
                    <circle cx="16" cy="7" r="2.2" fill="rgba(120,160,255,0.6)" />
                    <circle cx="26" cy="12" r="1.8" fill="rgba(120,160,255,0.5)" />
                    <circle cx="10" cy="18" r="1.5" fill="rgba(120,160,255,0.35)" />
                    <circle cx="22" cy="16" r="1.5" fill="rgba(120,160,255,0.35)" />
                    <circle cx="13" cy="19.5" r="1.4" fill="rgba(255,255,255,0.85)" />
                    <circle cx="18" cy="13" r="1.6" fill="rgba(255,255,255,0.9)" />
                    <circle cx="28" cy="10" r="1.4" fill="rgba(255,255,255,0.85)" />
                  </svg>
                  <div className="absolute inset-0 rounded-[12px] bg-gradient-to-br from-[rgba(120,160,255,0.04)] via-transparent to-transparent" />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-sm sm:text-base font-bold tracking-wide whitespace-nowrap">
                    <span className="text-white/90">HERMES</span>
                    <span className="gradient-text ml-1 sm:ml-1.5 font-extrabold">AI</span>
                  </h1>
                  <div className="hidden lg:block w-px h-4 bg-gold-400/15" />
                  <span className="hidden lg:inline text-[11px] text-gold-400/50 font-medium tracking-wider uppercase truncate">NASDAQ/NYSE • Neural Core</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Market Status */}
                <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-midnight-50/50 border border-gold-400/8">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${marketOpen ? 'bg-hermes-green shadow-lg shadow-hermes-green/50 animate-pulse' : 'bg-red-400/50'}`} />
                  <span className={`text-[10px] sm:text-[11px] font-semibold tracking-wide ${marketOpen ? 'text-hermes-green' : 'text-red-400/50'}`}>
                    <span className="hidden sm:inline">{marketLabel}</span>
                    <span className="sm:hidden">{marketOpen ? 'OPEN' : 'CLOSED'}</span>
                  </span>
                  {marketNextEvent && (
                    <span className="text-[10px] text-white/30 hidden lg:inline">{marketNextEvent}</span>
                  )}
                </div>

                {/* Regime Badge */}
                {marketRegime !== 'RISK_ON' && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                    marketRegime === 'CRISIS'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse'
                      : marketRegime === 'RISK_OFF'
                        ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`} title={pauseReason || `VIX: ${vixValue ?? '?'} | Pos: ${Math.round(positionSizeMultiplier * 100)}%`}>
                    {marketRegime === 'CRISIS' ? '🚨' : marketRegime === 'RISK_OFF' ? '⚠️' : '⚡'}
                    <span className="hidden sm:inline">{marketRegime.replace('_', ' ')}</span>
                    {vixValue !== null && <span className="opacity-60 ml-0.5">VIX {vixValue.toFixed(0)}</span>}
                  </div>
                )}

                {/* Auto-refresh */}
                <button
                  onClick={() => setAutoRefreshEnabled(prev => !prev)}
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all duration-200 border ${
                    autoRefreshEnabled 
                      ? 'bg-hermes-green/10 text-hermes-green border-hermes-green/20' 
                      : 'bg-midnight-50/50 text-white/40 border-gold-400/8'
                  }`}
                  title={autoRefreshEnabled ? 'Auto-refresh active (30min)' : 'Auto-refresh paused'}
                >
                  {isAutoRefreshing ? (
                    <span className="animate-spin inline-block">↻</span>
                  ) : 'Auto'}
                </button>

                <div className="w-px h-5 bg-gold-400/10 hidden lg:block" />

                <div className="hidden lg:flex flex-col items-end">
                  {lastRefresh && (
                    <span className="text-[10px] text-white/35 font-mono">
                      Last: {lastRefresh?.toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                  )}
                  {isAutoRefreshing && (
                    <span className="text-[10px] text-gold-300 animate-pulse">Refreshing...</span>
                  )}
                  {!isAutoRefreshing && marketOpen && autoRefreshEnabled && nextRefreshCountdown && (
                    <span className="text-[10px] text-white/25">Next: {nextRefreshCountdown}</span>
                  )}
                </div>
                
                <button
                  onClick={handleScan}
                  disabled={isAnyLoading}
                  className={`px-3 sm:px-5 py-1.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all duration-200 ${
                    isAnyLoading
                      ? 'bg-midnight-50 text-white/40 cursor-wait border border-gold-400/10'
                      : 'bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-[#0d0d0d] shadow-lg shadow-gold-400/20 hover:shadow-gold-400/35'
                  }`}
                >
                  {isAnyLoading ? (currentProgress || 'Scan...') : 'Scan'}
                </button>
              </div>
            </div>

            {/* Module Navigation — Gold accent tabs, horizontal scroll on mobile */}
            <nav className="flex items-center gap-0.5 -mb-px overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
              {MODULES.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={`relative px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-[13px] font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                    activeModule === mod.id
                      ? 'text-gold-300'
                      : mod.ready
                        ? 'text-white/35 hover:text-white/60'
                        : 'text-white/20 hover:text-white/35'
                  }`}
                >
                  <span className="text-xs sm:text-sm">{mod.icon}</span>
                  <span className="hidden sm:inline">{mod.label}</span>
                  <span className="sm:hidden">{mod.id === 'nasdaq-terminal' ? 'TERMINAL' : mod.id === 'nasdaq-trade' ? 'TRADE' : mod.id === 'nasdaq-signals' ? 'SIGNALS' : mod.id === 'nasdaq-watchlist' ? 'WATCH' : 'INDEX'}</span>
                  {(mod.id === 'nasdaq-signals' || mod.id === 'hermes-index') && (
                    <span className="relative ml-1 text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/15 text-amber-300/90 border border-amber-400/30 font-bold tracking-wider animate-pulse group/premium cursor-default">
                      PREMIUM
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] px-2 py-1 rounded-lg bg-[#1a1a2e]/95 text-amber-300/80 border border-amber-400/20 opacity-0 group-hover/premium:opacity-100 transition-opacity duration-300 pointer-events-none backdrop-blur-sm shadow-lg z-50">
                        Ileride Hermes Coin holder&apos;larina ozel
                      </span>
                    </span>
                  )}
                  {activeModule === mod.id && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-gold-400/80 via-gold-300 to-gold-400/80 rounded-full" />
                  )}
                  {!mod.ready && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold-400/10 text-gold-400/50">Soon</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* ═══ CONTENT ═══ */}
        <main className="animate-fade-in">
          {children(activeModule)}
        </main>

        {/* ═══ FOOTER — Midnight Gold ═══ */}
        <footer className="border-t border-gold-400/8 bg-[#111111]/80 py-2.5 sm:py-3 mt-8 safe-bottom">
          <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] sm:text-[11px] text-white/25 font-medium tracking-wide truncate">HERMES AI • NASDAQ/NYSE Scanner</span>
              <span className="hidden md:inline text-[11px] text-white/20 shrink-0">0-20 Strong Long • 21-35 Long • 36-66 Notr • 67-89 Short • 90-100 Strong Short</span>
            </div>
            <p className="text-[9px] text-white/15 leading-tight">
              Not financial advice. Signals are algorithmic, based on historical patterns; past performance does not guarantee future results. Always do your own research (DYOR). Use at your own risk.
            </p>
          </div>
        </footer>

        {/* ═══ SCROLL TO TOP BUTTON — appears when user scrolls down ═══ */}
        <ScrollToTopButton />
      </div>
    </ScanContext.Provider>
  )
}
