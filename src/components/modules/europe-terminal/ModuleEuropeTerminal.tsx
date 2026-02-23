'use client'

import { useState, useCallback, lazy, Suspense } from 'react'
import { Brain, BarChart3, Globe, Eye, Search, X } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { EuropeExchangeId } from '@/lib/europe-config'

const TabStocks = lazy(() => import('./TabStocks'))
const TabMarket = lazy(() => import('./TabMarket'))
const TabStock = lazy(() => import('./TabStock'))

function TabSkeleton() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 animate-spin" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(59,130,246,0.1)" strokeWidth="2" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="2" strokeLinecap="round" strokeDasharray="80 184" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain size={18} className="text-blue-400/80 animate-pulse" />
        </div>
      </div>
      <p className="text-sm text-white/50 mt-3">Avrupa Terminal yukleniyor...</p>
    </div>
  )
}

type EuropeTab = 'stocks' | 'market' | 'stock'

const TABS: Array<{ id: EuropeTab; label: string; icon: React.ReactNode; desc: string }> = [
  { id: 'market', label: 'PIYASA & TREND', icon: <Globe size={16} />, desc: 'Avrupa piyasa genel gorunumu, endeksler, sektorler' },
  { id: 'stocks', label: 'HISSELER', icon: <BarChart3 size={16} />, desc: 'Tum Avrupa hisseleri ve puanlama' },
  { id: 'stock', label: 'DETAY', icon: <Eye size={16} />, desc: 'Tekli hisse detay analizi' },
]

export default function ModuleEuropeTerminal() {
  const [activeTab, setActiveTab] = useState<EuropeTab>('market')
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [exchangeFilter, setExchangeFilter] = useState<EuropeExchangeId | 'ALL'>('ALL')

  const handleExchangeClick = useCallback((exId: EuropeExchangeId) => {
    setExchangeFilter(exId)
    setActiveTab('stocks')
  }, [])

  const handleSelectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol)
    setActiveTab('stock')
  }, [])

  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3 sm:mb-5 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#1e2028] flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.15)' }}>
            <span className="text-lg">🇪🇺</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-bold text-white tracking-wide whitespace-nowrap">
              AVRUPA TERMINAL <span className="text-blue-400 font-extrabold">AI</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-white/40 hidden sm:block">8 Borsa • Temel Analiz ve Puanlama</p>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-400/8 border border-blue-400/15 ml-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
            <span className="text-[11px] text-blue-300 font-medium tracking-wider">LIVE</span>
          </div>
        </div>

        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 group-focus-within:text-blue-400 transition-colors z-10" />
          <input type="text" value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value.toUpperCase()); if (e.target.value.trim()) { setSelectedSymbol(e.target.value.toUpperCase()); } }}
            onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) { handleSelectSymbol(searchQuery.trim()); setSearchQuery('') } }}
            placeholder="Ara (HSBA.L, SAP.DE)..."
            className="w-32 sm:w-44 md:w-60 pl-9 pr-8 py-1.5 sm:py-2 rounded-xl bg-midnight-50/50 border border-blue-400/10 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-400/30 transition-all duration-200" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 z-10">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.desc}
            className={`group flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-blue-400/15 text-blue-300 border border-blue-400/25 shadow-sm shadow-blue-400/5'
                : 'bg-transparent text-white/45 hover:bg-midnight-50/80 hover:text-white/60 border border-transparent hover:border-blue-400/8'
            }`}>
            <span className={activeTab === tab.id ? 'text-blue-300' : 'text-white/40 group-hover:text-white/60'}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="md:hidden flex items-center gap-1 mb-3 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
              activeTab === tab.id
                ? 'bg-blue-400/15 text-blue-300 border border-blue-400/25'
                : 'text-white/45 hover:text-white/60 border border-transparent'
            }`}>
            <span className={activeTab === tab.id ? 'text-blue-300' : 'text-white/40'}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-[60vh] animate-fade-in" key={activeTab}>
        <ErrorBoundary fallbackTitle={`${activeTab.toUpperCase()} Tab Hatasi`}>
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'stocks' && <TabStocks onSelectSymbol={handleSelectSymbol} exchangeFilter={exchangeFilter} onExchangeFilterChange={setExchangeFilter} />}
            {activeTab === 'market' && <TabMarket onSelectSymbol={handleSelectSymbol} onExchangeClick={handleExchangeClick} />}
            {activeTab === 'stock' && <TabStock symbol={selectedSymbol} onSelectSymbol={handleSelectSymbol} onAddToCompare={() => {}} />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
