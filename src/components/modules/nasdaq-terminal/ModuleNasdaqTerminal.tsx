'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Ana Modul Container
// Modern trading platform UI - Flowbite/HyperUI/Lucide inspired
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, lazy, Suspense, useEffect, useRef } from 'react'
import { Brain, Search, BarChart3, Globe, Eye, PieChart, Users, Target, GitCompare, Calendar, Globe2, Radio, X, Activity } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 group-focus-within:text-gold-400 transition-colors z-10" />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value.toUpperCase())}
        onFocus={() => { if (acResults.length > 0) setAcOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder="Hisse ara (sembol)..."
        className="w-32 sm:w-44 md:w-60 pl-9 pr-10 sm:pr-12 py-1.5 sm:py-2 rounded-xl bg-midnight-50/50 border border-gold-400/10 
                   text-sm sm:text-base text-white placeholder-white/25 
                   focus:outline-none focus:border-gold-400/30 focus:bg-midnight-50/80 focus:shadow-lg focus:shadow-gold-400/5
                   transition-all duration-200"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => { setSearchQuery(''); setAcOpen(false); setAcResults([]) }}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors z-10"
        >
          <X size={14} />
        </button>
      )}
      {acLoading && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10">
          <div className="w-3 h-3 border border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
        </div>
      )}
      {!searchQuery && (
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/35 bg-white/[0.05] px-1.5 py-0.5 rounded hidden md:inline-block z-10">
          Enter
        </kbd>
      )}
      {acOpen && acResults.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] max-h-[280px] overflow-y-auto bg-[#151520] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 z-50">
          <div className="px-3 py-1.5 border-b border-white/[0.04] text-[10px] text-white/40">
            Tikla veya Enter ile sec
          </div>
          {acResults.map((item, idx) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => handleSelect(item.symbol)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                ${idx === selectedIdx ? 'bg-gold-400/10' : 'hover:bg-white/[0.04]'}
                ${idx < acResults.length - 1 ? 'border-b border-white/[0.02]' : ''}`}
            >
              <span className="font-mono font-semibold text-white shrink-0">{item.symbol}</span>
              <span className="min-w-0 truncate text-[11px] text-white/60">
                {item.companyName || item.sector || ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {acOpen && searchQuery.trim().length >= 1 && acResults.length === 0 && !acLoading && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] bg-[#151520] border border-white/[0.08] rounded-xl shadow-2xl z-50 p-3 text-center">
          <span className="text-[11px] text-white/35">Hisse bulunamadi</span>
        </div>
      )}
    </div>
  )
}

// Lazy load tabs — only the active tab's code is loaded
const TabStocks = lazy(() => import('./TabStocks'))
const TabMarket = lazy(() => import('./TabMarket'))
const TabStock = lazy(() => import('./TabStock'))
const TabCalendar = lazy(() => import('./TabCalendar'))
const TabMacro = lazy(() => import('./TabMacro'))
const TabFinancials = lazy(() => import('./TabFinancials'))
const TabOwnership = lazy(() => import('./TabOwnership'))
const TabAnalyst = lazy(() => import('./TabAnalyst'))
const TabCompare = lazy(() => import('./TabCompare'))
const TabFred = lazy(() => import('./TabFred'))
const TabPulse = lazy(() => import('./TabPulse'))

function TabSkeleton() {
  const MODULES = ['Veri', 'Analiz', 'Skor']
  return (
    <div className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 data-stream pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(179,148,91,0.03) 0%, transparent 70%)' }} />
      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Ring */}
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14" viewBox="0 0 100 100" style={{ animation: 'ring-spin 2s linear infinite' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(179,148,91,0.06)" strokeWidth="2" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="url(#tGold)" strokeWidth="2" strokeLinecap="round"
              strokeDasharray="264" style={{ animation: 'ring-pulse 1.6s ease-in-out infinite' }} />
            <defs><linearGradient id="tGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#C9A96E" /><stop offset="100%" stopColor="#876b3a" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain size={18} className="text-gold-400/80" style={{ animation: 'heartbeat 2s ease-in-out infinite' }} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white/70 tracking-wide">Modul yukleniyor</p>
          <p className="text-[10px] text-white/35 mt-0.5">HERMES AI Terminal</p>
        </div>
        {/* Progress */}
        <div className="w-40 h-0.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #876b3a, #C9A96E)' }} />
        </div>
        {/* Mini modules */}
        <div className="flex gap-2">
          {MODULES.map((m, i) => (
            <div key={i} className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] opacity-0"
              style={{ animation: `card-reveal 0.4s ease-out ${0.5 + i * 0.25}s forwards` }}>
              <span className="text-[9px] text-white/40 font-medium tracking-wider">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type HermesTab = 'stocks' | 'market' | 'stock' | 'calendar' | 'macro' | 'fred' | 'pulse' | 'financials' | 'ownership' | 'analyst' | 'compare'

interface TabConfig {
  id: HermesTab
  label: string
  icon: React.ReactNode
  desc: string
}

const TABS: TabConfig[] = [
  { id: 'market', label: 'PIYASA & TREND', icon: <Globe size={16} />, desc: 'Piyasa trendi, endeks skorlari, sektor rotasyonu' },
  { id: 'pulse', label: 'WALL STREET NABZI', icon: <Activity size={16} />, desc: '12 bilesenli piyasa nabiz endeksi — breadth, smart money, earnings, korku/hirs' },
  { id: 'stocks', label: 'HISSELER', icon: <BarChart3 size={16} />, desc: 'Tum hisseler ve puanlama' },
  { id: 'stock', label: 'DETAY', icon: <Eye size={16} />, desc: 'Hisse detay analizi' },
  { id: 'financials', label: 'FINANSALLAR', icon: <PieChart size={16} />, desc: 'Gelir tablosu, bilanco' },
  { id: 'ownership', label: 'SAHIPLIK', icon: <Users size={16} />, desc: 'Kurumsallar ve iceriden alanlar' },
  { id: 'analyst', label: 'ANALIST', icon: <Target size={16} />, desc: 'Analist tahminleri ve hedefler' },
  { id: 'macro', label: 'MAKRO', icon: <Globe2 size={16} />, desc: 'GDP, tuketici guveni, ESG, endeksler' },
  { id: 'fred', label: 'MAKRO RADAR', icon: <Radio size={16} />, desc: 'FRED bazli makro ekonomi paneli — verim egrisi, Fed, enflasyon, istihdam' },
  { id: 'calendar', label: 'TAKVIM', icon: <Calendar size={16} />, desc: 'Kazanc, temettu, split, IPO takvimleri' },
  { id: 'compare', label: 'KARSILASTIR', icon: <GitCompare size={16} />, desc: 'Hisseleri karsilastir' },
]

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
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-5 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-[12px] bg-[#1e2028] flex items-center justify-center hermes-logo overflow-hidden shrink-0"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <svg className="w-5 h-5 sm:w-7 sm:h-7 relative z-10" viewBox="0 0 32 32" fill="none">
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
          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-bold text-white tracking-wide whitespace-nowrap">
              <span className="sm:hidden">NASDAQ <span className="gradient-text">AI</span></span>
              <span className="hidden sm:inline">NASDAQ TERMINAL <span className="gradient-text">AI</span></span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-white/40 hidden sm:block">Temel analiz & puanlama platformu</p>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-400/8 border border-gold-400/15 ml-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulse" />
            <span className="text-[11px] text-gold-300 font-medium tracking-wider">CANLI</span>
          </div>
        </div>

        {/* Search */}
        <NasdaqSymbolSearchInput
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectSymbol={handleSelectSymbol}
        />
      </div>

      {/* Desktop Tab Navigation */}
      <div className="hidden md:flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.desc}
            className={`group flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium 
                         whitespace-nowrap transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-gold-400/15 text-gold-300 border border-gold-400/25 shadow-sm shadow-gold-400/5'
                : 'bg-transparent text-white/45 hover:bg-midnight-50/80 hover:text-white/60 border border-transparent hover:border-gold-400/8'
              }`}
          >
            <span className={`transition-colors ${activeTab === tab.id ? 'text-gold-300' : 'text-white/40 group-hover:text-white/60'}`}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {tab.id === 'compare' && compareSymbols.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-gold-400/20 text-[11px] text-gold-300 font-bold">
                {compareSymbols.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden flex items-center gap-1 mb-3 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
        {TABS.map(tab => {
          const shortLabels: Record<string, string> = {
            market: 'PIYASA', stocks: 'HISSE', stock: 'DETAY', financials: 'FINANS',
            ownership: 'SAHIP', analyst: 'ANALIST', macro: 'MAKRO', fred: 'RADAR',
            calendar: 'TAKVIM', compare: 'KARS.',
          }
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold 
                           whitespace-nowrap transition-all duration-200 shrink-0
                ${activeTab === tab.id
                  ? 'bg-gold-400/15 text-gold-300 border border-gold-400/25 shadow-sm shadow-gold-400/5'
                  : 'text-white/45 hover:text-white/60 border border-transparent'
                }`}
            >
              <span className={`transition-colors ${activeTab === tab.id ? 'text-gold-300' : 'text-white/40'}`}>
                {tab.icon}
              </span>
              <span>{shortLabels[tab.id] || tab.label}</span>
              {tab.id === 'compare' && compareSymbols.length > 0 && (
                <span className="ml-0.5 px-1 py-0.5 rounded-full bg-gold-400/20 text-[10px] text-gold-300 font-bold">
                  {compareSymbols.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content — lazy loaded with Suspense + ErrorBoundary per tab */}
      <div className="min-h-[60vh] animate-fade-in" key={activeTab}>
        <ErrorBoundary fallbackTitle={`${activeTab.toUpperCase()} Tab Hatasi`}>
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
