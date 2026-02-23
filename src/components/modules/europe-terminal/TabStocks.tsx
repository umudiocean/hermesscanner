'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { TrendingUp, TrendingDown, Search, Filter, Shield, Zap, AlertTriangle, Minus, Info, Star, BarChart3, Crown, Building2, Layers, Store, Bug, Globe } from 'lucide-react'
import { getWatchlist, toggleWatchlist } from '@/lib/store'
import { computeSegmentFromMarketCap } from '@/lib/symbols'
import { EUROPE_EXCHANGES, type EuropeExchangeId } from '@/lib/europe-config'
import { ScoreMiniBar, PriceFlashCell } from '../../premium-ui'

interface StockRow {
  symbol: string
  companyName: string
  sector: string
  exchange: string
  currency: string
  price: number
  change: number
  changePercent: number
  marketCap: number
  pe: number
  pb: number
  roe: number
  debtEquity: number
  currentRatio: number
  dividendYield: number
  volume: number
  avgVolume: number
  beta: number
  evEbitda: number
  signal: string
  signalScore: number
  categories: {
    valuation: number; health: number; growth: number; analyst: number; quality: number
    momentum: number; sector: number; smartMoney: number
  }
  confidence: number
  redFlags: Array<{ severity: string; category: string; message: string; value?: number }>
  gated: boolean
  altmanZ: number
  piotroski: number
  dcf: number
  dcfUpside: number
  priceTarget: number
  analystConsensus: string
  riskScore: number
  riskLevel: string
  valuationScore: number
  valuationLabel: string
  shortFloat: number
  badges: Array<{ type: string; label: string; severity: string; description?: string }>
  overvalScore: number
  overvalLevel: string
  yearHigh: number
  yearLow: number
  targetPrice?: number
  floorPrice?: number
  riskReward?: number
  zone?: string
}

type SortField = 'symbol' | 'companyName' | 'sector' | 'price' | 'changePercent' | 'marketCap' | 'pe' | 'roe' | 'debtEquity' | 'volume' | 'signalScore' | 'confidence' | 'altmanZ' | 'piotroski' | 'dcfUpside' | 'riskScore' | 'valuationScore' | 'shortFloat' | 'overvalScore' | 'priceTarget' | 'yearLow' | 'dividendYield' | 'targetPrice' | 'floorPrice' | 'riskReward'
type SortDir = 'asc' | 'desc'
type SegmentFilter = 'ALL' | 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO'
type ExchangeFilter = 'ALL' | EuropeExchangeId

interface TabStocksProps {
  onSelectSymbol: (s: string) => void
  exchangeFilter?: ExchangeFilter
  onExchangeFilterChange?: (v: ExchangeFilter) => void
}

const EXCHANGE_FILTERS: Array<{ key: ExchangeFilter; label: string; flagUrl: string; country: string; color: string }> = [
  { key: 'ALL', label: 'Tum Borsalar', flagUrl: 'https://flagcdn.com/w80/eu.png', country: 'EU', color: 'text-blue-300 bg-blue-500/10 border-blue-500/25' },
  ...Object.values(EUROPE_EXCHANGES).map(ex => ({
    key: ex.id as ExchangeFilter,
    label: `${ex.country} ${ex.shortLabel}`,
    flagUrl: `https://flagcdn.com/w80/${ex.country.toLowerCase()}.png`,
    country: ex.country,
    color: 'text-white/60 bg-white/[0.04] border-white/[0.08] hover:border-blue-400/30',
  })),
]

const SECTORS = [
  'All', 'Technology', 'Healthcare', 'Financial Services',
  'Consumer Cyclical', 'Communication Services', 'Industrials',
  'Consumer Defensive', 'Energy', 'Basic Materials', 'Real Estate', 'Utilities',
]

