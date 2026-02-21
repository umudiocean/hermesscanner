'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Ana Modul Container
// 10-tab terminal + modul navigation (Trade AI, Signals, Watchlist)
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from 'react'
import { Brain, Search, BarChart3, Globe, Eye, PieChart, TrendingUp, Zap, Wallet, GitCompare, Activity, Target, Radio, Star, Lock, X, Grid3X3, Anchor } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Lazy load tabs
const TabCoins = lazy(() => import('./TabCoins'))
const TabMarket = lazy(() => import('./TabMarket'))
const TabCoinDetail = lazy(() => import('./TabCoinDetail'))
const TabChart = lazy(() => import('./TabChart'))
const TabCategories = lazy(() => import('./TabCategories'))
const TabDerivatives = lazy(() => import('./TabDerivatives'))
const TabExchanges = lazy(() => import('./TabExchanges'))
const TabOnchain = lazy(() => import('./TabOnchain'))
const TabTreasury = lazy(() => import('./TabTreasury'))
const TabCompare = lazy(() => import('./TabCompare'))
const TabWhaleTracker = lazy(() => import('./TabWhaleTracker'))
const TabHeatmap = lazy(() => import('./TabHeatmap'))
const TabCorrelation = lazy(() => import('./TabCorrelation'))

// Sub-modules (Trade AI, Signals, Watchlist)
const ModuleCryptoTradeAI = lazy(() => import('./ModuleCryptoTradeAI'))
const ModuleCryptoSignals = lazy(() => import('./ModuleCryptoSignals'))
const ModuleCryptoWatchlist = lazy(() => import('./ModuleCryptoWatchlist'))
const SignalPerformance = lazy(() => import('./SignalPerformance'))
const ModuleCryptoIndex = lazy(() => import('./ModuleCryptoIndex'))

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        <span className="text-xs text-white/25">Yukleniyor...</span>
      </div>
    </div>
  )
}

type CryptoModule = 'terminal' | 'trade' | 'signals' | 'watchlist' | 'index'
type CryptoTab = 'market' | 'coins' | 'coin' | 'chart' | 'heatmap' | 'categories' | 'derivatives' | 'exchanges' | 'onchain' | 'whale' | 'treasury' | 'compare' | 'correlation'

interface ModuleConfig {
  id: CryptoModule
  label: string
  shortLabel: string
  icon: React.ReactNode
  active: boolean
}

const MODULES: ModuleConfig[] = [
  { id: 'terminal', label: 'CRYPTO TERMINAL AI', shortLabel: 'TERMINAL', icon: <Brain size={14} />, active: true },
  { id: 'trade', label: 'TRADE AI', shortLabel: 'TRADE', icon: <Target size={14} />, active: true },
  { id: 'signals', label: 'AI SIGNALS', shortLabel: 'SIGNALS', icon: <Radio size={14} />, active: true },
  { id: 'watchlist', label: 'WATCHLIST', shortLabel: 'WATCH', icon: <Star size={14} />, active: true },
  { id: 'index', label: 'HERMES AI INDEX', shortLabel: 'INDEX', icon: <Zap size={14} />, active: true },
]

interface TabConfig {
  id: CryptoTab
  label: string
  shortLabel: string
  icon: React.ReactNode
  desc: string
}

const TABS: TabConfig[] = [
  { id: 'market', label: 'PIYASA & TREND', shortLabel: 'PIYASA', icon: <Globe size={15} />, desc: 'Global crypto piyasa durumu' },
  { id: 'coins', label: 'COINLER', shortLabel: 'COIN', icon: <BarChart3 size={15} />, desc: 'Top coinler ve puanlama' },
  { id: 'coin', label: 'DETAY', shortLabel: 'DETAY', icon: <Eye size={15} />, desc: 'Coin detay analizi' },
  { id: 'chart', label: 'GRAFIK', shortLabel: 'GRAFIK', icon: <TrendingUp size={15} />, desc: 'OHLC candlestick + RSI/MACD' },
  { id: 'heatmap', label: 'HEATMAP', shortLabel: 'HEAT', icon: <Grid3X3 size={15} />, desc: 'Market cap treemap' },
  { id: 'categories', label: 'KATEGORILER', shortLabel: 'KAT.', icon: <PieChart size={15} />, desc: 'DeFi, Layer 1, Meme...' },
  { id: 'derivatives', label: 'TUREVLER', shortLabel: 'TUREV', icon: <Activity size={15} />, desc: 'Funding rate & open interest' },
  { id: 'whale', label: 'WHALE TRACKER', shortLabel: 'WHALE', icon: <Anchor size={15} />, desc: 'Top holder & smart money' },
  { id: 'exchanges', label: 'BORSALAR', shortLabel: 'BORSA', icon: <Wallet size={15} />, desc: 'Borsa karsilastirma' },
  { id: 'onchain', label: 'ON-CHAIN', shortLabel: 'DEX', icon: <Zap size={15} />, desc: 'DEX pools & trending' },
  { id: 'treasury', label: 'HAZINE', shortLabel: 'HAZINE', icon: <Wallet size={15} />, desc: 'Sirket BTC/ETH holdingleri' },
  { id: 'compare', label: 'KARSILASTIR', shortLabel: 'KARS.', icon: <GitCompare size={15} />, desc: 'Coinleri karsilastir' },
  { id: 'correlation', label: 'KORELASYON', shortLabel: 'KOR.', icon: <Grid3X3 size={15} />, desc: 'Fiyat korelasyon matrisi' },
]

