'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import MarketLauncher, { MarketId } from '@/components/MarketLauncher'
import Layout, { ModuleId } from '@/components/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'
import ManifestoSplash from '@/components/ManifestoSplash'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'

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

// Fund module
const HermesFundPage = dynamic(() => import('@/app/hermes-fund/page'), {
  loading: () => <ModuleSkeleton />,
  ssr: false,
})

function ModuleSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-stroke-gold-strong border-t-gold-400 rounded-full animate-spin" />
        <span className="text-sm text-text-tertiary">Modul yukleniyor...</span>
      </div>
    </div>
  )
}

const MARKET_NAV: { id: MarketId; label: string; icon: string; accentColor: string; status: 'live' | 'soon' }[] = [
  { id: 'nasdaq', label: 'NASDAQ BORSASI', icon: '🇺🇸', accentColor: 'rgb(212,184,106)', status: 'live' },
  { id: 'crypto', label: 'CRYPTO', icon: '₿', accentColor: 'rgb(245,158,11)', status: 'live' },
  { id: 'bist100', label: 'BORSA ISTANBUL', icon: '🇹🇷', accentColor: 'rgb(239,68,68)', status: 'soon' },
  { id: 'forex', label: 'FOREX', icon: '💱', accentColor: 'rgb(16,185,129)', status: 'soon' },
  { id: 'fund' as MarketId, label: 'HERMES FON', icon: '🏦', accentColor: 'rgb(168,85,247)', status: 'live' },
]

function MarketNavBar({
  activeMarket,
  onSelectMarket,
  onBack,
}: {
  activeMarket: MarketId
  onSelectMarket: (m: MarketId) => void
  onBack: () => void
}) {
  return (
    <div className="sticky top-0 z-[60] bg-surface-1/85 backdrop-blur-xl border-b border-stroke">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center h-10 gap-2 overflow-x-auto scrollbar-hide">
          {/* Back */}
          <button
            onClick={onBack}
            title="Pazar seçimine dön"
            aria-label="Pazar seçimine dön"
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md shrink-0',
              'text-2xs font-semibold tracking-wide text-text-tertiary',
              'hover:text-gold-400 hover:bg-surface-3 transition-all duration-150 ease-snap',
            )}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline uppercase">Piyasalar</span>
          </button>

          <span className="w-px h-4 bg-stroke shrink-0" />

          {/* Market chips */}
          <div className="flex items-center gap-0.5">
            {MARKET_NAV.map(m => {
              const isActive = activeMarket === m.id
              const isLive = m.status === 'live'
              const shortLabel = m.id === 'bist100' ? 'BIST' : m.label.split(' ')[0]
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectMarket(m.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative inline-flex items-center gap-1.5 shrink-0',
                    'h-7 px-2.5 rounded-md text-2xs font-bold tracking-wider whitespace-nowrap',
                    'transition-all duration-150 ease-snap',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1',
                    isActive
                      ? 'bg-gold-400/12 text-gold-300 border border-stroke-gold-strong shadow-depth-1'
                      : isLive
                        ? 'text-text-tertiary border border-transparent hover:text-text-primary hover:bg-surface-3'
                        : 'text-text-quaternary border border-transparent hover:text-text-tertiary',
                  )}
                >
                  <span className="text-sm leading-none">{m.icon}</span>
                  <span className="hidden md:inline">{m.label}</span>
                  <span className="md:hidden">{shortLabel}</span>

                  {isLive ? (
                    <span className="relative flex h-1.5 w-1.5 ml-0.5">
                      <span className={cn(
                        'absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping',
                        isActive ? 'bg-gold-400' : 'bg-success-400',
                      )} />
                      <span className={cn(
                        'relative inline-flex rounded-full h-1.5 w-1.5',
                        isActive ? 'bg-gold-400' : 'bg-success-400',
                      )} />
                    </span>
                  ) : (
                    <Badge tone="neutral" size="xs" className="ml-0.5">SOON</Badge>
                  )}
                </button>
              )
            })}
          </div>

          {/* Right cluster: socials + HERMES Coin (compact, premium) */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-3">
            <span className="hidden xl:inline-flex items-center text-2xs font-semibold text-gold-300/70 mr-1 tracking-wide">
              Katıl Bize <span className="text-gold-400 ml-1">›</span>
            </span>
            <SocialLink href="https://t.me/hermes_ai_trade" label="Telegram" colorHex="#26A5E4">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </SocialLink>
            <SocialLink href="https://x.com/Hermes_ai_app" label="X" colorHex="#FFFFFF">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </SocialLink>
            <SocialLink href="https://www.linkedin.com/in/umut-tugrul-1147b0372/" label="LinkedIn" colorHex="#0A66C2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </SocialLink>
            <a
              href="https://pancakeswap.finance/swap?outputCurrency=0x9495aB3549338BF14aD2F86CbcF79C7b574bba37"
              target="_blank"
              rel="noopener noreferrer"
              title="HERMES Coin satın al"
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2.5 rounded-md',
                'bg-gradient-to-r from-gold-500 to-gold-400 text-surface-0',
                'text-2xs font-bold tracking-wide whitespace-nowrap',
                'shadow-glow-gold hover:shadow-depth-2',
                'transition-all duration-150 ease-snap active:scale-[0.97]',
              )}
            >
              HERMES <span className="hidden sm:inline">Coin</span> Al
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact social icon for the persistent market navbar
function SocialLink({
  href,
  label,
  colorHex,
  children,
}: {
  href: string
  label: string
  colorHex: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
        'bg-surface-2 border border-stroke text-text-secondary',
        'hover:bg-surface-3 hover:border-stroke-strong transition-all duration-150 ease-snap',
      )}
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" style={{ color: colorHex }} fill="currentColor">
        {children}
      </svg>
    </a>
  )
}

