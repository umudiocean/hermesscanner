'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — NASDAQ Terminal (Premium Redesign)
// Layout: header → premium search → segmented tab nav → lazy content
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, lazy, Suspense, useEffect, useRef } from 'react'
import {
  Brain, Search, BarChart3, Globe, Eye, PieChart, Users, Target,
  GitCompare, Calendar, Globe2, Radio, X, Activity,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { HermesLogo } from '@/components/shell/HermesLogo'
import { Badge, Kbd, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// SYMBOL SEARCH — premium typeahead with debounced FMP autocomplete
// ═══════════════════════════════════════════════════════════════════

interface SearchResultItem {
  symbol: string
  sector: string
  companyName?: string
}

function NasdaqSymbolSearchInput({
  searchQuery,
  setSearchQuery,
  onSelectSymbol,
}: {
  searchQuery: string
  setSearchQuery: (v: string) => void
  onSelectSymbol: (symbol: string) => void
}) {
  const [acResults, setAcResults] = useState<SearchResultItem[]>([])
  const [acOpen, setAcOpen] = useState(false)
  const [acLoading, setAcLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAcOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const q = searchQuery.trim().toUpperCase()
    if (q.length < 1) {
      setAcResults([])
      setAcOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setAcLoading(true)
      try {
        const res = await fetch(`/api/nasdaq-terminal/search?q=${encodeURIComponent(q)}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setAcResults(data.results || [])
          setAcOpen(true)
          setSelectedIdx(-1)
        }
      } catch { /* silent */ }
      finally { setAcLoading(false) }
    }, 150)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!acOpen || acResults.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim().length > 0) {
        onSelectSymbol(searchQuery.trim().toUpperCase())
        setSearchQuery('')
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, acResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = selectedIdx >= 0 ? acResults[selectedIdx] : acResults[0]
      if (item) {
        onSelectSymbol(item.symbol)
        setSearchQuery('')
        setAcOpen(false)
      }
    } else if (e.key === 'Escape') {
      setAcOpen(false)
    }
  }, [acOpen, acResults, selectedIdx, onSelectSymbol, setSearchQuery, searchQuery])

  const handleSelect = useCallback((symbol: string) => {
    onSelectSymbol(symbol)
    setSearchQuery('')
    setAcOpen(false)
    inputRef.current?.blur()
  }, [onSelectSymbol, setSearchQuery])

  return (
    <div ref={containerRef} className="relative group">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-gold-400 transition-colors z-10"
      />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value.toUpperCase())}
        onFocus={() => { if (acResults.length > 0) setAcOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder="Hisse ara…"
        className={cn(
          'h-9 w-36 sm:w-52 md:w-64 pl-8 pr-12 rounded-lg',
          'bg-surface-2 border border-stroke text-sm font-mono text-text-primary',
          'placeholder:text-text-quaternary placeholder:font-sans',
          'focus:outline-none focus:bg-surface-3 focus:border-stroke-gold focus:shadow-glow-gold',
          'transition-all duration-150 ease-snap',
        )}
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => { setSearchQuery(''); setAcOpen(false); setAcResults([]) }}
          aria-label="Aramayı temizle"
          className="absolute right-9 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors z-10"
        >
          <X size={12} />
        </button>
      )}
      {acLoading && (
        <div className="absolute right-9 top-1/2 -translate-y-1/2 z-10">
          <div className="w-3 h-3 border-2 border-stroke-gold-strong border-t-gold-400 rounded-full animate-spin" />
        </div>
      )}
      {!searchQuery && (
        <Kbd size="xs" className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:flex z-10">
          ↵
        </Kbd>
      )}

      {/* Autocomplete dropdown */}
      {acOpen && acResults.length > 0 && (
        <div
          role="listbox"
          className={cn(
            'absolute top-full left-0 mt-1.5 w-full min-w-[260px] max-h-[320px] overflow-y-auto z-50',
            'bg-surface-3 border border-stroke-strong rounded-xl shadow-depth-3 p-1',
            'animate-fade-in-up',
          )}
        >
          <div className="px-2.5 py-1 text-2xs font-semibold uppercase tracking-widest text-text-quaternary">
            Sonuçlar ({acResults.length})
          </div>
          {acResults.map((item, idx) => (
            <button
              key={item.symbol}
              type="button"
              role="option"
              aria-selected={idx === selectedIdx}
              onClick={() => handleSelect(item.symbol)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left',
                'transition-colors duration-100',
                idx === selectedIdx
                  ? 'bg-surface-4 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-3',
              )}
            >
              <span className="font-mono font-semibold text-sm text-gold-300 shrink-0 w-14">{item.symbol}</span>
              <span className="min-w-0 truncate text-xs text-text-tertiary">
                {item.companyName || item.sector || ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {acOpen && searchQuery.trim().length >= 1 && acResults.length === 0 && !acLoading && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[260px] z-50 bg-surface-3 border border-stroke rounded-xl shadow-depth-3 p-4 text-center animate-fade-in-up">
          <span className="text-xs text-text-tertiary">Hisse bulunamadı</span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// LAZY TABS
// ═══════════════════════════════════════════════════════════════════

const TabStocks     = lazy(() => import('./TabStocks'))
const TabMarket     = lazy(() => import('./TabMarket'))
const TabStock      = lazy(() => import('./TabStock'))
const TabCalendar   = lazy(() => import('./TabCalendar'))
const TabMacro      = lazy(() => import('./TabMacro'))
const TabFinancials = lazy(() => import('./TabFinancials'))
const TabOwnership  = lazy(() => import('./TabOwnership'))
const TabAnalyst    = lazy(() => import('./TabAnalyst'))
const TabCompare    = lazy(() => import('./TabCompare'))
const TabFred       = lazy(() => import('./TabFred'))
const TabPulse      = lazy(() => import('./TabPulse'))

// ─── Premium Skeleton (replaces over-animated old loader) ───────────
function TabSkeleton() {
  return (
    <div className="space-y-4 py-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Skeleton width={36} height={36} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height={14} width="40%" />
          <Skeleton height={10} width="60%" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={88} rounded="xl" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={44} rounded="lg" />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 pt-2 text-2xs text-text-quaternary">
        <Brain size={12} className="text-gold-400/70 animate-pulse" />
        <span className="font-medium tracking-wider uppercase">Modül yükleniyor…</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB CONFIG
// ═══════════════════════════════════════════════════════════════════

type HermesTab =
  | 'stocks' | 'market' | 'stock' | 'calendar' | 'macro' | 'fred'
  | 'pulse' | 'financials' | 'ownership' | 'analyst' | 'compare'

interface TabConfig {
  id: HermesTab
  label: string
  shortLabel: string
  icon: React.ReactNode
  desc: string
}

const TABS: TabConfig[] = [
  { id: 'market',     label: 'Piyasa & Trend',  shortLabel: 'PIYASA', icon: <Globe size={14} />,     desc: 'Piyasa trendi, endeks skorları, sektör rotasyonu' },
  { id: 'pulse',      label: 'Wall Street Nabzı', shortLabel: 'NABIZ',  icon: <Activity size={14} />,  desc: '12 bileşenli piyasa nabız endeksi' },
  { id: 'stocks',     label: 'Hisseler',          shortLabel: 'HISSE',  icon: <BarChart3 size={14} />, desc: 'Tüm hisseler ve puanlama' },
  { id: 'stock',      label: 'Detay',             shortLabel: 'DETAY',  icon: <Eye size={14} />,       desc: 'Hisse detay analizi' },
  { id: 'financials', label: 'Finansallar',       shortLabel: 'FINANS', icon: <PieChart size={14} />,  desc: 'Gelir tablosu, bilanço' },
  { id: 'ownership',  label: 'Sahiplik',          shortLabel: 'SAHIP',  icon: <Users size={14} />,     desc: 'Kurumsal ve içeriden alanlar' },
  { id: 'analyst',    label: 'Analist',           shortLabel: 'ANALIST',icon: <Target size={14} />,    desc: 'Analist tahminleri ve hedefler' },
  { id: 'macro',      label: 'Makro',             shortLabel: 'MAKRO',  icon: <Globe2 size={14} />,    desc: 'GDP, tüketici güveni, ESG' },
  { id: 'fred',       label: 'Makro Radar',       shortLabel: 'RADAR',  icon: <Radio size={14} />,     desc: 'FRED bazlı makro paneli' },
  { id: 'calendar',   label: 'Takvim',            shortLabel: 'TAKVIM', icon: <Calendar size={14} />,  desc: 'Kazanç, temettü, IPO takvimi' },
  { id: 'compare',    label: 'Karşılaştır',       shortLabel: 'KARS.',  icon: <GitCompare size={14} />,desc: 'Hisseleri karşılaştır' },
]

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

export default function ModuleNasdaqTerminal() {
  const [activeTab, setActiveTab] = useState<HermesTab>('market')
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [compareSymbols, setCompareSymbols] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const handleSelectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol)
    setActiveTab('stock')
  }, [])

  const handleAddToCompare = useCallback((symbol: string) => {
    setCompareSymbols(prev => {
      if (prev.includes(symbol)) return prev
      if (prev.length >= 4) return prev
      return [...prev, symbol]
    })
  }, [])

  const handleRemoveFromCompare = useCallback((symbol: string) => {
    setCompareSymbols(prev => prev.filter(s => s !== symbol))
  }, [])

  return (
    <div className="max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5 animate-fade-in">
      {/* ─── Module header ─── */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <HermesLogo size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-text-primary whitespace-nowrap">
                NASDAQ Terminal
                <span className="ml-2 text-gold-400 font-bold">AI</span>
              </h2>
              <Badge tone="success" size="xs" dot pulse className="hidden lg:inline-flex">
                CANLI
              </Badge>
            </div>
            <p className="text-xs text-text-tertiary hidden sm:block mt-0.5">
              Temel analiz · Z-Score sinyalleri · Sektör rotasyonu
            </p>
          </div>
        </div>

        <NasdaqSymbolSearchInput
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectSymbol={handleSelectSymbol}
        />
      </div>

      {/* ─── Tab navigation: pills with subtle hover, mobile horizontal scroll ─── */}
      <div
        role="tablist"
        aria-label="NASDAQ Terminal sekmeleri"
        className={cn(
          'flex items-center gap-1 mb-5 overflow-x-auto scrollbar-hide',
          '-mx-3 px-3 sm:mx-0 sm:px-0 pb-1',
        )}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              title={tab.desc}
              className={cn(
                'group inline-flex items-center gap-1.5 shrink-0',
                'h-8 px-3 rounded-md text-xs font-semibold tracking-wide whitespace-nowrap',
                'transition-all duration-150 ease-snap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
                isActive
                  ? 'bg-gold-400/15 text-gold-300 border border-stroke-gold-strong shadow-depth-1'
                  : 'text-text-tertiary border border-transparent hover:bg-surface-3 hover:text-text-primary hover:border-stroke',
              )}
            >
              <span className={cn(isActive ? 'text-gold-300' : 'text-text-tertiary group-hover:text-text-secondary')}>
                {tab.icon}
              </span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
              {tab.id === 'compare' && compareSymbols.length > 0 && (
                <Badge tone="gold" size="xs" className="ml-0.5 px-1.5 font-mono">
                  {compareSymbols.length}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Tab content ─── */}
      <div
        role="tabpanel"
        className="min-h-[60vh] animate-fade-in-up"
        key={activeTab}
      >
        <ErrorBoundary fallbackTitle={`${activeTab.toUpperCase()} Tab Hatası`}>
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'pulse' && <TabPulse onSelectSymbol={handleSelectSymbol} />}
            {activeTab === 'stocks' && <TabStocks onSelectSymbol={handleSelectSymbol} />}
            {activeTab === 'market' && <TabMarket onSelectSymbol={handleSelectSymbol} />}
            {activeTab === 'stock' && (
              <TabStock symbol={selectedSymbol} onSelectSymbol={handleSelectSymbol} onAddToCompare={handleAddToCompare} />
            )}
            {activeTab === 'calendar' && <TabCalendar onSelectSymbol={handleSelectSymbol} />}
            {activeTab === 'macro' && <TabMacro onSelectSymbol={handleSelectSymbol} />}
            {activeTab === 'fred' && <TabFred />}
            {activeTab === 'financials' && <TabFinancials symbol={selectedSymbol} />}
            {activeTab === 'ownership' && <TabOwnership symbol={selectedSymbol} />}
            {activeTab === 'analyst' && <TabAnalyst symbol={selectedSymbol} />}
            {activeTab === 'compare' && (
              <TabCompare symbols={compareSymbols} onRemoveSymbol={handleRemoveFromCompare} onSelectSymbol={handleAddToCompare} />
            )}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
