'use client'

// HERMES AI CRYPTO TERMINAL — Tab: PIYASA & TREND
// Global market data, Fear & Greed, trending, dominance, main trend

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, Globe, Zap, ArrowUpRight, ArrowDownRight, Flame, BarChart3, Target } from 'lucide-react'
import { CryptoMarketDashboard, CoinMarket } from '@/lib/crypto-terminal/coingecko-types'

interface TabMarketProps {
  onSelectCoin: (id: string) => void
}

function formatLargeNum(v: number | undefined | null): string {
  if (!v) return '$0'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

function formatPrice(p: number | undefined | null): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  return `$${p.toFixed(6)}`
}

function safeNum(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) return v
  return 0
}

function DominanceBar({ label, value, color, maxWidth = 80 }: { label: string; value: number; color: string; maxWidth?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-white/50 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(value, maxWidth)}%` }} />
      </div>
      <span className="text-xs font-bold text-white/70 tabular-nums w-14 text-right">{value.toFixed(2)}%</span>
    </div>
  )
}

function TrendIndicator({ label, value, change }: { label: string; value: string; change?: number }) {
  const isUp = (change ?? 0) >= 0
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
      <span className="text-[11px] text-white/50">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-white tabular-nums">{value}</span>
        {change != null && (
          <span className={`text-[10px] font-medium tabular-nums ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{change.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  )
}

