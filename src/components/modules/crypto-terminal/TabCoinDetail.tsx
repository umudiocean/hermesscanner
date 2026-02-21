'use client'

// HERMES AI CRYPTO TERMINAL — Tab: COIN DETAY
// Single coin deep dive with market data, community, developer metrics

import { useState, useEffect, useRef, useCallback } from 'react'
import { Eye, Globe, ExternalLink, TrendingUp, TrendingDown, Activity, Users, Code, Zap, X, ArrowRight, Shield, Star } from 'lucide-react'
import { CoinDetail, CryptoScore, Derivative, getCryptoScoreColor, CRYPTO_SCORE_LABELS, CRYPTO_CATEGORY_LABELS, CRYPTO_SCORE_WEIGHTS, CryptoScoreBreakdown } from '@/lib/crypto-terminal/coingecko-types'
import SharePanel from '@/components/SharePanel'

type ValuationTag = 'COK UCUZ' | 'UCUZ' | 'NORMAL' | 'PAHALI' | 'COK PAHALI'

function computeDetailValuation(md: CoinDetail['market_data']): ValuationTag {
  if (!md) return 'NORMAL'
  const fdv = md.fully_diluted_valuation?.usd ?? 0
  const mcap = md.market_cap?.usd ?? 0
  const fdvR = mcap > 0 && fdv > 0 ? fdv / mcap : 0
  const athDist = Math.abs(md.ath_change_percentage?.usd ?? 0)
  const supRatio = md.circulating_supply && md.total_supply && md.total_supply > 0
    ? (md.circulating_supply / md.total_supply) * 100 : 0
  if (fdvR > 0 && fdvR < 1.2 && athDist > 70 && supRatio > 70) return 'COK UCUZ'
  if (fdvR > 0 && fdvR < 1.5 && athDist > 50) return 'UCUZ'
  if (fdvR > 5 || athDist < 3) return 'COK PAHALI'
  if (fdvR > 3 || athDist < 10) return 'PAHALI'
  return 'NORMAL'
}

function computeDetailRisk(md: CoinDetail['market_data']): number {
  if (!md) return 50
  let risk = 50
  const mcap = md.market_cap?.usd ?? 0
  const vol = md.total_volume?.usd ?? 0
  const volMc = mcap > 0 ? vol / mcap : 0
  if (volMc < 0.01) risk += 15
  else if (volMc > 0.5) risk += 10
  const fdv = md.fully_diluted_valuation?.usd ?? 0
  const fdvR = mcap > 0 && fdv > 0 ? fdv / mcap : 0
  if (fdvR > 5) risk += 15
  else if (fdvR > 3) risk += 10
  else if (fdvR > 0 && fdvR < 1.5) risk -= 10
  const athDist = Math.abs(md.ath_change_percentage?.usd ?? 0)
  if (athDist > 90) risk += 10
  else if (athDist < 10) risk -= 5
  if (mcap >= 10e9) risk -= 15
  else if (mcap >= 1e9) risk -= 8
  else if (mcap < 10e6) risk += 12
  return Math.max(0, Math.min(100, risk))
}

