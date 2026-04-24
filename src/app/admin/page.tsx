'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, LogOut, RefreshCw, Users, Eye, Globe, Smartphone,
  Server, Database, Activity, ToggleLeft, ToggleRight, Trash2,
  TrendingUp, Zap, Cpu, Download, BarChart3, AlertTriangle,
  Home, Bitcoin, Building2, ChevronRight, CheckCircle, XCircle,
  Loader2, ArrowUpRight,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

type AdminTab = 'overview' | 'nasdaq' | 'crypto' | 'analytics' | 'system' | 'diagnostics'

interface AnalyticsData {
  analytics: {
    pageViews: { date: string; count: number }[]
    uniqueVisitors: { date: string; count: number }[]
    topPages: { path: string; count: number }[]
    referrers: { source: string; count: number }[]
    devices: { type: string; count: number }[]
    apiCalls: { endpoint: string; count: number }[]
    externalApis: { provider: string; count: number }[]
    totals: { pv: number; uv: number; api: number }
  }
  cache: {
    redis: { available: boolean; connected: boolean; keyCount: number; prefixes: Record<string, number> }
    fmpMemory: { memoryEntries: number; maxEntries: number; oldestEntry: number | null }
    cryptoMemory: { memoryEntries: number; maxEntries: number; oldestEntry: number | null }
  }
  system: Record<string, unknown>
  ops: {
    status: string
    freshness: {
      scanAgeMin?: number | null
      stocksQuoteAgeMin?: number | null
    } | null
    sla: {
      scanBreached?: boolean
      stocksQuoteBreached?: boolean
    } | null
    sloTrend1h: {
      totalChecks1h: number
      breachCounts1h: {
        cryptoMarket: number
        derivatives: number
        scan: number
        coinsBulk: number
        stocksQuote: number
      }
    } | null
    watchdog: {
      selfHealSuccess1h?: number
      selfHealFail1h?: number
    } | null
    cache: {
      tierHits1h?: {
        memory: number
        redis: number
        disk: number
        origin: number
      }
    } | null
    thresholds: {
      cacheOriginWarnPct?: number
      cacheOriginCriticalPct?: number
    } | null
  }
  generatedAt: string
}

interface FlagMap { [key: string]: boolean }

interface MarketStatus {
  stockCount: number
  lastRefresh: string | null
  loading: boolean
  error: string | null
  refreshing: boolean
}

interface BootstrapState {
  completed: number
  total: number
  lastSymbol: string
  status: string
  barCacheCount: number
  error: string | null
  redisAvailable: boolean
}

// ═══════════════════════════════════════════════════════════════════
// UI Components
// ═══════════════════════════════════════════════════════════════════

