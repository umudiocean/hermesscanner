'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Market Launcher
// Projector spotlight follows mouse, illuminating cards
// ═══════════════════════════════════════════════════════════════════

export type MarketId = 'nasdaq' | 'crypto' | 'europe' | 'bist100' | 'forex'

interface MarketConfig {
  id: MarketId
  name: string
  subtitle: string
  icon: string
  accentRgb: string
  stats: string
  status: 'active' | 'coming_soon'
  badge?: string
}

const MARKETS: MarketConfig[] = [
  { id: 'nasdaq', name: 'NASDAQ', subtitle: 'US Equities & Technology', icon: '🇺🇸', accentRgb: '179,148,91', stats: 'Tum NASDAQ hisseleri • Neural Core', status: 'active', badge: 'LIVE' },
  { id: 'crypto', name: 'CRYPTO', subtitle: 'Digital Assets & DeFi', icon: '₿', accentRgb: '245,158,11', stats: 'Tum coinler • CoinGecko Analyst', status: 'active', badge: 'LIVE' },
  { id: 'europe', name: 'EUROPE', subtitle: 'DAX • CAC 40 • FTSE', icon: '🇪🇺', accentRgb: '59,130,246', stats: 'Tum Avrupa hisseleri', status: 'coming_soon' },
  { id: 'bist100', name: 'BIST 100', subtitle: 'Borsa Istanbul', icon: '🇹🇷', accentRgb: '239,68,68', stats: 'Tum BIST hisseleri', status: 'coming_soon' },
  { id: 'forex', name: 'FOREX', subtitle: 'Major & Cross Pairs', icon: '💱', accentRgb: '16,185,129', stats: 'Tum major pariteler', status: 'coming_soon' },
]

interface MarketLauncherProps {
  onSelectMarket: (market: MarketId) => void
}