const VALUATION_STYLE_DETAIL: Record<ValuationTag, { text: string; bg: string; border: string }> = {
  'COK UCUZ': { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'UCUZ': { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'NORMAL': { text: 'text-slate-300', bg: 'bg-white/[0.04]', border: 'border-white/10' },
  'PAHALI': { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  'COK PAHALI': { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
}

interface TabCoinDetailProps {
  coinId: string
  onSelectCoin: (id: string) => void
  onViewChart: (id: string) => void
  onAddToCompare: (id: string) => void
}

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  return `$${p.toFixed(8)}`
}

function formatLarge(v: number): string {
  if (!v) return '-'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

function ChangeTag({ value, label }: { value: number | undefined; label: string }) {
  if (value == null) return null
  const isPos = value >= 0
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02]">
      <span className="text-[9px] text-white/25 uppercase mb-1">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPos ? '+' : ''}{value.toFixed(2)}%
      </span>
    </div>
  )
}

export default function TabCoinDetail({ coinId, onSelectCoin, onViewChart, onAddToCompare }: TabCoinDetailProps) {
  const [detail, setDetail] = useState<CoinDetail | null>(null)
  const [score, setScore] = useState<CryptoScore | null>(null)
  const [derivatives, setDerivatives] = useState<Derivative[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [showSplash, setShowSplash] = useState(false)
  const [splashFade, setSplashFade] = useState(false)
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const prevCoinRef = useRef<string>('')

  useEffect(() => {
    const stored = localStorage.getItem('hermes_crypto_watchlist')
    if (stored) {
      try { setWatchlist(new Set(JSON.parse(stored))) } catch { /* */ }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hermes_crypto_watchlist' && e.newValue) {
        try { setWatchlist(new Set(JSON.parse(e.newValue))) } catch { /* */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleWatchlist = useCallback((id: string) => {
    setWatchlist(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem('hermes_crypto_watchlist', JSON.stringify([...next]))
      return next
    })
  }, [])

  useEffect(() => {
    if (!coinId) return
    const isNewCoin = prevCoinRef.current !== coinId
    prevCoinRef.current = coinId

    if (isNewCoin) {
      setShowSplash(true)
      setSplashFade(false)
    }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/crypto-terminal/coin/${coinId}`)
        if (!res.ok) throw new Error(`${coinId} verisi yuklenemedi`)
        const data = await res.json()
        setDetail(data.detail)
        setScore(data.score)
        setDerivatives(data.derivatives || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
        setShowSplash(false)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [coinId])

  if (!coinId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Eye size={48} className="text-white/10 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Coin Secin</h3>
        <p className="text-white/40 text-sm mb-6">COINLER sekmesinden veya arama ile coin secin</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value.toLowerCase())}
            onKeyDown={e => { if (e.key === 'Enter' && searchInput) { onSelectCoin(searchInput); setSearchInput('') } }}
            placeholder="Orn: bitcoin, ethereum, solana..."
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40 w-64"
          />
          <button
            onClick={() => { if (searchInput) { onSelectCoin(searchInput); setSearchInput('') } }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:from-amber-400 hover:to-orange-400 transition-all"
          >Git</button>
        </div>
      </div>
    )
  }

  // Animated Splash Screen
  if (showSplash && detail) {
    const splashScore = score?.total ?? 0
    const splashLevel = score ? CRYPTO_SCORE_LABELS[score.level] : 'ANALIZ EDILIYOR'
    const splashColor = score ? getCryptoScoreColor(score.level) : 'text-amber-400'
    const md = detail.market_data
    const price = md?.current_price?.usd ?? 0
    const change24h = md?.price_change_percentage_24h ?? 0

    const closeSplash = () => {
      setSplashFade(true)
      setTimeout(() => setShowSplash(false), 400)
    }

    return (
      <div className={`relative flex flex-col items-center justify-center min-h-[55vh] transition-all duration-400 ${splashFade ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        {/* Close button top-right */}
        <button
          onClick={closeSplash}
          className="absolute top-2 right-2 z-20 p-2 rounded-full bg-white/[0.06] border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={16} />
        </button>

        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[120px] animate-pulse" />
        </div>

        {/* Logo + Name */}
        <div className="relative z-10 flex flex-col items-center animate-[fadeInScale_0.6s_ease-out]">
          {detail.image?.large && (
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
              <img
                src={detail.image.large}
                alt={detail.symbol}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full relative z-10 ring-2 ring-amber-500/30 shadow-2xl shadow-amber-500/20"
              />
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1 animate-[fadeInUp_0.5s_0.2s_ease-out_both]">
            {detail.name}
          </h1>
          <span className="text-sm text-white/30 font-medium uppercase tracking-widest mb-6 animate-[fadeInUp_0.5s_0.3s_ease-out_both]">
            {detail.symbol} #{md?.market_cap_rank}
          </span>

          {/* Price */}
          <div className="text-3xl sm:text-4xl font-black text-white tabular-nums mb-2 animate-[fadeInUp_0.5s_0.4s_ease-out_both]">
            {formatPrice(price)}
          </div>
          <div className={`text-lg font-bold tabular-nums mb-8 animate-[fadeInUp_0.5s_0.5s_ease-out_both] ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
            <span className="text-xs text-white/20 ml-1.5 font-normal">24s</span>
          </div>

          {/* Score Circle */}
          <div className="animate-[fadeInScale_0.6s_0.6s_ease-out_both]">
            <div className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 flex flex-col items-center justify-center ${
              score?.level === 'STRONG' ? 'border-amber-500/50 bg-amber-500/10' :
              score?.level === 'GOOD' ? 'border-emerald-500/50 bg-emerald-500/10' :
              score?.level === 'WEAK' ? 'border-orange-500/50 bg-orange-500/10' :
              score?.level === 'BAD' ? 'border-red-500/50 bg-red-500/10' :
              'border-white/20 bg-white/[0.04]'
            }`}>
              <span className={`text-3xl sm:text-4xl font-black tabular-nums ${splashColor}`}>
                {splashScore}
              </span>
              <span className={`text-[10px] sm:text-xs font-bold tracking-wider ${splashColor}`}>
                {splashLevel}
              </span>
            </div>
          </div>

          {/* Continue button */}
          <button
            onClick={closeSplash}
            className="mt-8 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-500/40 transition-all duration-300 animate-[fadeInUp_0.5s_0.9s_ease-out_both]"
          >
            Detaya Git
            <ArrowRight size={14} />
          </button>
        </div>

        <style jsx>{`
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  if (loading && !showSplash) return (
    <div className="space-y-4">
      <div className="h-24 bg-white/[0.02] rounded-2xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-white/[0.02] rounded-xl animate-pulse" />)}
      </div>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <span className="text-3xl mb-3">&#9888;</span>
      <p className="text-white/50 text-sm">{error}</p>
    </div>
  )
  if (!detail) return null

  const md = detail.market_data
  const price = md?.current_price?.usd ?? 0
  const mcap = md?.market_cap?.usd ?? 0

  return (
    <div className="space-y-2 sm:space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300">
        <div className="flex items-center gap-3">
          {detail.image?.large && (
            <img src={detail.image.large} alt={detail.symbol} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white">{detail.name}</h2>
              <span className="text-sm text-white/30 font-medium uppercase">{detail.symbol}</span>
              <span className="text-[10px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded">#{md?.market_cap_rank}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {detail.categories?.slice(0, 3).map(cat => (
                <span key={cat} className="text-[9px] text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded">{cat}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">{formatPrice(price)}</div>
            <span className={`text-sm font-medium ${(md?.price_change_percentage_24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(md?.price_change_percentage_24h ?? 0) >= 0 ? '+' : ''}{(md?.price_change_percentage_24h ?? 0).toFixed(2)}%
            </span>
          </div>
          {score && (
            <div className="flex items-center gap-2">
              <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl border ${
                score.level === 'STRONG' ? 'bg-amber-500/15 border-amber-500/30' :
                score.level === 'GOOD' ? 'bg-emerald-500/15 border-emerald-500/30' :
                score.level === 'WEAK' ? 'bg-orange-500/15 border-orange-500/30' :
                score.level === 'BAD' ? 'bg-red-500/15 border-red-500/30' :
                'bg-white/[0.04] border-white/[0.08]'
              }`}>
                <span className={`text-lg font-bold ${getCryptoScoreColor(score.level)}`}>{score.total}</span>
                <span className={`text-[8px] font-medium ${getCryptoScoreColor(score.level)}`}>{CRYPTO_SCORE_LABELS[score.level]}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${
                  score.confidence >= 70 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                  score.confidence >= 50 ? 'text-white/60 bg-white/[0.04] border-white/10' :
                  'text-white/30 bg-white/[0.02] border-white/[0.06]'
                }`} title="Veri kalitesi guveni — kac kategoride gercek veri var">
                  <Shield size={10} />
                  Guven: %{Math.round(score.confidence)}
                </div>
                {(() => {
                  const vl = computeDetailValuation(md)
                  const vs = VALUATION_STYLE_DETAIL[vl]
                  return (
                    <div className={`px-2 py-1 rounded-lg border text-[10px] font-bold text-center ${vs.text} ${vs.bg} ${vs.border}`} title="ATH mesafesi + FDV/MCap + arz oranina gore fiyatlama">
                      {vl}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button
          onClick={() => toggleWatchlist(coinId)}
          className={`group px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition-all duration-300 ${
            watchlist.has(coinId)
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25 hover:border-amber-500/40 shadow-md shadow-amber-500/10'
              : 'bg-white/[0.04] border-white/8 text-white/50 hover:bg-amber-500/10 hover:border-amber-500/25 hover:text-amber-400'
          } hover:scale-[1.03]`}
        >
          <Star size={12} className="inline mr-1" fill={watchlist.has(coinId) ? '#f59e0b' : 'none'} />
          {watchlist.has(coinId) ? 'Izleniyor' : 'Izleme Listesine Ekle'}
        </button>
        <button onClick={() => onViewChart(coinId)} className="group px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500/12 to-orange-500/8 border border-amber-500/25 text-amber-400 text-xs font-bold hover:from-amber-500/20 hover:to-orange-500/12 hover:border-amber-500/40 hover:shadow-md hover:shadow-amber-500/10 hover:scale-[1.03] transition-all duration-300">
          <TrendingUp size={12} className="inline mr-1" />Grafik
        </button>
        <button onClick={() => onAddToCompare(coinId)} className="group px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-xs font-bold hover:bg-white/[0.08] hover:border-white/15 hover:text-white/70 hover:shadow-md hover:shadow-black/20 hover:scale-[1.03] transition-all duration-300">
          Karsilastir
        </button>
        {detail.links?.homepage?.[0] && (
          <a href={detail.links.homepage[0]} target="_blank" rel="noopener noreferrer" className="group px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-xs font-bold hover:bg-white/[0.08] hover:border-white/15 hover:text-white/70 hover:shadow-md hover:shadow-black/20 hover:scale-[1.02] transition-all duration-300">
            <ExternalLink size={12} className="inline mr-1" />Website
          </a>
        )}
        <SharePanel
          title={`${detail.name} (${detail.symbol?.toUpperCase()})`}
          subtitle={detail.categories?.[0]}
          price={md ? formatPrice(md.current_price?.usd ?? 0) : undefined}
          change={md?.price_change_percentage_24h != null ? `${md.price_change_percentage_24h >= 0 ? '+' : ''}${md.price_change_percentage_24h.toFixed(2)}%` : undefined}
          score={score?.total}
          scoreLabel={score ? CRYPTO_SCORE_LABELS[score.level] : undefined}
          type="crypto"
        />
      </div>

      {/* Price Changes */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
        <ChangeTag value={md?.price_change_percentage_24h} label="24s" />
        <ChangeTag value={md?.price_change_percentage_7d} label="7g" />
        <ChangeTag value={md?.price_change_percentage_14d} label="14g" />
        <ChangeTag value={md?.price_change_percentage_30d} label="30g" />
        <ChangeTag value={md?.price_change_percentage_60d} label="60g" />
        <ChangeTag value={md?.price_change_percentage_1y} label="1y" />
      </div>

      {/* AI Analysis Badges */}
      {md && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className={`bg-[#151520] rounded-xl border p-2.5 sm:p-3 ${
            (score?.confidence ?? 0) >= 70 ? 'border-amber-500/25' : 'border-white/[0.06]'
          }`}>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Guven</span>
            <div className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 ${
              (score?.confidence ?? 0) >= 70 ? 'text-amber-400' :
              (score?.confidence ?? 0) >= 50 ? 'text-white/70' : 'text-white/30'
            }`}>%{Math.round(score?.confidence ?? 0)}</div>
            <span className="text-[9px] text-white/20">{score?.degraded ? 'Eksik veri' : 'Kaliteli veri'}</span>
          </div>
          {(() => {
            const vl = computeDetailValuation(md)
            const vs = VALUATION_STYLE_DETAIL[vl]
            return (
              <div className={`bg-[#151520] rounded-xl border p-2.5 sm:p-3 ${vs.border}`}>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Fiyatlama</span>
                <div className={`text-base sm:text-lg font-bold mt-0.5 ${vs.text}`}>{vl}</div>
                <span className="text-[9px] text-white/20">ATH + FDV/MC bazli</span>
              </div>
            )
          })()}
          {(() => {
            const r = computeDetailRisk(md)
            return (
              <div className={`bg-[#151520] rounded-xl border p-2.5 sm:p-3 ${
                r >= 70 ? 'border-red-500/25' : r >= 50 ? 'border-orange-500/20' : 'border-emerald-500/20'
              }`}>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Risk Skoru</span>
                <div className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 ${
                  r >= 70 ? 'text-red-400' : r >= 50 ? 'text-orange-400' : r >= 30 ? 'text-white/70' : 'text-emerald-400'
                }`}>{r}/100</div>
                <span className="text-[9px] text-white/20">{r >= 70 ? 'Yuksek risk' : r >= 50 ? 'Orta risk' : 'Dusuk risk'}</span>
              </div>
            )
          })()}
          {(() => {
            const supRatio = md.circulating_supply && md.total_supply && md.total_supply > 0
              ? Math.round((md.circulating_supply / md.total_supply) * 100) : 0
            const fdv = md.fully_diluted_valuation?.usd ?? 0
            const fdvR = mcap > 0 && fdv > 0 ? (fdv / mcap).toFixed(1) : '-'
            return (
              <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-2.5 sm:p-3">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Arz & Dilution</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-base sm:text-lg font-bold tabular-nums ${supRatio >= 80 ? 'text-emerald-400' : supRatio >= 50 ? 'text-white/70' : 'text-orange-400'}`}>
                    {supRatio > 0 ? `${supRatio}%` : '-'}
                  </span>
                  <span className={`text-xs font-medium tabular-nums ${fdvR !== '-' && parseFloat(fdvR) > 3 ? 'text-red-400' : 'text-white/40'}`}>
                    FDV/MC: {fdvR}x
                  </span>
                </div>
                <span className="text-[9px] text-white/20">Dolasim / Toplam arz</span>
              </div>
            )
          })()}
        </div>
      )}

      {/* Market Data Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <MetricCard label="Piyasa Degeri" value={formatLarge(mcap)} />
        <MetricCard label="FDV" value={formatLarge(md?.fully_diluted_valuation?.usd ?? 0)} />
        <MetricCard label="24s Hacim" value={formatLarge(md?.total_volume?.usd ?? 0)} />
        <MetricCard label="TVL" value={md?.total_value_locked ? formatLarge(md.total_value_locked) : '-'} />
        <MetricCard label="Dolasan Arz" value={md?.circulating_supply ? `${(md.circulating_supply / 1e6).toFixed(1)}M` : '-'} />
        <MetricCard label="Max Arz" value={md?.max_supply ? `${(md.max_supply / 1e6).toFixed(1)}M` : 'Sinirsiz'} />
        <MetricCard label="ATH" value={formatPrice(md?.ath?.usd ?? 0)} sub={`${(md?.ath_change_percentage?.usd ?? 0).toFixed(1)}%`} />
        <MetricCard label="ATL" value={formatPrice(md?.atl?.usd ?? 0)} sub={`+${(md?.atl_change_percentage?.usd ?? 0).toFixed(0)}%`} />
      </div>

      {/* Score Breakdown */}
      {score && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300">
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-2 sm:mb-3">HERMES AI Skor Dagilimi</h3>
          <div className="space-y-2">
            {(Object.keys(CRYPTO_SCORE_WEIGHTS) as (keyof CryptoScoreBreakdown)[])
              .slice()
              .sort((a, b) => (score.categories[b] ?? 0) - (score.categories[a] ?? 0))
              .map(key => {
              const value = score.categories[key]
              const weight = CRYPTO_SCORE_WEIGHTS[key]
              const barColor = value >= 70 ? 'bg-emerald-400' : value >= 50 ? 'bg-amber-400' : value >= 30 ? 'bg-orange-400' : 'bg-red-400'
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-20 text-[10px] text-white/40">{CRYPTO_CATEGORY_LABELS[key]}</span>
                  <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${Math.max(2, value)}%` }} />
                  </div>
                  <span className={`w-8 text-[10px] text-right tabular-nums font-medium ${value >= 70 ? 'text-emerald-400' : value >= 50 ? 'text-amber-400' : value >= 30 ? 'text-orange-400' : 'text-red-400'}`}>{Math.round(value)}</span>
                  <span className="w-8 text-[8px] text-white/20 text-right">{Math.round(weight * 100)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Community & Developer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        {detail.community_data && (
          <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Users size={14} className="text-blue-400" />
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Topluluk</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-white/30">Twitter</span> <span className="text-white font-medium ml-1">{(detail.community_data.twitter_followers ?? 0).toLocaleString()}</span></div>
              <div><span className="text-white/30">Reddit</span> <span className="text-white font-medium ml-1">{(detail.community_data.reddit_subscribers ?? 0).toLocaleString()}</span></div>
              <div><span className="text-white/30">Telegram</span> <span className="text-white font-medium ml-1">{(detail.community_data.telegram_channel_user_count ?? 0).toLocaleString()}</span></div>
              <div><span className="text-white/30">Sentiment</span> <span className="text-emerald-400 font-medium ml-1">{detail.sentiment_votes_up_percentage?.toFixed(0) ?? '-'}% pozitif</span></div>
            </div>
          </div>
        )}
        {detail.developer_data && (
          <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Code size={14} className="text-violet-400" />
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Gelistirici</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-white/30">GitHub Stars</span> <span className="text-white font-medium ml-1">{(detail.developer_data.stars ?? 0).toLocaleString()}</span></div>
              <div><span className="text-white/30">Forks</span> <span className="text-white font-medium ml-1">{(detail.developer_data.forks ?? 0).toLocaleString()}</span></div>
              <div><span className="text-white/30">4H Commit</span> <span className="text-white font-medium ml-1">{detail.developer_data.commit_count_4_weeks ?? 0}</span></div>
              <div><span className="text-white/30">PR Merged</span> <span className="text-white font-medium ml-1">{detail.developer_data.pull_requests_merged ?? 0}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {detail.description?.en && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4">
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-1.5 sm:mb-2">Hakkinda</h3>
          <p className="text-xs text-white/40 leading-relaxed line-clamp-4">{detail.description.en.replace(/<[^>]*>/g, '').substring(0, 500)}</p>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-3 hover:border-white/[0.12] hover:shadow-md hover:shadow-black/20 transition-all duration-300">
      <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
      <div className="text-sm font-bold text-white tabular-nums mt-0.5">{value}</div>
      {sub && <span className="text-[10px] text-white/20">{sub}</span>}
    </div>
  )
}