const SEGMENT_CONFIG: Array<{ key: SegmentFilter; label: string; desc: string; icon: React.ReactNode; color: string }> = [
  { key: 'ALL', label: 'Tumu', desc: 'Tum hisseler', icon: <Layers size={13} />, color: 'text-white/60 bg-white/[0.04] border-white/[0.08] hover:border-white/20' },
  { key: 'MEGA', label: 'MEGA', desc: '$200B+', icon: <Crown size={13} />, color: 'text-amber-400 bg-amber-500/8 border-amber-500/20 hover:border-amber-500/40' },
  { key: 'LARGE', label: 'LARGE', desc: '$10B-$200B', icon: <Building2 size={13} />, color: 'text-violet-400 bg-violet-500/8 border-violet-500/20 hover:border-violet-500/40' },
  { key: 'MID', label: 'MID', desc: '$2B-$10B', icon: <Store size={13} />, color: 'text-blue-400 bg-blue-500/8 border-blue-500/20 hover:border-blue-500/40' },
  { key: 'SMALL', label: 'SMALL', desc: '$300M-$2B', icon: <Filter size={13} />, color: 'text-hermes-green bg-hermes-green/8 border-hermes-green/20 hover:border-hermes-green/40' },
  { key: 'MICRO', label: 'MICRO', desc: '<$300M', icon: <Bug size={13} />, color: 'text-orange-400 bg-orange-500/8 border-orange-500/20 hover:border-orange-500/40' },
]

// Birebir NASDAQ modulleri ile ayni renkler (hermes-ui-design: STRONG=gold, GOOD=hermes-green, WEAK=orange, BAD=red)
const SIGNAL_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  STRONG: { color: 'text-gold-300 bg-gold-400/15 border-gold-400/30', icon: <Zap size={12} />, label: 'Guclu' },
  GOOD: { color: 'text-hermes-green bg-hermes-green/15 border-hermes-green/30', icon: <TrendingUp size={12} />, label: 'Iyi' },
  NEUTRAL: { color: 'text-slate-300 bg-white/[0.04] border-white/[0.08]', icon: <Minus size={12} />, label: 'Notr' },
  WEAK: { color: 'text-orange-400 bg-orange-500/15 border-orange-500/30', icon: <AlertTriangle size={12} />, label: 'Zayif' },
  BAD: { color: 'text-red-400 bg-red-500/15 border-red-500/30', icon: <TrendingDown size={12} />, label: 'Kotu' },
}

