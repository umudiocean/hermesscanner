'use client'

import { useState, useMemo, useEffect, useRef } from 'react'

// ================================================================
// HERMES AI CRYPTO INDEX — Kripto Piyasasinin Kalbi (VITRIN)
// CoinGecko + Trade AI verilerini birlestirerek kripto piyasasinin
// genel durumunu tek bir composite endeks olarak gosterir.
// ================================================================

interface CoinData {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  price_change_percentage_24h: number
  price_change_percentage_7d_in_currency?: number
  total_volume: number
}

interface MarketDashboard {
  fearGreed?: { index: number; label: string; components?: Record<string, number> }
  btcDominance?: number
  ethDominance?: number
  totalMarketCap?: number
  total24hVolume?: number
  activeCryptos?: number
  topGainers?: CoinData[]
  topLosers?: CoinData[]
  trending?: { coins?: Array<{ item: { id: string; symbol: string; name: string; thumb: string; data?: { price_change_percentage_24h?: Record<string, number> } } }> }
}

// ─── AnimatedNumber ───
function AnimatedNumber({ value, decimals = 1, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef<number>(0)
  useEffect(() => {
    const start = display
    const end = value
    const duration = 800
    const t0 = performance.now()
    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(start + (end - start) * eased)
      if (p < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

function formatMcap(mc: number): string {
  if (!mc) return '-'
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`
  return `$${mc.toFixed(0)}`
}

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  return `$${p.toFixed(6)}`
}

// ─── Pulse Gauge ───
function CryptoPulseGauge({ score, label, size = 160 }: { score: number; label: string; size?: number }) {
  const getTheme = (s: number) => {
    if (s <= 20) return { color: '#EF4444', glow: 'rgba(239,68,68,0.3)', text: 'EXTREME FEAR' }
    if (s <= 35) return { color: '#fb923c', glow: 'rgba(251,146,60,0.25)', text: 'FEAR' }
    if (s <= 50) return { color: '#94a3b8', glow: 'rgba(148,163,184,0.15)', text: 'NEUTRAL' }
    if (s <= 65) return { color: '#62CBC1', glow: 'rgba(98,203,193,0.25)', text: 'GREED' }
    return { color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', text: 'EXTREME GREED' }
  }
  const t = getTheme(score)
  const r = 52, circ = 2 * Math.PI * r, dash = (score / 100) * circ

  return (
    <div className="flex flex-col items-center animate-heartbeat">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-[-8px] rounded-full animate-radial-pulse" style={{ background: `radial-gradient(circle, ${t.glow}, transparent 70%)` }} />
        <svg className="w-full h-full -rotate-90 drop-shadow-lg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/[0.04]" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={t.color} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="transition-all duration-1000" style={{ filter: `drop-shadow(0 0 6px ${t.glow})` }} />
          {[0, 25, 50, 75, 100].map(v => {
            const angle = (v / 100) * 360 - 90
            const rad = (angle * Math.PI) / 180
            return <line key={v} x1={60 + 44 * Math.cos(rad)} y1={60 + 44 * Math.sin(rad)} x2={60 + 48 * Math.cos(rad)} y2={60 + 48 * Math.sin(rad)} stroke="white" strokeWidth="1" strokeOpacity="0.15" />
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black tabular-nums animate-number-glow" style={{ color: t.color }}>{Math.round(score)}</span>
          <span className="text-[9px] font-bold tracking-wider mt-0.5" style={{ color: t.color }}>{label || t.text}</span>
        </div>
      </div>
      <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mt-2">Kripto Nabzi</span>
    </div>
  )
}

// ─── StatCard ───
function StatCard({ title, value, sub, icon, color = 'text-amber-300', className = '' }: {
  title: string; value: string | number; sub?: string; icon: string; color?: string; className?: string
}) {
  return (
    <div className={`group relative bg-[#141414] rounded-xl border border-amber-400/8 p-3.5 hover:border-amber-400/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-400/5 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-amber-400/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base group-hover:scale-110 transition-transform duration-300">{icon}</span>
          <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">{title}</span>
        </div>
        <div className={`text-xl font-black tabular-nums ${color}`}>{value}</div>
        {sub && <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Dominance Bar ───
function DominanceBar({ btc, eth }: { btc: number; eth: number }) {
  const others = Math.max(0, 100 - btc - eth)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Piyasa Hakimiyeti</span>
      </div>
      <div className="flex h-6 rounded-xl overflow-hidden border border-white/[0.06]">
        <div style={{ width: `${btc}%` }} className="bg-amber-500 flex items-center justify-center transition-all duration-700 relative group hover:brightness-110">
          <span className="text-[9px] font-bold text-black/80">BTC {btc.toFixed(1)}%</span>
        </div>
        <div style={{ width: `${eth}%` }} className="bg-violet-500 flex items-center justify-center transition-all duration-700 relative group hover:brightness-110">
          <span className="text-[9px] font-bold text-white/80">ETH {eth.toFixed(1)}%</span>
        </div>
        <div style={{ width: `${others}%` }} className="bg-white/10 flex items-center justify-center transition-all duration-700">
          {others > 10 && <span className="text-[9px] text-white/40">Alts {others.toFixed(0)}%</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Top Movers ───
function CryptoMovers({ title, items, color, icon }: {
  title: string; icon: string; color: string
  items: CoinData[]
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">{title}</span>
      </div>
      <div className="space-y-1">
        {items.slice(0, 5).map((coin, i) => (
          <div key={coin.id} className="group flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200 hover:translate-x-1 cursor-default">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-white/20 w-3 font-mono">{i + 1}</span>
              {coin.image && <img src={coin.image} alt="" className="w-4 h-4 rounded-full" />}
              <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors uppercase">{coin.symbol}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 tabular-nums font-mono">{formatPrice(coin.current_price)}</span>
              <span className={`text-xs font-bold tabular-nums ${color} group-hover:scale-110 transition-transform origin-right`}>
                {(coin.price_change_percentage_24h ?? 0) >= 0 ? '+' : ''}{(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Trending Coins ───
function TrendingCoins({ items }: { items: Array<{ item: { id: string; symbol: string; name: string; thumb: string; data?: { price_change_percentage_24h?: Record<string, number> } } }> }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">🔥</span>
        <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Trend Coinler</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {items.slice(0, 6).map((t, i) => {
          const change = t.item.data?.price_change_percentage_24h?.usd ?? 0
          return (
            <div key={t.item.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200 hover:scale-[1.02] cursor-default" style={{ animationDelay: `${i * 50}ms` }}>
              {t.item.thumb && <img src={t.item.thumb} alt="" className="w-5 h-5 rounded-full" />}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-white/70 uppercase block truncate">{t.item.symbol}</span>
                <span className={`text-[9px] tabular-nums font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Ticker Tape ───
function TickerTape({ items }: { items: Array<{ symbol: string; price: number; change: number }> }) {
  if (items.length === 0) return null
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden relative h-7 border-y border-amber-400/[0.06] bg-[#0a0a0a]">
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10" />
      <div className="flex items-center gap-6 animate-[scroll-x_30s_linear_infinite] whitespace-nowrap py-1">
        {doubled.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="flex items-center gap-1.5 text-[10px]">
            <span className="font-bold text-white/50 uppercase">{item.symbol}</span>
            <span className="text-white/35 tabular-nums font-mono">{formatPrice(item.price)}</span>
            <span className={`font-semibold tabular-nums ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {item.change >= 0 ? '▲' : '▼'}{Math.abs(item.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
      <style>{`@keyframes scroll-x { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
    </div>
  )
}

// ─── Signal Summary from Trade AI coins ───
function CryptoSignalSummary({ coins }: { coins: CoinData[] }) {
  const stats = useMemo(() => {
    const signals = { strong_long: 0, long: 0, neutral: 0, short: 0, strong_short: 0 }
    for (const c of coins) {
      const change = c.price_change_percentage_24h || 0
      const change7d = c.price_change_percentage_7d_in_currency || 0
      const momentum = (change * 0.3 + (change7d || 0) * 0.4) / 10
      const score = Math.round(Math.max(0, Math.min(100, 50 + Math.tanh(momentum / 1.8) * 50)))
      if (score <= 20) signals.strong_long++
      else if (score <= 30) signals.long++
      else if (score >= 90) signals.strong_short++
      else if (score >= 70) signals.short++
      else signals.neutral++
    }
    return signals
  }, [coins])

  const total = coins.length
  const segments = [
    { key: 'strong_long' as const, color: '#f59e0b', label: 'S.LONG' },
    { key: 'long' as const, color: '#62CBC1', label: 'LONG' },
    { key: 'neutral' as const, color: '#64748b', label: 'NOTR' },
    { key: 'short' as const, color: '#fb923c', label: 'SHORT' },
    { key: 'strong_short' as const, color: '#EF4444', label: 'S.SHORT' },
  ]
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚡</span>
          <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Sinyal Dagilimi</span>
        </div>
        <span className="text-[10px] text-white/25">{total} coin</span>
      </div>
      <div className="flex h-8 rounded-xl overflow-hidden border border-white/[0.06] shadow-inner mb-2">
        {segments.map(s => {
          const count = stats[s.key]
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct < 0.3) return null
          const isHov = hovered === s.key
          return (
            <div key={s.key} onMouseEnter={() => setHovered(s.key)} onMouseLeave={() => setHovered(null)}
              style={{ width: `${pct}%`, backgroundColor: s.color, boxShadow: isHov ? `0 0 20px ${s.color}40` : 'none' }}
              className={`transition-all duration-300 relative cursor-default ${isHov ? 'brightness-125 z-10 scale-y-110' : ''}`}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                {pct > 6 && <span className={`text-[10px] font-bold ${isHov ? 'text-white scale-110' : 'text-white/70'}`}>{count}</span>}
              </div>
              {isHov && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-2.5 py-1 rounded-lg shadow-xl z-20 whitespace-nowrap animate-scale-pop">
                  <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.label}: {count}</span>
                  <span className="text-[10px] text-white/40 ml-1.5">({pct.toFixed(1)}%)</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between px-1">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-1 cursor-default" onMouseEnter={() => setHovered(s.key)} onMouseLeave={() => setHovered(null)}>
            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${hovered === s.key ? 'scale-125' : ''}`} style={{ backgroundColor: s.color }} />
            <span className={`text-[9px] ${hovered === s.key ? 'text-white/70' : 'text-white/25'}`}>{s.label}</span>
            <span className={`text-[10px] font-bold tabular-nums ${hovered === s.key ? 'text-white/90' : 'text-white/40'}`}>{stats[s.key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function ModuleCryptoIndex() {
  const [coins, setCoins] = useState<CoinData[]>([])
  const [marketData, setMarketData] = useState<MarketDashboard>({})
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        setLoading(true)
        const [marketRes, coinsRes] = await Promise.all([
          fetch('/api/crypto-terminal/market'),
          fetch('/api/crypto-terminal/coins?page=1&per_page=250'),
        ])
        if (!cancelled) {
          if (marketRes.ok) { const d = await marketRes.json(); setMarketData(d) }
          if (coinsRes.ok) { const d = await coinsRes.json(); setCoins(d.coins || []) }
        }
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false) }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const indexStats = useMemo(() => {
    if (coins.length === 0 && !marketData.fearGreed) return null

    const n = coins.length
    let totalChange = 0, totalMcap = 0, totalVolume = 0
    for (const c of coins) {
      totalChange += c.price_change_percentage_24h || 0
      totalMcap += c.market_cap || 0
      totalVolume += c.total_volume || 0
    }
    const avgChange = n > 0 ? totalChange / n : 0

    const fgScore = marketData.fearGreed?.index ?? 50
    const fgLabel = marketData.fearGreed?.label ?? ''

    const direction = fgScore >= 70 ? 'EXTREME GREED' :
      fgScore >= 55 ? 'GREED' :
      fgScore <= 30 ? 'EXTREME FEAR' :
      fgScore <= 45 ? 'FEAR' : 'NEUTRAL'
    const dirColor = direction.includes('GREED') ? 'text-amber-400' :
      direction.includes('FEAR') ? 'text-red-400' : 'text-white/50'
    const dirIcon = direction.includes('GREED') ? '🚀' : direction.includes('FEAR') ? '🔻' : '⚖️'

    const topGainers: CoinData[] = (marketData.topGainers || [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 5)) as CoinData[]
    const topLosers: CoinData[] = (marketData.topLosers || [...coins].sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)).slice(0, 5)) as CoinData[]
    const tickerItems = coins.slice(0, 30).map(c => ({ symbol: c.symbol, price: c.current_price || 0, change: c.price_change_percentage_24h || 0 }))
    const trending = marketData.trending?.coins || []

    return {
      n, avgChange, totalMcap, totalVolume,
      fgScore, fgLabel, direction, dirColor, dirIcon,
      btcDom: marketData.btcDominance || 0,
      ethDom: marketData.ethDominance || 0,
      activeCryptos: marketData.activeCryptos || 0,
      topGainers, topLosers, tickerItems, trending,
      fgComponents: marketData.fearGreed?.components,
    }
  }, [coins, marketData])

  if (loading && !indexStats) {
    return (
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-8">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 sm:gap-5">
          <div className="relative">
            <div className="w-20 h-20 border-[3px] border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl sm:text-2xl animate-pulse">₿</span></div>
          </div>
          <div className="text-center">
            <span className="text-sm block font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">HERMES AI CRYPTO INDEX</span>
            <span className="text-white/20 text-xs mt-1 block">Kripto piyasa verilerini birlestiriyor...</span>
          </div>
          <div className="flex gap-2 mt-2">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-2 h-2 rounded-full bg-amber-400/30 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
          </div>
        </div>
      </div>
    )
  }

  if (!indexStats) {
    return (
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-8">
        <div className="text-center py-12 sm:py-24">
          <div className="text-5xl sm:text-7xl mb-3 sm:mb-5 animate-float">₿</div>
          <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent inline-block">HERMES AI CRYPTO INDEX</h3>
          <p className="text-white/25 text-sm max-w-md mx-auto mt-2">Kripto piyasa verileri yuklenemedi. Lutfen tekrar deneyin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4 ${mounted ? 'animate-fade-in' : ''}`}>
      {/* ═══ HEADER ═══ */}
      <div className="mb-2 sm:mb-4 stagger-1">
        <div className="flex items-center gap-2 sm:gap-3 mb-1">
          <span className="text-xl sm:text-2xl animate-float">₿</span>
          <h2 className="text-base sm:text-lg font-black tracking-wide">
            <span className="text-white/90">HERMES</span>
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent ml-1.5 font-extrabold">AI CRYPTO INDEX</span>
          </h2>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400/60 font-bold border border-amber-400/15 animate-border-shimmer">
            {indexStats.n > 0 ? `${indexStats.n} COIN` : `${indexStats.activeCryptos} AKTIF`}
          </span>
          {loading && <div className="w-3 h-3 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />}
        </div>
        <p className="text-[11px] text-white/25 ml-6 sm:ml-10">
          Kripto piyasasinin nabzi — Fear & Greed, hakimiyet, trendler ve sinyaller
        </p>
      </div>

      {/* ═══ TICKER TAPE ═══ */}
      <div className="mb-2 sm:mb-4 stagger-2 rounded-xl overflow-hidden">
        <TickerTape items={indexStats.tickerItems} />
      </div>

      {/* ═══ TOP ROW ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-2 sm:mb-4">
        {/* Pulse Gauge */}
        <div className="stagger-2 bg-[#111111] rounded-2xl border border-amber-400/10 p-3 sm:p-4 lg:p-6 flex items-center justify-center hover:border-amber-400/20 transition-all duration-500">
          <CryptoPulseGauge score={indexStats.fgScore} label={indexStats.fgLabel} />
        </div>

        {/* Direction + Dominance */}
        <div className="stagger-3 bg-[#111111] rounded-2xl border border-amber-400/10 p-3 sm:p-4 lg:p-5 flex flex-col justify-between hover:border-amber-400/20 transition-all duration-500">
          <div className="animate-scale-pop text-center mb-2 sm:mb-3">
            <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 backdrop-blur-sm ${
              indexStats.direction.includes('GREED') ? 'border-amber-500/30 bg-amber-500/[0.06] shadow-lg shadow-amber-500/10' :
              indexStats.direction.includes('FEAR') ? 'border-red-500/30 bg-red-500/[0.06] shadow-lg shadow-red-500/10' :
              'border-white/10 bg-white/[0.03]'
            }`}>
              <span className="text-xl sm:text-2xl">{indexStats.dirIcon}</span>
              <span className={`text-base sm:text-xl font-black tracking-wide ${indexStats.dirColor}`}>{indexStats.direction}</span>
            </div>
          </div>
          <DominanceBar btc={indexStats.btcDom} eth={indexStats.ethDom} />
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Ort. 24s Degisim</span>
              <span className={`text-sm font-bold tabular-nums ${indexStats.avgChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <AnimatedNumber value={indexStats.avgChange} prefix={indexStats.avgChange >= 0 ? '+' : ''} suffix="%" />
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 stagger-4">
          <StatCard title="Toplam Mcap" value={formatMcap(marketData.totalMarketCap || indexStats.totalMcap)} icon="🏦" color="text-white/60" />
          <StatCard title="24s Hacim" value={formatMcap(marketData.total24hVolume || indexStats.totalVolume)} icon="📊" color="text-amber-300" />
          <StatCard title="BTC Dominance" value={`${indexStats.btcDom.toFixed(1)}%`} icon="₿" color="text-amber-400" sub={indexStats.btcDom > 50 ? 'BTC Sezonu' : 'Altcoin Sezonu'} />
          <StatCard title="Aktif Coin" value={indexStats.activeCryptos.toLocaleString()} icon="🪙" color="text-white/50" />
        </div>
      </div>

      {/* ═══ SIGNAL DISTRIBUTION ═══ */}
      {coins.length > 0 && (
        <div className="stagger-5 bg-[#111111] rounded-2xl border border-amber-400/10 p-3 sm:p-4 lg:p-5 mb-2 sm:mb-4 hover:border-amber-400/20 transition-all duration-500">
          <CryptoSignalSummary coins={coins} />
        </div>
      )}

      {/* ═══ F&G COMPONENTS ═══ */}
      {indexStats.fgComponents && (
        <div className="bg-[#111111] rounded-2xl border border-amber-400/10 p-3 sm:p-4 lg:p-5 mb-2 sm:mb-4 hover:border-amber-400/20 transition-all duration-500">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span className="text-sm">🧪</span>
            <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Fear & Greed Bilesenleri</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(indexStats.fgComponents).map(([key, val]) => {
              const labels: Record<string, string> = {
                btcDominance: 'BTC Hakimiyeti', volumeMomentum: 'Hacim Mom.',
                priceMomentum: 'Fiyat Mom.', marketBreadth: 'Piyasa Genisligi',
                altcoinSeason: 'Altcoin Sezonu', defiStrength: 'DeFi Gucu', derivativeSentiment: 'Turev Duyarlilik',
              }
              const v = typeof val === 'number' ? val : 50
              const color = v >= 60 ? 'text-emerald-400' : v <= 40 ? 'text-red-400' : 'text-white/50'
              return (
                <div key={key} className="bg-white/[0.02] rounded-lg p-2 hover:bg-white/[0.04] transition-all">
                  <div className="text-[9px] text-white/30 truncate">{labels[key] || key}</div>
                  <div className={`text-sm font-black tabular-nums ${color}`}>{v.toFixed(0)}</div>
                  <div className="h-1 bg-white/[0.04] rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, backgroundColor: v >= 60 ? '#62CBC1' : v <= 40 ? '#EF4444' : '#64748b' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ MOVERS + TRENDING ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-4">
        <div className="bg-[#111111] rounded-2xl border border-amber-400/10 p-3 sm:p-4 hover:border-emerald-500/20 transition-all duration-500">
          <CryptoMovers title="En Cok Yukselenler" items={indexStats.topGainers as CoinData[]} color="text-emerald-400" icon="🟢" />
        </div>
        <div className="bg-[#111111] rounded-2xl border border-amber-400/10 p-3 sm:p-4 hover:border-red-500/20 transition-all duration-500">
          <CryptoMovers title="En Cok Dusenler" items={indexStats.topLosers as CoinData[]} color="text-red-400" icon="🔴" />
        </div>
        <div className="bg-[#111111] rounded-2xl border border-amber-400/10 p-3 sm:p-4 hover:border-amber-400/20 transition-all duration-500">
          <TrendingCoins items={indexStats.trending} />
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="flex items-center justify-between text-[10px] text-white/15 px-2 pb-2">
        <span>Coinler: {coins.length} | Aktif: {indexStats.activeCryptos.toLocaleString()}</span>
        <span className="tabular-nums">Guncelleme: {new Date().toLocaleTimeString('tr-TR')}</span>
      </div>
    </div>
  )
}
