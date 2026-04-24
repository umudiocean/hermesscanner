'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowRight, Heart, Sparkles, Lightbulb, Star, X } from 'lucide-react'
import { Badge, Button, Dialog } from '@/components/ui'
import { HermesLogo } from '@/components/shell/HermesLogo'
import { LiveTickerTape } from '@/components/shell/LiveTickerTape'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Market Launcher (Premium Redesign)
// Static institutional landing → live ticker → market grid → mission
// No more spotlight/beam-cone novelty. Clean, fast, focused.
// ═══════════════════════════════════════════════════════════════════

export type MarketId = 'nasdaq' | 'crypto' | 'bist100' | 'forex' | 'fund'

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
  { id: 'nasdaq', name: 'NASDAQ',   subtitle: 'US Equities & Technology', icon: '🇺🇸', accentRgb: '212,184,106', stats: 'Tüm NASDAQ hisseleri · Neural Core', status: 'active', badge: 'LIVE' },
  { id: 'crypto', name: 'CRYPTO',   subtitle: 'Digital Assets & DeFi',     icon: '₿',   accentRgb: '245,158,11',  stats: 'Tüm coinler · CoinGecko Analyst',    status: 'active', badge: 'LIVE' },
  { id: 'fund',   name: 'HERMES FON', subtitle: 'Topluluk Fonu · BSC',     icon: '🏦',  accentRgb: '168,85,247',  stats: 'On-chain · Smart Contract',           status: 'active', badge: 'LIVE' },
  { id: 'bist100',name: 'BIST 100',  subtitle: 'Borsa İstanbul',           icon: '🇹🇷', accentRgb: '239,68,68',   stats: 'Tüm BIST hisseleri',                   status: 'coming_soon' },
  { id: 'forex',  name: 'FOREX',    subtitle: 'Major & Cross Pairs',       icon: '💱',  accentRgb: '63,202,180',  stats: 'Tüm major pariteler',                  status: 'coming_soon' },
]

interface MarketLauncherProps {
  onSelectMarket: (market: MarketId) => void
}

