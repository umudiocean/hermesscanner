'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab: HISSELER (Tum Hisseler Tablosu)
// Modern trading table with signals, Lucide icons, compact layout
// Font sizes: %25 buyutulmus, sutun bosuklari daraltilmis
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'
import { TrendingUp, TrendingDown, Search, Filter, Shield, Zap, AlertTriangle, Minus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Info, Star, BarChart3, Crown, Building2, Layers, Store, Bug } from 'lucide-react'
import { getWatchlist, toggleWatchlist } from '@/lib/store'
import { computeSegmentFromMarketCap } from '@/lib/symbols'

interface RedFlag {
  severity: 'critical' | 'warning'
  category: string
  message: string
  value?: number
}

interface StockRow {
  symbol: string
  companyName: string
  sector: string
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
  // V4 8-Category (Technical kaldirildi)
  categories: {
    valuation: number; health: number; growth: number; analyst: number; quality: number
    insider: number; institutional: number; momentum: number; sector: number; congressional: number
  }
  confidence: number
  redFlags: RedFlag[]
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
}

interface TabStocksProps {
  onSelectSymbol: (symbol: string) => void
}

type SortField = keyof Pick<StockRow, 'symbol' | 'companyName' | 'sector' | 'price' | 'changePercent' | 'marketCap' | 'pe' | 'roe' | 'debtEquity' | 'dividendYield' | 'volume' | 'signalScore' | 'confidence' | 'altmanZ' | 'piotroski' | 'dcfUpside' | 'riskScore' | 'valuationScore' | 'shortFloat'>
type SortDir = 'asc' | 'desc'
type SegmentFilter = 'ALL' | 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO'

const SECTORS = [
  'Tumu', 'Technology', 'Healthcare', 'Financial Services',
  'Consumer Cyclical', 'Communication Services', 'Industrials',
  'Consumer Defensive', 'Energy', 'Basic Materials', 'Real Estate', 'Utilities',
]