export default function MarketLauncher({ onSelectMarket }: MarketLauncherProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const [showCards, setShowCards] = useState(false)
  const [showSubtitle, setShowSubtitle] = useState(false)
  const [showLine, setShowLine] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t1 = setTimeout(() => setShowLine(true), 400)
    const t2 = setTimeout(() => setShowSubtitle(true), 700)
    const t3 = setTimeout(() => setShowCards(true), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMouse({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="min-h-screen bg-[#060606] flex flex-col items-center relative py-8 sm:py-16 sm:justify-center"
    >
      {/* ═══ PROJECTOR LIGHT ═══ */}
      {/* This is the main effect: a large radial gradient that follows the mouse */}
      {/* Everything outside the spotlight stays at ~33% brightness */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          opacity: mounted ? 1 : 0,
          background: `radial-gradient(600px circle at ${mouse.x}px ${mouse.y}px, transparent 0%, rgba(0,0,0,0.55) 100%)`,
        }}
      />

      {/* Projector beam cone — subtle visible light cone from top */}
      <div
        className="pointer-events-none fixed top-0 z-20 transition-opacity duration-500"
        style={{
          opacity: mounted ? 0.08 : 0,
          left: mouse.x - 300,
          width: 600,
          height: '100vh',
          background: `linear-gradient(180deg, rgba(179,148,91,0.4) 0%, transparent 60%)`,
          clipPath: `polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)`,
        }}
      />

      {/* Projector source dot — top center, follows mouse X */}
      <div
        className="pointer-events-none fixed top-0 z-40 transition-opacity duration-1000"
        style={{
          opacity: mounted ? 1 : 0,
          left: mouse.x - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'rgba(179,148,91,0.9)',
          boxShadow: '0 0 20px rgba(179,148,91,0.6), 0 0 60px rgba(179,148,91,0.3)',
        }}
      />

      {/* ═══ AMBIENT BACKGROUND ═══ */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-gold-400/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* ═══ SOCIAL & HERMES COIN — sag ust, sabit ═══ */}
      <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-50 flex items-center gap-1.5">
        {/* "Katil Bize" animasyonlu yazi */}
        <span className="hidden sm:inline-flex items-center text-xs font-bold tracking-wide animate-join-us-glow mr-1">
          <span className="inline-block animate-join-us-bounce">Katil</span>
          <span className="inline-block animate-join-us-bounce ml-1" style={{ animationDelay: '0.15s' }}>Bize</span>
          <span className="inline-block ml-1.5 text-gold-400/60 animate-join-us-arrow">{'>'}</span>
        </span>
        <a href="https://t.me/hermes_ai_trade" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[#26A5E4] hover:bg-[#26A5E4]/20 hover:border-[#26A5E4]/40 transition-all duration-200 hover:scale-110" title="Telegram">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
        </a>
        <a href="https://x.com/Hermes_ai_app" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/80 hover:bg-white/[0.12] hover:border-white/20 transition-all duration-200 hover:scale-110" title="X (Twitter)">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        </a>
        <a href="https://www.linkedin.com/in/umut-tugrul-1147b0372/" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[#0A66C2] hover:bg-[#0A66C2]/20 hover:border-[#0A66C2]/40 transition-all duration-200 hover:scale-110" title="LinkedIn">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
        </a>
        <a href="https://pancakeswap.finance/swap?outputCurrency=0x9495aB3549338BF14aD2F86CbcF79C7b574bba37" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/25 to-orange-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold hover:from-amber-500/35 hover:to-orange-500/30 hover:border-amber-500/60 transition-all duration-200 hover:scale-[1.05] shadow-lg shadow-amber-500/20" title="Hermes Coin Satin Al">
          <span className="font-extrabold">HERMES</span> <span className="hidden sm:inline">Coin</span> Satin Al
        </a>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="relative z-10 w-full max-w-6xl px-3 sm:px-6">

        {/* Logo & Title */}
        <div className="text-center mb-8 sm:mb-16">
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className={`absolute w-28 h-28 rounded-[22px] border border-[rgba(120,160,255,0.15)] transition-all duration-[2000ms] ${mounted ? 'opacity-100 scale-100 animate-logo-ring' : 'opacity-0 scale-50'}`} />
            <div className={`relative w-20 h-20 rounded-[18px] bg-[#1e2028] flex items-center justify-center hermes-logo overflow-hidden transition-all duration-1000 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
              style={{ boxShadow: '0 0 50px rgba(120,160,255,0.08), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <svg className="w-12 h-12 relative z-10" viewBox="0 0 32 32" fill="none">
                <line x1="6" y1="10" x2="16" y2="7" stroke="rgba(120,160,255,0.3)" strokeWidth="0.9" />
                <line x1="16" y1="7" x2="26" y2="12" stroke="rgba(120,160,255,0.3)" strokeWidth="0.9" />
                <line x1="6" y1="10" x2="10" y2="18" stroke="rgba(120,160,255,0.25)" strokeWidth="0.8" />
                <line x1="16" y1="7" x2="10" y2="18" stroke="rgba(120,160,255,0.25)" strokeWidth="0.8" />
                <line x1="16" y1="7" x2="22" y2="16" stroke="rgba(120,160,255,0.25)" strokeWidth="0.8" />
                <line x1="26" y1="12" x2="22" y2="16" stroke="rgba(120,160,255,0.25)" strokeWidth="0.8" />
                <line x1="10" y1="18" x2="22" y2="16" stroke="rgba(120,160,255,0.18)" strokeWidth="0.7" />
                <path d="M4 22 L8.5 17 L13 19.5 L18 13 L22.5 16 L28 10" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="10" r="2" fill="rgba(120,160,255,0.5)" />
                <circle cx="16" cy="7" r="2.5" fill="rgba(120,160,255,0.65)" />
                <circle cx="26" cy="12" r="2" fill="rgba(120,160,255,0.5)" />
                <circle cx="10" cy="18" r="1.6" fill="rgba(120,160,255,0.4)" />
                <circle cx="22" cy="16" r="1.6" fill="rgba(120,160,255,0.4)" />
                <circle cx="13" cy="19.5" r="1.5" fill="rgba(255,255,255,0.9)" />
                <circle cx="18" cy="13" r="1.8" fill="rgba(255,255,255,0.95)" />
                <circle cx="28" cy="10" r="1.5" fill="rgba(255,255,255,0.9)" />
              </svg>
              <div className="absolute inset-0 rounded-[18px] bg-gradient-to-br from-[rgba(120,160,255,0.05)] via-transparent to-transparent" />
            </div>
          </div>

          <h1 className={`text-5xl md:text-7xl font-black tracking-tight mb-4 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="text-white/90">HERMES</span>
            <span className="gold-shimmer ml-3 md:ml-4">AI</span>
          </h1>

          <div className="relative mx-auto mb-6">
            <div className={`mx-auto h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent transition-all duration-[1200ms] ${showLine ? 'w-64 opacity-100' : 'w-0 opacity-0'}`} />
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold-400 transition-all duration-700 ${showLine ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
              style={{ boxShadow: '0 0 8px rgba(179,148,91,0.6)' }}
            />
          </div>

          <p className={`text-lg md:text-xl text-white/20 font-light tracking-[0.25em] uppercase transition-all duration-1000 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Institutional Multi-Market Scanner
          </p>
          <p className={`mt-3 text-sm text-white/10 font-light tracking-wider transition-all duration-1000 delay-100 ${showSubtitle ? 'opacity-100' : 'opacity-0'}`}>
            Mean-Reversion Z-Score Strategy • Real-Time Analysis
          </p>

          {/* ═══ SLOGAN ═══ */}
          <div className={`mt-8 sm:mt-12 transition-all duration-[1400ms] delay-500 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="relative inline-block">
              <div className="absolute -inset-x-8 -inset-y-4 bg-gradient-to-r from-transparent via-gold-400/[0.03] to-transparent rounded-2xl blur-xl" />
              <div className="relative">
                <p className="text-base sm:text-lg md:text-xl font-semibold text-white/60 tracking-wide leading-relaxed">
                  Veriye hukmeden,{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-amber-400 to-gold-300 font-bold">
                    paraya hukmeder.
                  </span>
                </p>
                <p className="mt-1.5 text-sm sm:text-base text-white/30 font-light tracking-wide">
                  Hermes AI ile guc artik{' '}
                  <span className="text-white/50 font-medium">herkesin.</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ MARKET CARDS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5">
          {MARKETS.map((market, index) => (
            <MarketCard
              key={market.id}
              market={market}
              index={index}
              showCards={showCards}
              onSelect={onSelectMarket}
              mouseX={mouse.x}
              mouseY={mouse.y}
            />
          ))}
        </div>

        {/* Footer */}
        <div className={`text-center mt-8 sm:mt-16 transition-all duration-1000 delay-700 ${showCards ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-[11px] text-white/8 tracking-[0.3em] uppercase font-light">
            Neural Core • Pure Z-Score • Multi-Market Intelligence Platform
          </p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Market Card — reacts to projector light
// ═══════════════════════════════════════════════════════════════════

function MarketCard({
  market, index, showCards, onSelect, mouseX, mouseY,
}: {
  market: MarketConfig
  index: number
  showCards: boolean
  onSelect: (id: MarketId) => void
  mouseX: number
  mouseY: number
}) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const [localMouse, setLocalMouse] = useState({ x: 0, y: 0 })
  const [isNear, setIsNear] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isActive = market.status === 'active'

  useEffect(() => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dist = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2)
    setIsNear(dist < 350)
    setLocalMouse({ x: mouseX - rect.left, y: mouseY - rect.top })
  }, [mouseX, mouseY])

  return (
    <button
      ref={cardRef}
      onClick={() => isActive && onSelect(market.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={!isActive}
      className={`group relative rounded-2xl text-left overflow-hidden transition-all duration-500
        ${isActive ? 'cursor-pointer' : 'cursor-default'}
      `}
      style={{
        transitionDelay: `${index * 100}ms`,
        opacity: showCards ? 1 : 0,
        transform: showCards
          ? (isHovered && isActive ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)')
          : 'translateY(30px) scale(0.96)',
      }}
    >
      {/* Card border — glows when projector is near */}
      <div
        className="absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          opacity: isNear ? (isHovered ? 0.8 : 0.4) : 0.08,
          background: `linear-gradient(135deg, rgba(${market.accentRgb},${isHovered ? 0.6 : 0.3}), transparent 50%, rgba(${market.accentRgb},${isHovered ? 0.3 : 0.15}))`,
        }}
      />

      {/* Card bg */}
      <div className={`relative rounded-2xl overflow-hidden h-full transition-colors duration-300 ${isNear ? 'bg-[#0f0f0f]' : 'bg-[#0a0a0a]'}`}
        style={{ border: '1px solid transparent' }}
      >
        {/* Spotlight glow inside card — follows mouse */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: isHovered ? 0.9 : (isNear ? 0.35 : 0),
            background: `radial-gradient(250px circle at ${localMouse.x}px ${localMouse.y}px, rgba(${market.accentRgb}, 0.15), transparent 70%)`,
          }}
        />

        {/* Top accent bar */}
        <div className="absolute top-0 inset-x-0 h-px transition-all duration-500" style={{
          background: isNear
            ? `linear-gradient(90deg, transparent, rgba(${market.accentRgb}, ${isHovered ? 0.7 : 0.3}), transparent)`
            : 'rgba(255,255,255,0.03)',
        }} />

        {/* Content */}
        <div className="relative z-10 p-4 sm:p-6">
          {/* Badge */}
          {market.badge && (
            <div className="absolute top-4 right-4">
              <span className="relative flex items-center">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: `rgba(${market.accentRgb}, 0.4)` }} />
                <span className="relative px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-[0.15em]"
                  style={{
                    backgroundColor: `rgba(${market.accentRgb}, 0.15)`,
                    border: `1px solid rgba(${market.accentRgb}, 0.3)`,
                    color: `rgb(${market.accentRgb})`,
                  }}
                >
                  {market.badge}
                </span>
              </span>
            </div>
          )}
          {market.status === 'coming_soon' && (
            <div className="absolute top-4 right-4">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.15em] bg-white/[0.03] text-white/15 border border-white/[0.05]">
                SOON
              </span>
            </div>
          )}

          {/* Icon */}
          <div className="relative mb-5">
            <div className="text-4xl relative z-10 transition-transform duration-300" style={{ transform: isHovered && isActive ? 'scale(1.15)' : 'scale(1)' }}>
              {market.icon}
            </div>
            {isActive && (
              <div className="absolute -inset-3 rounded-full blur-xl transition-opacity duration-500"
                style={{ opacity: isHovered ? 0.25 : (isNear ? 0.06 : 0), backgroundColor: `rgb(${market.accentRgb})` }}
              />
            )}
          </div>

          {/* Name */}
          <h2 className="text-xl font-black tracking-wide mb-1 transition-colors duration-300"
            style={{ color: isHovered && isActive ? `rgb(${market.accentRgb})` : (isNear ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)') }}
          >
            {market.name}
          </h2>

          {/* Subtitle */}
          <p className="text-xs font-medium tracking-wide mb-5 transition-colors duration-300"
            style={{ color: isNear ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)' }}
          >
            {market.subtitle}
          </p>

          {/* Divider */}
          <div className="h-px mb-4 transition-all duration-500" style={{
            background: isNear
              ? `linear-gradient(90deg, transparent, rgba(${market.accentRgb}, ${isHovered ? 0.35 : 0.12}), transparent)`
              : 'rgba(255,255,255,0.03)',
          }} />

          {/* Stats */}
          <p className="text-[11px] font-mono tracking-wide transition-colors duration-300"
            style={{ color: isNear ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}
          >
            {market.stats}
          </p>

          {/* Module chips */}
          {isActive && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {['Terminal', 'Trade', 'Signals', 'Watch'].map(mod => (
                <span key={mod}
                  className="px-2 py-0.5 rounded-md text-[8px] font-bold tracking-wider border transition-all duration-300"
                  style={{
                    backgroundColor: isHovered ? `rgba(${market.accentRgb}, 0.1)` : 'rgba(255,255,255,0.02)',
                    color: isHovered ? `rgba(${market.accentRgb}, 0.7)` : (isNear ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'),
                    borderColor: isHovered ? `rgba(${market.accentRgb}, 0.15)` : 'rgba(255,255,255,0.03)',
                  }}
                >
                  {mod}
                </span>
              ))}
            </div>
          )}

          {/* Enter CTA */}
          {isActive && (
            <div className="mt-5 flex items-center gap-2 transition-all duration-300"
              style={{ color: isHovered ? `rgb(${market.accentRgb})` : (isNear ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)') }}
            >
              <span className="text-xs font-bold tracking-widest uppercase">Enter</span>
              <svg className="w-4 h-4 transition-transform duration-300" style={{ transform: isHovered ? 'translateX(4px)' : 'translateX(0)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
