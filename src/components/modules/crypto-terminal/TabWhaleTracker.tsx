'use client'

// HERMES AI CRYPTO TERMINAL — Tab: WHALE TRACKER (K6)
// Smart money flow analysis using CoinGecko market data + tickers
// Shows buy/sell pressure, volume analysis, exchange flows

import { useState, useEffect, useCallback } from 'react'
import { Eye, TrendingUp, TrendingDown, Users, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, BarChart3 } from 'lucide-react'

interface WhaleFlowData {
  coinId: string
  coinName: string
  symbol: string
  image: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  volumeToMcap: number
  // Derived whale metrics
  exchangeCount: number
  topExchangeVolume: { name: string; volume: number; trustScore: string }[]
  buyPressureProxy: number // Based on price action + volume
  sellPressureProxy: number
  netFlow: number
  circulatingSupply: number
  totalSupply: number | null
  supplyRatio: number
  athDistance: number
}

interface TabWhaleTrackerProps {
  onSelectCoin: (id: string) => void
}

const TRACKED_COINS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'ripple', symbol: 'XRP' },
  { id: 'cardano', symbol: 'ADA' },
  { id: 'avalanche-2', symbol: 'AVAX' },
  { id: 'polkadot', symbol: 'DOT' },
  { id: 'dogecoin', symbol: 'DOGE' },
  { id: 'chainlink', symbol: 'LINK' },
]

