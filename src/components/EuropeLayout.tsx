'use client'

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { ScanResult, ScanSummary } from '@/lib/types'
import { getWatchlist, getSettings } from '@/lib/store'
import { FmpLookupItem } from './Layout'
import { LEGAL_DISCLAIMER_TEXT } from '@/lib/legal-disclaimer'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Europe Layout with Module Navigation
// ═══════════════════════════════════════════════════════════════════

export type EuropeModuleId = 'europe-terminal' | 'europe-trade' | 'europe-signals' | 'europe-watchlist' | 'europe-index'

interface Module {
  id: EuropeModuleId
  label: string
  icon: string
  ready: boolean
}

const MODULES: Module[] = [
  { id: 'europe-terminal', label: 'AVRUPA TERMINAL AI', icon: '🧠', ready: true },
  { id: 'europe-trade', label: 'TRADE AI', icon: '📊', ready: true },
  { id: 'europe-signals', label: 'AI SINYALLERI', icon: '⚡', ready: true },
  { id: 'europe-watchlist', label: 'Takip Listesi', icon: '⭐', ready: true },
  { id: 'europe-index', label: 'HERMES AI ENDEKS', icon: '💎', ready: true },
]

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

// ═══════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════

interface EuropeScanContextType {
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
  marketOpen: boolean
}

const EuropeScanContext = createContext<EuropeScanContextType | null>(null)

export function useEuropeTradeContext() {
  const ctx = useContext(EuropeScanContext)
  if (!ctx) throw new Error('useEuropeTradeContext must be used within EuropeLayout')
  return ctx
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    function onScroll() { setVisible(window.scrollY > 400) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!visible) return null
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 15l-6-6-6 6" /><path d="M18 9l-6-6-6 6" />
      </svg>
    </button>
  )
}