export default function TabStocks({ onSelectSymbol, exchangeFilter: controlledExchange, onExchangeFilterChange }: TabStocksProps) {
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('All')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL')
  const [internalExchange, setInternalExchange] = useState<ExchangeFilter>('ALL')
  const exchangeFilter = controlledExchange !== undefined ? controlledExchange : internalExchange
  const setExchangeFilter = onExchangeFilterChange ?? setInternalExchange
  const [sortField, setSortField] = useState<SortField>('signalScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [signalFilter, setSignalFilter] = useState('all')
  const [valuationFilter, setValuationFilter] = useState('all')

  useEffect(() => { setWatchlist(getWatchlist()) }, [])

  const handleToggleWatchlist = useCallback((e: React.MouseEvent, symbol: string) => {
    e.stopPropagation()
    setWatchlist(toggleWatchlist(symbol).list)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/europe-terminal/stocks')
        const data = await res.json()
        if (data.stocks) setStocks(data.stocks)
        else throw new Error('Failed to load European stocks')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const [watchlistOnly, setWatchlistOnly] = useState(false)

  const exchangeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: stocks.length }
    for (const s of stocks) {
      const ex = s.exchange || 'Unknown'
      counts[ex] = (counts[ex] || 0) + 1
    }
    return counts
  }, [stocks])

  const segmentCounts = useMemo(() => {
    const counts: Record<SegmentFilter, number> = { ALL: stocks.length, MEGA: 0, LARGE: 0, MID: 0, SMALL: 0, MICRO: 0 }
    for (const s of stocks) {
      const seg = computeSegmentFromMarketCap(s.marketCap)
      if (seg !== 'ALL') counts[seg as SegmentFilter]++
    }
    return counts
  }, [stocks])

  const filteredStocks = useMemo(() => {
    let result = [...stocks]
    if (watchlistOnly) result = result.filter(s => watchlist.includes(s.symbol))
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s => s.symbol.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q))
    }
    if (sectorFilter !== 'All') result = result.filter(s => s.sector === sectorFilter)
    if (segmentFilter !== 'ALL') result = result.filter(s => computeSegmentFromMarketCap(s.marketCap) === segmentFilter)
    if (exchangeFilter !== 'ALL') result = result.filter(s => s.exchange === exchangeFilter)
    if (signalFilter !== 'all') result = result.filter(s => s.signal === signalFilter)
    if (valuationFilter !== 'all') result = result.filter(s => s.valuationLabel === valuationFilter)
    result.sort((a, b) => {
      const aVal = a[sortField as keyof StockRow], bVal = b[sortField as keyof StockRow]
      if (typeof aVal === 'string' && typeof bVal === 'string')
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      const aNum = typeof aVal === 'number' && isFinite(aVal) ? aVal : 0
      const bNum = typeof bVal === 'number' && isFinite(bVal) ? bVal : 0
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })
    return result
  }, [stocks, search, sectorFilter, segmentFilter, exchangeFilter, sortField, sortDir, watchlistOnly, watchlist, signalFilter, valuationFilter])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }, [sortField])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-2 sm:space-y-3 animate-fade-in">
      {/* Exchange Filter Cards */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {EXCHANGE_FILTERS.map(ex => {
          const isActive = exchangeFilter === ex.key
          const count = ex.key === 'ALL' ? exchangeCounts.ALL : (exchangeCounts[ex.key] || 0)
          return (
            <button key={ex.key} onClick={() => setExchangeFilter(ex.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200
                ${isActive ? ex.color + ' ring-1 ring-blue-400/20 shadow-lg shadow-blue-500/10' : 'text-white/40 bg-white/[0.02] border-white/[0.05] hover:border-blue-400/20 hover:text-white/60'}`}>
              <img src={ex.flagUrl} alt={ex.country} className="w-6 h-4 object-cover rounded drop-shadow-md" title={ex.label} />
              <span>{ex.label}</span>
              <span className={`text-[10px] tabular-nums ${isActive ? 'opacity-80' : 'opacity-40'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Segment Filter + Watchlist */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SEGMENT_CONFIG.map(seg => {
          const isActive = segmentFilter === seg.key && !watchlistOnly
          return (
            <button key={seg.key} onClick={() => { setSegmentFilter(seg.key); setWatchlistOnly(false) }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all duration-200
                ${isActive ? seg.color + ' ring-1 ring-white/10' : 'text-white/35 bg-white/[0.02] border-white/[0.04] hover:border-white/10'}`}>
              {seg.icon}
              <span>{seg.label}</span>
              <span className={`text-[9px] tabular-nums ${isActive ? 'opacity-70' : 'opacity-30'}`}>{segmentCounts[seg.key]}</span>
            </button>
          )
        })}
        <div className="w-px h-5 bg-white/[0.06] mx-0.5" />
        <button onClick={() => setWatchlistOnly(w => !w)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all duration-200
            ${watchlistOnly ? 'text-amber-300 bg-amber-500/15 border-amber-400/40 ring-1 ring-amber-400/20' : 'text-amber-400/40 bg-white/[0.02] border-white/[0.05] hover:border-amber-400/25'}`}>
          <Star size={12} fill={watchlistOnly ? 'currentColor' : 'none'} />
          <span>WATCH</span>
          <span className={`text-[9px] ${watchlistOnly ? 'opacity-80' : 'opacity-40'}`}>{watchlist.length}</span>
        </button>
      </div>

      {/* Signal + Valuation Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-2.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider font-semibold block mb-1.5">Sinyal Filtresi</span>
          <div className="flex gap-1 flex-wrap">
            {            [
              { key: 'all', label: 'Tumu', color: 'text-white/60 bg-white/[0.04] border-white/[0.08]' },
              { key: 'STRONG', label: 'Guclu', color: 'text-gold-300 bg-gold-400/15 border-gold-400/30' },
              { key: 'GOOD', label: 'Iyi', color: 'text-hermes-green bg-hermes-green/15 border-hermes-green/30' },
              { key: 'NEUTRAL', label: 'Notr', color: 'text-slate-300 bg-white/[0.04] border-white/10' },
              { key: 'WEAK', label: 'Zayif', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
              { key: 'BAD', label: 'Kotu', color: 'text-red-400 bg-red-500/15 border-red-500/30' },
            ].map(f => (
              <button key={f.key} onClick={() => setSignalFilter(f.key)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                  signalFilter === f.key ? f.color + ' ring-1 ring-white/10' : 'text-white/35 bg-white/[0.02] border-white/[0.04] hover:border-white/10'
                }`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-2.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider font-semibold block mb-1.5">Degerleme Filtresi</span>
          <div className="flex gap-1 flex-wrap">
            {            [
              { key: 'all', label: 'Tumu', color: 'text-white/60 bg-white/[0.04] border-white/[0.08]' },
              { key: 'COK UCUZ', label: 'Cok Ucuz', color: 'text-hermes-green bg-hermes-green/15 border-hermes-green/30' },
              { key: 'UCUZ', label: 'Ucuz', color: 'text-hermes-green/80 bg-hermes-green/12 border-hermes-green/25' },
              { key: 'NORMAL', label: 'Normal', color: 'text-slate-300 bg-white/[0.04] border-white/10' },
              { key: 'PAHALI', label: 'Pahali', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
              { key: 'COK PAHALI', label: 'Cok Pahali', color: 'text-red-400 bg-red-500/15 border-red-500/30' },
            ].map(f => (
              <button key={f.key} onClick={() => setValuationFilter(f.key)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                  valuationFilter === f.key ? f.color + ' ring-1 ring-white/10' : 'text-white/35 bg-white/[0.02] border-white/[0.04] hover:border-white/10'
                }`}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Search + Counts */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative group">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
              placeholder="Hisse ara..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/30 w-48 transition-all" />
          </div>
          <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none cursor-pointer appearance-none">
            {SECTORS.map(s => <option key={s} value={s} className="bg-[#151520]">{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/45">
          <span>Toplam: <b className="text-white/80">{stocks.length}</b></span>
          <span>Gosterilen: <b className="text-white/80">{filteredStocks.length}</b></span>
        </div>
      </div>

      {tooltip && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/8 border border-blue-500/15 rounded-xl text-xs text-blue-200 animate-fade-in">
          <Info size={13} className="text-blue-400 shrink-0" />{tooltip}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl shadow-black/20">
        <div className="overflow-x-auto overflow-y-auto max-h-[80vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0e0e18] z-10">
              <tr className="border-b border-white/[0.08]">
                <ThC field="symbol" label="SEMBOL" sort={sortField} dir={sortDir} onSort={handleSort} tip="Hisse sembolu" onTip={setTooltip} />
                <ThC field="companyName" label="SIRKET" sort={sortField} dir={sortDir} onSort={handleSort} />
                <th className="px-1 py-2.5 text-xs text-white/50 tracking-wider font-semibold text-left whitespace-nowrap">BORSA</th>
                <ThC field="sector" label="SEKTOR" sort={sortField} dir={sortDir} onSort={handleSort} />
                <ThC field="signalScore" label="SINYAL" sort={sortField} dir={sortDir} onSort={handleSort} />
                <ThC field="signalScore" label="SKOR" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="confidence" label="GUVEN" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="price" label="FIYAT" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="targetPrice" label="HEDEF" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="floorPrice" label="DIP" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="riskReward" label="R:R" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="changePercent" label="DEG%" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="marketCap" label="MCAP" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="pe" label="P/E" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="altmanZ" label="Z" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="piotroski" label="F" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="dcfUpside" label="DCF%" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="roe" label="ROE%" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="debtEquity" label="D/E" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="dividendYield" label="DIV%" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="riskScore" label="RISK" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="valuationScore" label="DEGER" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <ThC field="volume" label="HACIM" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((s, idx) => {
                const sig = SIGNAL_CONFIG[s.signal] || SIGNAL_CONFIG.NEUTRAL
                const exConfig = Object.values(EUROPE_EXCHANGES).find(e => e.id === s.exchange)
                return (
                  <tr key={s.symbol} onClick={() => onSelectSymbol(s.symbol)}
                    className={`border-b border-white/[0.03] cursor-pointer hover:bg-blue-500/[0.04] transition-colors ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                    <td className="px-1.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <button onClick={e => handleToggleWatchlist(e, s.symbol)}
                          className={`shrink-0 p-0.5 rounded transition-all ${watchlist.includes(s.symbol) ? 'text-amber-400' : 'text-white/35 hover:text-amber-400/60'}`}>
                          <Star size={12} fill={watchlist.includes(s.symbol) ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-sm font-bold text-white">{s.symbol}</span>
                      </div>
                    </td>
                    <td className="px-1 py-2"><span className="text-[12px] text-white/60 truncate block max-w-[120px]" title={s.companyName}>{s.companyName}</span></td>
                    <td className="px-1 py-2">
                      <span className="text-[10px] text-white/50 font-medium inline-flex items-center gap-1">
                        {exConfig ? (
                          <>
                            <img src={`https://flagcdn.com/w40/${exConfig.country.toLowerCase()}.png`} alt={exConfig.country} className="w-5 h-3.5 object-cover rounded" />
                            {exConfig.shortLabel}
                          </>
                        ) : s.exchange}
                      </span>
                    </td>
                    <td className="px-1 py-2"><span className="text-[11px] text-white/45 truncate block max-w-[70px]">{shortSector(s.sector)}</span></td>
                    <td className="px-1 py-2">
                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${sig.color}`}>
                        {sig.icon}<span>{sig.label}</span>
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <ScoreMiniBar value={s.signalScore} maxWidth={36} />
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[10px] tabular-nums ${(s.confidence || 0) >= 70 ? 'text-hermes-green/60' : (s.confidence || 0) >= 50 ? 'text-amber-400/60' : 'text-white/35'}`}>
                        {s.confidence || 30}%
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <PriceFlashCell price={s.price} className="text-[13px] text-white/90 font-medium" />
                        <span className="text-[8px] text-white/30">{s.currency || ''}</span>
                      </div>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-[11px] text-white/70 tabular-nums">{s.targetPrice ? s.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-[11px] text-white/60 tabular-nums">{s.floorPrice ? s.floorPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[10px] tabular-nums font-semibold ${
                        (s.riskReward ?? 0) >= 2 ? 'text-hermes-green' : (s.riskReward ?? 0) >= 1 ? 'text-amber-400' : 'text-red-400/80'
                      }`}>{s.riskReward != null ? s.riskReward.toFixed(1) : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`inline-flex items-center gap-0.5 text-[12px] tabular-nums font-semibold ${s.changePercent >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                        {s.changePercent >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {s.changePercent >= 0 ? '+' : ''}{fmtN(s.changePercent, 2)}%
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right"><span className="text-[12px] text-white/60 tabular-nums">{fmtCap(s.marketCap)}</span></td>
                    <td className="px-1 py-2 text-right"><span className="text-[12px] text-white/60 tabular-nums">{fmtR(s.pe)}</span></td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[10px] tabular-nums font-medium ${(s.altmanZ || 0) >= 3 ? 'text-hermes-green/70' : (s.altmanZ || 0) >= 1.8 ? 'text-amber-400/70' : (s.altmanZ || 0) > 0 ? 'text-red-400/70' : 'text-white/40'}`}>
                        {s.altmanZ > 0 ? s.altmanZ.toFixed(1) : '\u2014'}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[10px] tabular-nums font-bold ${(s.piotroski || 0) >= 7 ? 'text-hermes-green' : (s.piotroski || 0) >= 5 ? 'text-amber-400/70' : 'text-white/40'}`}>
                        {s.piotroski > 0 ? s.piotroski : '\u2014'}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[10px] tabular-nums ${(s.dcfUpside || 0) > 20 ? 'text-hermes-green' : (s.dcfUpside || 0) < -20 ? 'text-red-400' : 'text-white/40'}`}>
                        {s.dcfUpside ? `${s.dcfUpside > 0 ? '+' : ''}${s.dcfUpside.toFixed(0)}%` : '\u2014'}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[12px] tabular-nums ${s.roe > 0 ? 'text-hermes-green/70' : s.roe < 0 ? 'text-red-400/70' : 'text-white/35'}`}>{fmtPct(s.roe)}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[12px] tabular-nums ${s.debtEquity > 2 ? 'text-red-400/70' : 'text-white/45'}`}>{fmtR(s.debtEquity)}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] tabular-nums ${(s.dividendYield || 0) > 3 ? 'text-hermes-green/70' : (s.dividendYield || 0) > 0 ? 'text-white/50' : 'text-white/30'}`}>
                        {s.dividendYield > 0 ? `${s.dividendYield.toFixed(1)}%` : '\u2014'}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full ${
                        (s.riskScore || 50) <= 25 ? 'text-hermes-green bg-hermes-green/10' :
                        (s.riskScore || 50) <= 50 ? 'text-amber-400 bg-amber-500/10' :
                        (s.riskScore || 50) <= 75 ? 'text-orange-400 bg-orange-500/10' :
                        'text-red-400 bg-red-500/10'
                      }`}>{s.riskScore || 50}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        s.valuationLabel === 'COK UCUZ' ? 'text-hermes-green bg-hermes-green/15' :
                        s.valuationLabel === 'UCUZ' ? 'text-hermes-green bg-hermes-green/10' :
                        s.valuationLabel === 'NORMAL' ? 'text-slate-300 bg-white/[0.04]' :
                        s.valuationLabel === 'PAHALI' ? 'text-orange-400 bg-orange-500/10' :
                        s.valuationLabel === 'COK PAHALI' ? 'text-red-400 bg-red-500/10' :
                        'text-white/35 bg-white/[0.03]'
                      }`}>{s.valuationLabel || 'N/A'}</span>
                    </td>
                    <td className="px-1 py-2 text-right"><span className="text-[12px] text-white/45 tabular-nums">{fmtVol(s.volume)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-center py-1.5">
        <span className="text-xs text-white/35">Toplam <b className="text-white/60">{filteredStocks.length}</b> hisse listelendi</span>
      </div>
    </div>
  )
}

function ThC({ field, label, sort, dir, onSort, align = 'left', tip, onTip }: {
  field: SortField; label: string; sort: SortField; dir: SortDir
  onSort: (f: SortField) => void; align?: 'left' | 'right'; tip?: string; onTip?: (t: string | null) => void
}) {
  return (
    <th onClick={() => onSort(field)}
      onMouseEnter={() => tip && onTip?.(tip)}
      onMouseLeave={() => onTip?.(null)}
      className={`px-1 py-2.5 text-[11px] text-white/50 tracking-wider font-semibold cursor-pointer hover:text-white/70 transition-all whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {label}
      {sort === field
        ? <span className="text-blue-400 ml-0.5 text-[10px]">{'\u25B2'}{dir === 'asc' ? '' : '\u25BC'}</span>
        : <span className="text-white/35 ml-0.5 text-[10px]">{'\u25BC'}</span>}
    </th>
  )
}

function shortSector(s: string): string {
  const map: Record<string, string> = {
    'Financial Services': 'Finance', 'Consumer Cyclical': 'Cons.Cyc', 'Consumer Defensive': 'Cons.Def',
    'Communication Services': 'Comms', 'Basic Materials': 'Materials', 'Real Estate': 'RE',
    'Technology': 'Tech', 'Healthcare': 'Health', 'Industrials': 'Industry', 'Energy': 'Energy', 'Utilities': 'Utilities',
  }
  return map[s] || s
}
function fmtN(v: number | null | undefined, d = 2): string { if (v == null || !isFinite(v)) return '\u2014'; return v.toFixed(d) }
function fmtR(v: number | null | undefined): string { if (v == null || !isFinite(v) || v === 0) return '\u2014'; if (Math.abs(v) > 999) return '>999'; return v.toFixed(1) }
function fmtPct(v: number | null | undefined): string { if (v == null || !isFinite(v) || v === 0) return '\u2014'; const pct = Math.abs(v) < 2 ? v * 100 : v; return `${pct.toFixed(1)}%` }
function fmtCap(v: number | null | undefined): string { if (v == null || !isFinite(v) || v === 0) return '\u2014'; if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`; if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`; if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`; return `${v.toLocaleString()}` }
function fmtVol(v: number | null | undefined): string { if (v == null || !isFinite(v) || v === 0) return '\u2014'; if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`; if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`; return v.toLocaleString() }

function LoadingSkeleton() {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 animate-spin" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(59,130,246,0.08)" strokeWidth="2" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="80 203" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe size={22} className="text-blue-400 animate-pulse" />
        </div>
      </div>
      <h3 className="text-base font-bold text-white/90 mt-4">AVRUPA TERMINAL <span className="text-blue-400">AI</span></h3>
      <p className="text-[11px] text-white/40 mt-1">Avrupa piyasalari analiz ediliyor...</p>
      <div className="w-48 h-1 bg-white/[0.04] rounded-full overflow-hidden mt-3">
        <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #1e40af, #3b82f6, #60a5fa)' }} />
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in">
      <AlertTriangle size={36} className="text-red-400/50 mb-3" />
      <p className="text-white/45">{message}</p>
      <button onClick={() => window.location.reload()}
        className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 transition-all">
        Tekrar Dene
      </button>
    </div>
  )
}