function Card({ title, icon: Icon, children, accent }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string
}) {
  return (
    <div className={`bg-surface-3 rounded-2xl border ${accent || 'border-white/8'} p-5 shadow-xl`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-[#D4B86A]" />
        <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-text-primary tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-text-quaternary mt-0.5">{sub}</div>}
    </div>
  )
}

function MiniBar({ items, max }: { items: { label: string; value: number }[]; max: number }) {
  return (
    <div className="space-y-1.5">
      {items.slice(0, 8).map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-[10px] text-text-tertiary w-24 truncate">{item.label}</span>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#D4B86A] to-[#8B7340] rounded-full transition-all duration-500"
              style={{ width: `${max > 0 ? Math.max(2, (item.value / max) * 100) : 0}%` }}
            />
          </div>
          <span className="text-[10px] text-text-secondary tabular-nums w-10 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return <div className={`w-2 h-2 rounded-full ${ok ? 'bg-success-400' : 'bg-danger-400'}`} />
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className="h-10 rounded-lg bg-surface-2 border border-stroke-subtle" />
  }
  const max = Math.max(...values, 1)
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 100
      const y = 100 - (v / max) * 100
      return `${x},${y}`
    })
    .join(' ')
  return (
    <div className="h-10 rounded-lg bg-surface-2 border border-stroke-subtle p-1">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polyline
          fill="none"
          stroke="rgba(179,148,91,0.95)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Tab definitions for header menu
// ═══════════════════════════════════════════════════════════════════

const TABS: { id: AdminTab; label: string; icon: React.ElementType; accent: string }[] = [
  { id: 'overview', label: 'Genel Bakis', icon: Home, accent: '#D4B86A' },
  { id: 'nasdaq', label: 'NASDAQ', icon: TrendingUp, accent: '#D4B86A' },
  { id: 'crypto', label: 'CRYPTO', icon: Bitcoin, accent: '#F59E0B' },
  { id: 'analytics', label: 'Analitik', icon: BarChart3, accent: '#8B5CF6' },
  { id: 'system', label: 'Sistem', icon: Server, accent: '#10B981' },
  { id: 'diagnostics', label: 'Diagnostics', icon: AlertTriangle, accent: '#F04848' },
]

// ═══════════════════════════════════════════════════════════════════
// Main Admin Dashboard
// ═══════════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [flags, setFlags] = useState<FlagMap>({})
  const [loading, setLoading] = useState(true)
  const [flagLoading, setFlagLoading] = useState<string | null>(null)

  // Market-specific states
  const [nasdaqStatus, setNasdaqStatus] = useState<MarketStatus>({
    stockCount: 0, lastRefresh: null, loading: false, error: null, refreshing: false,
  })
  const [europeStatus, setEuropeStatus] = useState<MarketStatus>({
    stockCount: 0, lastRefresh: null, loading: false, error: null, refreshing: false,
  })
  const [cryptoStatus, setCryptoStatus] = useState<MarketStatus>({
    stockCount: 0, lastRefresh: null, loading: false, error: null, refreshing: false,
  })

  const [bootstrap, setBootstrap] = useState<BootstrapState>({
    completed: 0, total: 0, lastSymbol: '', status: 'unknown', barCacheCount: 0, error: null, redisAvailable: true,
  })
  const [symbolsSync, setSymbolsSync] = useState<{
    tradeReady: string[]; tradeReadyCount: number;
    insufficient: string[]; insufficientCount: number;
  } | null>(null)
  const [cacheOriginTrend, setCacheOriginTrend] = useState<number[]>([])

  const router = useRouter()

  // ── Fetch admin stats ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, flagsRes] = await Promise.all([
        fetch('/api/admin/stats?days=7'),
        fetch('/api/admin/flags'),
      ])
      if (statsRes.ok) {
        const statsData: AnalyticsData = await statsRes.json()
        setData(statsData)
        const tier = statsData.ops?.cache?.tierHits1h
        if (tier) {
          const total = tier.memory + tier.redis + tier.disk + tier.origin
          const originPct = total > 0 ? (tier.origin / total) * 100 : 0
          setCacheOriginTrend(prev => [...prev.slice(-19), Number(originPct.toFixed(2))])
        }
      }
      if (flagsRes.ok) setFlags(await flagsRes.json())
    } catch { /* retry later */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  // ── Fetch market statuses ──
  const fetchNasdaqStatus = useCallback(async () => {
    setNasdaqStatus(p => ({ ...p, loading: true, error: null }))
    try {
      const res = await fetch('/api/fmp-terminal/stocks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setNasdaqStatus({
        stockCount: d.evrenCount ?? d.count ?? d.stocks?.length ?? 0,
        lastRefresh: d.timestamp || new Date().toISOString(),
        loading: false, error: null, refreshing: false,
      })
    } catch (e) {
      setNasdaqStatus(p => ({ ...p, loading: false, error: (e as Error).message }))
    }
  }, [])

  const fetchEuropeStatus = useCallback(async () => {
    setEuropeStatus(p => ({ ...p, loading: true, error: null }))
    try {
      const res = await fetch('/api/europe-terminal/stocks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setEuropeStatus({
        stockCount: d.count || d.stocks?.length || 0,
        lastRefresh: d.timestamp || new Date().toISOString(),
        loading: false, error: null, refreshing: false,
      })
    } catch (e) {
      setEuropeStatus(p => ({ ...p, loading: false, error: (e as Error).message }))
    }
  }, [])

  const fetchCryptoStatus = useCallback(async () => {
    setCryptoStatus(p => ({ ...p, loading: true, error: null }))
    try {
      const res = await fetch('/api/crypto-terminal/coins')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setCryptoStatus({
        stockCount: d.count || d.coins?.length || 0,
        lastRefresh: d.timestamp || new Date().toISOString(),
        loading: false, error: null, refreshing: false,
      })
    } catch (e) {
      setCryptoStatus(p => ({ ...p, loading: false, error: (e as Error).message }))
    }
  }, [])

  // Fetch all market statuses on mount
  useEffect(() => {
    fetchNasdaqStatus()
    fetchEuropeStatus()
    fetchCryptoStatus()
  }, [fetchNasdaqStatus, fetchEuropeStatus, fetchCryptoStatus])

  // ── Market refresh handlers ──
  const refreshNasdaq = useCallback(async () => {
    setNasdaqStatus(p => ({ ...p, refreshing: true, error: null }))
    try {
      // Clear FMP cache first
      await fetch('/api/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'admin' },
        body: JSON.stringify({ type: 'fmp' }),
      })
      // Trigger bulk refresh
      await fetch('/api/fmp-terminal/bulk-refresh', {
        method: 'POST',
        headers: { 'x-bulk-refresh': '1' },
      })
      // Re-fetch status
      await fetchNasdaqStatus()
    } catch (e) {
      setNasdaqStatus(p => ({ ...p, refreshing: false, error: (e as Error).message }))
    }
  }, [fetchNasdaqStatus])

  const refreshEurope = useCallback(async () => {
    setEuropeStatus(p => ({ ...p, refreshing: true, error: null }))
    try {
      await fetch('/api/europe-terminal/bulk-refresh', { method: 'POST' })
      await fetchEuropeStatus()
    } catch (e) {
      setEuropeStatus(p => ({ ...p, refreshing: false, error: (e as Error).message }))
    }
  }, [fetchEuropeStatus])

  const refreshCrypto = useCallback(async () => {
    setCryptoStatus(p => ({ ...p, refreshing: true, error: null }))
    try {
      await fetch('/api/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'admin' },
        body: JSON.stringify({ type: 'crypto' }),
      })
      await fetchCryptoStatus()
    } catch (e) {
      setCryptoStatus(p => ({ ...p, refreshing: false, error: (e as Error).message }))
    }
  }, [fetchCryptoStatus])

  // ── Bootstrap polling ──
  const fetchBootstrapStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bootstrap-status')
      if (res.ok) {
        const d = await res.json()
        const redisOk = d.redisAvailable !== false
        setBootstrap(prev => ({
          ...prev,
          completed: d.progress?.completed || 0,
          total: d.progress?.total || 0,
          lastSymbol: d.progress?.lastSymbol || '',
          status: d.progress?.status || 'not_started',
          barCacheCount: d.barCacheCount || 0,
          error: redisOk ? null : 'Redis (Upstash / Vercel KV) gerekli. Vercel Dashboard > Storage > KV ekleyin veya Upstash Redis baglayin.',
          redisAvailable: redisOk,
        }))
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchBootstrapStatus() }, [fetchBootstrapStatus])
  useEffect(() => {
    const interval = setInterval(
      fetchBootstrapStatus,
      bootstrap.status === 'running' ? 5_000 : 30_000
    )
    return () => clearInterval(interval)
  }, [fetchBootstrapStatus, bootstrap.status])

  const [bootstrapTriggering, setBootstrapTriggering] = useState(false)
  const triggerBootstrap = useCallback(async () => {
    setBootstrapTriggering(true)
    try {
      const res = await fetch('/api/admin/trigger-bootstrap', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBootstrap(prev => ({ ...prev, error: data.error || data.message || 'Bootstrap baslatilamadi' }))
      } else {
        await fetchBootstrapStatus()
      }
    } catch (e) {
      setBootstrap(prev => ({ ...prev, error: (e as Error).message }))
    } finally {
      setBootstrapTriggering(false)
    }
  }, [fetchBootstrapStatus])

  // ── Symbols sync ──
  const fetchSymbolsSync = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/symbols-sync')
      if (res.ok) setSymbolsSync(await res.json())
    } catch { setSymbolsSync(null) }
  }, [])

  useEffect(() => { fetchSymbolsSync() }, [fetchSymbolsSync])

  // ── Helpers ──
  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  async function toggleFlag(key: string) {
    setFlagLoading(key)
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: !flags[key] }),
      })
      if (res.ok) setFlags(prev => ({ ...prev, [key]: !prev[key] }))
    } catch { /* silent */ } finally { setFlagLoading(null) }
  }

  async function clearCache(type: 'fmp' | 'crypto' | 'all') {
    try {
      await fetch('/api/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'admin' },
        body: JSON.stringify({ type }),
      })
      fetchData()
    } catch { /* silent */ }
  }

  const a = data?.analytics
  const c = data?.cache

  const FLAG_LABELS: Record<string, string> = {
    'excel-download': 'CSV / Excel Indirme',
    'crypto-terminal': 'Crypto Terminal',
    'ai-signals': 'AI Signals Modulu',
    'share-panel': 'Sosyal Medya Paylasma',
    'manifesto-splash': 'Acilis Manifesto Ekrani',
  }

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-surface-1">

      {/* ═══ HEADER with Market Menu ═══ */}
      <header className="sticky top-0 z-50 bg-surface-1/95 backdrop-blur-md border-b border-white/5">
        <div className="px-4 md:px-8">
          {/* Top row: Logo + Actions */}
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4B86A]/20 to-[#D4B86A]/5 border border-[#D4B86A]/30 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-[#D4B86A]" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-text-primary">HERMES AI Admin</h1>
                <p className="text-[9px] text-text-tertiary">
                  {data?.generatedAt ? new Date(data.generatedAt).toLocaleString('tr-TR') : '...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-3 border border-white/8 text-text-secondary text-xs transition-all"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Siteye Git
              </a>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-xl bg-surface-3 hover:bg-surface-3 border border-white/8 transition-all"
              >
                <RefreshCw className={`w-4 h-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger-400/10 hover:bg-danger-400/20 border border-danger-400/30 text-danger-400 text-xs transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cikis
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="flex gap-1 overflow-x-auto pb-2 -mb-px scrollbar-hide">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-surface-3 text-white border border-stroke'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                  }`}
                  style={isActive ? { borderColor: `${tab.accent}33` } : undefined}
                >
                  <TabIcon className="w-3.5 h-3.5" style={isActive ? { color: tab.accent } : undefined} />
                  {tab.label}
                </button>
              )
            })}
            {/* Hermes Fund — separate page */}
            <a
              href="/admin/hermes-fund"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all text-text-tertiary hover:text-text-secondary hover:bg-surface-3 border border-transparent hover:border-[#C49E1C]/30"
            >
              <span className="text-sm">🏦</span>
              HERMES FON
            </a>
          </nav>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main className="p-4 md:p-8">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#D4B86A]/30 border-t-[#D4B86A] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                nasdaq={nasdaqStatus}
                europe={europeStatus}
                crypto={cryptoStatus}
                cache={c}
                ops={data?.ops}
                cacheOriginTrend={cacheOriginTrend}
                onRefreshNasdaq={refreshNasdaq}
                onRefreshEurope={refreshEurope}
                onRefreshCrypto={refreshCrypto}
                onSelectTab={setActiveTab}
              />
            )}

            {activeTab === 'nasdaq' && (
              <NasdaqTab
                status={nasdaqStatus}
                bootstrap={bootstrap}
                symbolsSync={symbolsSync}
                onRefresh={refreshNasdaq}
                onTriggerBootstrap={triggerBootstrap}
                bootstrapTriggering={bootstrapTriggering}
              />
            )}

            {activeTab === 'crypto' && (
              <CryptoTab status={cryptoStatus} onRefresh={refreshCrypto} />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab analytics={a} />
            )}

            {activeTab === 'system' && (
              <SystemTab
                cache={c}
                ops={data?.ops}
                cacheOriginTrend={cacheOriginTrend}
                flags={flags}
                flagLabels={FLAG_LABELS}
                flagLoading={flagLoading}
                onToggleFlag={toggleFlag}
                onClearCache={clearCache}
              />
            )}

            {activeTab === 'diagnostics' && <DiagnosticsTab />}
          </>
        )}
      </main>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// OVERVIEW TAB — Market Summary Cards