function formatUSD(val: number): string {
  if (!val || isNaN(val)) return '$0'
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`
  return `$${val.toFixed(0)}`
}

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  return `$${p.toFixed(6)}`
}

export default function TabWhaleTracker({ onSelectCoin }: TabWhaleTrackerProps) {
  const [selectedCoin, setSelectedCoin] = useState(TRACKED_COINS[0])
  const [whaleData, setWhaleData] = useState<WhaleFlowData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!selectedCoin) return
    setLoading(true)
    try {
      // Fetch coin detail + tickers from backend API
      const coinRes = await fetch(`/api/crypto-terminal/coin/${selectedCoin.id}`)

      let detail: any = null
      let tickers: any[] = []

      if (coinRes.ok) {
        const data = await coinRes.json()
        detail = data.detail
        tickers = data.tickers || []
      }

      if (!detail) {
        setWhaleData(null)
        return
      }

      const md = detail.market_data
      const price = md?.current_price?.usd ?? 0
      const volume24h = md?.total_volume?.usd ?? 0
      const marketCap = md?.market_cap?.usd ?? 0
      const change24h = md?.price_change_percentage_24h ?? 0
      const circulatingSupply = md?.circulating_supply ?? 0
      const totalSupply = md?.total_supply ?? null
      const ath = md?.ath?.usd ?? price
      const athDist = ath > 0 ? ((price - ath) / ath) * 100 : 0

      // Derive buy/sell pressure from price action
      const change1h = md?.price_change_percentage_1h_in_currency?.usd ?? 0
      const volumeToMcap = marketCap > 0 ? volume24h / marketCap : 0

      // Buy pressure = positive change * volume weight
      const momentum = (change1h * 0.3 + change24h * 0.7) / 100
      const absVolume = volume24h
      const buyPressure = momentum > 0 ? absVolume * Math.abs(momentum) : absVolume * Math.abs(momentum) * 0.3
      const sellPressure = momentum < 0 ? absVolume * Math.abs(momentum) : absVolume * Math.abs(momentum) * 0.3
      const netFlow = buyPressure - sellPressure

      // Top exchange volumes from tickers
      const exchangeMap = new Map<string, { volume: number; trust: string }>()
      for (const t of tickers) {
        const name = t.market?.name || 'Unknown'
        const vol = t.converted_volume?.usd || 0
        const trust = t.trust_score || 'grey'
        const existing = exchangeMap.get(name)
        if (existing) {
          existing.volume += vol
        } else {
          exchangeMap.set(name, { volume: vol, trust })
        }
      }
      const topExchanges = Array.from(exchangeMap.entries())
        .map(([name, d]) => ({ name, volume: d.volume, trustScore: d.trust }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10)

      setWhaleData({
        coinId: selectedCoin.id,
        coinName: detail.name || selectedCoin.id,
        symbol: detail.symbol?.toUpperCase() || selectedCoin.symbol,
        image: detail.image?.large || '',
        price,
        change24h,
        marketCap,
        volume24h,
        volumeToMcap,
        exchangeCount: exchangeMap.size,
        topExchangeVolume: topExchanges,
        buyPressureProxy: buyPressure,
        sellPressureProxy: sellPressure,
        netFlow,
        circulatingSupply,
        totalSupply,
        supplyRatio: totalSupply && totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 100,
        athDistance: athDist,
      })
    } catch {
      setWhaleData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedCoin])

  useEffect(() => { loadData() }, [loadData])

  const totalPressure = (whaleData?.buyPressureProxy || 0) + (whaleData?.sellPressureProxy || 0)
  const buyPercent = totalPressure > 0 ? ((whaleData?.buyPressureProxy || 0) / totalPressure) * 100 : 50

  return (
    <div className="space-y-2 sm:space-y-4 animate-fade-in">
      {/* Coin Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white">WHALE TRACKER</h3>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {TRACKED_COINS.map(coin => (
            <button
              key={coin.id}
              onClick={() => setSelectedCoin(coin)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                selectedCoin.id === coin.id
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-text-tertiary hover:text-text-secondary border border-transparent'
              }`}
            >
              {coin.symbol}
            </button>
          ))}
          <button onClick={loadData} className="ml-2 p-1.5 rounded-xl text-text-tertiary hover:text-amber-400 hover:bg-amber-500/10 hover:shadow-sm hover:shadow-amber-500/10 transition-all duration-300">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      )}

      {!loading && whaleData && (
        <>
          {/* Coin Header */}
          <div className="flex items-center justify-between bg-surface-3 rounded-xl border border-stroke-subtle p-2 sm:p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
            <div className="flex items-center gap-3">
              {whaleData.image && <img src={whaleData.image} alt={whaleData.symbol} className="w-8 h-8 rounded-full" />}
              <div>
                <span className="text-sm font-bold text-white">{whaleData.coinName}</span>
                <span className="text-xs text-text-tertiary ml-2">{whaleData.symbol}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white tabular-nums">{formatPrice(whaleData.price)}</div>
              <span className={`text-xs tabular-nums ${whaleData.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {whaleData.change24h >= 0 ? '+' : ''}{whaleData.change24h.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Flow Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300">
              <div className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Net Akis Tahmini</div>
              <div className={`text-base sm:text-lg font-bold ${whaleData.netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {whaleData.netFlow >= 0 ? '+' : ''}{formatUSD(Math.abs(whaleData.netFlow))}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {whaleData.netFlow >= 0 ? <ArrowUpRight size={10} className="text-emerald-400" /> : <ArrowDownRight size={10} className="text-red-400" />}
                <span className="text-[9px] text-text-tertiary">Momentum bazli</span>
              </div>
            </div>

            <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
              <div className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">24s Hacim</div>
              <div className="text-base sm:text-lg font-bold text-white">{formatUSD(whaleData.volume24h)}</div>
              <div className="text-[9px] text-text-tertiary mt-1">V/MC: {(whaleData.volumeToMcap * 100).toFixed(2)}%</div>
            </div>

            <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
              <div className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Piyasa Degeri</div>
              <div className="text-base sm:text-lg font-bold text-white">{formatUSD(whaleData.marketCap)}</div>
              <div className="text-[9px] text-text-tertiary mt-1">ATH: {whaleData.athDistance.toFixed(1)}%</div>
            </div>

            <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
              <div className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Arz Orani</div>
              <div className="text-base sm:text-lg font-bold text-white">{whaleData.supplyRatio.toFixed(1)}%</div>
              <div className="flex items-center gap-1 mt-1">
                <Users size={10} className="text-text-tertiary" />
                <span className="text-[9px] text-text-tertiary">Dolasimdaki / Toplam</span>
              </div>
            </div>
          </div>

          {/* Buy/Sell Pressure Bar */}
          <div className="bg-surface-3 rounded-xl border border-stroke-subtle p-3 sm:p-4 hover:border-stroke transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-secondary">ALIS / SATIS BASKISI</span>
              <span className="text-[10px] text-text-quaternary">{whaleData.exchangeCount} borsa aktif</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-emerald-400 font-medium">Alis {buyPercent.toFixed(0)}%</span>
                  <span className="text-[10px] text-red-400 font-medium">Satis {(100 - buyPercent).toFixed(0)}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full transition-all duration-700" style={{ width: `${buyPercent}%` }} />
                  <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full transition-all duration-700" style={{ width: `${100 - buyPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
              <div className="flex items-center gap-2">
                <TrendingUp size={12} className="text-emerald-400" />
                <span className="text-text-tertiary">Alis Baskisi:</span>
                <span className="text-emerald-400 font-bold">{formatUSD(whaleData.buyPressureProxy)}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown size={12} className="text-red-400" />
                <span className="text-text-tertiary">Satis Baskisi:</span>
                <span className="text-red-400 font-bold">{formatUSD(whaleData.sellPressureProxy)}</span>
              </div>
            </div>
          </div>

          {/* Top Exchanges by Volume */}
          <div className="bg-surface-3 rounded-2xl border border-stroke-subtle overflow-hidden">
            <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-stroke-subtle">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-amber-400/60" />
                <span className="text-xs font-bold text-text-secondary">BORSA HACIM DAGILIMI — {whaleData.symbol}</span>
              </div>
              <span className="text-[9px] text-text-tertiary">Top {whaleData.topExchangeVolume.length} borsa</span>
            </div>

            <div className="divide-y divide-white/[0.03]">
              {whaleData.topExchangeVolume.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-text-quaternary">Borsa verisi bulunamadi</div>
              )}
              {whaleData.topExchangeVolume.map((ex, idx) => {
                const maxVol = whaleData.topExchangeVolume[0]?.volume || 1
                const widthPercent = (ex.volume / maxVol) * 100
                return (
                  <div key={idx} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5 hover:bg-surface-2 transition-colors">
                    <span className="text-[10px] text-text-tertiary w-5 text-right tabular-nums">{idx + 1}</span>
                    <div className="flex items-center gap-2 w-32 min-w-[100px]">
                      <div className={`w-2 h-2 rounded-full ${ex.trustScore === 'green' ? 'bg-emerald-400' : ex.trustScore === 'yellow' ? 'bg-amber-400' : 'bg-white/20'}`} />
                      <span className="text-xs text-text-secondary font-medium truncate">{ex.name}</span>
                    </div>
                    <div className="flex-1">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500/60 to-amber-400/40 rounded-full transition-all duration-500" style={{ width: `${widthPercent}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-text-secondary font-medium tabular-nums w-24 text-right">{formatUSD(ex.volume)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {!loading && !whaleData && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Eye size={32} className="text-text-quaternary mb-3" />
          <p className="text-sm text-text-tertiary">Whale verileri yuklenemedi</p>
          <p className="text-[10px] text-text-quaternary mt-1">Lutfen tekrar deneyin</p>
        </div>
      )}
    </div>
  )
}