export default function TabMarket({ onSelectCoin }: TabMarketProps) {
  const [data, setData] = useState<CryptoMarketDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/crypto-terminal/market')
        if (!res.ok) throw new Error('Piyasa verisi yuklenemedi')
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 bg-white/[0.02] rounded-2xl animate-pulse" />
      ))}
    </div>
  )
  if (error) return <div className="text-center py-20 text-white/50">{error}</div>
  if (!data) return <div className="text-center py-20 text-white/40">Veri bulunamadi</div>

  const fg = data.fearGreed
  const global = data.global
  const btcDom = safeNum(data.btcDominance)
  const ethDom = safeNum(data.ethDominance)
  const totalMcap = safeNum(data.totalMarketCap)
  const total24h = safeNum(data.total24hVolume)
  const mcapChange = safeNum(global?.market_cap_change_percentage_24h_usd)

  // Derive dominance & trend info
  const stablecoinDom = 100 - btcDom - ethDom - safeNum(global?.market_cap_percentage?.usdt) - safeNum(global?.market_cap_percentage?.usdc)
  const usdtDom = safeNum(global?.market_cap_percentage?.usdt)
  const usdcDom = safeNum(global?.market_cap_percentage?.usdc)
  const altDom = 100 - btcDom
  const altExStableDom = altDom - usdtDom - usdcDom

  // Main trend determination
  let mainTrend: 'YUKSELIS' | 'NOTR' | 'DUSUS' = 'NOTR'
  let trendColor = 'text-slate-300'
  let trendBg = 'bg-white/[0.04] border-white/[0.08]'
  if (mcapChange > 2) { mainTrend = 'YUKSELIS'; trendColor = 'text-emerald-400'; trendBg = 'bg-emerald-500/10 border-emerald-500/25' }
  else if (mcapChange < -2) { mainTrend = 'DUSUS'; trendColor = 'text-red-400'; trendBg = 'bg-red-500/10 border-red-500/25' }

  return (
    <div className="space-y-2 sm:space-y-4 animate-fade-in">

      {/* Main Trend Banner */}
      <div className={`rounded-2xl border p-3 sm:p-4 ${trendBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target size={20} className={trendColor} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 uppercase tracking-wider">Ana Trend</span>
                <span className={`text-sm font-black ${trendColor}`}>{mainTrend}</span>
              </div>
              <p className="text-[10px] text-white/35 mt-0.5">
                Toplam piyasa degeri 24s degisim: {mcapChange >= 0 ? '+' : ''}{mcapChange.toFixed(2)}%
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg sm:text-xl font-black text-white tabular-nums">{formatLargeNum(totalMcap)}</div>
            <span className={`text-xs font-medium tabular-nums ${mcapChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {mcapChange >= 0 ? '+' : ''}{mcapChange.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Fear & Greed */}
      {fg && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300 shadow-xl shadow-black/20 hover:border-white/[0.12] hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Crypto Fear & Greed</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xl sm:text-2xl font-black tabular-nums ${
                fg.index <= 20 ? 'text-red-500' :
                fg.index <= 40 ? 'text-orange-400' :
                fg.index <= 60 ? 'text-slate-300' :
                fg.index <= 80 ? 'text-emerald-400' :
                'text-emerald-300'
              }`}>{fg.index}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                fg.index <= 20 ? 'text-red-400 bg-red-500/15' :
                fg.index <= 40 ? 'text-orange-400 bg-orange-500/15' :
                fg.index <= 60 ? 'text-slate-300 bg-white/[0.06]' :
                fg.index <= 80 ? 'text-emerald-400 bg-emerald-500/15' :
                'text-emerald-300 bg-emerald-500/20'
              }`}>{fg.label}</span>
            </div>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-600 via-orange-500 via-yellow-400 via-slate-400 via-emerald-400 to-emerald-500">
            <div className="absolute top-0 h-full w-1 bg-white shadow-lg shadow-white/50 rounded-full transition-all duration-700"
              style={{ left: `${Math.max(1, Math.min(99, fg.index))}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-red-400/50">Asiri Korku</span>
            <span className="text-[9px] text-emerald-400/50">Asiri Acgozluluk</span>
          </div>
          {/* F&G Components */}
          {fg.components && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mt-2 sm:mt-3">
              {Object.entries(fg.components).map(([key, val]) => {
                const labels: Record<string, string> = {
                  btcDominance: 'BTC Hakimiyeti', volumeMomentum: 'Hacim Momentum',
                  priceMomentum: 'Fiyat Momentum', marketBreadth: 'Piyasa Genisligi',
                  altcoinSeason: 'Altcoin Sezonu', defiStrength: 'DeFi Gucu', derivativeSentiment: 'Turev Duyarlilik'
                }
                const v = safeNum(val)
                return (
                  <div key={key} className="bg-white/[0.02] rounded-lg p-2">
                    <div className="text-[9px] text-white/35 mb-1">{labels[key] || key}</div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${v >= 60 ? 'bg-emerald-500' : v >= 40 ? 'bg-slate-400' : 'bg-red-500'}`}
                          style={{ width: `${v}%` }} />
                      </div>
                      <span className="text-[10px] text-white/60 tabular-nums w-6 text-right">{Math.round(v)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Alternative.me Fear & Greed (independent source) */}
          {data.alternativeFG && (
            <div className="mt-3 p-2.5 bg-white/[0.02] rounded-xl border border-white/[0.04]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Alternative.me F&G (Bagimsiz)</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black tabular-nums ${
                    data.alternativeFG.current <= 25 ? 'text-red-500' :
                    data.alternativeFG.current <= 45 ? 'text-orange-400' :
                    data.alternativeFG.current <= 55 ? 'text-slate-300' :
                    data.alternativeFG.current <= 75 ? 'text-emerald-400' :
                    'text-emerald-300'
                  }`}>{data.alternativeFG.current}</span>
                  <span className="text-[10px] text-white/60">{data.alternativeFG.label}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-1.5">
                {data.alternativeFG.yesterday != null && (
                  <div className="text-[9px]">
                    <span className="text-white/40">Dun: </span>
                    <span className="text-white/60 tabular-nums">{data.alternativeFG.yesterday}</span>
                  </div>
                )}
                {data.alternativeFG.weekAgo != null && (
                  <div className="text-[9px]">
                    <span className="text-white/40">1 Hafta: </span>
                    <span className="text-white/60 tabular-nums">{data.alternativeFG.weekAgo}</span>
                  </div>
                )}
                {data.alternativeFG.monthAgo != null && (
                  <div className="text-[9px]">
                    <span className="text-white/40">1 Ay: </span>
                    <span className="text-white/60 tabular-nums">{data.alternativeFG.monthAgo}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Toplam Piyasa Deg." value={formatLargeNum(totalMcap)} icon={<Globe size={14} />} change={mcapChange} />
        <StatCard label="24s Hacim" value={formatLargeNum(total24h)} icon={<Activity size={14} />} />
        <StatCard label="Aktif Kripto" value={safeNum(data.activeCryptos).toLocaleString()} icon={<BarChart3 size={14} />} />
        <StatCard label="Aktif Borsa" value={safeNum(data.activeExchanges).toLocaleString()} icon={<Zap size={14} />} />
      </div>

      {/* Dominance Section */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300">
        <div className="flex items-center gap-2 mb-2 sm:mb-4">
          <BarChart3 size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Hakimiyet & Piyasa Yapisi</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
          {/* Left: Dominance bars */}
          <div className="space-y-3">
            <DominanceBar label="BTC" value={btcDom} color="bg-amber-500" />
            <DominanceBar label="ETH" value={ethDom} color="bg-blue-500" />
            <DominanceBar label="USDT" value={usdtDom} color="bg-emerald-500" />
            <DominanceBar label="USDC" value={usdcDom} color="bg-blue-400" />
            <DominanceBar label="Altcoin" value={altExStableDom > 0 ? altExStableDom : 0} color="bg-violet-500" />
          </div>
          {/* Right: Market Structure Summary */}
          <div className="space-y-1">
            <TrendIndicator label="TOTAL (Toplam)" value={formatLargeNum(totalMcap)} change={mcapChange} />
            <TrendIndicator label="TOTAL2 (BTC Haric)" value={formatLargeNum(totalMcap * (1 - btcDom / 100))} />
            <TrendIndicator label="TOTAL3 (Top 2 Haric)" value={formatLargeNum(totalMcap * (1 - (btcDom + ethDom) / 100))} />
            <TrendIndicator label="BTC Hakimiyeti" value={`${btcDom.toFixed(2)}%`} />
            <TrendIndicator label="Stablecoin Payi" value={`${(usdtDom + usdcDom).toFixed(2)}%`} />
            <TrendIndicator label="USDT/USDC Orani" value={usdcDom > 0 ? `${(usdtDom / usdcDom).toFixed(2)}x` : '-'} />
          </div>
        </div>
      </div>

      {/* DeFi Stats */}
      {data.globalDefi && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          <StatCard label="DeFi Piyasa Deg." value={formatLargeNum(parseFloat(data.globalDefi.defi_market_cap || '0'))} icon={<Zap size={14} className="text-violet-400" />} />
          <StatCard label="DeFi Hakimiyeti" value={`${parseFloat(data.globalDefi.defi_dominance || '0').toFixed(2)}%`} icon={<Zap size={14} className="text-violet-400" />} />
          <StatCard label="DeFi 24s Hacim" value={formatLargeNum(parseFloat(data.globalDefi.trading_volume_24h || '0'))} icon={<Zap size={14} className="text-violet-400" />} />
        </div>
      )}

      {/* Trending */}
      {data.trending?.coins && data.trending.coins.length > 0 && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Flame size={16} className="text-orange-400" />
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Trend Coinler</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.trending.coins.slice(0, 9).map(({ item }) => (
              <button
                key={item.id}
                onClick={() => onSelectCoin(item.id)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
              >
                <img src={item.small} alt={item.symbol} className="w-6 h-6 rounded-full" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white truncate">{item.symbol}</span>
                    <span className="text-[10px] text-white/40">#{item.market_cap_rank}</span>
                  </div>
                  <span className="text-[10px] text-white/40 truncate block">{item.name}</span>
                </div>
                {item.data?.price_change_percentage_24h?.usd != null && (
                  <span className={`text-[11px] font-medium tabular-nums ${
                    item.data.price_change_percentage_24h.usd >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {item.data.price_change_percentage_24h.usd >= 0 ? '+' : ''}
                    {item.data.price_change_percentage_24h.usd.toFixed(1)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Gainers & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        <MoverList title="En Cok Yukselenler" icon={<ArrowUpRight size={14} className="text-emerald-400" />} coins={data.topGainers?.slice(0, 10) ?? []} onSelectCoin={onSelectCoin} isGainer />
        <MoverList title="En Cok Dusenler" icon={<ArrowDownRight size={14} className="text-red-400" />} coins={data.topLosers?.slice(0, 10) ?? []} onSelectCoin={onSelectCoin} isGainer={false} />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, change }: { label: string; value: string; icon: React.ReactNode; change?: number }) {
  return (
    <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-3 hover:border-white/[0.12] hover:shadow-md hover:shadow-black/20 transition-all duration-300">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-base sm:text-lg font-bold text-white tabular-nums">{value}</div>
        {change != null && (
          <span className={`text-[10px] font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  )
}

function MoverList({ title, icon, coins, onSelectCoin, isGainer }: {
  title: string; icon: React.ReactNode; coins: CoinMarket[]; onSelectCoin: (id: string) => void; isGainer: boolean
}) {
  return (
    <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        {icon}
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1">
        {coins.map((coin, i) => (
          <button
            key={coin.id || i}
            onClick={() => onSelectCoin(coin.id)}
            className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-4">{i + 1}</span>
              {coin.image && <img src={coin.image} alt={coin.symbol} className="w-4 h-4 rounded-full" loading="lazy" />}
              <span className="text-xs font-medium text-white">{coin.symbol?.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 tabular-nums">{formatPrice(coin.current_price)}</span>
              <span className={`text-xs font-medium tabular-nums ${isGainer ? 'text-emerald-400' : 'text-red-400'}`}>
                {(coin.price_change_percentage_24h ?? 0) >= 0 ? '+' : ''}
                {(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
              </span>
            </div>
          </button>
        ))}
        {coins.length === 0 && <span className="text-xs text-white/40">Veri bekleniyor...</span>}
      </div>
    </div>
  )
}