// ═══════════════════════════════════════════════════════════════════

function MarketCard({
  title, icon, iconBg, accent, stockCount, lastRefresh, loading: isLoading, error, refreshing,
  onRefresh, onDetail, description, features,
}: {
  title: string; icon: string; iconBg: string; accent: string
  stockCount: number; lastRefresh: string | null; loading: boolean; error: string | null; refreshing: boolean
  onRefresh: () => void; onDetail: () => void
  description: string; features: string[]
}) {
  return (
    <div className="bg-surface-3 rounded-2xl border border-white/8 hover:border-stroke p-6 shadow-xl transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center text-xl`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">{title}</h3>
            <p className="text-[10px] text-text-tertiary mt-0.5">{description}</p>
          </div>
        </div>
        {stockCount > 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success-400/15 border border-success-400/30">
            <CheckCircle className="w-3 h-3 text-success-400" />
            <span className="text-[10px] font-medium text-success-400">AKTIF</span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gold-500/15 border border-stroke-gold-strong">
            <Loader2 className="w-3 h-3 text-gold-400 animate-spin" />
            <span className="text-[10px] font-medium text-gold-400">YUKLENIYOR</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-danger-400/15 border border-danger-400/30">
            <XCircle className="w-3 h-3 text-danger-400" />
            <span className="text-[10px] font-medium text-danger-400">HATA</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: accent }}>
            {isLoading ? '...' : stockCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Toplam Hisse</div>
        </div>
        <div>
          <div className="text-sm font-medium text-text-secondary">
            {lastRefresh ? new Date(lastRefresh).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
          </div>
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Son Guncelleme</div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-danger-400/10 border border-danger-400/30 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 text-danger-400 mt-0.5 flex-shrink-0" />
          <span className="text-[10px] text-danger-400">{error}</span>
        </div>
      )}

      {/* Features */}
      <div className="space-y-1.5 mb-4">
        {features.map(f => (
          <div key={f} className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3 text-text-quaternary" />
            <span className="text-[10px] text-text-tertiary">{f}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onRefresh}
          disabled={refreshing || isLoading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
          style={{
            background: `linear-gradient(135deg, ${accent}22, ${accent}11)`,
            borderColor: `${accent}33`,
            color: accent,
            border: '1px solid',
          }}
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {refreshing ? 'Yenileniyor...' : 'Verileri Yenile'}
        </button>
        <button
          onClick={onDetail}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-3 hover:bg-surface-3 border border-white/8 text-text-secondary text-xs transition-all"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Detay
        </button>
      </div>
    </div>
  )
}

function OverviewTab({
  nasdaq, europe, crypto, cache, ops, cacheOriginTrend,
  onRefreshNasdaq, onRefreshEurope, onRefreshCrypto,
  onSelectTab,
}: {
  nasdaq: MarketStatus; europe: MarketStatus; crypto: MarketStatus
  cache: AnalyticsData['cache'] | undefined
  ops: AnalyticsData['ops'] | undefined
  cacheOriginTrend: number[]
  onRefreshNasdaq: () => void; onRefreshEurope: () => void; onRefreshCrypto: () => void
  onSelectTab: (tab: AdminTab) => void
}) {
  const tier = ops?.cache?.tierHits1h
  const tierTotal = (tier?.memory || 0) + (tier?.redis || 0) + (tier?.disk || 0) + (tier?.origin || 0)
  const hitPct = tierTotal > 0 ? Math.round((((tier?.memory || 0) + (tier?.redis || 0) + (tier?.disk || 0)) / tierTotal) * 100) : 0
  const originPct = tierTotal > 0 ? Math.round(((tier?.origin || 0) / tierTotal) * 100) : 0
  const originWarnThreshold = ops?.thresholds?.cacheOriginWarnPct ?? 25
  const originCriticalThreshold = ops?.thresholds?.cacheOriginCriticalPct ?? 40
  const slaScanBreached = !!ops?.sla?.scanBreached
  const slaQuoteBreached = !!ops?.sla?.stocksQuoteBreached
  const watchdogFail = (ops?.watchdog?.selfHealFail1h || 0) > 0
  const isOriginCritical = originPct >= originCriticalThreshold
  const isOriginWarn = originPct >= originWarnThreshold && originPct < originCriticalThreshold
  return (
    <div className="space-y-6">
      {/* Market Cards */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold mb-4">Market Durumu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <MarketCard
            title="NASDAQ"
            icon="🇺🇸"
            iconBg="bg-gradient-to-br from-[#D4B86A]/20 to-[#D4B86A]/5"
            accent="#D4B86A"
            {...nasdaq}
            onRefresh={onRefreshNasdaq}
            onDetail={() => onSelectTab('nasdaq')}
            description="US Equities & Technology — FMP API"
            features={[
              '8 kategori HERMES AI Skor',
              'Trade AI (V15 V360_Z7 Pure Z-Score)',
              'AI Signals (6 capraz sinyal)',
              'Bootstrap + Redis bar cache',
            ]}
          />
          <MarketCard
            title="CRYPTO"
            icon="₿"
            iconBg="bg-gradient-to-br from-amber-500/20 to-amber-500/5"
            accent="#F59E0B"
            {...crypto}
            onRefresh={onRefreshCrypto}
            onDetail={() => onSelectTab('crypto')}
            description="Dijital Varliklar — CoinGecko Analyst API"
            features={[
              '8 kategori Crypto AI Skor',
              'Fear & Greed + Dominans',
              'On-Chain + DEX verileri',
              'Turev + Funding Rate',
            ]}
          />
        </div>
      </div>

      {/* Quick System Status */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold mb-4">Sistem Ozeti</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-3 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusDot ok={cache?.redis?.connected ?? false} />
              <span className="text-[10px] text-text-tertiary uppercase">Redis</span>
            </div>
            <div className="text-xl font-bold text-text-primary tabular-nums">{cache?.redis?.keyCount || 0}</div>
            <div className="text-[9px] text-text-quaternary">key</div>
          </div>
          <div className="bg-surface-3 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-3 h-3 text-text-tertiary" />
              <span className="text-[10px] text-text-tertiary uppercase">FMP Cache</span>
            </div>
            <div className="text-xl font-bold text-text-primary tabular-nums">{cache?.fmpMemory?.memoryEntries || 0}</div>
            <div className="text-[9px] text-text-quaternary">/{cache?.fmpMemory?.maxEntries || 500}</div>
          </div>
          <div className="bg-surface-3 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-3 h-3 text-text-tertiary" />
              <span className="text-[10px] text-text-tertiary uppercase">Crypto Cache</span>
            </div>
            <div className="text-xl font-bold text-text-primary tabular-nums">{cache?.cryptoMemory?.memoryEntries || 0}</div>
            <div className="text-[9px] text-text-quaternary">/{cache?.cryptoMemory?.maxEntries || 1000}</div>
          </div>
          <div className="bg-surface-3 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3 h-3 text-text-tertiary" />
              <span className="text-[10px] text-text-tertiary uppercase">Toplam Varlik</span>
            </div>
            <div className="text-xl font-bold text-text-primary tabular-nums">
              {(nasdaq.stockCount + europe.stockCount + crypto.stockCount).toLocaleString()}
            </div>
            <div className="text-[9px] text-text-quaternary">hisse + coin</div>
          </div>
        </div>
      </div>

      {/* Ops Alert Thresholds */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold mb-4">Ops Alert Esikleri</h2>
        <div className="bg-surface-3 rounded-2xl border border-white/8 p-4">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
              slaScanBreached ? 'text-danger-300 bg-danger-400/15 border-red-500/35' : 'text-success-300 bg-success-400/12 border-success-400/30'
            }`}>
              SLA Scan {slaScanBreached ? 'BREACH' : 'OK'}
            </span>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
              slaQuoteBreached ? 'text-danger-300 bg-danger-400/15 border-red-500/35' : 'text-success-300 bg-success-400/12 border-success-400/30'
            }`}>
              SLA Quote {slaQuoteBreached ? 'BREACH' : 'OK'}
            </span>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
              isOriginCritical ? 'text-danger-300 bg-danger-400/15 border-red-500/35' :
              isOriginWarn ? 'text-gold-300 bg-gold-500/15 border-amber-500/35' :
              'text-success-300 bg-success-400/12 border-success-400/30'
            }`}>
              Origin Ratio {originPct}%
            </span>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
              watchdogFail ? 'text-gold-300 bg-gold-500/15 border-amber-500/35' : 'text-success-300 bg-success-400/12 border-success-400/30'
            }`}>
              SelfHeal Fail1h {(ops?.watchdog?.selfHealFail1h || 0)}
            </span>
          </div>
          <p className="text-[10px] text-text-tertiary mt-3">
            Esik: Origin ratio warn &gt;={originWarnThreshold}%, critical &gt;={originCriticalThreshold}%. SLA breach veya self-heal fail durumunda ops incelemesi onerilir.
          </p>
        </div>
      </div>

      {/* Cache Tier Telemetry */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold mb-4">Cache Tier Telemetry (1h)</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-surface-3 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Tier Hit Dagilimi</span>
              <span className="text-[10px] text-text-tertiary">Toplam {tierTotal}</span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between"><span className="text-text-secondary">Memory</span><span className="text-text-primary tabular-nums">{tier?.memory || 0}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Redis</span><span className="text-text-primary tabular-nums">{tier?.redis || 0}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Disk</span><span className="text-text-primary tabular-nums">{tier?.disk || 0}</span></div>
              <div className="flex justify-between"><span className="text-danger-300/80">Origin</span><span className="text-danger-300 tabular-nums">{tier?.origin || 0}</span></div>
            </div>
            <div className="mt-3 pt-2 border-t border-stroke-subtle flex justify-between">
              <span className="text-[10px] text-text-tertiary">Cache hit rate</span>
              <span className="text-[10px] text-success-300 tabular-nums">{hitPct}%</span>
            </div>
          </div>
          <div className="bg-surface-3 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Origin Trend (Session)</span>
              <span className="text-[10px] text-text-tertiary">{cacheOriginTrend.length} nokta</span>
            </div>
            <Sparkline values={cacheOriginTrend} />
            <p className="text-[10px] text-text-tertiary mt-2">
              Dusuk origin yuzdesi = daha iyi cache verimliligi.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// NASDAQ TAB
// ═══════════════════════════════════════════════════════════════════

function NasdaqTab({ status, bootstrap, symbolsSync, onRefresh, onTriggerBootstrap, bootstrapTriggering }: {
  status: MarketStatus
  bootstrap: BootstrapState
  symbolsSync: { tradeReady: string[]; tradeReadyCount: number; insufficient: string[]; insufficientCount: number } | null
  onRefresh: () => void
  onTriggerBootstrap: () => Promise<void>
  bootstrapTriggering: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold">NASDAQ Yonetimi</h2>
        <button
          onClick={onRefresh}
          disabled={status.refreshing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4B86A]/20 to-[#D4B86A]/10 border border-[#D4B86A]/30 text-[#D4B86A] text-xs font-medium transition-all hover:from-[#D4B86A]/30 hover:to-[#D4B86A]/20"
        >
          {status.refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {status.refreshing ? 'Yenileniyor...' : 'Tum NASDAQ Verilerini Yenile'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* NASDAQ Overview */}
        <Card title="NASDAQ Durumu" icon={TrendingUp}>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <Stat label="Evren" value={(symbolsSync ? (symbolsSync.tradeReadyCount + symbolsSync.insufficientCount) : status.stockCount).toLocaleString()} />
            <Stat label="Son Guncelleme" value={
              status.lastRefresh ? new Date(status.lastRefresh).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'
            } />
          </div>
          {status.error && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-danger-400/10 border border-danger-400/30">
              <AlertTriangle className="w-3.5 h-3.5 text-danger-400 mt-0.5 flex-shrink-0" />
              <span className="text-[10px] text-danger-400">{status.error}</span>
            </div>
          )}
          <div className="mt-3 space-y-1.5 text-[10px] text-text-tertiary">
            <div className="flex justify-between">
              <span>Skor Motoru</span>
              <span className="text-text-secondary">V5 — 8 Kategori</span>
            </div>
            <div className="flex justify-between">
              <span>Trade AI</span>
              <span className="text-text-secondary">V15 V360_Z7 L35_S85</span>
            </div>
            <div className="flex justify-between">
              <span>API Kaynagi</span>
              <span className="text-text-secondary">FMP Stable (Ultimate)</span>
            </div>
          </div>
        </Card>

        {/* Bootstrap */}
        <Card title="Trade AI Bootstrap" icon={Database}>
          <div className="space-y-3">
            {!bootstrap.redisAvailable && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-gold-500/15 border border-stroke-gold-strong">
                <AlertTriangle className="w-4 h-4 text-gold-400 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-gold-300">
                  <strong>Redis gerekli.</strong> Trade AI icin Upstash Redis veya Vercel KV gerekir.
                  Vercel Dashboard &gt; Storage &gt; KV ekleyin veya upstash.com ile Redis olusturun.
                  <code className="block mt-1.5 text-[10px] text-text-secondary">UPSTASH_REDIS_REST_URL</code>
                  <code className="block text-[10px] text-text-secondary">UPSTASH_REDIS_REST_TOKEN</code>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Redis Bar Cache" value={bootstrap.barCacheCount} sub="hisse" />
              <Stat label="Durum" value={
                bootstrap.status === 'complete' ? 'Tamamlandi' :
                bootstrap.status === 'running' ? 'Calisiyor...' :
                bootstrap.status === 'partial' ? 'Kismi' : 'Baslamadi'
              } />
            </div>
            {bootstrap.total > 0 && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-text-tertiary">Ilerleme</span>
                  <span className="text-[10px] text-text-secondary tabular-nums">
                    {bootstrap.completed} / {bootstrap.total} ({bootstrap.total > 0 ? Math.round((bootstrap.completed / bootstrap.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      bootstrap.status === 'complete'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-[#D4B86A] to-amber-400'
                    }`}
                    style={{ width: `${bootstrap.total > 0 ? Math.max(1, (bootstrap.completed / bootstrap.total) * 100) : 0}%` }}
                  />
                </div>
                {bootstrap.lastSymbol && (
                  <p className="text-[9px] text-text-quaternary mt-1">Son: {bootstrap.lastSymbol}</p>
                )}
              </div>
            )}
            {bootstrap.error && (
              <p className="text-[10px] text-danger-400 bg-danger-400/10 rounded-lg px-2 py-1">{bootstrap.error}</p>
            )}
            {(bootstrap.status === 'not_started' || bootstrap.status === 'unknown' || bootstrap.status === 'partial') && (
              <button
                onClick={onTriggerBootstrap}
                disabled={bootstrapTriggering || !bootstrap.redisAvailable}
                className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-[#D4B86A]/20 to-amber-500/15 border border-[#D4B86A]/40 text-[#D4B86A] text-xs font-semibold hover:from-[#D4B86A]/30 hover:to-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {bootstrapTriggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {bootstrapTriggering ? 'Baslatiliyor...' : bootstrap.redisAvailable ? 'Bootstrap Baslat' : 'Redis gerekli'}
              </button>
            )}
            <p className="text-[9px] text-text-tertiary leading-relaxed mt-2">
              %100 otomatik. Cron her 5 dakikada calisir: bootstrap tamamlanmamissa devam eder,
              tamamlanmissa Redis&apos;ten skor hesaplar ve sonuclari kaydeder.
            </p>
          </div>
        </Card>

        {/* Symbol Sync */}
        <Card title="Trade AI Sembol Senkronizasyonu" icon={Activity}>
          <div className="space-y-3">
            {!bootstrap.redisAvailable && symbolsSync && symbolsSync.tradeReadyCount === 0 && (
              <p className="text-[10px] text-gold-400/90">
                Trade-ready 0: Redis yoksa tarama sonuclari kaydedilmez. Redis ekleyip Bootstrap calistirin.
              </p>
            )}
            {symbolsSync ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Trade-ready" value={symbolsSync.tradeReadyCount} sub="Trade AI + Terminal" />
                  <Stat label="Yetersiz (cikarilacak)" value={symbolsSync.insufficientCount} sub="FMP 15dk veri yok" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify({
                        tradeReady: symbolsSync.tradeReady,
                        insufficient: symbolsSync.insufficient,
                      }, null, 2)], { type: 'application/json' })
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = 'trade_ready.json'
                      a.click()
                      URL.revokeObjectURL(a.href)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success-400/10 hover:bg-success-400/20 border border-success-400/30 text-success-400 text-xs transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    trade_ready.json
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(symbolsSync.insufficient, null, 2)], { type: 'application/json' })
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = 'insufficient.json'
                      a.click()
                      URL.revokeObjectURL(a.href)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-3 hover:bg-surface-3 border border-white/8 text-text-secondary text-xs transition-all"
                  >
                    insufficient.json
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-text-tertiary">Tarama sonucu yok veya yukleniyor...</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// EUROPE TAB
// ═══════════════════════════════════════════════════════════════════

function EuropeTab({ status, onRefresh }: { status: MarketStatus; onRefresh: () => void }) {
  const EXCHANGES = [
    { id: 'LSE', name: 'London (LSE)', flag: '🇬🇧', suffix: '.L' },
    { id: 'XETRA', name: 'Frankfurt (XETRA)', flag: '🇩🇪', suffix: '.DE' },
    { id: 'EURONEXT_PARIS', name: 'Paris (Euronext)', flag: '🇫🇷', suffix: '.PA' },
    { id: 'EURONEXT_AMSTERDAM', name: 'Amsterdam (Euronext)', flag: '🇳🇱', suffix: '.AS' },
    { id: 'SIX', name: 'Zurich (SIX Swiss)', flag: '🇨🇭', suffix: '.SW' },
    { id: 'MIL', name: 'Milan (Borsa Italiana)', flag: '🇮🇹', suffix: '.MI' },
    { id: 'BME', name: 'Madrid (BME)', flag: '🇪🇸', suffix: '.MC' },
    { id: 'OMX', name: 'Nordic (OMX)', flag: '🇸🇪', suffix: '.ST' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold">EUROPE Yonetimi</h2>
        <button
          onClick={onRefresh}
          disabled={status.refreshing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500/20 to-blue-500/10 border border-info-400/30 text-info-400 text-xs font-medium transition-all hover:from-blue-500/30 hover:to-blue-500/20"
        >
          {status.refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {status.refreshing ? 'Yenileniyor...' : 'Tum Avrupa Verilerini Yenile'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Europe Status */}
        <Card title="Europe Durumu" icon={Building2}>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <Stat label="Toplam Hisse" value={status.stockCount.toLocaleString()} />
            <Stat label="Son Guncelleme" value={
              status.lastRefresh ? new Date(status.lastRefresh).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'
            } />
          </div>
          {status.error && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-danger-400/10 border border-danger-400/30">
              <AlertTriangle className="w-3.5 h-3.5 text-danger-400 mt-0.5 flex-shrink-0" />
              <span className="text-[10px] text-danger-400">{status.error}</span>
            </div>
          )}
          <div className="mt-3 space-y-1.5 text-[10px] text-text-tertiary">
            <div className="flex justify-between">
              <span>Skor Motoru</span>
              <span className="text-text-secondary">8 Kategori (NASDAQ ile ayni)</span>
            </div>
            <div className="flex justify-between">
              <span>Trade AI</span>
              <span className="text-text-secondary">V360_Z51, TP 1%, SL 31%</span>
            </div>
            <div className="flex justify-between">
              <span>Veri Kaynagi</span>
              <span className="text-text-secondary">FMP company-screener (dinamik)</span>
            </div>
          </div>
        </Card>

        {/* Europe Data Flow */}
        <Card title="Veri Akisi" icon={Activity}>
          <div className="space-y-2 text-[10px]">
            <p className="text-text-tertiary leading-relaxed">
              Avrupa hisseleri <span className="text-info-400 font-medium">FMP company-screener</span> API&apos;sinden
              dinamik olarak cekilir. Her borsa icin en yuksek piyasa degerine sahip 1000 hisse secilir.
            </p>
            <div className="border-t border-white/5 pt-2 mt-2">
              <p className="text-text-tertiary font-semibold mb-1.5">Veri Pipeline:</p>
              <div className="space-y-1">
                {[
                  'FMP company-screener → Sembol listesi (24s cache)',
                  'Ratios/Scores/DCF/Analyst → Bulk CSV endpointleri',
                  'Batch-Quote → Canli fiyat (100er batch)',
                  'Score Engine → 8 kategori puanlama',
                  'Target Engine → Hedef/Dip fiyat hesabi',
                ].map(step => (
                  <div key={step} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3 h-3 text-info-400/60 mt-0.5 flex-shrink-0" />
                    <span className="text-text-tertiary">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-text-quaternary mt-2 pt-2 border-t border-white/5">
              Hisseler gorunmuyorsa: &quot;Verileri Yenile&quot; ile cache temizlenip yeni veri cekilir.
              FMP API limitleri nedeniyle ilk yukleme 30-60sn surebilir.
            </p>
          </div>
        </Card>

        {/* Exchange Grid */}
        <Card title="8 Borsa" icon={Globe}>
          <div className="space-y-2">
            {EXCHANGES.map(ex => (
              <div key={ex.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{ex.flag}</span>
                  <span className="text-[11px] text-text-secondary">{ex.name}</span>
                </div>
                <span className="text-[10px] text-text-quaternary font-mono">{ex.suffix}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// CRYPTO TAB
// ═══════════════════════════════════════════════════════════════════

function CryptoTab({ status, onRefresh }: { status: MarketStatus; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold">CRYPTO Yonetimi</h2>
        <button
          onClick={onRefresh}
          disabled={status.refreshing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-500/10 border border-stroke-gold-strong text-gold-400 text-xs font-medium transition-all hover:from-amber-500/30 hover:to-amber-500/20"
        >
          {status.refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {status.refreshing ? 'Yenileniyor...' : 'Tum Crypto Verilerini Yenile'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Crypto Status */}
        <Card title="Crypto Durumu" icon={Bitcoin}>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <Stat label="Toplam Coin" value={status.stockCount.toLocaleString()} />
            <Stat label="Son Guncelleme" value={
              status.lastRefresh ? new Date(status.lastRefresh).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'
            } />
          </div>
          {status.error && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-danger-400/10 border border-danger-400/30">
              <AlertTriangle className="w-3.5 h-3.5 text-danger-400 mt-0.5 flex-shrink-0" />
              <span className="text-[10px] text-danger-400">{status.error}</span>
            </div>
          )}
          <div className="mt-3 space-y-1.5 text-[10px] text-text-tertiary">
            <div className="flex justify-between">
              <span>Skor Motoru</span>
              <span className="text-text-secondary">8 Kategori Crypto Score</span>
            </div>
            <div className="flex justify-between">
              <span>API Kaynagi</span>
              <span className="text-text-secondary">CoinGecko Analyst ($129/ay)</span>
            </div>
            <div className="flex justify-between">
              <span>Rate Limit</span>
              <span className="text-text-secondary">500 req/min</span>
            </div>
            <div className="flex justify-between">
              <span>Ozellikler</span>
              <span className="text-text-secondary">10 Tab (On-Chain, DEX, Turev)</span>
            </div>
          </div>
        </Card>

        {/* Crypto Features */}
        <Card title="Crypto Modulleri" icon={Zap}>
          <div className="space-y-2 text-[10px]">
            {[
              { name: 'PIYASA', desc: 'Fear & Greed, Dominans, Trend', ok: true },
              { name: 'COINLER', desc: '250 coin + AI Skor + Sinyal', ok: true },
              { name: 'ON-CHAIN', desc: 'DEX trending pools + yeni coinler', ok: true },
              { name: 'TUREVLER', desc: 'Funding rate heatmap + OI', ok: true },
              { name: 'BORSALAR', desc: 'Trust score + hacim', ok: true },
              { name: 'HAZINE', desc: 'Sirket BTC/ETH holdingleri', ok: true },
              { name: 'TRADE AI', desc: 'Z-Score mean reversion', ok: false },
              { name: 'AI SIGNALS', desc: 'Capraz sinyal', ok: false },
            ].map(m => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {m.ok ? (
                    <CheckCircle className="w-3 h-3 text-success-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-stroke-strong" />
                  )}
                  <span className="text-text-secondary font-medium">{m.name}</span>
                </div>
                <span className="text-text-quaternary">{m.desc}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Crypto Data */}
        <Card title="Veri Kaynaklari" icon={Database}>
          <div className="space-y-2 text-[10px]">
            <p className="text-text-tertiary leading-relaxed">
              CoinGecko Analyst Plan API ile <span className="text-gold-400 font-medium">18,919+</span> kripto varligin
              analizi yapilir. 26+ endpoint aktif.
            </p>
            <div className="border-t border-white/5 pt-2 mt-2 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Pro Endpoint</span>
                <span className="text-text-secondary">20 aktif</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">GeckoTerminal</span>
                <span className="text-text-secondary">6 aktif</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Credit/ay</span>
                <span className="text-text-secondary">~350K / 500K</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════

function AnalyticsTab({ analytics: a }: { analytics: AnalyticsData['analytics'] | undefined }) {
  const todayPV = a?.pageViews?.[0]?.count || 0
  const todayUV = a?.uniqueVisitors?.[0]?.count || 0
  const yesterdayPV = a?.pageViews?.[1]?.count || 0
  const weekPV = a?.pageViews?.reduce((s, d) => s + d.count, 0) || 0
  const totalDevices = a?.devices?.reduce((s, d) => s + d.count, 0) || 1

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Visitors */}
      <Card title="Ziyaretci Ozeti" icon={Users}>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Stat label="Bugun" value={todayPV} sub={`${todayUV} tekil`} />
          <Stat label="Dun" value={yesterdayPV} />
          <Stat label="7 Gun" value={weekPV} />
        </div>
        <div className="space-y-1">
          {a?.pageViews?.slice(0, 7).map(d => (
            <div key={d.date} className="flex items-center gap-2">
              <span className="text-[9px] text-text-tertiary w-16">{d.date.slice(5)}</span>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D4B86A]/60 rounded-full"
                  style={{ width: `${weekPV > 0 ? Math.max(2, (d.count / Math.max(...(a?.pageViews?.map(x => x.count) || [1]))) * 100) : 0}%` }}
                />
              </div>
              <span className="text-[9px] text-text-tertiary tabular-nums w-8 text-right">{d.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Top Pages */}
      <Card title="Sayfa Bazli Trafik" icon={Eye}>
        {(a?.topPages?.length || 0) > 0 ? (
          <MiniBar items={a!.topPages.map(p => ({ label: p.path, value: p.count }))} max={a!.topPages[0]?.count || 1} />
        ) : (
          <p className="text-text-tertiary text-xs">Henuz veri yok</p>
        )}
      </Card>

      {/* Referrers */}
      <Card title="Kaynak Analizi" icon={Globe}>
        {(a?.referrers?.length || 0) > 0 ? (
          <MiniBar items={a!.referrers.map(r => ({ label: r.source, value: r.count }))} max={a!.referrers[0]?.count || 1} />
        ) : (
          <p className="text-text-tertiary text-xs">Henuz veri yok</p>
        )}
      </Card>

      {/* Devices */}
      <Card title="Cihaz Dagilimi" icon={Smartphone}>
        <div className="space-y-3">
          {(a?.devices || []).map(d => {
            const pct = totalDevices > 0 ? ((d.count / totalDevices) * 100).toFixed(1) : '0'
            const colors: Record<string, string> = {
              desktop: 'from-blue-500 to-blue-600',
              mobile: 'from-emerald-500 to-emerald-600',
              tablet: 'from-amber-500 to-amber-600',
            }
            return (
              <div key={d.type}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-text-secondary capitalize">{d.type}</span>
                  <span className="text-xs text-text-tertiary">{pct}% ({d.count})</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${colors[d.type] || 'from-violet-500 to-violet-600'} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {(a?.devices?.length || 0) === 0 && <p className="text-text-tertiary text-xs">Henuz veri yok</p>}
        </div>
      </Card>

      {/* API Usage */}
      <Card title="API Kullanim" icon={Zap}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="Bugun API" value={a?.totals?.api || 0} />
          <div>
            {(a?.externalApis || []).map(e => (
              <div key={e.provider} className="flex justify-between">
                <span className="text-[10px] text-text-tertiary uppercase">{e.provider}</span>
                <span className="text-[10px] text-text-secondary tabular-nums">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
        {(a?.apiCalls?.length || 0) > 0 ? (
          <MiniBar items={a!.apiCalls.slice(0, 6).map(c => ({ label: c.endpoint, value: c.count }))} max={a!.apiCalls[0]?.count || 1} />
        ) : (
          <p className="text-text-tertiary text-xs">Henuz veri yok</p>
        )}
      </Card>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// SYSTEM TAB
// ═══════════════════════════════════════════════════════════════════

function SystemTab({
  cache: c, ops, cacheOriginTrend, flags, flagLabels, flagLoading, onToggleFlag, onClearCache,
}: {
  cache: AnalyticsData['cache'] | undefined
  ops: AnalyticsData['ops'] | undefined
  cacheOriginTrend: number[]
  flags: FlagMap; flagLabels: Record<string, string>; flagLoading: string | null
  onToggleFlag: (key: string) => void
  onClearCache: (type: 'fmp' | 'crypto' | 'all') => void
}) {
  const tier = ops?.cache?.tierHits1h
  const tierTotal = (tier?.memory || 0) + (tier?.redis || 0) + (tier?.disk || 0) + (tier?.origin || 0)
  const hitPct = tierTotal > 0 ? Math.round((((tier?.memory || 0) + (tier?.redis || 0) + (tier?.disk || 0)) / tierTotal) * 100) : 0
  const originPct = tierTotal > 0 ? Math.round(((tier?.origin || 0) / tierTotal) * 100) : 0
  const originWarnThreshold = ops?.thresholds?.cacheOriginWarnPct ?? 25
  const originCriticalThreshold = ops?.thresholds?.cacheOriginCriticalPct ?? 40
  const originState = originPct >= originCriticalThreshold ? 'critical' : originPct >= originWarnThreshold ? 'warn' : 'ok'
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* System Health */}
      <Card title="Sistem Sagligi" icon={Activity}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusDot ok={c?.redis?.connected ?? false} />
            <span className="text-xs text-text-secondary">Redis: {c?.redis?.connected ? 'Bagli' : 'Bagli Degil'}</span>
            {c?.redis?.keyCount !== undefined && (
              <span className="text-[10px] text-text-tertiary ml-auto">{c.redis.keyCount} key</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3 text-text-tertiary" />
            <span className="text-xs text-text-secondary">FMP Memory Cache</span>
            <span className="text-[10px] text-text-tertiary ml-auto">{c?.fmpMemory?.memoryEntries || 0}/{c?.fmpMemory?.maxEntries || 500}</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3 text-text-tertiary" />
            <span className="text-xs text-text-secondary">Crypto Memory Cache</span>
            <span className="text-[10px] text-text-tertiary ml-auto">{c?.cryptoMemory?.memoryEntries || 0}/{c?.cryptoMemory?.maxEntries || 1000}</span>
          </div>
          {c?.redis?.prefixes && Object.keys(c.redis.prefixes).length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <span className="text-[9px] text-text-quaternary uppercase">Redis Key Dagilimi</span>
              {Object.entries(c.redis.prefixes).map(([p, n]) => (
                <div key={p} className="flex justify-between mt-1">
                  <span className="text-[10px] text-text-tertiary">{p}</span>
                  <span className="text-[10px] text-text-tertiary tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Feature Flags */}
      <Card title="Ozellik Kontrol" icon={Cpu}>
        <div className="space-y-3">
          {Object.entries(flagLabels).map(([key, label]) => {
            const enabled = flags[key] !== false
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">{label}</span>
                <button onClick={() => onToggleFlag(key)} disabled={flagLoading === key} className="transition-all">
                  {enabled ? (
                    <ToggleRight className="w-6 h-6 text-success-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-text-tertiary" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Cache Management */}
      <Card title="Cache Yonetimi" icon={Server}>
        <div className="space-y-2">
          <button
            onClick={() => onClearCache('fmp')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-500/10 hover:bg-gold-500/20 border border-amber-500/20 text-gold-400 text-xs transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            FMP Cache Temizle
          </button>
          <button
            onClick={() => onClearCache('crypto')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-500/10 hover:bg-gold-500/20 border border-amber-500/20 text-gold-400 text-xs transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Crypto Cache Temizle
          </button>
          <button
            onClick={() => onClearCache('all')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-danger-400/10 hover:bg-danger-400/20 border border-danger-400/30 text-danger-400 text-xs transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Tum Cache Temizle
          </button>
        </div>
      </Card>

      {/* Performance */}
      <Card title="Performans" icon={TrendingUp}>
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Redis Key"
            value={c?.redis?.keyCount || 0}
            sub={c?.redis?.connected ? 'Aktif' : 'Pasif'}
          />
          <Stat
            label="Memory Cache"
            value={(c?.fmpMemory?.memoryEntries || 0) + (c?.cryptoMemory?.memoryEntries || 0)}
            sub="FMP + Crypto"
          />
        </div>
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Cache Tier Hit 1h</span>
            <span className="text-[10px] text-success-300 tabular-nums">{hitPct}% hit</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mb-2">
            <div><div className="text-[11px] text-text-primary tabular-nums">{tier?.memory || 0}</div><div className="text-[9px] text-text-tertiary">Mem</div></div>
            <div><div className="text-[11px] text-text-primary tabular-nums">{tier?.redis || 0}</div><div className="text-[9px] text-text-tertiary">Redis</div></div>
            <div><div className="text-[11px] text-text-primary tabular-nums">{tier?.disk || 0}</div><div className="text-[9px] text-text-tertiary">Disk</div></div>
            <div><div className="text-[11px] text-danger-300 tabular-nums">{tier?.origin || 0}</div><div className="text-[9px] text-text-tertiary">Origin</div></div>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary">Origin ratio</span>
            <span className={`text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full border ${
              originState === 'critical' ? 'text-danger-300 bg-danger-400/15 border-red-500/35' :
              originState === 'warn' ? 'text-gold-300 bg-gold-500/15 border-amber-500/35' :
              'text-success-300 bg-success-400/12 border-success-400/30'
            }`}>
              {originPct}% {originState === 'critical' ? 'CRITICAL' : originState === 'warn' ? 'WARN' : 'OK'}
            </span>
          </div>
          <p className="text-[9px] text-text-quaternary mb-2">
            Thresholds: warn {originWarnThreshold}% | critical {originCriticalThreshold}%
          </p>
          <Sparkline values={cacheOriginTrend} />
        </div>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Diagnostics Tab — Real-time system health monitoring
// ═══════════════════════════════════════════════════════════════════

interface DiagIssue {
  severity: 'critical' | 'warning' | 'info'
  module: string
  message: string
  detail?: string
  timestamp: string
}

interface DiagModule {
  status: 'ok' | 'warning' | 'error'
  lastUpdate: string | null
  detail: string
}

function DiagnosticsTab() {
  const [diagData, setDiagData] = useState<{
    status: string
    issueCount: number
    criticalCount: number
    warningCount: number
    issues: DiagIssue[]
    modules: Record<string, DiagModule>
    symbolCount: number
    barCacheCount: number
    timestamp: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string>('')

  const loadDiag = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/diagnostics')
      if (res.ok) {
        const data = await res.json()
        setDiagData(data)
        setLastRefresh(new Date().toLocaleTimeString('tr-TR'))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDiag()
    const iv = setInterval(loadDiag, 60_000)
    return () => clearInterval(iv)
  }, [loadDiag])

  const statusColor = (s: string) => {
    if (s === 'ok' || s === 'healthy') return 'text-success-400'
    if (s === 'warning') return 'text-gold-400'
    return 'text-danger-400'
  }

  const statusBg = (s: string) => {
    if (s === 'ok' || s === 'healthy') return 'bg-success-400/15 border-success-400/30'
    if (s === 'warning') return 'bg-gold-500/15 border-stroke-gold-strong'
    return 'bg-danger-400/15 border-danger-400/30'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-danger-400" />
            System Diagnostics
          </h2>
          <p className="text-xs text-text-tertiary mt-1">
            Her yenilemede tum moduller kontrol edilir. Sorun varsa otomatik bildirilir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {diagData && (
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase ${statusBg(diagData.status)} ${statusColor(diagData.status)}`}>
              {diagData.status === 'healthy' ? 'HEALTHY' : diagData.status === 'warning' ? `${diagData.warningCount} WARNING` : `${diagData.criticalCount} CRITICAL`}
            </div>
          )}
          <button onClick={loadDiag} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all" title="Yenile">
            <RefreshCw className={`w-4 h-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-[10px] text-text-tertiary">Son: {lastRefresh}</span>
        </div>
      </div>

      {loading && !diagData ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-text-quaternary animate-spin" />
        </div>
      ) : diagData ? (
        <>
          {diagData.issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">Sorunlar ({diagData.issueCount})</h3>
              {diagData.issues.map((issue, idx) => (
                <div key={idx} className={`p-3 rounded-xl border ${
                  issue.severity === 'critical' ? 'bg-danger-400/10 border-danger-400/30' :
                  issue.severity === 'warning' ? 'bg-gold-500/10 border-stroke-gold-strong' :
                  'bg-info-400/10 border-info-400/30'
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{issue.severity === 'critical' ? '●' : issue.severity === 'warning' ? '●' : '●'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${issue.severity === 'critical' ? 'text-danger-300' : issue.severity === 'warning' ? 'text-gold-300' : 'text-info-400'}`}>[{issue.module}]</span>
                        <span className="text-xs text-text-secondary">{issue.message}</span>
                      </div>
                      {issue.detail && (
                        <p className="text-[10px] text-text-tertiary mt-1">{issue.detail}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {diagData.issues.length === 0 && (
            <div className="p-6 rounded-xl border border-success-400/30 bg-success-400/10 text-center">
              <CheckCircle className="w-8 h-8 text-success-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-success-300">Tum Sistemler Saglikli</p>
              <p className="text-[10px] text-text-tertiary mt-1">Hicbir sorun tespit edilmedi.</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Modul Durumu</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Object.entries(diagData.modules).map(([name, mod]) => (
                <div key={name} className="p-3 rounded-xl bg-surface-3 border border-white/8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-primary">{name}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBg(mod.status)} ${statusColor(mod.status)}`}>
                      {mod.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-tertiary">{mod.detail}</p>
                  {mod.lastUpdate && (
                    <p className="text-[10px] text-text-quaternary mt-1">Son: {mod.lastUpdate}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-surface-3 border border-white/8 text-center">
              <div className="text-lg font-bold text-white tabular-nums">{diagData.symbolCount}</div>
              <div className="text-[10px] text-text-tertiary">Toplam Hisse</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-3 border border-white/8 text-center">
              <div className="text-lg font-bold text-success-400 tabular-nums">{diagData.barCacheCount}</div>
              <div className="text-[10px] text-text-tertiary">Redis Bar Cache</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-3 border border-white/8 text-center">
              <div className={`text-lg font-bold tabular-nums ${diagData.criticalCount > 0 ? 'text-danger-400' : 'text-success-400'}`}>{diagData.criticalCount}</div>
              <div className="text-[10px] text-text-tertiary">Kritik Sorun</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-3 border border-white/8 text-center">
              <div className={`text-lg font-bold tabular-nums ${diagData.warningCount > 0 ? 'text-gold-400' : 'text-success-400'}`}>{diagData.warningCount}</div>
              <div className="text-[10px] text-text-tertiary">Uyari</div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-10 text-text-tertiary text-sm">Diagnostics verileri yuklenemedi.</div>
      )}
    </div>
  )
}