export default function ModuleCryptoTerminal() {
  const [activeModule, setActiveModule] = useState<CryptoModule>('terminal')
  const [activeTab, setActiveTab] = useState<CryptoTab>('market')
  const [selectedCoinId, setSelectedCoinId] = useState<string>('')
  const [compareCoins, setCompareCoins] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showPerfTracker, setShowPerfTracker] = useState(false)

  const handleSelectCoin = useCallback((coinId: string) => {
    setSelectedCoinId(coinId)
    setActiveTab('coin')
  }, [])

  const handleViewChart = useCallback((coinId: string) => {
    setSelectedCoinId(coinId)
    setActiveTab('chart')
  }, [])

  const handleAddToCompare = useCallback((coinId: string) => {
    setCompareCoins(prev => {
      if (prev.includes(coinId)) return prev
      if (prev.length >= 4) return prev
      return [...prev, coinId]
    })
  }, [])

  const handleRemoveFromCompare = useCallback((coinId: string) => {
    setCompareCoins(prev => prev.filter(c => c !== coinId))
  }, [])

  return (
    <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 animate-fade-in">

      {/* Signal Performance Tracker Modal */}
      <Suspense fallback={null}>
        <SignalPerformance isOpen={showPerfTracker} onClose={() => setShowPerfTracker(false)} />
      </Suspense>

      {/* Module Navigation — Premium Glow */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-none pb-1">
        {MODULES.map(mod => (
          <button
            key={mod.id}
            onClick={() => mod.active ? setActiveModule(mod.id) : null}
            disabled={!mod.active}
            className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 border
              ${activeModule === mod.id
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/12 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/15 scale-[1.02]'
                : mod.active
                  ? 'text-white/40 hover:text-amber-300 hover:bg-gradient-to-r hover:from-amber-500/10 hover:to-orange-500/5 border-white/[0.06] hover:border-amber-500/25 hover:shadow-md hover:shadow-amber-500/10 hover:scale-[1.01]'
                  : 'text-white/15 border-transparent cursor-not-allowed'
              }`}
          >
            <span className={`transition-transform duration-200 ${activeModule === mod.id ? 'scale-110' : 'group-hover:scale-110'}`}>{mod.icon}</span>
            <span className="hidden sm:inline">{mod.label}</span>
            <span className="sm:hidden">{mod.shortLabel}</span>
            {!mod.active && <Lock size={10} className="text-white/15 ml-0.5" />}
          </button>
        ))}
        {/* Signal Performance Tracker Button */}
        <button
          onClick={() => setShowPerfTracker(true)}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 border text-white/40 hover:text-amber-300 hover:bg-gradient-to-r hover:from-amber-500/10 hover:to-orange-500/5 border-white/[0.06] hover:border-amber-500/25 hover:shadow-md hover:shadow-amber-500/10 hover:scale-[1.01] ml-auto"
        >
          <span className="group-hover:scale-110 transition-transform duration-200"><Activity size={14} /></span>
          <span className="hidden sm:inline">PERFORMANS</span>
          <span className="sm:hidden">PERF</span>
        </button>
      </div>

      {/* Active Module Content — ErrorBoundary per module */}
      <ErrorBoundary fallbackTitle={`${activeModule.toUpperCase()} Modul Hatasi`}>
        <Suspense fallback={<TabSkeleton />}>
          {activeModule === 'terminal' && (
            <TerminalContent
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedCoinId={selectedCoinId}
              compareCoins={compareCoins}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectCoin={handleSelectCoin}
              onViewChart={handleViewChart}
              onAddToCompare={handleAddToCompare}
              onRemoveFromCompare={handleRemoveFromCompare}
            />
          )}
          {activeModule === 'trade' && <ModuleCryptoTradeAI />}
          {activeModule === 'signals' && (
            <ModuleCryptoSignals
              onSelectCoin={(id) => {
                setSelectedCoinId(id)
                setActiveModule('terminal')
                setActiveTab('coin')
              }}
            />
          )}
          {activeModule === 'watchlist' && <ModuleCryptoWatchlist />}
          {activeModule === 'index' && <ModuleCryptoIndex />}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function TerminalContent({
  activeTab, setActiveTab, selectedCoinId, compareCoins, searchQuery, setSearchQuery,
  onSelectCoin, onViewChart, onAddToCompare, onRemoveFromCompare,
}: {
  activeTab: CryptoTab; setActiveTab: (t: CryptoTab) => void
  selectedCoinId: string; compareCoins: string[]
  searchQuery: string; setSearchQuery: (s: string) => void
  onSelectCoin: (id: string) => void; onViewChart: (id: string) => void
  onAddToCompare: (id: string) => void; onRemoveFromCompare: (id: string) => void
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Brain size={18} className="text-[#0d0d0d] sm:hidden" />
            <Brain size={20} className="text-[#0d0d0d] hidden sm:block" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              CRYPTO TERMINAL <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">AI</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-white/30 hidden sm:block">CoinGecko Analyst | Canli Kripto Analiz</p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/8 border border-amber-400/15 ml-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] text-amber-300 font-medium tracking-wider">24/7 CANLI</span>
          </div>
        </div>

        {/* Autocomplete Search */}
        <CoinSearchAutocomplete
          value={searchQuery}
          onChange={setSearchQuery}
          onSelect={(coinId) => {
            onSelectCoin(coinId)
            setSearchQuery('')
          }}
        />
      </div>

      {/* Desktop Tab Bar — Premium Glow */}
      <div className="hidden md:flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 border
              ${activeTab === tab.id
                ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/8 text-amber-300 border-amber-500/35 shadow-md shadow-amber-500/10 scale-[1.02]'
                : 'text-white/35 hover:text-amber-200/80 hover:bg-gradient-to-r hover:from-amber-500/8 hover:to-transparent border-white/[0.04] hover:border-amber-500/20 hover:shadow-sm hover:shadow-amber-500/5'
              }`}
            title={tab.desc}
          >
            <span className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile Tab Bar — Premium Glow */}
      <div className="md:hidden flex items-center gap-1 mb-3 overflow-x-auto scrollbar-none pb-1 -mx-3 px-3">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-300 border
              ${activeTab === tab.id
                ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/8 text-amber-300 border-amber-500/35 shadow-sm shadow-amber-500/10'
                : 'text-white/35 hover:text-amber-200/80 border-transparent hover:border-amber-500/20'
              }`}
          >
            <span className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`}>{tab.icon}</span>
            <span>{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Tab Content — ErrorBoundary per tab */}
      <ErrorBoundary fallbackTitle={`${activeTab.toUpperCase()} Tab Hatasi`}>
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'market' && <TabMarket onSelectCoin={onSelectCoin} />}
          {activeTab === 'coins' && <TabCoins onSelectCoin={onSelectCoin} onViewChart={onViewChart} onAddToCompare={onAddToCompare} />}
          {activeTab === 'coin' && <TabCoinDetail coinId={selectedCoinId} onSelectCoin={onSelectCoin} onViewChart={onViewChart} onAddToCompare={onAddToCompare} />}
          {activeTab === 'chart' && <TabChart coinId={selectedCoinId} onSelectCoin={onSelectCoin} />}
          {activeTab === 'heatmap' && <TabHeatmap onSelectCoin={onSelectCoin} />}
          {activeTab === 'categories' && <TabCategories onSelectCoin={onSelectCoin} />}
          {activeTab === 'derivatives' && <TabDerivatives />}
          {activeTab === 'whale' && <TabWhaleTracker onSelectCoin={onSelectCoin} />}
          {activeTab === 'exchanges' && <TabExchanges />}
          {activeTab === 'onchain' && <TabOnchain onSelectCoin={onSelectCoin} />}
          {activeTab === 'treasury' && <TabTreasury />}
          {activeTab === 'compare' && <TabCompare coinIds={compareCoins} onRemoveCoin={onRemoveFromCompare} onSelectCoin={onSelectCoin} />}
          {activeTab === 'correlation' && <TabCorrelation onSelectCoin={onSelectCoin} />}
        </Suspense>
      </ErrorBoundary>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Coin Search Autocomplete
// Fetches full coin list from CoinGecko, filters locally, instant results
// ═══════════════════════════════════════════════════════════════════

interface SearchResult {
  id: string
  symbol: string
  name: string
  matchedContract?: { chain: string; address: string }
}

function CoinSearchAutocomplete({
  value, onChange, onSelect,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (coinId: string) => void
}) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setResults([])
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const q = value.trim()
      if (q.length < 1) return

      setLoading(true)
      try {
        const res = await fetch(`/api/crypto-terminal/search?q=${encodeURIComponent(q)}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
          setOpen(true)
          setSelectedIdx(-1)
        }
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }, 150) // 150ms debounce for fast feel

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && value.trim()) {
        onSelect(value.trim().toLowerCase())
        onChange('')
        setOpen(false)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIdx >= 0 && selectedIdx < results.length) {
        onSelect(results[selectedIdx].id)
        onChange('')
        setOpen(false)
      } else if (results.length > 0) {
        onSelect(results[0].id)
        onChange('')
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [open, results, selectedIdx, value, onSelect, onChange])

  const handleSelect = useCallback((coinId: string) => {
    onSelect(coinId)
    onChange('')
    setOpen(false)
    inputRef.current?.blur()
  }, [onSelect, onChange])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative group">
        <Search size={14} className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-amber-400 transition-colors z-10" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Coin, token veya contract ara..."
          className="w-48 sm:w-64 lg:w-80 pl-8 sm:pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm bg-white/[0.04] border border-white/8 rounded-lg sm:rounded-xl
                     text-white placeholder-white/25 focus:outline-none focus:border-amber-500/30 transition-all font-mono"
        />
        {value && (
          <button
            onClick={() => { onChange(''); setOpen(false); setResults([]) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors z-10"
          >
            <X size={14} />
          </button>
        )}
        {loading && (
          <div className="absolute right-7 top-1/2 -translate-y-1/2 z-10">
            <div className="w-3.5 h-3.5 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full right-0 mt-1 w-72 sm:w-80 max-h-[360px] overflow-y-auto bg-[#151520] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 z-50 animate-fade-in">
          <div className="px-3 py-1.5 border-b border-white/[0.04]">
            <span className="text-[10px] text-white/20">{results.length} sonuc</span>
          </div>
          {results.map((coin, idx) => (
            <button
              key={coin.id}
              onClick={() => handleSelect(coin.id)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                ${idx === selectedIdx ? 'bg-amber-500/10' : 'hover:bg-white/[0.04]'}
                ${idx < results.length - 1 ? 'border-b border-white/[0.02]' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase">{coin.symbol}</span>
                  <span className="text-[10px] text-white/30 truncate">{coin.name}</span>
                </div>
                {coin.matchedContract ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[8px] px-1 py-px rounded bg-violet-500/20 text-violet-300 border border-violet-500/20 font-medium uppercase">{coin.matchedContract.chain}</span>
                    <span className="text-[9px] text-white/20 truncate font-mono">{coin.matchedContract.address.slice(0, 8)}...{coin.matchedContract.address.slice(-6)}</span>
                  </div>
                ) : (
                  <span className="text-[9px] text-white/15 truncate block">{coin.id}</span>
                )}
              </div>
              <span className="text-[10px] text-amber-400/50 shrink-0">→</span>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {open && value.trim().length >= 1 && results.length === 0 && !loading && (
        <div className="absolute top-full right-0 mt-1 w-72 sm:w-80 bg-[#151520] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 z-50 p-4 text-center">
          <span className="text-xs text-white/25">Sonuc bulunamadi</span>
        </div>
      )}
    </div>
  )
}

function ComingSoonModule({ moduleId }: { moduleId: CryptoModule }) {
  const config: Record<CryptoModule, { name: string; desc: string; icon: React.ReactNode }> = {
    terminal: { name: 'Terminal', desc: '', icon: <Brain size={32} /> },
    trade: { name: 'CRYPTO TRADE AI', desc: 'Kripto piyasalarinda mean-reversion Z-Score stratejisi ile orta vadeli trade sinyalleri. VWAP, Z-Score ve momentum bazli puanlama ile en uygun giris/cikis noktalarini belirler.', icon: <Target size={32} className="text-amber-400" /> },
    signals: { name: 'CRYPTO AI SIGNALS', desc: 'Teknik analiz + HERMES AI Skor capraz sinyal sistemi. Terminal puanlamasi ile teknik sinyallerin kesisstigi en guclu firsatlari gosterir.', icon: <Radio size={32} className="text-violet-400" /> },
    watchlist: { name: 'CRYPTO WATCHLIST', desc: 'Izleme listenizdeki coinlerin canli takibi. Favori coinlerinizi yildiz butonu ile ekleyin, fiyat ve sinyal degisimlerini anlik izleyin.', icon: <Star size={32} className="text-amber-400" /> },
    index: { name: 'HERMES AI CRYPTO INDEX', desc: 'Kripto piyasasinin kalbi. Fear & Greed, hakimiyet, trendler ve sinyaller tek bir ekranda.', icon: <Zap size={32} className="text-amber-400" /> },
  }

  const c = config[moduleId]

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
        {c.icon}
      </div>
      <h2 className="text-2xl font-black text-white/80 mb-2">{c.name}</h2>
      <p className="text-sm text-white/30 max-w-md mb-6 leading-relaxed">{c.desc}</p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Lock size={14} className="text-amber-400" />
        <span className="text-xs font-bold text-amber-300 tracking-wider">COMING SOON</span>
      </div>
    </div>
  )
}
