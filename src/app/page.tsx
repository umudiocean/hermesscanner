'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import MarketLauncher, { MarketId } from '@/components/MarketLauncher'
import Layout, { ModuleId } from '@/components/Layout'
import EuropeLayout, { EuropeModuleId } from '@/components/EuropeLayout'
import ErrorBoundary from '@/components/ErrorBoundary'
import ManifestoSplash from '@/components/ManifestoSplash'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Multi-Market Platform
// Launcher → Market Selection → Module Navigation
// ═══════════════════════════════════════════════════════════════════

// Lazy load all modules
const ModuleNasdaqTerminal = dynamic(() => import('@/components/modules/nasdaq-terminal/ModuleNasdaqTerminal'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

const ModuleNasdaqTrade = dynamic(() => import('@/components/modules/ModuleNasdaqTrade'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

const ModuleNasdaqSignals = dynamic(() => import('@/components/modules/ModuleNasdaqSignals'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

const ModuleNasdaqWatchlist = dynamic(() => import('@/components/modules/ModuleNasdaqWatchlist'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

const ModuleHermesIndex = dynamic(() => import('@/components/modules/ModuleHermesIndex'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

// Crypto modules
const ModuleCryptoTerminal = dynamic(() => import('@/components/modules/crypto-terminal/ModuleCryptoTerminal'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

// Europe modules
const ModuleEuropeTerminal = dynamic(() => import('@/components/modules/europe-terminal/ModuleEuropeTerminal'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})
const ModuleEuropeTrade = dynamic(() => import('@/components/modules/ModuleEuropeTrade'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})
const ModuleEuropeSignals = dynamic(() => import('@/components/modules/ModuleEuropeSignals'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})
const ModuleEuropeWatchlist = dynamic(() => import('@/components/modules/ModuleEuropeWatchlist'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})
const ModuleEuropeIndex = dynamic(() => import('@/components/modules/ModuleEuropeIndex'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

function ModuleSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
        <span className="text-sm text-white/40">Modul yukleniyor...</span>
      </div>
    </div>
  )
}

const MARKET_NAV: { id: MarketId; label: string; icon: string; accentColor: string; status: 'live' | 'soon' }[] = [
  { id: 'nasdaq', label: 'NASDAQ BORSASI', icon: '🇺🇸', accentColor: 'rgb(179,148,91)', status: 'live' },
  { id: 'crypto', label: 'CRYPTO', icon: '₿', accentColor: 'rgb(245,158,11)', status: 'live' },
  { id: 'europe', label: 'AVRUPA BORSALARI', icon: '🇪🇺', accentColor: 'rgb(59,130,246)', status: 'live' },
  { id: 'bist100', label: 'BORSA ISTANBUL', icon: '🇹🇷', accentColor: 'rgb(239,68,68)', status: 'soon' },
  { id: 'forex', label: 'FOREX', icon: '💱', accentColor: 'rgb(16,185,129)', status: 'soon' },
]

function MarketNavBar({ activeMarket, onSelectMarket, onBack }: { activeMarket: MarketId; onSelectMarket: (m: MarketId) => void; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/[0.04]">
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center h-11 gap-1 overflow-x-auto scrollbar-hide">
          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all text-xs font-medium shrink-0 mr-1"
            title="Ana sayfaya don"
          >
            <span className="text-sm">←</span>
            <span className="hidden sm:inline">Piyasalar</span>
          </button>

          <div className="w-px h-5 bg-white/[0.06] shrink-0 mr-1" />

          {/* HERMES Logo */}
          <div className="flex items-center gap-1.5 mr-3 shrink-0">
            <span className="text-xs font-bold text-white/60">HERMES</span>
            <span className="text-xs font-extrabold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">AI</span>
          </div>

          <div className="w-px h-5 bg-white/[0.06] shrink-0 mr-1" />

          {/* Market Tabs */}
          <div className="flex items-center gap-0.5">
            {MARKET_NAV.map(m => {
              const isActive = activeMarket === m.id
              const isLive = m.status === 'live'
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectMarket(m.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-300 shrink-0 group
                    ${isActive
                      ? 'text-white shadow-lg'
                      : isLive
                        ? 'text-white/45 hover:text-white/60 hover:bg-white/[0.04]'
                        : 'text-white/40 hover:text-white/45 hover:bg-white/[0.02]'
                    }`}
                  style={isActive ? {
                    background: `linear-gradient(135deg, ${m.accentColor}15, ${m.accentColor}08)`,
                    boxShadow: `0 2px 12px ${m.accentColor}20, inset 0 1px 0 ${m.accentColor}15`,
                    border: `1px solid ${m.accentColor}30`,
                  } : undefined}
                >
                  <span className="text-sm">{m.icon}</span>
                  <span className="hidden md:inline">{m.label}</span>
                  <span className="md:hidden">{m.id === 'bist100' ? 'BIST' : m.id === 'europe' ? 'EU' : m.label.split(' ')[0]}</span>

                  {/* Status badge */}
                  {isLive ? (
                    <span className="relative flex items-center ml-0.5">
                      <span className="absolute w-full h-full rounded-full animate-ping opacity-40" style={{ backgroundColor: isActive ? m.accentColor : 'rgba(16,185,129,0.5)' }} />
                      <span className="relative w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? m.accentColor : 'rgb(16,185,129)' }} />
                    </span>
                  ) : (
                    <span className="text-[8px] font-bold tracking-wider text-white/35 bg-white/[0.03] px-1.5 py-px rounded ml-0.5">
                      YAKINDA
                    </span>
                  )}

                  {/* Active indicator line */}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ backgroundColor: m.accentColor }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Social & HERMES Coin — sag ust */}
          <div className="ml-auto flex items-center gap-1 shrink-0 pl-2">
            {/* "Katil Bize" animasyonlu yazi */}
            <span className="hidden lg:inline-flex items-center text-[10px] font-bold tracking-wide animate-join-us-glow mr-0.5">
              <span className="inline-block animate-join-us-bounce">Katil</span>
              <span className="inline-block animate-join-us-bounce ml-0.5" style={{ animationDelay: '0.15s' }}>Bize</span>
              <span className="inline-block ml-1 text-gold-400/60 animate-join-us-arrow">{'>'}</span>
            </span>
            <a href="https://t.me/hermes_ai_trade" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#26A5E4] hover:bg-[#26A5E4]/15 hover:border-[#26A5E4]/30 transition-all duration-200 hover:scale-105" title="Telegram">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
            </a>
            <a href="https://x.com/Hermes_ai_app" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/70 hover:bg-white/[0.1] hover:border-white/20 transition-all duration-200 hover:scale-105" title="X (Twitter)">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="https://www.linkedin.com/in/umut-tugrul-1147b0372/" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#0A66C2] hover:bg-[#0A66C2]/15 hover:border-[#0A66C2]/30 transition-all duration-200 hover:scale-105" title="LinkedIn">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
            <a href="https://pancakeswap.finance/swap?outputCurrency=0x9495aB3549338BF14aD2F86CbcF79C7b574bba37" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold hover:from-amber-500/30 hover:to-orange-500/25 hover:border-amber-500/50 transition-all duration-200 hover:scale-[1.03] shadow-md shadow-amber-500/10" title="Hermes Coin Satin Al">
              <span className="font-extrabold">HERMES</span><span className="hidden sm:inline ml-0.5">Coin</span><span className="ml-0.5">Satin Al</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

const MARKET_IDS: MarketId[] = ['nasdaq', 'europe', 'crypto', 'bist100', 'forex']
const PERSIST_KEY = 'hermes_active_market'

function HomeContent() {
  const searchParams = useSearchParams()
  const [activeMarket, setActiveMarket] = useState<MarketId | null>(null)
  const [showManifesto, setShowManifesto] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fromUrl = searchParams.get('market')
    const fromStorage = localStorage.getItem(PERSIST_KEY)
    const m = fromUrl || fromStorage
    if (m && MARKET_IDS.includes(m as MarketId)) {
      setActiveMarket(m as MarketId)
    }
  }, [searchParams])

  const handleSelectMarket = useCallback((market: MarketId) => {
    setActiveMarket(market)
    if (typeof window !== 'undefined') {
      localStorage.setItem(PERSIST_KEY, market)
      const url = new URL(window.location.href)
      url.searchParams.set('market', market)
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleBackToLauncher = useCallback(() => {
    setActiveMarket(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PERSIST_KEY)
      const url = new URL(window.location.href)
      url.searchParams.delete('market')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  if (showManifesto) {
    return <ManifestoSplash onClose={() => setShowManifesto(false)} />
  }

  // Show launcher if no market selected
  if (!activeMarket) {
    return <MarketLauncher onSelectMarket={handleSelectMarket} />
  }

  // NASDAQ market — fully active
  if (activeMarket === 'nasdaq') {
    return (
      <div className="min-h-screen bg-[#0d0d0d]">
        <MarketNavBar activeMarket={activeMarket} onSelectMarket={handleSelectMarket} onBack={handleBackToLauncher} />
        <Layout onBack={undefined}>
          {(activeModule: ModuleId) => {
          let content: React.ReactNode

          switch (activeModule) {
            case 'nasdaq-terminal':
              content = <ModuleNasdaqTerminal />
              break
            case 'nasdaq-trade':
              content = <ModuleNasdaqTrade />
              break
            case 'nasdaq-signals':
              content = <ModuleNasdaqSignals />
              break
            case 'nasdaq-watchlist':
              content = <ModuleNasdaqWatchlist />
              break
            case 'hermes-index':
              content = <ModuleHermesIndex />
              break
            default:
              content = <ModuleNasdaqTerminal />
          }

          return (
              <ErrorBoundary fallbackTitle={`Modul hatasi: ${activeModule}`}>
                {content}
              </ErrorBoundary>
          )
        }}
      </Layout>
      </div>
    )
  }

  // EUROPE market — active
  if (activeMarket === 'europe') {
    return (
      <div className="min-h-screen bg-[#0d0d0d]">
        <MarketNavBar activeMarket={activeMarket} onSelectMarket={handleSelectMarket} onBack={handleBackToLauncher} />
        <EuropeLayout onBack={undefined}>
          {(activeModule: EuropeModuleId) => {
            let content: React.ReactNode

            switch (activeModule) {
              case 'europe-terminal':
                content = <ModuleEuropeTerminal />
                break
              case 'europe-trade':
                content = <ModuleEuropeTrade />
                break
              case 'europe-signals':
                content = <ModuleEuropeSignals />
                break
              case 'europe-watchlist':
                content = <ModuleEuropeWatchlist />
                break
              case 'europe-index':
                content = <ModuleEuropeIndex />
                break
              default:
                content = <ModuleEuropeTerminal />
            }

            return (
              <ErrorBoundary fallbackTitle={`Modul hatasi: ${activeModule}`}>
                {content}
              </ErrorBoundary>
            )
          }}
        </EuropeLayout>
      </div>
    )
  }

  // CRYPTO market — active
  if (activeMarket === 'crypto') {
    return (
      <div className="min-h-screen bg-[#0d0d0d]">
        <MarketNavBar activeMarket={activeMarket} onSelectMarket={handleSelectMarket} onBack={handleBackToLauncher} />
        <ErrorBoundary fallbackTitle="Crypto Terminal hatasi">
          <ModuleCryptoTerminal />
        </ErrorBoundary>
        <ScrollToTopBtn />
      </div>
    )
  }

  // Other markets — coming soon placeholder
  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <MarketNavBar activeMarket={activeMarket} onSelectMarket={handleSelectMarket} onBack={handleBackToLauncher} />
      <ComingSoonMarket
        marketId={activeMarket}
        onBack={handleBackToLauncher}
      />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}

// Scroll to top button for Crypto and other non-Layout pages
function ScrollToTopBtn() {
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

function ComingSoonMarket({ marketId, onBack }: { marketId: MarketId; onBack: () => void }) {
  const info = MARKET_NAV.find(m => m.id === marketId)
  if (!info) return null

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 rounded-full blur-3xl opacity-10" style={{ backgroundColor: info.accentColor }} />
          <div className="text-7xl relative z-10">{info.icon}</div>
        </div>
        <h1 className="text-3xl font-black text-white/80 mb-2">{info.label}</h1>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest border border-white/10 bg-white/[0.03] text-white/35">
            YAKINDA
          </span>
        </div>
        <p className="text-white/40 text-sm max-w-md mx-auto mb-8">
          HERMES AI Neural Core altyapisi ile {info.label} modulu uzerinde calisiliyor.
          Kurumsal duzeyde analiz ve sinyal sistemi yakin zamanda aktif olacak.
        </p>
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="w-2 h-2 rounded-full bg-amber-400/50 animate-pulse" />
            <span className="text-xs text-white/40 font-medium">Gelistirme asamasinda</span>
          </div>
        </div>
      </div>
    </div>
  )
}