export default function MarketLauncher({ onSelectMarket }: MarketLauncherProps) {
  const [missionOpen, setMissionOpen] = useState(false)

  return (
    <div className="relative min-h-screen bg-surface-0 overflow-x-hidden">
      {/* ─── Ambient backgrounds (GPU-light, no JS) ─── */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        {/* Aurora top */}
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full opacity-[0.20]"
             style={{ background: 'radial-gradient(closest-side, rgba(212,184,106,0.55), transparent 70%)', filter: 'blur(60px)' }} />
        {/* Aurora bottom-left */}
        <div className="absolute bottom-0 -left-[10%] w-[700px] h-[700px] rounded-full opacity-[0.10]"
             style={{ background: 'radial-gradient(closest-side, rgba(99,102,241,0.50), transparent 70%)', filter: 'blur(70px)' }} />
        {/* Subtle noise grain */}
        <div className="absolute inset-0 opacity-[0.05] bg-noise mix-blend-overlay" />
        {/* Neural dot grid */}
        <div className="absolute inset-0 opacity-[0.06]"
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,184,106,0.7) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      {/* ─── Top utility bar: socials + Hermes Coin CTA ─── */}
      <div className="relative z-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 sm:pt-5 flex items-center justify-end gap-2">
          <span className="hidden sm:inline-flex items-center text-2xs font-semibold tracking-wide text-gold-300/80 mr-1">
            <Sparkles size={12} className="mr-1.5" /> Katıl Bize
          </span>
          <SocialIcon
            href="https://t.me/hermes_ai_trade"
            label="Telegram"
            colorHex="#26A5E4"
            path="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
          />
          <SocialIcon
            href="https://x.com/Hermes_ai_app"
            label="X"
            colorHex="#FFFFFF"
            path="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          />
          <SocialIcon
            href="https://www.linkedin.com/in/umut-tugrul-1147b0372/"
            label="LinkedIn"
            colorHex="#0A66C2"
            path="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
          />
          <a
            href="https://pancakeswap.finance/swap?outputCurrency=0x9495aB3549338BF14aD2F86CbcF79C7b574bba37"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold tracking-wide',
              'bg-gradient-to-r from-gold-500 to-gold-400 text-surface-0',
              'shadow-glow-gold hover:shadow-depth-3 transition-all duration-150 ease-snap',
              'active:scale-[0.98]',
            )}
            title="HERMES Coin satın al"
          >
            HERMES <span className="hidden sm:inline">Coin</span> Satın Al
          </a>
        </div>
      </div>

      {/* ─── Hero ─── */}
      <section className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 text-center">
        <div className="inline-flex items-center justify-center mb-6">
          <HermesLogo size={72} className="rounded-2xl" />
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tightest text-text-primary leading-[1.05]">
          <span className="block">HERMES <span className="bg-gradient-to-r from-gold-400 via-gold-300 to-gold-400 bg-clip-text text-transparent font-extrabold">AI</span></span>
        </h1>

        <div className="mx-auto my-5 h-px w-48 bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

        <p className="text-sm sm:text-base font-medium tracking-[0.3em] uppercase text-text-tertiary">
          Institutional Multi-Market Terminal
        </p>
        <p className="mt-2 text-xs sm:text-sm font-medium tracking-widest text-text-quaternary">
          Pure Z-Score Strategy · Real-Time Analysis · Neural Core
        </p>

        {/* Slogan */}
        <div className="mt-10 max-w-2xl mx-auto">
          <p className="text-lg sm:text-xl md:text-2xl font-semibold leading-snug text-text-secondary tracking-tight">
            Veriye hükmeden,{' '}
            <span className="bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent font-bold">
              paraya hükmeder.
            </span>
          </p>
          <p className="mt-2 text-sm sm:text-base text-text-tertiary">
            HERMES AI ile güç artık <span className="text-text-primary font-semibold">herkesin.</span>
          </p>
        </div>

        {/* Platform badges */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="success" size="md">%100 ÜCRETSİZ</Badge>
          <Badge tone="info"    size="md">%100 YAPAY ZEKA</Badge>
          <Badge tone="gold"    size="md">TÜRKÇE</Badge>
        </div>
      </section>

      {/* ─── Live Ticker Tape ─── */}
      <div className="relative z-10 mb-10">
        <LiveTickerTape />
      </div>

      {/* ─── Market Grid ─── */}
      <section className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {MARKETS.map((market) => (
            <MarketCard key={market.id} market={market} onSelect={onSelectMarket} />
          ))}
        </div>
      </section>

      {/* ─── Darüşşafaka Mission Section ─── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 mt-16 sm:mt-24">
        <div className="relative rounded-2xl border border-stroke-gold bg-surface-2/60 backdrop-blur-sm overflow-hidden shadow-glass">
          <div className="h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />

          <div className="p-5 sm:p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
            {/* Image */}
            <div className="relative shrink-0 w-40 h-52 sm:w-48 sm:h-64 md:w-56 md:h-72 rounded-2xl overflow-hidden border border-stroke">
              <Image
                src="/images/hermes-darussafaka.png"
                alt="Hermes AI ile bir çocuğa ışık ol"
                fill
                className="object-cover object-top"
                sizes="(max-width: 768px) 160px, 224px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-0/70 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <Badge tone="gold" size="xs" className="mx-auto">DARÜŞŞAFAKA</Badge>
              </div>
            </div>

            {/* Story */}
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-text-primary leading-tight tracking-tight">
                Hayatta bazı yatırımlar vardır;{' '}
                <span className="bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent">
                  karşılığı parayla ölçülmez.
                </span>
              </h3>

              <div className="mt-4 pl-4 border-l-2 border-stroke-gold-strong space-y-2.5">
                <p className="text-sm text-text-tertiary leading-relaxed">
                  Annesini çok erken yaşta kaybetmiş ve kendi imkânlarıyla okuyarak bugünlere ulaşmış biri olarak,
                  eğitimin bir çocuğun hayatındaki değerini çok iyi biliyorum.
                </p>
                <p className="text-sm text-text-tertiary leading-relaxed">
                  Kazandığımız tüm geliri, maddi imkânları sınırlı çocukların eğitimi için{' '}
                  <span className="text-gold-300 font-semibold">Darüşşafaka</span>&#39;ya bağışlıyoruz.
                </p>
              </div>

              <p className="mt-5 text-sm sm:text-base font-medium text-text-secondary italic leading-relaxed">
                &ldquo;Gerçek başarı, bir hayatın değişmesine vesile olmaktır. Bana verilebilecek en güzel hediye —
                bir çocuğun gözlerindeki <span className="text-gold-300 font-bold not-italic">umuttur.</span>&rdquo;
              </p>

              <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
                <a
                  href="https://fonzip.com/darussafaka/fundraising-campaigns/hermes-ai-ile-gelecege-yatirim"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'group inline-flex items-center gap-2.5 h-11 px-5 rounded-lg',
                    'bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500 text-surface-0',
                    'font-bold text-sm tracking-wide',
                    'shadow-glow-gold hover:shadow-depth-3',
                    'transition-all duration-150 ease-snap active:scale-[0.98]',
                  )}
                >
                  <Heart size={16} fill="currentColor" />
                  Bağış Yap ve Umut Ol
                  <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                </a>
                <button
                  onClick={() => setMissionOpen(true)}
                  className="text-xs text-text-tertiary hover:text-text-primary underline underline-offset-2 transition-colors"
                >
                  Hikayemizin tamamı →
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-gold-400/25 to-transparent" />
        </div>
      </section>

      {/* ─── Footer signature ─── */}
      <div className="relative z-10 text-center mt-12 mb-10">
        <p className="text-2xs tracking-[0.3em] uppercase font-medium text-text-quaternary">
          Neural Core · Pure Z-Score · Multi-Market Intelligence
        </p>
      </div>

      {/* ─── Mission Modal (now using Dialog primitive) ─── */}
      <Dialog open={missionOpen} onClose={() => setMissionOpen(false)} size="lg" ariaLabel="Hermes AI misyon">
        <MissionModalContent onClose={() => setMissionOpen(false)} />
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MARKET CARD — clean, premium, hover-lift, no mouse-spotlight
// ═══════════════════════════════════════════════════════════════════