export default function EuropeLayout({ children, onBack }: { children: (activeModule: EuropeModuleId) => React.ReactNode; onBack?: () => void }) {
  const [activeModule, setActiveModule] = useState<EuropeModuleId>('europe-terminal')
  const [results, setResults] = useState<ScanResult[]>([])
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [sectorMap, setSectorMap] = useState<Map<string, string>>(new Map())
  const [fmpStocksMap, setFmpStocksMap] = useState<Map<string, FmpLookupItem>>(new Map())
  const [marketOpen, setMarketOpen] = useState(false)
  const [marketLabel, setMarketLabel] = useState('Kontrol ediliyor...')
  const [marketNextEvent, setMarketNextEvent] = useState('')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState('')
  const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot | null>(null)
  const marketCheckTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wasMarketOpenRef = useRef(false)
  const isRefreshingRef = useRef(false)
  const resultsRef = useRef<ScanResult[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hermes_eu_watchlist')
      if (stored) setWatchlist(JSON.parse(stored))
    } catch { /* */ }
  }, [])

  // Fetch EU Terminal stocks
  useEffect(() => {
    let cancelled = false
    async function fetchEuStocks() {
      try {
        const res = await fetch('/api/europe-terminal/stocks')
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
    fetchEuStocks()
    return () => { cancelled = true }
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

  const toggleWatchlistItem = useCallback((symbol: string) => {
    setWatchlist(prev => {
      const newList = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
      localStorage.setItem('hermes_eu_watchlist', JSON.stringify(newList))
      return newList
    })
  }, [])

  const isInWatchlist = useCallback((symbol: string) => watchlist.includes(symbol), [watchlist])

  const runScan = useCallback(async () => {
    setLoading(true); setError(null); setProgress('Avrupa verisi yukleniyor...')
    try {
      const cachedRes = await fetch('/api/europe-scan/latest')
      if (cachedRes.ok) {
        const cached = await cachedRes.json()
        if (cached.results?.length > 0) {
          setResults(cached.results); resultsRef.current = cached.results
          setSummary(cached.summary); setLastRefresh(new Date())
          setProgress(''); setLoading(false); return
        }
      }
      setProgress('Avrupa borsalari taraniyor...')
      const scanRes = await fetch('/api/europe-scan?limit=200')
      if (!scanRes.ok) throw new Error(`Scan failed: ${scanRes.status}`)
      const data = await scanRes.json()
      setResults(data.results || []); resultsRef.current = data.results || []
      setSummary(data.summary); setLastRefresh(new Date())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false); setProgress('')
    }
  }, [])

  // Initial scan on mount (like NASDAQ — scan once on load if no cached data)
  const initialScanRef = useRef(false)
  useEffect(() => {
    if (!initialScanRef.current && resultsRef.current.length === 0) {
      initialScanRef.current = true
      runScan()
    }
  }, [runScan])

  // Europe market hours check (CET-based)
  useEffect(() => {
    function checkMarket() {
      const now = new Date()
      const londonStr = now.toLocaleString('en-US', { timeZone: 'Europe/London' })
      const londonDate = new Date(londonStr)
      const h = londonDate.getHours(), m = londonDate.getMinutes()
      const dayOfWeek = londonDate.getDay()
      const mins = h * 60 + m
      const isOpen = dayOfWeek >= 1 && dayOfWeek <= 5 && mins >= 480 && mins < 1050

      setMarketOpen(isOpen)
      if (isOpen) {
        const remain = 1050 - mins
        setMarketLabel('SEANS ACIK')
        setMarketNextEvent(`Kapanisa ${Math.floor(remain / 60)}s ${remain % 60}dk`)
      } else {
        setMarketLabel('SEANS KAPALI')
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && mins < 480) {
          const diff = 480 - mins
          setMarketNextEvent(`Acilisa ${Math.floor(diff / 60)}s ${diff % 60}dk`)
        } else {
          setMarketNextEvent('Hafta ici acilir')
        }
      }

      if (isOpen && !wasMarketOpenRef.current) {
        wasMarketOpenRef.current = true
        if (resultsRef.current.length === 0) runScan()
      }
      if (!isOpen) wasMarketOpenRef.current = false
    }
    checkMarket()
    marketCheckTimerRef.current = setInterval(checkMarket, 30_000)
    return () => { if (marketCheckTimerRef.current) clearInterval(marketCheckTimerRef.current) }
  }, [runScan])

  const contextValue: EuropeScanContextType = {
    results, summary, loading, error, progress, lastRefresh, watchlist,
    sectorMap, fmpStocksMap, runScan, toggleWatchlistItem, isInWatchlist, marketOpen,
  }

  return (
    <EuropeScanContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#0d0d0d] text-white relative">
        <div className="aurora-bg" aria-hidden="true">
          <div className="aurora-blob-1" /><div className="aurora-blob-2" /><div className="aurora-blob-3" />
        </div>
        <div className="neural-grid" aria-hidden="true" />

        <header className="sticky top-0 z-50 bg-[#111111]/95 backdrop-blur-xl safe-top transform-gpu will-change-transform">
          <div className="header-glow-line" />
          <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6">
            <div className="flex items-center justify-between h-12 sm:h-14">
              <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                {onBack && (
                  <button onClick={onBack} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-midnight-50/50 border border-blue-400/10 flex items-center justify-center text-white/50 hover:text-blue-300 hover:border-blue-400/30 transition-all duration-200 shrink-0" title="Back to Markets">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                )}
                <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] sm:rounded-[12px] bg-[#1e2028] flex items-center justify-center overflow-hidden shrink-0"
                  style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                  <span className="text-lg">🇪🇺</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-sm sm:text-base font-bold tracking-wide whitespace-nowrap">
                    <span className="text-white/90">HERMES</span>
                    <span className="text-blue-400 ml-1 sm:ml-1.5 font-extrabold">AI</span>
                  </h1>
                  <div className="hidden lg:block w-px h-4 bg-blue-400/15" />
                  <span className="hidden lg:inline text-[11px] text-blue-400/50 font-medium tracking-wider uppercase truncate">AVRUPA • 8 Borsa</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-midnight-50/50 border border-blue-400/8">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${marketOpen ? 'bg-hermes-green shadow-lg shadow-hermes-green/50 animate-pulse' : 'bg-red-400/50'}`} />
                  <span className={`text-[10px] sm:text-[11px] font-semibold tracking-wide ${marketOpen ? 'text-hermes-green' : 'text-red-400/50'}`}>
                    <span className="hidden sm:inline">{marketLabel}</span>
                    <span className="sm:hidden">{marketOpen ? 'ACIK' : 'KAPALI'}</span>
                  </span>
                  {marketNextEvent && <span className="text-[10px] text-white/40 hidden lg:inline">{marketNextEvent}</span>}
                </div>
                {healthSnapshot && (
                  <div
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border ${
                      freshnessLevel === 'bad'
                        ? 'bg-red-500/12 text-red-300 border-red-500/30'
                        : freshnessLevel === 'warn'
                          ? 'bg-amber-500/12 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                    }`}
                    title={
                      `Freshness Guardrail | ScanAge=${scanAgeMin ?? 'n/a'}m | QuoteAge=${quoteAgeMin ?? 'n/a'}m | `
                      + `SLO1h scan=${healthSnapshot.sloTrend1h?.breachCounts1h.scan ?? 0}, quote=${healthSnapshot.sloTrend1h?.breachCounts1h.stocksQuote ?? 0}, checks=${healthSnapshot.sloTrend1h?.totalChecks1h ?? 0}`
                    }
                  >
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide">
                      {freshnessLevel === 'bad' ? 'FRESHNESS BAD' : freshnessLevel === 'warn' ? 'FRESHNESS WARN' : 'FRESHNESS OK'}
                    </span>
                    <span className="hidden xl:inline text-[10px] opacity-80">
                      SLO1h {healthSnapshot.sloTrend1h?.breachCounts1h.scan ?? 0}/{healthSnapshot.sloTrend1h?.breachCounts1h.stocksQuote ?? 0}
                    </span>
                  </div>
                )}
                {healthSnapshot && (
                  <div
                    className="hidden xl:flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/70"
                    title={
                      `Ops Trend | Watchdog runs=${healthSnapshot.watchdog?.runs ?? 0}, fail=${healthSnapshot.watchdog?.failures ?? 0}, `
                      + `selfHeal=${healthSnapshot.watchdog?.selfHealRuns ?? 0}, selfHealFail=${healthSnapshot.watchdog?.selfHealFailures ?? 0}`
                    }
                  >
                    <span className="text-[10px] font-semibold tracking-wide">OPS</span>
                    <span className="text-[10px] opacity-80">
                      W {healthSnapshot.watchdog?.failures ?? 0}/{healthSnapshot.watchdog?.runs ?? 0}
                    </span>
                    <span className="text-[10px] opacity-70">
                      H {healthSnapshot.watchdog?.selfHealFailures ?? 0}/{healthSnapshot.watchdog?.selfHealRuns ?? 0}
                    </span>
                  </div>
                )}
                <button onClick={() => setAutoRefreshEnabled(prev => !prev)}
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all duration-200 border ${autoRefreshEnabled ? 'bg-hermes-green/10 text-hermes-green border-hermes-green/20' : 'bg-midnight-50/50 text-white/50 border-blue-400/8'}`}>
                  {isAutoRefreshing ? <span className="animate-spin inline-block">↻</span> : 'Auto'}
                </button>
                <div className="hidden lg:flex flex-col items-end gap-0.5">
                  {lastRefresh && (
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-hermes-green opacity-40 live-dot" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-hermes-green" /></span>
                      <span className="text-[10px] text-white/45 font-mono">{lastRefresh?.toLocaleTimeString('en-US', { hour12: false })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <nav className="flex items-center gap-0.5 -mb-px overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
              {MODULES.map(mod => (
                <button key={mod.id} onClick={() => setActiveModule(mod.id)}
                  className={`relative px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-[13px] font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1 sm:gap-1.5 shrink-0 ${activeModule === mod.id ? 'text-blue-300' : 'text-white/45 hover:text-white/60'}`}>
                  <span className="text-xs sm:text-sm">{mod.icon}</span>
                  <span className="hidden sm:inline">{mod.label}</span>
                  <span className="sm:hidden">{mod.id === 'europe-terminal' ? 'TERMINAL' : mod.id === 'europe-trade' ? 'TRADE' : mod.id === 'europe-signals' ? 'SINYALLER' : mod.id === 'europe-watchlist' ? 'TAKIP' : 'ENDEKS'}</span>
                  {activeModule === mod.id && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-400/80 via-blue-300 to-blue-400/80 rounded-full" />}
                </button>
              ))}
            </nav>
          </div>
          <div className="header-glow-line" />
        </header>

        <main className="animate-fade-in">{children(activeModule)}</main>

        <footer className="border-t border-blue-400/8 bg-[#111111]/80 py-2.5 sm:py-3 mt-8 safe-bottom">
          <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] sm:text-[11px] text-white/35 font-medium tracking-wide truncate">HERMES AI • AVRUPA Tarayici • 8 Borsa</span>
              <span className="hidden md:inline text-[11px] text-white/40 shrink-0">LSE • XETRA • PARIS • AMS • SWISS • MILAN • MADRID • NORDIC</span>
            </div>
            <p className="text-[9px] text-white/35 leading-tight">{LEGAL_DISCLAIMER_TEXT}</p>
          </div>
        </footer>

        <ScrollToTopButton />
      </div>
    </EuropeScanContext.Provider>
  )
}