const SEGMENT_CONFIG: { key: SegmentFilter; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { key: 'ALL', label: 'Tumu', desc: 'Tum hisseler', icon: <Layers size={13} />, color: 'text-white/60 bg-white/[0.04] border-white/[0.08] hover:border-white/20' },
  { key: 'MEGA', label: 'MEGA', desc: '$200B+', icon: <Crown size={13} />, color: 'text-amber-400 bg-amber-500/8 border-amber-500/20 hover:border-amber-500/40' },
  { key: 'LARGE', label: 'LARGE', desc: '$10B-$200B', icon: <Building2 size={13} />, color: 'text-violet-400 bg-violet-500/8 border-violet-500/20 hover:border-violet-500/40' },
  { key: 'MID', label: 'MID', desc: '$2B-$10B', icon: <Store size={13} />, color: 'text-blue-400 bg-blue-500/8 border-blue-500/20 hover:border-blue-500/40' },
  { key: 'SMALL', label: 'SMALL', desc: '$300M-$2B', icon: <Filter size={13} />, color: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/20 hover:border-emerald-500/40' },
  { key: 'MICRO', label: 'MICRO', desc: '<$300M', icon: <Bug size={13} />, color: 'text-orange-400 bg-orange-500/8 border-orange-500/20 hover:border-orange-500/40' },
]

const SIGNAL_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  STRONG: { color: 'text-amber-400 bg-amber-500/12 border-amber-500/25', icon: <Zap size={12} />, label: 'Guclu' },
  GOOD: { color: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25', icon: <TrendingUp size={12} />, label: 'Iyi' },
  NEUTRAL: { color: 'text-slate-300 bg-white/[0.04] border-white/[0.08]', icon: <Minus size={12} />, label: 'Notr' },
  WEAK: { color: 'text-orange-400 bg-orange-500/12 border-orange-500/25', icon: <AlertTriangle size={12} />, label: 'Zayif' },
  BAD: { color: 'text-red-400 bg-red-500/12 border-red-500/25', icon: <TrendingDown size={12} />, label: 'Kotu' },
}

const COLUMN_TIPS: Record<string, string> = {
  symbol: 'Hisse sembolu — tiklayarak detayli analiz sayfasina gidin',
  company: 'Sirketin tam adi',
  sector: 'Faaliyet gosterdigi sektor (Teknoloji, Finans, Saglik vs.)',
  signal: 'GENEL DEGERLENDIRME — 10 farkli kategorinin bilesimi. GUCLU (altin) = Cok iyi firsat, IYI (yesil) = Olumlu, NOTR (gri) = Bekle, ZAYIF (turuncu) = Dikkat, KOTU (kirmizi) = Uzak dur',
  signalScore: 'HERMES AI PUANI (0-100) — Sirketin temel analiz skoru. 75+ = GUCLU, 60-74 = IYI, 40-59 = NOTR, 25-39 = ZAYIF, 0-24 = KOTU. Puanin uzerine gelin detayli dagilimi gorun.',
  confidence: 'GUVEN SKORU — Verilerin eksiksizlik orani. %70+ = Guvenilir karar verilebilir, %50-69 = Kismi veri, <%50 = Dikkatli olun eksik veri var',
  price: 'GUNCEL FIYAT ($) — Hissenin son islem fiyati',
  change: 'GUNLUK DEGISIM (%) — Bugunun fiyat hareketi. Yesil = yukselis, Kirmizi = dusus',
  marketCap: 'PIYASA DEGERI — Sirketin toplam borsadaki degeri. T = Trilyon $, B = Milyar $, M = Milyon $',
  pe: 'F/K ORANI — Fiyat / Kar. Dusuk = ucuz, Yuksek = pahali. Sektordeki benzer sirketlerle karsilastirin.',
  altmanZ: 'ALTMAN Z-SKORU — Iflas riski olcegi. >3.0 (yesil) = Guvenli bolgede, 1.8-3.0 (sari) = Gri bolge dikkat, <1.8 (kirmizi) = Iflas riski yuksek!',
  piotroski: 'F-SKOR (0-9) — Piotroski finansal saglik testi. 7-9 = Cok saglam bilanço, 5-6 = Iyi, 3-4 = Orta, 0-2 = Zayif bilanço',
  dcfUpside: 'DCF FARKI (%) — Indirimli nakit akis modeline gore gercek deger farki. +% = Fiyat degerinin altinda (firsat), -% = Fiyat degerinin ustunde (pahali)',
  roe: 'ROE — Ozsermaye Getirisi. Sirketin her 1$ ozsermaye icin ne kadar kar urettigi. %15+ = Iyi, %20+ = Cok iyi',
  debtEquity: 'BORC/OZSERMAYE — Sirketin toplam borcu / ozsermayesi. <1 = Dusuk borclanma, 1-2 = Normal, >2 = Agir borclu (riskli)',
  risk: 'RISK PUANI (0-100) — Genel risk degerlendirmesi. 0-25 (yesil) = Dusuk risk, 26-50 (sari) = Orta, 51-75 (turuncu) = Yuksek risk, 76-100 (kirmizi) = Cok riskli!',
  volume: 'ISLEM HACMI — Bugun gerceklesen toplam alim-satim adedi. Yuksek hacim = piyasa ilgisi var',
  valuation: 'FIYATLAMA — Hissenin ucuz mu pahali mi oldugunu gosterir. DCF, sektore gore F/K, PEG orani, EV/EBITDA ve serbest nakit akis getirisi bilesenidir. COK UCUZ = Altin firsat, UCUZ = Uygun, NORMAL = Dengeli, PAHALI = Yuksek, COK PAHALI = Asiri pahali',
  shortFloat: 'HALKA ACIK ORAN (%) — Hisse senetlerinin yuzde kacinin serbest piyasada islem gordugunu gosterir. %90+ = Cok yuksek likidite, %50-90 = Normal, <%50 = Dusuk likidite (buyuk hissedar agirlikli)',
}

export default function TabStocks({ onSelectSymbol }: TabStocksProps) {
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('Tumu')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL')
  const [sortField, setSortField] = useState<SortField>('signalScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)
  const [watchlist, setWatchlist] = useState<string[]>([])

  useEffect(() => { setWatchlist(getWatchlist()) }, [])

  const handleToggleWatchlist = useCallback((e: React.MouseEvent, symbol: string) => {
    e.stopPropagation()
    const result = toggleWatchlist(symbol)
    setWatchlist(result.list)
  }, [])
  const [tooltip, setTooltip] = useState<string | null>(null)
  const pageSize = 50

  const [indexMap, setIndexMap] = useState<Record<string, string[]>>({})

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const [stocksRes, macroRes] = await Promise.allSettled([
          fetch('/api/fmp-terminal/stocks').then(r => r.json()),
          fetch('/api/fmp-terminal/macro').then(r => r.json()),
        ])
        if (stocksRes.status === 'fulfilled') setStocks(stocksRes.value.stocks || [])
        else throw new Error('Veri yuklenemedi')
        if (macroRes.status === 'fulfilled' && macroRes.value.indexMembership) {
          setIndexMap(macroRes.value.indexMembership)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const [watchlistOnly, setWatchlistOnly] = useState(false)

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
    if (watchlistOnly) {
      result = result.filter(s => watchlist.includes(s.symbol))
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s => s.symbol.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q))
    }
    if (sectorFilter !== 'Tumu') result = result.filter(s => s.sector === sectorFilter)
    if (segmentFilter !== 'ALL') {
      result = result.filter(s => computeSegmentFromMarketCap(s.marketCap) === segmentFilter)
    }
    result.sort((a, b) => {
      const aVal = a[sortField], bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string')
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      const aNum = typeof aVal === 'number' && isFinite(aVal) ? aVal : 0
      const bNum = typeof bVal === 'number' && isFinite(bVal) ? bVal : 0
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })
    return result
  }, [stocks, search, sectorFilter, segmentFilter, sortField, sortDir, watchlistOnly, watchlist])

  const paginatedStocks = useMemo(() => filteredStocks.slice(page * pageSize, (page + 1) * pageSize), [filteredStocks, page])
  const totalPages = Math.ceil(filteredStocks.length / pageSize)

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(0)
  }, [sortField])

  if (loading) return <TableSkeleton />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-2 sm:space-y-3 px-2 sm:px-4 lg:px-6 animate-fade-in">
      {/* Segment Filter Cards + Watchlist */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SEGMENT_CONFIG.map(seg => {
          const isActive = segmentFilter === seg.key && !watchlistOnly
          const count = segmentCounts[seg.key]
          return (
            <button key={seg.key}
              onClick={() => { setSegmentFilter(seg.key); setWatchlistOnly(false); setPage(0) }}
              title={`${seg.label} - ${seg.desc}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200
                ${isActive ? seg.color + ' ring-1 ring-white/10 shadow-lg' : 'text-white/30 bg-white/[0.02] border-white/[0.05] hover:border-white/10 hover:text-white/50'}`}>
              {seg.icon}
              <span>{seg.label}</span>
              <span className={`text-[10px] tabular-nums ${isActive ? 'opacity-80' : 'opacity-40'}`}>{count}</span>
            </button>
          )
        })}

        <div className="w-px h-6 bg-white/[0.06] mx-1" />

        <button
          onClick={() => { setWatchlistOnly(w => !w); setPage(0) }}
          title="Watchlist — Sadece takip listenizdeki hisseler"
          className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all duration-300 overflow-hidden
            ${watchlistOnly
              ? 'text-amber-300 bg-gradient-to-r from-amber-500/15 to-amber-600/10 border-amber-400/40 ring-1 ring-amber-400/20 shadow-lg shadow-amber-500/25'
              : 'text-amber-400/40 bg-white/[0.02] border-white/[0.05] hover:border-amber-400/25 hover:text-amber-400/70 hover:bg-amber-500/[0.04]'
            }`}
        >
          {watchlistOnly && (
            <>
              <span className="absolute inset-0 rounded-xl bg-amber-400/[0.07] animate-pulse pointer-events-none" />
              <span className="absolute -inset-1 rounded-xl opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.15), transparent 70%)' }} />
            </>
          )}
          <Star size={13} fill={watchlistOnly ? 'currentColor' : 'none'} className="relative z-[1]" />
          <span className="relative z-[1]">WATCHLIST</span>
          <span className={`relative z-[1] text-[10px] tabular-nums ${watchlistOnly ? 'opacity-90' : 'opacity-40'}`}>{watchlist.length}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-2 sm:gap-2.5 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative group">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-violet-400 transition-colors" />
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value.toUpperCase()); setPage(0) }}
              placeholder="Hisse ara..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white
                         placeholder-white/25 focus:outline-none focus:border-violet-500/30 focus:bg-white/[0.06] w-full sm:w-48 transition-all duration-200"
            />
          </div>
          <div className="relative">
            <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
            <select value={sectorFilter}
              onChange={e => { setSectorFilter(e.target.value); setPage(0) }}
              className="pl-7 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white
                         focus:outline-none focus:border-violet-500/30 cursor-pointer appearance-none transition-all duration-200">
              {SECTORS.map(s => <option key={s} value={s} className="bg-[#151520]">{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/35">
          <span>Toplam: <b className="text-white/80">{stocks.length}</b></span>
          <span>Gosterilen: <b className="text-white/80">{filteredStocks.length}</b></span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/8 border border-violet-500/15 rounded-xl text-xs text-violet-200 animate-fade-in">
          <Info size={13} className="text-violet-400 shrink-0" />
          {tooltip}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl shadow-black/20">
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh]" style={{ willChange: 'transform' }}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0e0e18] z-10 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-white/[0.08]">
              <tr className="border-b border-white/[0.08]">
                <ThC field="symbol" label="SEMBOL" sort={sortField} dir={sortDir} onSort={handleSort}
                  tip={COLUMN_TIPS.symbol} onTip={setTooltip} />
                <ThC field="companyName" label="SIRKET" sort={sortField} dir={sortDir} onSort={handleSort}
                  tip={COLUMN_TIPS.company} onTip={setTooltip} />
                <ThC field="sector" label="SEKTOR" sort={sortField} dir={sortDir} onSort={handleSort}
                  tip={COLUMN_TIPS.sector} onTip={setTooltip} />
                <ThC field="signalScore" label="SINYAL" sort={sortField} dir={sortDir} onSort={handleSort}
                  tip={COLUMN_TIPS.signal} onTip={setTooltip} />
                <ThC field="signalScore" label="PUAN" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.signalScore} onTip={setTooltip} />
                <ThC field="confidence" label="GUVEN" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.confidence} onTip={setTooltip} />
                <ThC field="price" label="FIYAT" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.price} onTip={setTooltip} />
                <ThC field="changePercent" label="DEGISIM" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.change} onTip={setTooltip} />
                <ThC field="marketCap" label="P.DEGERI" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.marketCap} onTip={setTooltip} />
                <ThC field="pe" label="F/K" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.pe} onTip={setTooltip} />
                <ThC field="altmanZ" label="ALTMAN Z" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.altmanZ} onTip={setTooltip} />
                <ThC field="piotroski" label="F-SKOR" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.piotroski} onTip={setTooltip} />
                <ThC field="dcfUpside" label="DCF %" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.dcfUpside} onTip={setTooltip} />
                <ThC field="roe" label="ROE %" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.roe} onTip={setTooltip} />
                <ThC field="debtEquity" label="BORC/OZ" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.debtEquity} onTip={setTooltip} />
                <ThC field="riskScore" label="RISK" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.risk} onTip={setTooltip} />
                <ThC field="valuationScore" label="FIYATLAMA" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.valuation} onTip={setTooltip} />
                <ThC field="shortFloat" label="FLOAT" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.shortFloat} onTip={setTooltip} />
                <ThC field="volume" label="HACIM" sort={sortField} dir={sortDir} onSort={handleSort} align="right"
                  tip={COLUMN_TIPS.volume} onTip={setTooltip} />
              </tr>
            </thead>
            <tbody>
              {paginatedStocks.map((s, idx) => {
                const sig = SIGNAL_CONFIG[s.signal] || SIGNAL_CONFIG.NEUTRAL
                // Renk signal level'dan gelir (percentile-bazli, sabit esik degil)
                const SIGNAL_COLORS: Record<string, string> = { STRONG: '#fbbf24', GOOD: '#34d399', NEUTRAL: '#94a3b8', WEAK: '#fb923c', BAD: '#f87171' }
                const scoreColor = SIGNAL_COLORS[s.signal] || SIGNAL_COLORS.NEUTRAL
                return (
                  <tr key={s.symbol} onClick={() => onSelectSymbol(s.symbol)}
                    className={`border-b border-white/[0.03] hover:bg-violet-500/[0.06] cursor-pointer transition-all duration-150 ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                    <td className="px-1.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleToggleWatchlist(e, s.symbol)}
                          className={`shrink-0 p-0.5 rounded transition-all duration-200 ${
                            watchlist.includes(s.symbol)
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'text-white/15 hover:text-amber-400/60'
                          }`}
                          title={watchlist.includes(s.symbol) ? 'Watchlist\'ten cikar' : 'Watchlist\'e ekle'}
                        >
                          <Star size={13} fill={watchlist.includes(s.symbol) ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-sm font-bold text-white">{s.symbol}</span>
                        {/* V3: Index Badges */}
                        {indexMap[s.symbol]?.map(idx => (
                          <span key={idx} className={`text-[8px] font-bold px-1 py-0 rounded ${
                            idx === 'SP500' ? 'text-violet-300/70 bg-violet-500/10' :
                            idx === 'NDX100' ? 'text-blue-300/70 bg-blue-500/10' :
                            idx === 'DJIA' ? 'text-amber-300/70 bg-amber-500/10' : 'text-white/30 bg-white/[0.04]'
                          }`}>{idx}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-1 py-2">
                      <span className="text-[13px] text-white/50 truncate block max-w-[130px]" title={s.companyName}>{s.companyName}</span>
                    </td>
                    <td className="px-1 py-2">
                      <span className="text-xs text-white/35 truncate block max-w-[80px]" title={s.sector}>
                        {s.sector === 'Unknown' ? '\u2014' : shortSector(s.sector)}
                      </span>
                    </td>
                    <td className="px-1 py-2">
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${sig.color}`}>
                        {sig.icon}
                        <span>{sig.label}</span>
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <div className="group/score relative flex items-center justify-end gap-1.5 cursor-pointer">
                        <div className="w-10 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.signalScore}%`, backgroundColor: scoreColor }} />
                        </div>
                        <span className="text-[13px] text-white/60 tabular-nums w-6 text-right font-semibold">{s.signalScore}</span>
                        {/* Score Breakdown Popup */}
                        <div className="hidden group-hover/score:block absolute z-50 bottom-full right-0 mb-2 w-52 bg-[#141420] border border-white/10 rounded-xl shadow-2xl p-3">
                          <div className="text-[10px] text-white/40 font-semibold mb-2 tracking-wider">HERMES AI SKOR</div>
                          {[
                            { label: 'Degerleme', val: s.categories?.valuation || 0, w: 20 },
                            { label: 'Saglik', val: s.categories?.health || 0, w: 19 },
                            { label: 'Buyume', val: s.categories?.growth || 0, w: 15 },
                            { label: 'Analist', val: s.categories?.analyst || 0, w: 11 },
                            { label: 'Kalite', val: s.categories?.quality || 0, w: 8 },
                            { label: 'Momentum', val: s.categories?.momentum || 0, w: 8 },
                            { label: 'Sektor', val: s.categories?.sector || 0, w: 6 },
                            { label: 'Insider', val: s.categories?.insider || 0, w: 5 },
                            { label: 'Kurumsal', val: s.categories?.institutional || 0, w: 5 },
                            { label: 'Kongre', val: s.categories?.congressional || 0, w: 3 },
                          ].sort((a, b) => b.val - a.val).map(c => (
                            <div key={c.label} className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] text-white/40 w-16 truncate">{c.label}</span>
                              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{
                                  width: `${c.val}%`,
                                  backgroundColor: c.val >= 70 ? '#34d399' : c.val >= 40 ? '#fbbf24' : '#f87171'
                                }} />
                              </div>
                              <span className="text-[10px] tabular-nums text-white/50 w-6 text-right">{c.val}</span>
                              <span className="text-[8px] text-white/20 w-5 text-right">{c.w}%</span>
                            </div>
                          ))}
                          {s.gated && (
                            <div className="mt-2 text-[9px] text-red-400/80 flex items-center gap-1">
                              <AlertTriangle size={9} /> Altman Z Gate aktif (max 50)
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] tabular-nums font-medium ${
                        (s.confidence || 0) >= 70 ? 'text-emerald-400/60' : (s.confidence || 0) >= 50 ? 'text-amber-400/60' : 'text-white/25'
                      }`}>{s.confidence || 30}%</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-sm text-white/90 tabular-nums font-medium">${fmtN(s.price, 2)}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`inline-flex items-center gap-0.5 text-[13px] tabular-nums font-semibold ${s.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.changePercent >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {s.changePercent >= 0 ? '+' : ''}{fmtN(s.changePercent, 2)}%
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-[13px] text-white/50 tabular-nums">{fmtCap(s.marketCap)}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-[13px] text-white/50 tabular-nums">{fmtR(s.pe)}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] tabular-nums font-medium ${
                        (s.altmanZ || 0) >= 3 ? 'text-emerald-400/70' : (s.altmanZ || 0) >= 1.8 ? 'text-amber-400/70' : (s.altmanZ || 0) > 0 ? 'text-red-400/70' : 'text-white/20'
                      }`}>{s.altmanZ > 0 ? s.altmanZ.toFixed(1) : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] tabular-nums font-bold ${
                        (s.piotroski || 0) >= 7 ? 'text-emerald-400' : (s.piotroski || 0) >= 5 ? 'text-amber-400/70' : (s.piotroski || 0) > 0 ? 'text-orange-400/70' : 'text-white/20'
                      }`}>{s.piotroski > 0 ? s.piotroski : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] tabular-nums font-medium ${
                        (s.dcfUpside || 0) > 20 ? 'text-emerald-400' : (s.dcfUpside || 0) > 0 ? 'text-emerald-400/60' : (s.dcfUpside || 0) < -20 ? 'text-red-400' : (s.dcfUpside || 0) < 0 ? 'text-red-400/60' : 'text-white/20'
                      }`}>{s.dcfUpside ? `${s.dcfUpside > 0 ? '+' : ''}${s.dcfUpside.toFixed(0)}%` : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[13px] tabular-nums ${s.roe > 0 ? 'text-emerald-400/70' : s.roe < 0 ? 'text-red-400/70' : 'text-white/25'}`}>
                        {fmtPct(s.roe)}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[13px] tabular-nums ${s.debtEquity > 2 ? 'text-red-400/70' : 'text-white/45'}`}>{fmtR(s.debtEquity)}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full ${
                        (s.riskScore || 50) <= 25 ? 'text-emerald-400 bg-emerald-500/10' :
                        (s.riskScore || 50) <= 50 ? 'text-amber-400 bg-amber-500/10' :
                        (s.riskScore || 50) <= 75 ? 'text-orange-400 bg-orange-500/10' :
                        'text-red-400 bg-red-500/10'
                      }`}>{s.riskScore || 50}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        s.valuationLabel === 'COK UCUZ' ? 'text-emerald-300 bg-emerald-500/15' :
                        s.valuationLabel === 'UCUZ' ? 'text-emerald-400 bg-emerald-500/10' :
                        s.valuationLabel === 'NORMAL' ? 'text-slate-300 bg-white/[0.04]' :
                        s.valuationLabel === 'PAHALI' ? 'text-orange-400 bg-orange-500/10' :
                        s.valuationLabel === 'COK PAHALI' ? 'text-red-400 bg-red-500/10' :
                        'text-white/25 bg-white/[0.03]'
                      }`}>{s.valuationLabel || 'N/A'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] tabular-nums ${
                        (s.shortFloat || 0) >= 90 ? 'text-emerald-400/70' :
                        (s.shortFloat || 0) >= 50 ? 'text-white/45' :
                        (s.shortFloat || 0) > 0 ? 'text-orange-400/70' : 'text-white/15'
                      }`}>{s.shortFloat > 0 ? `${s.shortFloat.toFixed(0)}%` : '\u2014'}</span>
                    </td>
                    <td className="px-1 py-2 text-right">
                      <span className="text-[13px] text-white/35 tabular-nums">{fmtVol(s.volume)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination - Modern */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30">
            Sayfa {page + 1} / {totalPages}
          </span>
          <div className="flex items-center gap-0.5">
            {[
              { icon: <ChevronsLeft size={14} />, act: () => setPage(0), dis: page === 0 },
              { icon: <ChevronLeft size={14} />, act: () => setPage(p => Math.max(0, p - 1)), dis: page === 0 },
              { icon: <ChevronRight size={14} />, act: () => setPage(p => Math.min(totalPages - 1, p + 1)), dis: page >= totalPages - 1 },
              { icon: <ChevronsRight size={14} />, act: () => setPage(totalPages - 1), dis: page >= totalPages - 1 },
            ].map((b, i) => (
              <button key={i} onClick={b.act} disabled={b.dis}
                className="p-1.5 rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-20 transition-all duration-200">
                {b.icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Compact Table Header ──────────────────────────────────────────

function ThC({ field, label, sort, dir, onSort, w = '', align = 'left', tip, onTip }: {
  field: SortField; label: string; sort: SortField; dir: SortDir
  onSort: (f: SortField) => void; w?: string; align?: 'left' | 'right'
  tip?: string; onTip?: (t: string | null) => void
}) {
  return (
    <th onClick={() => onSort(field)}
      onMouseEnter={() => tip && onTip?.(tip)}
      onMouseLeave={() => onTip?.(null)}
      title={tip || ''}
      className={`px-1 py-2.5 text-xs text-white/40 tracking-wider font-semibold cursor-pointer
                  hover:text-white/70 transition-all duration-200 select-none whitespace-nowrap ${w}
                  ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {label}
      {sort === field
        ? <span className="text-violet-400 ml-0.5 text-[10px]">{'\u25B2'}{dir === 'asc' ? '' : '\u25BC'}</span>
        : <span className="text-white/15 ml-0.5 text-[10px]">{'\u25BC'}</span>}
    </th>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────

function shortSector(s: string): string {
  const map: Record<string, string> = {
    'Financial Services': 'Finans', 'Consumer Cyclical': 'Tuketici', 'Consumer Defensive': 'Savunma',
    'Communication Services': 'Iletisim', 'Basic Materials': 'Hammadde', 'Real Estate': 'Gayrimenkul',
    'Technology': 'Teknoloji', 'Healthcare': 'Saglik', 'Industrials': 'Sanayi',
    'Energy': 'Enerji', 'Utilities': 'Altyapi',
  }
  return map[s] || s
}

function fmtN(v: number | null | undefined, d: number = 2): string {
  if (v == null || !isFinite(v)) return '\u2014'; return v.toFixed(d)
}
function fmtR(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return '\u2014'
  if (Math.abs(v) > 999) return '>999'; return v.toFixed(1)
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return '\u2014'
  const pct = Math.abs(v) < 2 ? v * 100 : v; return `${pct.toFixed(1)}%`
}
function fmtCap(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return '\u2014'
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`; return `$${v.toLocaleString()}`
}
function fmtVol(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return '\u2014'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`; return v.toLocaleString()
}

// ─── States ────────────────────────────────────────────────────────

function TableSkeleton() {
  const STEPS = [
    { label: 'Canli veri baglantilari kuruluyor', icon: '◆' },
    { label: 'Piyasa verileri cekiliyor', icon: '◇' },
    { label: 'Tum hisseler analiz ediliyor', icon: '◈' },
    { label: 'HERMES AI skorlari hesaplaniyor', icon: '◆' },
    { label: 'Percentile esikleri belirleniyor', icon: '◇' },
  ]
  const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK.B', 'JPM', 'V', 'UNH', 'XOM', 'JNJ', 'WMT', 'MA', 'PG', 'HD', 'MRK', 'COST', 'ABBV', 'CRM', 'AVGO', 'PEP', 'KO', 'TMO', 'ADBE', 'NFLX', 'AMD', 'INTC', 'QCOM']

  return (
    <div className="relative min-h-[55vh] flex flex-col items-center justify-center overflow-hidden animate-fade-in">
      {/* Background grid + data stream */}
      <div className="absolute inset-0 data-stream pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(179,148,91,0.04) 0%, transparent 70%)' }} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 w-full max-w-lg px-2 sm:px-4">

        {/* Animated ring loader */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20" viewBox="0 0 100 100" style={{ animation: 'ring-spin 2s linear infinite' }}>
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(179,148,91,0.08)" strokeWidth="2" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#goldGrad)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="283" style={{ animation: 'ring-pulse 1.8s ease-in-out infinite' }} />
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C9A96E" />
                <stop offset="50%" stopColor="#B3945B" />
                <stop offset="100%" stopColor="#876b3a" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <BarChart3 size={22} className="text-gold-400" style={{ animation: 'heartbeat 2s ease-in-out infinite' }} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h3 className="text-base font-bold text-white/90 tracking-wide">HERMES AI <span className="gradient-text">Terminal</span></h3>
          <p className="text-[11px] text-white/30 mt-1 tracking-wider">Veriler analiz ediliyor...</p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #876b3a, #C9A96E, #B3945B)' }} />
          </div>
        </div>

        {/* Animated steps */}
        <div className="w-full max-w-xs space-y-1.5">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-2.5 opacity-0"
              style={{ animation: `card-reveal 0.4s ease-out ${0.3 + i * 0.35}s forwards` }}>
              <span className="text-gold-400/60 text-[10px] font-mono">{step.icon}</span>
              <div className="flex-1 relative overflow-hidden">
                <span className="text-[11px] text-white/40 font-medium">{step.label}</span>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="h-full w-1/3 terminal-scan-line" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(179,148,91,0.15), transparent)',
                    animationDelay: `${i * 0.2}s`
                  }} />
                </div>
              </div>
              <div className="w-1 h-1 rounded-full bg-gold-400/30" style={{ animation: `metric-count 0.3s ease-out ${0.6 + i * 0.35}s forwards` }} />
            </div>
          ))}
        </div>

        {/* Skeleton mini-cards: simulated data panels */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-1">
          {[
            { label: 'Bilanco', delay: '0.8s' },
            { label: 'Puanlama', delay: '1.1s' },
            { label: 'Risk', delay: '1.4s' },
          ].map((card, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2.5 opacity-0"
              style={{ animation: `card-reveal 0.5s ease-out ${card.delay} forwards` }}>
              <div className="h-1 w-8 skeleton-shimmer rounded-full mb-2" />
              <div className="h-5 skeleton-shimmer rounded-md mb-1.5" />
              <div className="text-[9px] text-white/20 font-medium tracking-wider">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Simulated chart lines */}
        <div className="w-full max-w-xs h-10 relative overflow-hidden rounded-lg bg-white/[0.015] border border-white/[0.04] opacity-0"
          style={{ animation: 'card-reveal 0.5s ease-out 1.7s forwards' }}>
          <svg className="w-full h-full" viewBox="0 0 300 40" preserveAspectRatio="none">
            <polyline fill="none" stroke="rgba(98,203,193,0.3)" strokeWidth="1.5"
              points="0,30 20,28 40,25 60,27 80,20 100,22 120,15 140,18 160,12 180,14 200,10 220,13 240,8 260,11 280,6 300,9"
              style={{ strokeDasharray: '500', strokeDashoffset: '500', animation: 'ring-pulse 2s ease-in-out 1.9s forwards' }} />
            <polyline fill="none" stroke="rgba(179,148,91,0.2)" strokeWidth="1"
              points="0,35 30,32 60,28 90,30 120,25 150,27 180,22 210,24 240,20 270,22 300,18"
              style={{ strokeDasharray: '500', strokeDashoffset: '500', animation: 'ring-pulse 2s ease-in-out 2.1s forwards' }} />
          </svg>
          <div className="absolute bottom-1 right-2 text-[8px] text-white/15 font-mono">CHART PREVIEW</div>
        </div>

        {/* Ticker tape */}
        <div className="w-full max-w-xs overflow-hidden rounded-lg opacity-0" style={{ animation: 'card-reveal 0.4s ease-out 2s forwards' }}>
          <div className="flex ticker-scroll whitespace-nowrap">
            {[...TICKERS, ...TICKERS].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 text-[9px] font-mono text-white/15">
                {t}
                <span className={i % 3 === 0 ? 'text-hermes-green/20' : i % 3 === 1 ? 'text-red-400/20' : 'text-white/10'}>
                  {i % 3 === 0 ? '▲' : i % 3 === 1 ? '▼' : '—'}
                </span>
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in px-2 sm:px-4">
      <AlertTriangle size={36} className="text-red-400/50 mb-2 sm:mb-3" />
      <p className="text-white/45 text-sm sm:text-base">{message}</p>
      <button onClick={() => window.location.reload()}
        className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium
                   hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-500/20 transition-all duration-200">
        Tekrar Dene
      </button>
    </div>
  )
}