const MARKET_IDS: MarketId[] = ['nasdaq', 'crypto', 'bist100', 'forex', 'fund']
const PERSIST_KEY = 'hermes_active_market'
const MANIFESTO_CLOSED_KEY = 'hermes_manifesto_closed'

function safeGetItem(key: string): string | null {
  try { return typeof window !== 'undefined' ? localStorage.getItem(key) : null }
  catch { return null }
}
function safeSetItem(key: string, value: string): void {
  try { if (typeof window !== 'undefined') localStorage.setItem(key, value) }
  catch { /* quota exceeded or private mode */ }
}
function safeRemoveItem(key: string): void {
  try { if (typeof window !== 'undefined') localStorage.removeItem(key) }
  catch { /* ignore */ }
}

function HomeContent() {
  const searchParams = useSearchParams()
  const [activeMarket, setActiveMarket] = useState<MarketId | null>(() => {
    if (typeof window === 'undefined') return null
    const p = new URLSearchParams(window.location.search)
    const fromUrl = p.get('market')
    const fromStorage = safeGetItem(PERSIST_KEY)
    const m = fromUrl || fromStorage
    return (m && MARKET_IDS.includes(m as MarketId)) ? (m as MarketId) : null
  })
  const [showManifesto, setShowManifesto] = useState(() => {
    if (typeof window === 'undefined') return true
    return !safeGetItem(MANIFESTO_CLOSED_KEY)
  })

  useEffect(() => {
    const fromUrl = searchParams.get('market')
    const fromStorage = safeGetItem(PERSIST_KEY)
    const m = fromUrl || fromStorage
    if (m && MARKET_IDS.includes(m as MarketId)) {
      setActiveMarket(m as MarketId)
    }
  }, [searchParams])

  // Multi-tab sync via storage events
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === PERSIST_KEY) {
        const v = e.newValue
        if (v && MARKET_IDS.includes(v as MarketId)) setActiveMarket(v as MarketId)
        else if (!v) setActiveMarket(null)
      }
      if (e.key === MANIFESTO_CLOSED_KEY) {
        setShowManifesto(e.newValue !== 'true')
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const handleSelectMarket = useCallback((market: MarketId) => {
    setActiveMarket(market)
    safeSetItem(PERSIST_KEY, market)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('market', market)
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleBackToLauncher = useCallback(() => {
    setActiveMarket(null)
    safeRemoveItem(PERSIST_KEY)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('market')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  if (showManifesto) {
    return (
      <ManifestoSplash
        onClose={() => {
          setShowManifesto(false)
          safeSetItem(MANIFESTO_CLOSED_KEY, 'true')
        }}
      />
    )
  }

  // Show launcher if no market selected
  if (!activeMarket) {
    return <MarketLauncher onSelectMarket={handleSelectMarket} />
  }

  // NASDAQ market — fully active
  if (activeMarket === 'nasdaq') {
    return (
      <div className="min-h-screen bg-surface-0">
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

  // CRYPTO market — active
  if (activeMarket === 'crypto') {
    return (
      <div className="min-h-screen bg-surface-0">
        <MarketNavBar activeMarket={activeMarket} onSelectMarket={handleSelectMarket} onBack={handleBackToLauncher} />
        <ErrorBoundary fallbackTitle="Crypto Terminal hatasi">
          <ModuleCryptoTerminal />
        </ErrorBoundary>
        <ScrollToTopBtn />
      </div>
    )
  }

  // HERMES FUND — active
  if (activeMarket === 'fund') {
    return (
      <div className="min-h-screen bg-surface-0">
        <MarketNavBar activeMarket={activeMarket} onSelectMarket={handleSelectMarket} onBack={handleBackToLauncher} />
        <ErrorBoundary fallbackTitle="Hermes Fund hatasi">
          <HermesFundPage />
        </ErrorBoundary>
      </div>
    )
  }

  // Other markets — coming soon placeholder
  return (
    <div className="min-h-screen bg-surface-0">
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
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-stroke-gold-strong border-t-gold-400 rounded-full animate-spin" />
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
        <h1 className="text-3xl font-black text-text-primary mb-2">{info.label}</h1>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest border border-stroke bg-surface-2 text-text-quaternary">
            YAKINDA
          </span>
        </div>
        <p className="text-text-tertiary text-sm max-w-md mx-auto mb-8">
          HERMES AI Neural Core altyapisi ile {info.label} modulu uzerinde calisiliyor.
          Kurumsal duzeyde analiz ve sinyal sistemi yakin zamanda aktif olacak.
        </p>
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 border border-stroke-subtle">
            <div className="w-2 h-2 rounded-full bg-gold-400/50 animate-pulse" />
            <span className="text-xs text-text-tertiary font-medium">Gelistirme asamasinda</span>
          </div>
        </div>
      </div>
    </div>
  )
}