function MarketCard({
  market,
  onSelect,
}: {
  market: MarketConfig
  onSelect: (id: MarketId) => void
}) {
  const isActive = market.status === 'active'
  const accent = `rgb(${market.accentRgb})`
  const accentSoft = `rgba(${market.accentRgb},0.12)`
  const accentMid = `rgba(${market.accentRgb},0.40)`

  return (
    <button
      onClick={() => isActive && onSelect(market.id)}
      disabled={!isActive}
      className={cn(
        'group relative text-left rounded-2xl overflow-hidden',
        'bg-surface-2/70 backdrop-blur-md border border-stroke',
        'transition-all duration-250 ease-snap',
        isActive
          ? 'cursor-pointer hover:bg-surface-3/80 hover:-translate-y-0.5 hover:shadow-depth-3 hover:border-stroke-strong'
          : 'cursor-default opacity-70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
      )}
      style={{
        // Subtle accent border on hover via box-shadow
      }}
      onMouseEnter={(e) => {
        if (!isActive) return
        e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${accentMid}, 0 0 24px ${accentSoft}`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 inset-x-0 h-px transition-opacity duration-200 opacity-30 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      {/* Status badge */}
      <div className="absolute top-4 right-4 z-10">
        {market.badge && (
          <Badge tone="success" size="xs" dot pulse className="font-mono">
            {market.badge}
          </Badge>
        )}
        {market.status === 'coming_soon' && (
          <Badge tone="neutral" size="xs">SOON</Badge>
        )}
      </div>

      <div className="relative p-5 sm:p-6">
        {/* Icon (with subtle accent halo) */}
        <div className="relative mb-5 inline-block">
          <div
            className="absolute -inset-3 rounded-full opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300"
            style={{ backgroundColor: accent }}
          />
          <span className="relative text-4xl block transition-transform duration-200 group-hover:scale-110">
            {market.icon}
          </span>
        </div>

        {/* Name */}
        <h2
          className="text-xl font-bold tracking-tight transition-colors duration-200"
          style={{
            color: isActive ? undefined : undefined,
          }}
        >
          <span className="text-text-primary group-hover:text-[var(--accent-color)]"
                style={{ ['--accent-color' as string]: accent }}>
            {market.name}
          </span>
        </h2>

        {/* Subtitle */}
        <p className="mt-1 text-xs font-medium text-text-tertiary leading-snug">
          {market.subtitle}
        </p>

        {/* Divider */}
        <div className="my-4 h-px bg-stroke" />

        {/* Stats */}
        <p className="text-2xs font-mono tracking-wide text-text-quaternary">
          {market.stats}
        </p>

        {/* Module chips */}
        {isActive && (
          <div className="mt-4 flex flex-wrap gap-1">
            {['Terminal', 'Trade', 'Signals', 'Watch'].map(mod => (
              <span
                key={mod}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border border-stroke text-text-tertiary group-hover:border-stroke-strong group-hover:text-text-secondary transition-colors"
              >
                {mod}
              </span>
            ))}
          </div>
        )}

        {/* Enter CTA */}
        {isActive && (
          <div className="mt-5 flex items-center gap-1.5 text-text-tertiary group-hover:text-gold-400 transition-colors duration-150">
            <span className="text-2xs font-bold tracking-widest uppercase">Enter</span>
            <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-1" />
          </div>
        )}
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SOCIAL ICON
// ═══════════════════════════════════════════════════════════════════

function SocialIcon({
  href,
  label,
  colorHex,
  path,
}: {
  href: string
  label: string
  colorHex: string
  path: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
        'bg-surface-2 border border-stroke text-text-secondary',
        'hover:bg-surface-3 hover:border-stroke-strong',
        'transition-all duration-150 ease-snap hover:scale-105',
      )}
      style={{ ['--brand' as string]: colorHex }}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" style={{ color: colorHex }} fill="currentColor">
        <path d={path} />
      </svg>
    </a>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MISSION MODAL CONTENT
// ═══════════════════════════════════════════════════════════════════

function MissionModalContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Kapat"
        className={cn(
          'absolute top-4 right-4 z-10 w-8 h-8 rounded-full',
          'bg-surface-3 border border-stroke text-text-tertiary',
          'hover:bg-surface-4 hover:text-text-primary transition-all duration-150',
          'flex items-center justify-center',
        )}
      >
        <X size={14} />
      </button>

      {/* Banner */}
      <div className="relative w-full h-48 sm:h-64 overflow-hidden rounded-t-2xl">
        <Image
          src="/images/hermes-darussafaka.png"
          alt="Hermes AI · Darüşşafaka"
          fill
          className="object-cover object-center"
          sizes="800px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-2 via-surface-2/60 to-transparent" />
        <div className="absolute bottom-4 left-6 right-6">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-tight">
            HERMES AI ile{' '}
            <span className="bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent">
              bir çocuğa ışık ol
            </span>
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 sm:p-8 max-h-[60vh] overflow-y-auto space-y-6">
        <Section icon={<Star size={14} />} tone="violet" title="Vizyon">
          Seeking Alpha, TipRanks ve benzeri global platformlardan daha fazlasını
          {' '}<span className="text-gold-300 font-semibold">HERMES AI tamamen ücretsiz ve Türkçe</span> olarak sunuyor.
          Bu yazılımı 7 yıllık bir emekle inşa ettim. Bilgiye erişimi herkese ücretsiz açmayı seçtim.
        </Section>

        <Section icon={<Lightbulb size={14} />} tone="success" title="Neden Ücretsiz?">
          HERMES AI yalnızca ticari bir yazılım değil.{' '}
          <span className="text-text-primary font-medium">Finansal özgürlüğün herkes için mümkün olduğuna</span> inanan bir vizyondur.
          Kurucusu olarak zaten kazanıyorum. Platformu ücretli bir modele taşımak yerine, bilgiyi paylaşmayı seçtim.
        </Section>

        <Section icon={<Sparkles size={14} />} tone="gold" title="Amacımız">
          <ul className="space-y-1.5 mt-1">
            <Bullet>Türk gençlerinin yanlış yatırım kararlarını doğru kararlarla değiştirmesine yardımcı olmak</Bullet>
            <Bullet>Veri temelli düşünmeyi yaygınlaştırmak</Bullet>
            <Bullet>Bilgiye erişimi olanın güçlü olduğu bu dünyada, gücü eşitlemek</Bullet>
          </ul>
        </Section>

        <div className="h-px bg-stroke" />

        <div className="pl-4 border-l-2 border-stroke-gold-strong">
          <p className="text-sm text-text-secondary italic leading-relaxed">
            &ldquo;Annesini çok erken yaşta kaybetmiş ve kendi imkânlarıyla okuyarak bugünlere ulaşmış biri olarak,
            eğitimin bir çocuğun hayatındaki değerini çok iyi biliyorum. Bu kampanyayı da annesi veya babası hayatta
            olmayan çocukların eğitimine katkı sunabilmek için oluşturuyorum.&rdquo;
          </p>
        </div>

        <div className="text-center space-y-2">
          <p className="text-base font-semibold text-text-primary leading-relaxed">
            Kazandığımız tüm geliri, maddi imkânları sınırlı çocukların eğitimi için{' '}
            <span className="bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent font-bold">Darüşşafaka&#39;ya</span> bağışlıyoruz.
          </p>
          <p className="text-sm text-text-tertiary">
            Gerçek kazanç, bir çocuğun yarınlara umutla bakabilmesidir.<br />
            Gerçek başarı, bir hayatın değişmesine vesile olmaktır.
          </p>
          <p className="text-sm font-medium text-gold-300 italic mt-2">
            &ldquo;Bana verilebilecek en güzel hediye; bir çocuğun gözlerindeki umuttur.&rdquo;
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            variant="primary"
            size="lg"
            leftIcon={<Heart size={16} fill="currentColor" />}
            rightIcon={<ArrowRight size={14} />}
            onClick={() => window.open('https://fonzip.com/darussafaka/fundraising-campaigns/hermes-ai-ile-gelecege-yatirim', '_blank')}
          >
            Bağış Yap ve Umut Ol
          </Button>
          <p className="text-2xs text-text-quaternary tracking-wide">
            Darüşşafaka Cemiyeti resmi bağış sayfası (Fonzip)
          </p>
        </div>

        {/* Hermes Coin note */}
        <div className="rounded-xl bg-surface-3 border border-stroke p-4 text-center">
          <p className="text-xs text-text-tertiary leading-relaxed">
            HERMES AI ekosisteminin parçası olan{' '}
            <span className="text-gold-300 font-semibold">HERMES Coin</span> (BSC Smart Contract) ileride
            platform içi bazı premium avantajlara erişim sağlayabilir.
          </p>
          <p className="mt-2 text-2xs text-text-quaternary font-mono break-all">
            0x9495aB3549338BF14aD2F86CbcF79C7b574bba37
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({
  icon,
  tone,
  title,
  children,
}: {
  icon: React.ReactNode
  tone: 'gold' | 'success' | 'violet'
  title: string
  children: React.ReactNode
}) {
  const toneClasses = {
    gold: 'bg-gold-400/15 text-gold-300 border-stroke-gold-strong',
    success: 'bg-success-400/15 text-success-300 border-success-400/30',
    violet: 'bg-info-400/15 text-info-400 border-info-400/30',
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('w-6 h-6 rounded-md flex items-center justify-center border', toneClasses[tone])}>
          {icon}
        </span>
        <h3 className="text-xs font-bold text-text-primary tracking-widest uppercase">{title}</h3>
      </div>
      <div className="text-sm text-text-tertiary leading-relaxed">{children}</div>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-text-tertiary">
      <span className="text-gold-400/70 mt-0.5 shrink-0">▸</span>
      <span>{children}</span>
    </li>
  )
}
