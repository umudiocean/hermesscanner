'use client'

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { ScanResult, ScanSummary } from '@/lib/types'
import { getWatchlist, getSettings, setCachedResults, getCachedResults } from '@/lib/store'
import { REFRESH, MARKET, SCAN_GUARD } from '@/lib/config/constants'
import { LEGAL_DISCLAIMER_TEXT } from '@/lib/legal-disclaimer'
import { Kbd, Tooltip } from '@/components/ui'
import { HermesLogo } from '@/components/shell/HermesLogo'
import {
  MarketPill,
  FreshnessPill,
  RegimePill,
  LastRefreshIndicator,
} from '@/components/shell/StatusPills'
import { ModuleNav, type ModuleNavItem } from '@/components/shell/ModuleNav'
import { HermesCommandPalette } from '@/components/shell/HermesCommandPalette'
import { cn } from '@/lib/cn'

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

// ─── Premium nav items (mapped for ModuleNav primitive) ─────────────
const NAV_ITEMS: ModuleNavItem<ModuleId>[] = [
  { id: 'nasdaq-terminal',  label: 'Terminal',  shortLabel: 'TERMINAL', icon: '🧠' },
  { id: 'nasdaq-trade',     label: 'Trade AI',  shortLabel: 'TRADE',    icon: '📊' },
  { id: 'nasdaq-signals',   label: 'Signals',   shortLabel: 'SIGNALS',  icon: '⚡', premium: true, premiumTooltip: 'İleride HERMES Coin holderlarına özel' },
  { id: 'nasdaq-watchlist', label: 'Watchlist', shortLabel: 'WATCH',    icon: '⭐' },
  { id: 'hermes-index',     label: 'AI Index',  shortLabel: 'INDEX',    icon: '💎', premium: true, premiumTooltip: 'İleride HERMES Coin holderlarına özel' },
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
  priceTarget?: number
  yearHigh?: number
  yearLow?: number
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

interface HealthSnapshot {
  status: 'OK' | 'DEGRADED' | 'DOWN'
  dataFreshness?: {
    scanAgeMin?: number | null
    stocksQuoteAgeMin?: number | null
  }
  sla?: {
    scanBreached?: boolean
    stocksQuoteBreached?: boolean
  }
  sloTrend1h?: {
    totalChecks1h: number
    breachCounts1h: {
      scan: number
      stocksQuote: number
    }
  }
  watchdog?: {
    runs: number
    failures: number
    selfHealRuns: number
    selfHealFailures: number
  }
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
      title="Başa dön"
      aria-label="Sayfanın en üstüne dön"
      className={cn(
        'fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-40',
        'w-11 h-11 rounded-full',
        'bg-gradient-to-br from-gold-400 to-gold-500 text-surface-0',
        'shadow-glow-gold hover:shadow-depth-3',
        'transition-all duration-200 ease-snap hover:scale-105 active:scale-95',
        'flex items-center justify-center group',
        'animate-fade-in-up',
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-0.5 transition-transform duration-150">
        <path d="M18 15l-6-6-6 6" />
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
  const [lastPriceRefresh, setLastPriceRefresh] = useState<Date | null>(null)
  const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot | null>(null)
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

  // System health snapshot (freshness guardrail + SLO trend exposure)
  useEffect(() => {
    let cancelled = false

    async function fetchSystemHealth() {
      try {
        const res = await fetch('/api/system/health', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        setHealthSnapshot({
          status: data.status,
          dataFreshness: {
            scanAgeMin: data?.dataFreshness?.scanAgeMin ?? null,
            stocksQuoteAgeMin: data?.dataFreshness?.stocksQuoteAgeMin ?? null,
          },
          sla: {
            scanBreached: !!data?.sla?.scanBreached,
            stocksQuoteBreached: !!data?.sla?.stocksQuoteBreached,
          },
          sloTrend1h: {
            totalChecks1h: data?.sloTrend1h?.totalChecks1h ?? 0,
            breachCounts1h: {
              scan: data?.sloTrend1h?.breachCounts1h?.scan ?? 0,
              stocksQuote: data?.sloTrend1h?.breachCounts1h?.stocksQuote ?? 0,
            },
          },
          watchdog: {
            runs: data?.watchdog?.runs ?? 0,
            failures: data?.watchdog?.failures ?? 0,
            selfHealRuns: data?.watchdog?.selfHealRuns ?? 0,
            selfHealFailures: data?.watchdog?.selfHealFailures ?? 0,
          },
        })
      } catch {
        // non-blocking
      }
    }

    fetchSystemHealth()
    const iv = setInterval(fetchSystemHealth, 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  const scanAgeMin = healthSnapshot?.dataFreshness?.scanAgeMin ?? null
  const quoteAgeMin = healthSnapshot?.dataFreshness?.stocksQuoteAgeMin ?? null
  const freshnessLevel: 'good' | 'warn' | 'bad' = (
    healthSnapshot?.status === 'DOWN'
    || !!healthSnapshot?.sla?.scanBreached
    || !!healthSnapshot?.sla?.stocksQuoteBreached
  )
    ? 'bad'
    : (
      (scanAgeMin !== null && scanAgeMin > 60)
      || (quoteAgeMin !== null && quoteAgeMin > 10)
    )
      ? 'warn'
      : 'good'

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
            priceTarget: s.priceTarget || 0,
            yearHigh: s.yearHigh || 0,
            yearLow: s.yearLow || 0,
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
    const norm = symbol.toUpperCase()
    setWatchlist(prev => {
      const newList = prev.includes(norm) 
        ? prev.filter(s => s !== norm)
        : [...prev, norm]
      localStorage.setItem('hermes_watchlist', JSON.stringify(newList))
      return newList
    })
  }, [])

  const isInWatchlist = useCallback((symbol: string) => {
    return watchlist.includes(symbol.toUpperCase())
  }, [watchlist])

  // Scan function
  const MIN_TRUSTED_CACHE = SCAN_GUARD.MIN_TRUSTED_RESULTS

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
          setError('Tarama sonucu bulunamadi. Veriler yukleniyor, lutfen birkas saniye bekleyin...')
          setTimeout(() => runScan(), 10000)
        }
      } else {
        setError('Sunucu hatasi — tarama yapilamadi. Sayfayi yenileyin veya admin panelini kontrol edin.')
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
      // First, try cheap server-side cached snapshot (cron-fed) to avoid client heavy refresh storms.
      try {
        const latestRes = await fetch('/api/scan/latest')
        if (latestRes.ok) {
          const latest = await latestRes.json()
          const latestCount = latest.results?.length ?? 0
          if (latestCount >= MIN_TRUSTED_CACHE) {
            const allResults: ScanResult[] = latest.results
            const strongLongs = allResults.filter((r: ScanResult) => r.hermes.signalType === 'strong_long')
            const strongShorts = allResults.filter((r: ScanResult) => r.hermes.signalType === 'strong_short')
            setResults(allResults)
            setSummary({
              scanId: latest.scanId || `refresh-cache-${Date.now()}`,
              timestamp: latest.timestamp || new Date().toISOString(),
              duration: 0,
              totalScanned: allResults.length,
              strongLongs,
              strongShorts,
              longs: allResults.filter((r: ScanResult) => r.hermes.signalType === 'long'),
              shorts: allResults.filter((r: ScanResult) => r.hermes.signalType === 'short'),
              neutrals: allResults.filter((r: ScanResult) => r.hermes.signalType === 'neutral').length,
              errors: 0,
              segment: 'ALL',
            })
            setCachedResults(allResults)
            const now = new Date()
            setLastAutoRefresh(now)
            setLastRefresh(now)
            setProgress('')
            return
          }
        }
      } catch {
        // continue to heavier fallback
      }

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
  // LIVE PRICE ONLY REFRESH (lightweight, no heavy rescoring)
  // ═══════════════════════════════════════════════════════════════════
  const refreshLiveQuotes = useCallback(async () => {
    if (resultsRef.current.length === 0) return

    try {
      const symbols = resultsRef.current.map(r => r.symbol)
      const res = await fetch('/api/quotes/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      })
      if (!res.ok) return

      const data = await res.json()
      const quotes = data.quotes || {}
      if (Object.keys(quotes).length === 0) return

      setResults(prev => prev.map(r => {
        const q = quotes[r.symbol]
        if (!q) return r
        return {
          ...r,
          quote: {
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            volume: q.volume,
            marketCap: q.marketCap,
          },
          timestamp: data.timestamp || new Date().toISOString(),
        }
      }))
      setLastPriceRefresh(new Date())
    } catch {
      // lightweight loop, fail silently
    }
  }, [])

  useEffect(() => {
    const intervalSec = marketOpen
      ? REFRESH.NASDAQ_PRICE_OPEN_SEC
      : REFRESH.NASDAQ_PRICE_CLOSED_SEC

    const timer = setInterval(() => {
      refreshLiveQuotes()
    }, intervalSec * 1000)

    return () => clearInterval(timer)
  }, [marketOpen, refreshLiveQuotes])

  // ═══════════════════════════════════════════════════════════════════
  // MARKET STATUS CHECK & AUTO-REFRESH TIMER
  // Stable useEffect - refs kullanarak sık re-render'dan kaçınır
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    const refreshIntervalMs = REFRESH.TRADE_OPEN_INTERVAL_MIN * 60 * 1000

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

        // Seans yeni acildiysa (kapali->acik gecis) → incremental refresh tetikle
        // Eski veri varsa bile guncel veri cekmeli
        if (isOpen && !wasMarketOpenRef.current) {
          wasMarketOpenRef.current = true
          if (resultsRef.current.length === 0) {
            console.log('[AutoRefresh] Market just opened, no data — triggering full scan')
            runScan()
          } else {
            console.log('[AutoRefresh] Market just opened, refreshing data from server cache')
            runIncrementalRefreshRef.current()
          }
        }

        // Seans kapanisinda bir kez final incremental refresh
        if (!isOpen && wasMarketOpenRef.current && resultsRef.current.length > 0 && !isRefreshingRef.current) {
          console.log('[AutoRefresh] Market just closed, running final incremental refresh')
          runIncrementalRefreshRef.current()
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
              console.log('[AutoRefresh] 60min interval reached, starting incremental refresh')
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
    marketCheckTimerRef.current = setInterval(checkMarketAndRefresh, MARKET.CHECK_INTERVAL_MS)

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

  // ─── Command Palette state ──────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false)

  return (
    <ScanContext.Provider value={contextValue}>
      <div className="min-h-screen bg-surface-0 text-text-primary relative">
        {/* Premium ambient background — refined aurora + neural grid */}
        <div className="aurora-bg" aria-hidden="true">
          <div className="aurora-blob-1" />
          <div className="aurora-blob-2" />
          <div className="aurora-blob-3" />
        </div>
        <div className="neural-grid" aria-hidden="true" />

        {/* ═══ HEADER — Premium institutional terminal chrome ═══ */}
        <header className="sticky top-0 z-50 bg-surface-1/90 backdrop-blur-xl safe-top border-b border-stroke transform-gpu will-change-transform">
          <div className="max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6">
            {/* ── Top bar ── */}
            <div className="flex items-center justify-between h-14 gap-3">
              {/* Brand */}
              <div className="flex items-center gap-3 min-w-0">
                {onBack && (
                  <Tooltip content="Pazar seçimine dön" side="bottom">
                    <button
                      onClick={onBack}
                      aria-label="Pazar seçimine dön"
                      className={cn(
                        'w-9 h-9 rounded-lg shrink-0',
                        'bg-surface-3 border border-stroke text-text-secondary',
                        'hover:bg-surface-4 hover:text-gold-400 hover:border-stroke-gold',
                        'transition-all duration-150 ease-snap',
                        'flex items-center justify-center',
                      )}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </Tooltip>
                )}
                <HermesLogo size={36} />
                <div className="flex items-center gap-2.5 min-w-0">
                  <h1 className="text-md font-semibold tracking-tight whitespace-nowrap">
                    <span className="text-text-primary">HERMES</span>
                    <span className="ml-1.5 text-gold-400 font-bold">AI</span>
                  </h1>
                  <span className="hidden lg:block w-px h-3.5 bg-stroke" />
                  <span className="hidden lg:inline text-2xs font-medium tracking-widest uppercase text-text-tertiary">
                    NASDAQ/NYSE · Neural Core
                  </span>
                </div>
              </div>

              {/* Center: Cmd+K trigger (premium signature) */}
              <button
                onClick={() => setPaletteOpen(true)}
                className={cn(
                  'hidden md:flex items-center gap-2.5 flex-1 max-w-sm mx-auto h-9 px-3 rounded-lg',
                  'bg-surface-2/70 border border-stroke text-text-tertiary text-sm',
                  'hover:bg-surface-3 hover:border-stroke-strong hover:text-text-secondary',
                  'transition-all duration-150 ease-snap',
                )}
                aria-label="Komut paletini aç"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="flex-1 text-left truncate">Sembol, modül veya komut ara…</span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <Kbd size="xs">⌘</Kbd>
                  <Kbd size="xs">K</Kbd>
                </span>
              </button>

              {/* Right cluster */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Mobile palette trigger */}
                <button
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Komut paleti"
                  className="md:hidden w-9 h-9 rounded-lg bg-surface-3 border border-stroke text-text-secondary hover:text-gold-400 hover:border-stroke-gold transition-all duration-150 flex items-center justify-center"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </button>

                <MarketPill open={marketOpen} label={marketLabel} nextEvent={marketNextEvent} />

                {healthSnapshot && (
                  <FreshnessPill
                    level={freshnessLevel}
                    scanAgeMin={scanAgeMin}
                    quoteAgeMin={quoteAgeMin}
                  />
                )}

                <RegimePill regime={marketRegime} vix={vixValue} />

                {/* Auto-refresh toggle */}
                <Tooltip content={autoRefreshEnabled ? 'Auto-refresh: aktif (60dk)' : 'Auto-refresh: durdu'} side="bottom">
                  <button
                    onClick={() => setAutoRefreshEnabled(prev => !prev)}
                    aria-pressed={autoRefreshEnabled}
                    aria-label="Auto-refresh kontrol"
                    className={cn(
                      'h-7 px-2.5 rounded-md text-2xs font-semibold tracking-wide border transition-all duration-150',
                      autoRefreshEnabled
                        ? 'bg-success-400/12 text-success-300 border-success-400/30 hover:bg-success-400/18'
                        : 'bg-surface-3 text-text-tertiary border-stroke hover:bg-surface-4',
                    )}
                  >
                    {isAutoRefreshing ? <span className="animate-spin inline-block">↻</span> : 'AUTO'}
                  </button>
                </Tooltip>

                <LastRefreshIndicator
                  lastRefresh={lastRefresh}
                  lastPriceRefresh={lastPriceRefresh}
                  isRefreshing={isAutoRefreshing}
                  marketOpen={marketOpen}
                  autoEnabled={autoRefreshEnabled}
                  countdown={nextRefreshCountdown}
                />
              </div>
            </div>

            {/* ── Module navigation ── */}
            <ModuleNav
              items={NAV_ITEMS}
              active={activeModule}
              onChange={setActiveModule}
              className="-mx-3 px-3 sm:mx-0 sm:px-0"
            />
          </div>
          {/* Subtle gold seam */}
          <div className="h-px bg-gradient-to-r from-transparent via-gold-400/25 to-transparent" />
        </header>

        {/* ═══ CONTENT ═══ */}
        <main className="relative animate-fade-in">
          {children(activeModule)}
        </main>

        {/* ═══ FOOTER — minimal institutional ═══ */}
        <footer className="border-t border-stroke-subtle bg-surface-1/60 backdrop-blur-sm py-3 mt-12 safe-bottom">
          <div className="max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold tracking-wide text-text-secondary truncate">HERMES AI</span>
                <span className="text-text-quaternary">·</span>
                <span className="hidden sm:inline text-xs text-text-tertiary truncate">Institutional Trading Terminal</span>
              </div>
              <span className="hidden md:inline text-xs text-text-tertiary shrink-0">
                Neural Core · Real-Time Analysis
              </span>
            </div>
            <p className="text-2xs text-text-quaternary leading-relaxed">{LEGAL_DISCLAIMER_TEXT}</p>
          </div>
        </footer>

        {/* ═══ Cmd+K Command Palette ═══ */}
        <HermesCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          activeModule={activeModule}
          onModuleChange={setActiveModule}
          symbols={results.slice(0, 50).map(r => r.symbol)}
          onRefresh={() => { void runScan() }}
          onScrollTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />

        <ScrollToTopButton />
      </div>
    </ScanContext.Provider>
  )
}
