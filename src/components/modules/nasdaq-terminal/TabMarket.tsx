'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab: PIYASA & TREND
// Piyasa nabzi, trend gucu, AI skor ozeti, sektor trendi
// Font: %25 buyutulmus
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Activity, BarChart3, Globe, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, Info, Zap, Gauge, Shield, AlertTriangle, ChevronRight, Radio } from 'lucide-react'
import { FearGreedBar } from '../../premium-ui'
import { MarketDashboardData, MarketGainerLoser, IndexQuote, SectorPerformance, TreasuryRate, EconomicEvent } from '@/lib/fmp-terminal/fmp-types'
import type { FredDashboardData, FearGreedComponents } from '@/lib/fred-client'

interface TabMarketProps {
  onSelectSymbol: (symbol: string) => void
}

const INDEX_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ',
  '^DJI': 'Dow Jones',
}

const INDEX_DESC: Record<string, string> = {
  '^GSPC': 'ABD en buyuk 500 sirket',
  '^IXIC': 'Teknoloji agirlikli borsa',
  '^DJI': 'ABD 30 dev sirketi',
}

// ─── Trend hesaplama yardimcilari ────────────────────────────────

function computeMarketTrend(indexes: IndexQuote[], sectors: SectorPerformance[], gainers: MarketGainerLoser[], losers: MarketGainerLoser[]) {
  // Endeks trendi
  const avgIndexChange = indexes.length > 0
    ? indexes.reduce((sum, idx) => sum + (idx.changesPercentage ?? 0), 0) / indexes.length
    : 0

  // Sektor genisligi (pozitif sektor orani)
  const posSectors = sectors.filter(s => (s.changesPercentage ?? 0) > 0).length
  const sectorBreadth = sectors.length > 0 ? (posSectors / sectors.length) * 100 : 50

  // Gainer vs Loser gucu
  const avgGain = gainers.length > 0 ? gainers.slice(0, 5).reduce((s, g) => s + Math.abs(g.changesPercentage ?? 0), 0) / Math.min(5, gainers.length) : 0
  const avgLoss = losers.length > 0 ? losers.slice(0, 5).reduce((s, l) => s + Math.abs(l.changesPercentage ?? 0), 0) / Math.min(5, losers.length) : 0
  const glRatio = avgGain + avgLoss > 0 ? (avgGain / (avgGain + avgLoss)) * 100 : 50

  // Toplam trend skoru (0-100)
  const indexScore = Math.max(0, Math.min(100, 50 + avgIndexChange * 20))
  const trendScore = Math.round(indexScore * 0.4 + sectorBreadth * 0.35 + glRatio * 0.25)

  let trendLabel: string
  let trendColor: string
  if (trendScore >= 70) { trendLabel = 'GUCLU YUKSELIS'; trendColor = 'emerald' }
  else if (trendScore >= 55) { trendLabel = 'YUKSELIS EGILIMI'; trendColor = 'emerald' }
  else if (trendScore >= 45) { trendLabel = 'NOTR / YATAY'; trendColor = 'slate' }
  else if (trendScore >= 30) { trendLabel = 'DUSUS EGILIMI'; trendColor = 'red' }
  else { trendLabel = 'GUCLU DUSUS'; trendColor = 'red' }

  return { trendScore, trendLabel, trendColor, avgIndexChange, sectorBreadth, glRatio, posSectors, totalSectors: sectors.length }
}

function computeWallStreetSentiment(gainers: MarketGainerLoser[], losers: MarketGainerLoser[], mostActive: MarketGainerLoser[]) {
  // Wall Street nabzi: gainer gucu, loser gucu, hacim trendi
  const gainerCount = gainers.length
  const loserCount = losers.length
  const activeUp = mostActive.filter(a => (a.changesPercentage ?? 0) > 0).length
  const activeDown = mostActive.length - activeUp

  const sentiment = gainerCount + loserCount > 0
    ? Math.round((gainerCount / (gainerCount + loserCount)) * 100)
    : 50

  let label: string
  let icon: string
  if (sentiment >= 65) { label = 'Alis Baskisi Agir'; icon = 'bull' }
  else if (sentiment >= 50) { label = 'Hafif Alis Egilimi'; icon = 'neutral_up' }
  else if (sentiment >= 35) { label = 'Hafif Satis Egilimi'; icon = 'neutral_down' }
  else { label = 'Satis Baskisi Agir'; icon = 'bear' }

  return { sentiment, label, icon, activeUp, activeDown, gainerCount, loserCount }
}

interface IndexScoreData {
  name: string
  symbol: string
  memberCount: number
  avgScore: number
  strongCount: number
  goodCount: number
  neutralCount: number
  weakCount: number
  badCount: number
  avgValuation: number
  avgHealth: number
  avgGrowth: number
  topStocks: { symbol: string; score: number; signal: string }[]
  bottomStocks: { symbol: string; score: number; signal: string }[]
  signalLabel: string
  signalColor: string
  trendLabel: string
}

const INDEX_META: Record<string, { icon: string; desc: string; tier: 'official' | 'cap' | 'sector' }> = {
  '^GSPC': { icon: '🏛️', desc: 'ABD en buyuk 500 sirket', tier: 'official' },
  '^IXIC': { icon: '💻', desc: 'Teknoloji agirlikli 100', tier: 'official' },
  '^DJI': { icon: '🏦', desc: 'ABD 30 dev sirketi', tier: 'official' },
  'MEGA': { icon: '👑', desc: '>$200B market cap', tier: 'cap' },
  'LARGE': { icon: '🔵', desc: '$10B-$200B', tier: 'cap' },
  'MID': { icon: '🟢', desc: '$2B-$10B', tier: 'cap' },
  'SMALL': { icon: '🟡', desc: '$300M-$2B', tier: 'cap' },
  'TECH': { icon: '⚡', desc: 'En buyuk 100 teknoloji', tier: 'sector' },
  'HEALTH': { icon: '🏥', desc: 'En buyuk 50 saglik', tier: 'sector' },
  'FIN': { icon: '💰', desc: 'En buyuk 50 finans', tier: 'sector' },
}

export default function TabMarket({ onSelectSymbol }: TabMarketProps) {
  const [data, setData] = useState<MarketDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fredData, setFredData] = useState<(FredDashboardData & { fearGreedV2: FearGreedComponents }) | null>(null)
  const [indexScores, setIndexScores] = useState<IndexScoreData[]>([])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [marketRes, fredRes] = await Promise.all([
          fetch('/api/fmp-terminal/market'),
          fetch('/api/fmp-terminal/fred').catch(() => null),
        ])
        if (!marketRes.ok) throw new Error('Pazar verisi yuklenemedi')
        const json = await marketRes.json()
        setData(json)
        if (fredRes?.ok) {
          const fj = await fredRes.json()
          setFredData(fj)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  // Fetch index member scores — 3 resmi + 7 sentetik endeks
  useEffect(() => {
    async function loadIndexScores() {
      try {
        const [stocksRes, macroRes] = await Promise.all([
          fetch('/api/fmp-terminal/stocks'),
          fetch('/api/fmp-terminal/macro'),
        ])
        if (!stocksRes.ok) return
        const stocksData = await stocksRes.json()
        const macroData = macroRes.ok ? await macroRes.json() : {}
        type StockItem = { symbol: string; signalScore: number; signal: string; sector?: string; marketCap?: number; categories?: { valuation?: number; health?: number; growth?: number } }
        const allStocks: StockItem[] = stocksData.stocks || []
        const stockMap = new Map(allStocks.map(s => [s.symbol, s]))

        // 1) Resmi endeksler — macro indexMembership'ten
        const membership: Record<string, string[]> = macroData.indexMembership || {}
        const sp500Members: string[] = []
        const ndx100Members: string[] = []
        const djiaMembers: string[] = []
        for (const [sym, idxList] of Object.entries(membership)) {
          if ((idxList as string[]).includes('SP500')) sp500Members.push(sym)
          if ((idxList as string[]).includes('NDX100')) ndx100Members.push(sym)
          if ((idxList as string[]).includes('DJIA')) djiaMembers.push(sym)
        }

        // 2) Sentetik endeksler — marketCap ve sektor bazli
        const withMcap = allStocks.filter(s => s.marketCap && s.marketCap > 0 && s.signalScore > 0)
        const sortedByMcap = [...withMcap].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))

        const megaMembers = sortedByMcap.filter(s => (s.marketCap || 0) >= 200e9).map(s => s.symbol)
        const largeMembers = sortedByMcap.filter(s => (s.marketCap || 0) >= 10e9 && (s.marketCap || 0) < 200e9).map(s => s.symbol)
        const midMembers = sortedByMcap.filter(s => (s.marketCap || 0) >= 2e9 && (s.marketCap || 0) < 10e9).map(s => s.symbol)
        const smallMembers = sortedByMcap.filter(s => (s.marketCap || 0) >= 300e6 && (s.marketCap || 0) < 2e9).map(s => s.symbol)

        const techAll = sortedByMcap.filter(s => s.sector === 'Technology')
        const tech100 = techAll.slice(0, 100).map(s => s.symbol)
        const healthAll = sortedByMcap.filter(s => s.sector === 'Healthcare')
        const health50 = healthAll.slice(0, 50).map(s => s.symbol)
        const finAll = sortedByMcap.filter(s => s.sector === 'Financial Services')
        const finance50 = finAll.slice(0, 50).map(s => s.symbol)

        // Build all indexes
        const indexes: { name: string; symbol: string; icon: string; desc: string; tier: 'official' | 'cap' | 'sector'; members: string[] }[] = [
          // Resmi
          { name: 'S&P 500', symbol: '^GSPC', icon: '🏛️', desc: 'ABD en buyuk 500 sirket', tier: 'official', members: sp500Members },
          { name: 'NASDAQ-100', symbol: '^IXIC', icon: '💻', desc: 'Teknoloji agirlikli 100', tier: 'official', members: ndx100Members },
          { name: 'Dow Jones 30', symbol: '^DJI', icon: '🏦', desc: 'ABD 30 dev sirketi', tier: 'official', members: djiaMembers },
          // Market Cap
          { name: 'MEGA CAP', symbol: 'MEGA', icon: '👑', desc: `>$200B (${megaMembers.length} sirket)`, tier: 'cap', members: megaMembers },
          { name: 'LARGE CAP', symbol: 'LARGE', icon: '🔵', desc: `$10B-$200B (${largeMembers.length} sirket)`, tier: 'cap', members: largeMembers },
          { name: 'MID CAP', symbol: 'MID', icon: '🟢', desc: `$2B-$10B (${midMembers.length} sirket)`, tier: 'cap', members: midMembers },
          { name: 'SMALL CAP', symbol: 'SMALL', icon: '🟡', desc: `$300M-$2B (${smallMembers.length} sirket)`, tier: 'cap', members: smallMembers },
          // Sektor
          { name: 'TECH 100', symbol: 'TECH', icon: '⚡', desc: `En buyuk 100 teknoloji`, tier: 'sector', members: tech100 },
          { name: 'HEALTH 50', symbol: 'HEALTH', icon: '🏥', desc: `En buyuk 50 saglik`, tier: 'sector', members: health50 },
          { name: 'FINANCE 50', symbol: 'FIN', icon: '💰', desc: `En buyuk 50 finans`, tier: 'sector', members: finance50 },
        ]

        function buildIndexScore(idx: typeof indexes[0]): IndexScoreData {
          const scored = idx.members
            .map(sym => stockMap.get(sym))
            .filter((s): s is StockItem => !!s && s.signalScore > 0)

          const scores = scored.map(s => s.signalScore)
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

          const signalCounts = { strong: 0, good: 0, neutral: 0, weak: 0, bad: 0 }
          for (const s of scored) {
            const sig = s.signal?.toUpperCase() || 'NEUTRAL'
            if (sig === 'STRONG') signalCounts.strong++
            else if (sig === 'GOOD') signalCounts.good++
            else if (sig === 'WEAK') signalCounts.weak++
            else if (sig === 'BAD') signalCounts.bad++
            else signalCounts.neutral++
          }

          const valScores = scored.filter(s => s.categories?.valuation).map(s => s.categories!.valuation!)
          const hltScores = scored.filter(s => s.categories?.health).map(s => s.categories!.health!)
          const grwScores = scored.filter(s => s.categories?.growth).map(s => s.categories!.growth!)

          const sorted = [...scored].sort((a, b) => b.signalScore - a.signalScore)
          const top5 = sorted.slice(0, 5).map(s => ({ symbol: s.symbol, score: s.signalScore, signal: s.signal }))
          const bottom5 = sorted.slice(-5).reverse().map(s => ({ symbol: s.symbol, score: s.signalScore, signal: s.signal }))

          let signalLabel: string, signalColor: string
          if (avg >= 70) { signalLabel = 'GUCLU'; signalColor = '#62cbc1' }
          else if (avg >= 55) { signalLabel = 'IYI'; signalColor = '#62cbc1' }
          else if (avg >= 45) { signalLabel = 'NOTR'; signalColor = '#94a3b8' }
          else if (avg >= 30) { signalLabel = 'ZAYIF'; signalColor = '#fb923c' }
          else { signalLabel = 'KOTU'; signalColor = '#f87171' }

          const positiveRatio = scored.length > 0 ? (signalCounts.strong + signalCounts.good) / scored.length : 0
          let trendLabel: string
          if (positiveRatio >= 0.6) trendLabel = 'Yukselis Egilimi'
          else if (positiveRatio >= 0.4) trendLabel = 'Dengeli'
          else trendLabel = 'Dusus Egilimi'

          return {
            name: idx.name, symbol: idx.symbol, memberCount: scored.length, avgScore: avg,
            strongCount: signalCounts.strong, goodCount: signalCounts.good, neutralCount: signalCounts.neutral,
            weakCount: signalCounts.weak, badCount: signalCounts.bad,
            avgValuation: valScores.length > 0 ? Math.round(valScores.reduce((a, b) => a + b, 0) / valScores.length) : 0,
            avgHealth: hltScores.length > 0 ? Math.round(hltScores.reduce((a, b) => a + b, 0) / hltScores.length) : 0,
            avgGrowth: grwScores.length > 0 ? Math.round(grwScores.reduce((a, b) => a + b, 0) / grwScores.length) : 0,
            topStocks: top5, bottomStocks: bottom5, signalLabel, signalColor, trendLabel,
          }
        }

        setIndexScores(indexes.filter(i => i.members.length > 0).map(buildIndexScore))
      } catch { /* silent — index scores are enhancement */ }
    }
    loadIndexScores()
  }, [])

  // Computed trends
  const trend = useMemo(() => {
    if (!data) return null
    return computeMarketTrend(data.indexes, data.sectorPerformance, data.topGainers, data.topLosers)
  }, [data])

  const wallStreet = useMemo(() => {
    if (!data) return null
    return computeWallStreetSentiment(data.topGainers, data.topLosers, data.mostActive)
  }, [data])

  const hermesPulse = useMemo(() => {
    if (!data || !trend) return null
    const fg = data.fearGreedIndex ?? 50
    const fredFG = fredData?.fearGreedV2?.composite ?? 50
    const trendScore = trend.trendScore
    const sectorBreadth = trend.sectorBreadth
    const wsScore = wallStreet?.sentiment ?? 50

    const composite = Math.round(
      trendScore * 0.30 + fg * 0.20 + fredFG * 0.20 + sectorBreadth * 0.15 + wsScore * 0.15
    )

    let label: string, color: string
    if (composite >= 75) { label = 'GUCLU YUKSELIS'; color = '#62cbc1' }
    else if (composite >= 60) { label = 'YUKSELIS'; color = '#62cbc1' }
    else if (composite >= 45) { label = 'NOTR'; color = '#94a3b8' }
    else if (composite >= 30) { label = 'DUSUS'; color = '#fb923c' }
    else { label = 'GUCLU DUSUS'; color = '#f87171' }

    return { composite, label, color, components: { trendScore, fg, fredFG: Math.round(fredFG), sectorBreadth: Math.round(sectorBreadth), wsScore } }
  }, [data, trend, fredData, wallStreet])

  if (loading) return <MarketSkeleton />
  if (error) return <ErrorState message={error} />
  if (!data) return <ErrorState message="Veri bulunamadi" />

  return (
    <div className="space-y-2 sm:space-y-4 px-2 sm:px-4 lg:px-6 animate-fade-in">

      {/* ═══ HERMES AI PULSE — Tum Sistem Nabzi ═══ */}
      {hermesPulse && <HermesPulseGauge pulse={hermesPulse} />}

      {/* ═══ PIYASA ACILIS ONGORU — mevcut market verisinden ═══ */}
      {data && <MarketOpenForecast data={data} />}

      {/* ═══ FEAR & GREED INDEX BAR ═══ */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20 glass-card">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-violet-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Korku & Acgozluluk Endeksi</h3>
          <span className="text-[10px] text-white/35 ml-1">Piyasa duyarlilik olceri</span>
        </div>
        <FearGreedBar value={data.fearGreedIndex ?? 50} label={data.fearGreedLabel ?? 'NEUTRAL'} />
      </div>

      {/* ═══ FEAR & GREED v2 (FRED Bazli) ═══ */}
      {fredData && <FearGreedV2 fg={fredData.fearGreedV2} />}

      {/* ═══ MAKRO RADAR (FRED) ═══ */}
      {fredData && <MacroRadarCards fred={fredData} />}

      {/* ═══ ROW 1: TREND GUCU + HERMES AI SKOR + ENDEKSLER ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3">

        {/* Trend Gucu Gauge */}
        {trend && (
          <div className="lg:col-span-3 bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 mb-4">
              <Gauge size={18} className="text-violet-400" />
              <div>
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Piyasa Trend Gucu</h3>
                <p className="text-[11px] text-white/40">Canli endeks, sektor ve hacim analizi</p>
              </div>
            </div>

            {/* Big Score */}
            <div className="flex flex-col items-center mb-4">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none"
                    stroke={trend.trendColor === 'emerald' ? '#62cbc1' : trend.trendColor === 'red' ? '#f87171' : '#94a3b8'}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${trend.trendScore * 3.14} 314`}
                    className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black tabular-nums ${trend.trendColor === 'emerald' ? 'text-hermes-green' : trend.trendColor === 'red' ? 'text-red-400' : 'text-slate-300'}`}>
                    {trend.trendScore}
                  </span>
                  <span className="text-[10px] text-white/50">/100</span>
                </div>
              </div>
              <span className={`mt-2 text-sm font-bold tracking-wide ${trend.trendColor === 'emerald' ? 'text-hermes-green' : trend.trendColor === 'red' ? 'text-red-400' : 'text-slate-400'}`}>
                {trend.trendLabel}
              </span>
            </div>

            {/* Trend breakdown */}
            <div className="space-y-2">
              <TrendBar label="Endeks Trendi" value={Math.round(50 + trend.avgIndexChange * 20)} desc={`${trend.avgIndexChange >= 0 ? '+' : ''}${trend.avgIndexChange.toFixed(2)}% ort.`} />
              <TrendBar label="Sektor Genisligi" value={Math.round(trend.sectorBreadth)} desc={`${trend.posSectors}/${trend.totalSectors} pozitif`} />
              <TrendBar label="Alis/Satis Gucu" value={Math.round(trend.glRatio)} desc="Top 5 gainer vs loser" />
            </div>
          </div>
        )}

        {/* HERMES AI Skor Ozeti */}
        <HermesAIScoreSummary />

        {/* Index Cards */}
        <div className="lg:col-span-6">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={16} className="text-violet-400/60" />
            <h3 className="text-sm font-bold text-white/65 uppercase tracking-wider">Ana Endeksler</h3>
            <p className="text-[11px] text-white/35 ml-1">ABD borsalarinin anlik durumu</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            {data.indexes.length > 0 ? (
              data.indexes.map((idx, i) => <IndexCard key={i} index={idx} />)
            ) : (
              ['S&P 500', 'NASDAQ', 'Dow Jones'].map(n => (
                <div key={n} className="bg-[#151520] rounded-2xl border border-white/[0.06] p-4 animate-pulse">
                  <span className="text-xs text-white/35">{n}</span>
                  <div className="mt-2 h-6 w-24 bg-white/[0.04] rounded-lg" />
                </div>
              ))
            )}
          </div>

          {/* Treasury below indexes */}
          <div className="mt-2 sm:mt-3 bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-violet-400/60" />
              <h3 className="text-sm font-bold text-white/65 uppercase tracking-wider">ABD Tahvil Faizleri</h3>
              <p className="text-[11px] text-white/35 ml-1">Kisa ve uzun vadeli oranlar</p>
            </div>
            {data.treasury ? <TreasuryDisplay treasury={data.treasury} /> : (
              <p className="text-white/35 text-xs mt-3">Faiz verisi bekleniyor...</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ HERMES AI ENDEKS PANELI — 10 ENDEKS ═══ */}
      {indexScores.length > 0 && (() => {
        const official = indexScores.filter(i => INDEX_META[i.symbol]?.tier === 'official')
        const cap = indexScores.filter(i => INDEX_META[i.symbol]?.tier === 'cap')
        const sector = indexScores.filter(i => INDEX_META[i.symbol]?.tier === 'sector')
        const allAvg = indexScores.length > 0 ? Math.round(indexScores.reduce((s, i) => s + i.avgScore, 0) / indexScores.length) : 0
        const allColor = allAvg >= 55 ? '#62cbc1' : allAvg >= 45 ? '#94a3b8' : '#f87171'

        return (
          <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">HERMES AI Endeks Paneli</h3>
                  <p className="text-[10px] text-white/35">10 endeks, HERMES AI puanlamasi</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40">Genel Ort:</span>
                <span className="text-xl font-black tabular-nums" style={{ color: allColor }}>{allAvg}</span>
              </div>
            </div>

            {/* RESMI ENDEKSLER */}
            {official.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
                  <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Resmi Endeksler</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-violet-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                  {official.map(idx => <IndexScoreCard key={idx.symbol} idx={idx} onSelectSymbol={onSelectSymbol} expanded />)}
                </div>
              </div>
            )}

            {/* MARKET CAP */}
            {cap.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent" />
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Market Cap Segmentleri</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-blue-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {cap.map(idx => <IndexScoreCard key={idx.symbol} idx={idx} onSelectSymbol={onSelectSymbol} />)}
                </div>
              </div>
            )}

            {/* SEKTOR */}
            {sector.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Sektor Endeksleri</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                  {sector.map(idx => <IndexScoreCard key={idx.symbol} idx={idx} onSelectSymbol={onSelectSymbol} />)}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ═══ ROW 2: SEKTOR ROTASYON & PERFORMANS ═══ */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-400/60" />
            <h3 className="text-sm font-bold text-white/65 uppercase tracking-wider">Sektor Rotasyon & Performans</h3>
            <p className="text-[11px] text-white/35 ml-1">Her sektorun gunluk degisimi ve para akisi</p>
          </div>
          {/* Makro Rejim Badge */}
          {(() => {
            const posCount = data.sectorPerformance.filter(s => (s.changesPercentage ?? 0) > 0).length
            const total = data.sectorPerformance.length || 1
            const breadthRatio = posCount / total
            const regime = breadthRatio >= 0.7 ? 'RISK-ON' : breadthRatio >= 0.4 ? 'NEUTRAL' : 'RISK-OFF'
            const regimeColor = regime === 'RISK-ON' ? 'text-hermes-green bg-hermes-green/15 border-hermes-green/25' : regime === 'RISK-OFF' ? 'text-red-400 bg-red-500/15 border-red-500/25' : 'text-slate-300 bg-white/[0.06] border-white/[0.1]'
            return (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${regimeColor}`}>
                {regime} ({posCount}/{total})
              </span>
            )
          })()}
        </div>
        {data.sectorPerformance.length > 0 ? (
          <>
            {/* Sektor bar chart - sortlanmis */}
            <div className="space-y-1.5 mb-3">
              {[...data.sectorPerformance]
                .sort((a, b) => (b.changesPercentage ?? 0) - (a.changesPercentage ?? 0))
                .map((sp, i) => {
                  const pct = sp.changesPercentage ?? 0
                  const isPos = pct >= 0
                  const barWidth = Math.min(100, Math.abs(pct) * 15)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-white/60 w-24 truncate">{sp.sector}</span>
                      <div className="flex-1 h-4 relative bg-white/[0.03] rounded-md overflow-hidden">
                        <div className={`absolute top-0 h-full rounded-md transition-all duration-500 ${isPos ? 'left-1/2 bg-hermes-green/30' : 'right-1/2 bg-red-500/30'}`}
                          style={{ width: `${barWidth / 2}%` }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-[10px] font-bold tabular-nums ${isPos ? 'text-hermes-green' : 'text-red-400'}`}>
                            {isPos ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] w-5 text-center ${isPos ? 'text-hermes-green/60' : 'text-red-400/60'}`}>
                        {isPos ? '\u25B2' : '\u25BC'}
                      </span>
                    </div>
                  )
                })
              }
            </div>
            {/* Grid tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {data.sectorPerformance.map((sp, i) => <SectorTile key={i} sector={sp} />)}
            </div>
          </>
        ) : (
          <p className="text-white/35 text-xs">Sektor verisi bekleniyor...</p>
        )}
      </div>

      {/* ═══ ROW 3: MOVERS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
        <MoversCard title="En Cok Yukselen" desc="Bugun en fazla artan hisseler" items={data.topGainers}
          type="gainer" icon={<ArrowUpRight size={16} className="text-hermes-green" />} onSelect={onSelectSymbol} />
        <MoversCard title="En Cok Dusen" desc="Bugun en fazla dusen hisseler" items={data.topLosers}
          type="loser" icon={<ArrowDownRight size={16} className="text-red-400" />} onSelect={onSelectSymbol} />
        <MoversCard title="En Yuksek Hacim" desc="En cok alim-satim yapilan hisseler" items={data.mostActive}
          type="active" icon={<Activity size={16} className="text-violet-400" />} onSelect={onSelectSymbol} />
      </div>

      {/* ═══ ROW 3.5: BUYUK PARA AKISI (V3) ═══ */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 shadow-xl shadow-black/20">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-hermes-green/60" />
          <h3 className="text-sm font-bold text-white/65 uppercase tracking-wider">Buyuk Para Akisi</h3>
          <p className="text-[11px] text-white/35 ml-1">Kurumsal yatirimci yonu</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
            <div className="text-[11px] text-white/40 mb-1">Yukselenler Gucu</div>
            <div className="text-base font-bold text-hermes-green tabular-nums">
              {data.topGainers.slice(0, 5).reduce((s, g) => s + Math.abs(g.changesPercentage || 0), 0).toFixed(1)}%
            </div>
            <div className="text-[10px] text-white/40">Top 5 ort. yukselis</div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
            <div className="text-[11px] text-white/40 mb-1">Dusenler Gucu</div>
            <div className="text-base font-bold text-red-400 tabular-nums">
              {data.topLosers.slice(0, 5).reduce((s, l) => s + Math.abs(l.changesPercentage || 0), 0).toFixed(1)}%
            </div>
            <div className="text-[10px] text-white/40">Top 5 ort. dusus</div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
            <div className="text-[11px] text-white/40 mb-1">Aktif Hacim</div>
            <div className="text-base font-bold text-violet-400 tabular-nums">
              {data.mostActive.length}
            </div>
            <div className="text-[10px] text-white/40">Yuksek hacim hisse</div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
            <div className="text-[11px] text-white/40 mb-1">Net Yon</div>
            {(() => {
              const upCount = data.mostActive.filter(a => (a.changesPercentage ?? 0) > 0).length
              const total = data.mostActive.length || 1
              const ratio = upCount / total
              return (
                <>
                  <div className={`text-base font-bold tabular-nums ${ratio > 0.5 ? 'text-hermes-green' : 'text-red-400'}`}>
                    {ratio > 0.6 ? 'ALICI' : ratio < 0.4 ? 'SATICI' : 'DENGELI'}
                  </div>
                  <div className="text-[10px] text-white/40">{(ratio * 100).toFixed(0)}% pozitif</div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ═══ ROW 4: ECONOMIC CALENDAR ═══ */}
      {data.economicCalendar.length > 0 && (
        <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 shadow-xl shadow-black/20">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-violet-400/60" />
            <h3 className="text-sm font-bold text-white/65 uppercase tracking-wider">Ekonomik Takvim</h3>
            <p className="text-[11px] text-white/35 ml-1">Piyasayi etkileyebilecek yaklasan olaylar</p>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {data.economicCalendar.slice(0, 15).map((event, i) => <EventRow key={i} event={event} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Trend Bar Component ────────────────────────────────────────

function TrendBar({ label, value, desc }: { label: string; value: number; desc: string }) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const color = clampedValue >= 60 ? '#62cbc1' : clampedValue >= 40 ? '#94a3b8' : '#f87171'
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-white/60">{label}</span>
        <span className="text-[11px] text-white/50">{desc}</span>
      </div>
      <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clampedValue}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ─── Index Score Card — HERMES AI Endeks Skoru ────────────────────

function IndexScoreCard({ idx, onSelectSymbol, expanded = false }: { idx: IndexScoreData; onSelectSymbol: (s: string) => void; expanded?: boolean }) {
  const meta = INDEX_META[idx.symbol] || { icon: '📊', desc: '', tier: 'cap' as const }
  const tierBorder = meta.tier === 'official' ? 'border-violet-500/15 hover:border-violet-500/30' :
    meta.tier === 'cap' ? 'border-blue-500/10 hover:border-blue-500/25' :
    'border-amber-500/10 hover:border-amber-500/25'

  return (
    <div className={`bg-[#0c0c14] rounded-xl border p-3 sm:p-4 transition-all duration-300 ${tierBorder} group`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white/90 truncate">{idx.name}</h4>
            <span className="text-[9px] text-white/35">{idx.memberCount} hisse</span>
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-xl font-black tabular-nums leading-none" style={{ color: idx.signalColor }}>
            {idx.avgScore}
          </span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-0.5" style={{ color: idx.signalColor, backgroundColor: `${idx.signalColor}12`, border: `1px solid ${idx.signalColor}25` }}>
            {idx.signalLabel}
          </span>
        </div>
      </div>

      {/* Score progress */}
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${idx.avgScore}%`, background: `linear-gradient(90deg, ${idx.signalColor}50, ${idx.signalColor})` }} />
      </div>

      {/* Signal distribution */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-1.5">
        {idx.strongCount > 0 && <div className="bg-amber-400 rounded-sm" style={{ flex: idx.strongCount }} />}
        {idx.goodCount > 0 && <div className="bg-emerald-400 rounded-sm" style={{ flex: idx.goodCount }} />}
        {idx.neutralCount > 0 && <div className="bg-slate-500/80 rounded-sm" style={{ flex: idx.neutralCount }} />}
        {idx.weakCount > 0 && <div className="bg-orange-400 rounded-sm" style={{ flex: idx.weakCount }} />}
        {idx.badCount > 0 && <div className="bg-red-400 rounded-sm" style={{ flex: idx.badCount }} />}
      </div>
      <div className="flex flex-wrap gap-x-2 text-[8px] text-white/40 mb-2">
        {idx.strongCount > 0 && <span className="text-amber-400">{idx.strongCount}</span>}
        <span className="text-emerald-400">{idx.goodCount}</span>
        <span className="text-slate-400">{idx.neutralCount}</span>
        {idx.weakCount > 0 && <span className="text-orange-400">{idx.weakCount}</span>}
        {idx.badCount > 0 && <span className="text-red-400">{idx.badCount}</span>}
      </div>

      {/* Category mini scores */}
      {expanded && (
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {[
            { label: 'Degerleme', val: idx.avgValuation },
            { label: 'Saglik', val: idx.avgHealth },
            { label: 'Buyume', val: idx.avgGrowth },
          ].map(c => (
            <div key={c.label} className="text-center p-1 rounded-lg bg-white/[0.03]">
              <div className="text-[8px] text-white/35 uppercase">{c.label}</div>
              <div className="text-xs font-bold text-white/70 tabular-nums">{c.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trend */}
      <div className="flex items-center justify-between text-[9px] px-0.5">
        <span className="text-white/35">Trend</span>
        <span className="font-bold" style={{ color: idx.signalColor }}>{idx.trendLabel}</span>
      </div>

      {/* Top / Bottom */}
      {expanded && (
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/[0.04]">
          <div>
            <div className="text-[8px] text-emerald-400/60 uppercase mb-0.5">En Iyi 5</div>
            {idx.topStocks.map(s => (
              <button key={s.symbol} onClick={() => onSelectSymbol(s.symbol)}
                className="flex items-center justify-between w-full text-[9px] py-0.5 px-0.5 rounded hover:bg-white/[0.04] transition-colors">
                <span className="text-white/60 font-medium">{s.symbol}</span>
                <span className="text-emerald-400 font-bold tabular-nums">{s.score}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="text-[8px] text-red-400/60 uppercase mb-0.5">En Zayif 5</div>
            {idx.bottomStocks.map(s => (
              <button key={s.symbol} onClick={() => onSelectSymbol(s.symbol)}
                className="flex items-center justify-between w-full text-[9px] py-0.5 px-0.5 rounded hover:bg-white/[0.04] transition-colors">
                <span className="text-white/60 font-medium">{s.symbol}</span>
                <span className="text-red-400 font-bold tabular-nums">{s.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Index Card ────────────────────────────────────────────────────

function IndexCard({ index }: { index: IndexQuote }) {
  const change = index.change ?? 0
  const pct = index.changesPercentage ?? 0
  const price = index.price ?? 0
  const isUp = change >= 0
  const name = INDEX_NAMES[index.symbol] || index.name || 'Index'
  const desc = INDEX_DESC[index.symbol] || ''

  return (
    <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 hover:border-white/[0.12] transition-all duration-300 shadow-xl shadow-black/20 group">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs text-white/45 font-medium">{name}</span>
          {desc && <p className="text-[10px] text-white/35">{desc}</p>}
        </div>
        <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${isUp ? 'bg-hermes-green/12 text-hermes-green' : 'bg-red-500/12 text-red-400'}`}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl sm:text-2xl font-bold text-white/90 tabular-nums group-hover:text-white transition-colors">
          {price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </span>
        <span className={`text-sm tabular-nums ${isUp ? 'text-hermes-green/70' : 'text-red-400/70'}`}>
          {isUp ? '+' : ''}{change.toFixed(2)}
        </span>
      </div>
      {/* Day range */}
      {index.dayLow > 0 && index.dayHigh > 0 && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] text-white/35 tabular-nums">{index.dayLow.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden relative">
            <div className="absolute h-full bg-gradient-to-r from-red-400/40 via-violet-400/60 to-hermes-green/40 rounded-full"
              style={{ width: `${Math.min(100, ((price - index.dayLow) / (index.dayHigh - index.dayLow)) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-white/35 tabular-nums">{index.dayHigh.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      )}
    </div>
  )
}

// ─── Sector Tile ───────────────────────────────────────────────────

function SectorTile({ sector }: { sector: SectorPerformance }) {
  const pct = sector.changesPercentage ?? 0
  const isUp = pct >= 0
  const intensity = Math.min(1, Math.abs(pct) / 3)

  return (
    <div className="rounded-xl p-3 border border-white/[0.05] hover:border-white/[0.12] transition-all duration-200 cursor-default"
      style={{
        backgroundColor: isUp
          ? `rgba(98,203,193,${0.04 + intensity * 0.12})`
          : `rgba(248,113,113,${0.04 + intensity * 0.12})`,
      }}>
      <div className="text-[11px] text-white/60 truncate mb-1 font-medium">{sector.sector || 'Unknown'}</div>
      <div className={`flex items-center gap-0.5 text-base font-bold tabular-nums ${isUp ? 'text-hermes-green' : 'text-red-400'}`}>
        {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {isUp ? '+' : ''}{pct.toFixed(2)}%
      </div>
    </div>
  )
}

// ─── Treasury ──────────────────────────────────────────────────────

function TreasuryDisplay({ treasury }: { treasury: TreasuryRate }) {
  const rates = [
    { label: '3 Ay', value: treasury.month3 ?? 0 },
    { label: '6 Ay', value: treasury.month6 ?? 0 },
    { label: '1 Yil', value: treasury.year1 ?? 0 },
    { label: '2 Yil', value: treasury.year2 ?? 0 },
    { label: '5 Yil', value: treasury.year5 ?? 0 },
    { label: '10 Yil', value: treasury.year10 ?? 0 },
    { label: '30 Yil', value: treasury.year30 ?? 0 },
  ]
  const spread = (treasury.year10 ?? 0) - (treasury.year2 ?? 0)
  const inverted = spread < 0

  return (
    <div className="flex items-start gap-4 mt-2">
      <div className="flex-1 grid grid-cols-4 sm:grid-cols-7 gap-1.5">
        {rates.map(r => (
          <div key={r.label} className="text-center">
            <span className="block text-[10px] text-white/45 mb-1">{r.label}</span>
            <div className="h-10 relative flex items-end justify-center">
              <div className="w-full bg-gradient-to-t from-violet-500/40 to-blue-500/20 rounded-t"
                style={{ height: `${Math.min(100, (r.value / 6) * 100)}%` }} />
            </div>
            <span className="block text-xs text-white/70 tabular-nums font-semibold mt-0.5">{r.value.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      <div className={`shrink-0 px-2 sm:px-3 py-2 rounded-xl border text-center min-w-0 sm:min-w-[100px] ${inverted ? 'bg-red-500/8 border-red-500/15' : 'bg-hermes-green/8 border-hermes-green/15'}`}>
        <div className="flex items-center gap-1 justify-center mb-1">
          <Info size={11} className={inverted ? 'text-red-400/60' : 'text-hermes-green/60'} />
          <span className="text-[10px] text-white/50">2Y-10Y</span>
        </div>
        <span className={`text-base font-bold tabular-nums ${inverted ? 'text-red-400' : 'text-hermes-green'}`}>
          {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
        </span>
        {inverted && <p className="text-[9px] text-red-400/50 mt-1">Ters yield egrisi</p>}
      </div>
    </div>
  )
}

// ─── Movers Card ───────────────────────────────────────────────────

function MoversCard({ title, desc, items, type, icon, onSelect }: {
  title: string; desc: string; items: MarketGainerLoser[]
  type: 'gainer' | 'loser' | 'active'; icon: React.ReactNode; onSelect: (s: string) => void
}) {
  return (
    <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        {icon}
        <div>
          <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider">{title}</h3>
          <p className="text-[10px] text-white/40">{desc}</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {items.length === 0 ? (
          <p className="text-white/40 text-xs py-3 text-center">Veri bekleniyor...</p>
        ) : items.slice(0, 7).map((item, i) => {
          const price = item.price ?? 0
          const pct = item.changesPercentage ?? 0
          const isUp = pct >= 0
          return (
            <button key={i} onClick={() => onSelect(item.symbol)}
              className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition-all duration-150 text-left group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/35 w-3 tabular-nums">{i + 1}</span>
                <div>
                  <span className="text-xs font-semibold text-white/70 group-hover:text-violet-300 transition-colors">{item.symbol}</span>
                  <span className="text-[10px] text-white/35 ml-1.5 hidden lg:inline">{(item.name || '').slice(0, 14)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 tabular-nums">${price.toFixed(2)}</span>
                <span className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${isUp ? 'bg-hermes-green/10 text-hermes-green' : 'bg-red-500/10 text-red-400'}`}>
                  {isUp ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Economic Event ────────────────────────────────────────────────

function EventRow({ event }: { event: EconomicEvent }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-all duration-150">
      <span className="text-[11px] text-white/35 w-16 shrink-0 tabular-nums">
        {new Date(event.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
      </span>
      <span className="text-xs text-white/60 flex-1 truncate">{event.event}</span>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        event.impact === 'High' ? 'bg-red-500/12 text-red-400 border border-red-500/20' :
        event.impact === 'Medium' ? 'bg-orange-500/12 text-orange-400 border border-orange-500/20' :
        'bg-white/[0.04] text-white/35 border border-white/[0.06]'
      }`}>
        {event.impact === 'High' ? 'Yuksek' : event.impact === 'Medium' ? 'Orta' : 'Dusuk'}
      </span>
    </div>
  )
}

// ─── Fear & Greed v2 (FRED Bazli) ────────────────────────────────

function FearGreedV2({ fg }: { fg: FearGreedComponents }) {
  const label = fg.composite >= 80 ? 'ASIRI ACGOZLULUK'
    : fg.composite >= 60 ? 'ACGOZLULUK'
    : fg.composite >= 40 ? 'NOTR'
    : fg.composite >= 20 ? 'KORKU'
    : 'ASIRI KORKU'

  const barColor = fg.composite >= 60 ? 'text-hermes-green'
    : fg.composite >= 40 ? 'text-slate-300'
    : 'text-red-400'

  const components = [
    { name: 'VIX Momentum', score: fg.vixScore, weight: '25%' },
    { name: 'Verim Egrisi', score: fg.yieldCurveScore, weight: '20%' },
    { name: 'Kredi Spreadi', score: fg.creditSpreadScore, weight: '20%' },
    { name: 'Tuketici Guveni', score: fg.consumerSentimentScore, weight: '20%' },
    { name: 'Issizlik Basvurulari', score: fg.joblessClaimsScore, weight: '15%' },
  ]

  return (
    <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Makro Korku & Acgozluluk v2</h3>
          <span className="text-[10px] text-white/35 ml-1">FRED ekonomik veriler bazli</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xl sm:text-2xl font-black tabular-nums ${barColor}`}>{fg.composite}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            fg.composite >= 60 ? 'text-hermes-green bg-hermes-green/15' :
            fg.composite >= 40 ? 'text-slate-300 bg-white/[0.06]' :
            'text-red-400 bg-red-500/15'
          }`}>{label}</span>
        </div>
      </div>
      {/* Gradient bar */}
      <div className="relative h-2.5 rounded-full overflow-hidden bg-gradient-to-r from-red-600 via-orange-500 via-slate-400 to-hermes-green mb-3">
        <div className="absolute top-0 h-full w-1 bg-white shadow-lg shadow-white/50 rounded-full transition-all duration-700"
          style={{ left: `${Math.max(1, Math.min(99, fg.composite))}%` }} />
      </div>
      {/* Components */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {components.map(c => (
          <div key={c.name} className="text-center">
            <div className="text-[10px] text-white/45 mb-1 truncate">{c.name}</div>
            <div className={`text-sm font-bold tabular-nums ${
              c.score >= 60 ? 'text-hermes-green' : c.score >= 40 ? 'text-slate-300' : 'text-red-400'
            }`}>{c.score}</div>
            <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden mt-1">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${c.score}%`,
                  backgroundColor: c.score >= 60 ? '#62cbc1' : c.score >= 40 ? '#94a3b8' : '#f87171'
                }} />
            </div>
            <div className="text-[9px] text-white/40 mt-0.5">{c.weight}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Makro Radar Cards (FRED) ────────────────────────────────────

function MacroRadarCards({ fred }: { fred: FredDashboardData & { fearGreedV2: FearGreedComponents } }) {
  const yc = fred.yieldCurve
  const ycColor = yc.status === 'INVERSION' ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : yc.status === 'DIKKAT' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
    : yc.status === 'GENIS' ? 'text-hermes-green bg-hermes-green/10 border-hermes-green/20'
    : 'text-slate-300 bg-white/[0.04] border-white/[0.08]'

  const csColor = fred.creditStress.status === 'CRISIS' ? 'text-red-400'
    : fred.creditStress.status === 'HIGH' ? 'text-orange-400'
    : fred.creditStress.status === 'ELEVATED' ? 'text-yellow-400'
    : 'text-hermes-green'

  const vColor = fred.volatility.status === 'PANIC' ? 'text-red-400'
    : fred.volatility.status === 'FEAR' ? 'text-orange-400'
    : fred.volatility.status === 'NORMAL' ? 'text-slate-300'
    : 'text-hermes-green'

  const regimeColor: Record<string, string> = {
    GOLDILOCKS: 'text-hermes-green bg-hermes-green/15 border-hermes-green/25',
    REFLATION: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
    STAGFLATION: 'text-red-400 bg-red-500/15 border-red-500/25',
    DEFLATION: 'text-blue-400 bg-blue-500/15 border-blue-500/25',
    UNKNOWN: 'text-slate-400 bg-white/[0.06] border-white/[0.1]',
  }

  const regimeEmoji: Record<string, string> = {
    GOLDILOCKS: '\u2728', REFLATION: '\uD83D\uDD25', STAGFLATION: '\u26A0\uFE0F', DEFLATION: '\u2744\uFE0F', UNKNOWN: '\u2753',
  }

  return (
    <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Makro Radar</h3>
          <span className="text-[10px] text-white/35 ml-1">FRED verileri — ekonomi nabzi</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${regimeColor[fred.macroRegime] || regimeColor.UNKNOWN}`}>
          {regimeEmoji[fred.macroRegime] || '?'} {fred.macroRegime}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {/* Yield Curve */}
        <div className={`rounded-xl p-3 border ${ycColor}`}>
          <div className="text-[11px] text-white/50 mb-1">Verim Egrisi (10Y-2Y)</div>
          <div className="text-xl font-black tabular-nums">
            {yc.spread >= 0 ? '+' : ''}{yc.spread.toFixed(2)}%
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-white/40">10Y: {yc.dgs10.toFixed(2)}%</span>
            <span className="text-[10px] text-white/40">2Y: {yc.dgs2.toFixed(2)}%</span>
          </div>
          <div className="text-[10px] font-bold mt-1">{yc.status}</div>
        </div>

        {/* Fed Policy */}
        <div className="rounded-xl p-3 border border-blue-500/20 bg-blue-500/8 text-blue-300">
          <div className="text-[11px] text-white/50 mb-1">Fed Faiz Orani</div>
          <div className="text-xl font-black tabular-nums">
            {fred.fedPolicy.fedFundsRate.toFixed(2)}%
          </div>
          <div className="text-[10px] text-white/40 mt-1">Bank Prime: {fred.fedPolicy.bankPrime.toFixed(2)}%</div>
          <div className="text-[10px] text-white/40 mt-0.5">{fred.fedPolicy.fedFundsDate}</div>
        </div>

        {/* Credit Stress */}
        <div className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.03]">
          <div className="text-[11px] text-white/50 mb-1">Kredi Stresi (HY Spread)</div>
          <div className={`text-xl font-black tabular-nums ${csColor}`}>
            {fred.creditStress.highYieldSpread.toFixed(2)}%
          </div>
          <div className="text-[10px] text-white/40 mt-1">Durum: <span className={`font-bold ${csColor}`}>{fred.creditStress.status}</span></div>
          <div className="text-[10px] text-white/40 mt-0.5">{fred.creditStress.highYieldDate}</div>
        </div>

        {/* Employment */}
        <div className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.03]">
          <div className="text-[11px] text-white/50 mb-1">Istihdam Nabzi</div>
          <div className="text-xl font-black tabular-nums text-white/80">
            %{fred.employment.unemploymentRate.toFixed(1)}
          </div>
          <div className="text-[10px] text-white/40 mt-1">
            Haftalik Basvuru: {(fred.employment.joblessClaims / 1000).toFixed(0)}K
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-white/50">VIX:</span>
            <span className={`text-[10px] font-bold ${vColor}`}>{fred.volatility.vix.toFixed(1)} ({fred.volatility.status})</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── States ────────────────────────────────────────────────────────

function MarketSkeleton() {
  const PANELS = [
    { label: 'Fear & Greed', w: 'col-span-3', h: 'h-72' },
    { label: 'Sektor Trendi', w: 'col-span-3', h: 'h-72' },
    { label: 'Endeks Verileri', w: 'col-span-6', h: 'h-72' },
  ]
  const CARDS = [
    { label: 'Yukselenler', icon: '▲' },
    { label: 'Dusenler', icon: '▼' },
    { label: 'Hacim Liderleri', icon: '◆' },
  ]
  return (
    <div className="relative space-y-4 animate-fade-in overflow-hidden">
      <div className="absolute inset-0 data-stream pointer-events-none" />
      {/* Top panels */}
      <div className="grid grid-cols-12 gap-3 relative z-10">
        {PANELS.map((p, i) => (
          <div key={i} className={`${p.w} bg-[#1A1A1A]/60 rounded-2xl border border-white/[0.05] p-4 ${p.h} opacity-0 overflow-hidden`}
            style={{ animation: `card-reveal 0.5s ease-out ${0.1 + i * 0.15}s forwards` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-gold-400/30" style={{ animation: 'heartbeat 2s ease-in-out infinite' }} />
              <span className="text-[10px] text-white/35 font-medium tracking-wider uppercase">{p.label}</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-3 skeleton-shimmer rounded" style={{ width: `${65 + Math.random() * 30}%`, animationDelay: `${j * 80}ms` }} />
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden">
              <div className="h-full w-1/3 terminal-scan-line" style={{ background: 'linear-gradient(90deg, transparent, rgba(179,148,91,0.06), transparent)' }} />
            </div>
          </div>
        ))}
      </div>
      {/* Bottom cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 relative z-10">
        {CARDS.map((c, i) => (
          <div key={i} className="bg-[#1A1A1A]/60 rounded-2xl border border-white/[0.05] p-4 h-44 opacity-0 overflow-hidden"
            style={{ animation: `card-reveal 0.5s ease-out ${0.6 + i * 0.15}s forwards` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gold-400/40 text-xs">{c.icon}</span>
              <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase">{c.label}</span>
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="h-2.5 w-12 skeleton-shimmer rounded" style={{ animationDelay: `${j * 100}ms` }} />
                  <div className="flex-1 h-2.5 skeleton-shimmer rounded" style={{ animationDelay: `${j * 100 + 50}ms` }} />
                  <div className="h-2.5 w-8 skeleton-shimmer rounded" style={{ animationDelay: `${j * 100 + 100}ms` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Progress */}
      <div className="flex justify-center relative z-10 opacity-0" style={{ animation: 'card-reveal 0.4s ease-out 1s forwards' }}>
        <div className="flex items-center gap-2">
          <div className="w-24 h-0.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #876b3a, #C9A96E)' }} />
          </div>
          <span className="text-[9px] text-white/35 font-mono">Piyasa verisi yukleniyor</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// HERMES AI PULSE — Animasyonlu Oval Gauge (tum sistem nabzi)
// ═══════════════════════════════════════════════════════════════════

function HermesPulseGauge({ pulse }: {
  pulse: {
    composite: number; label: string; color: string
    components: { trendScore: number; fg: number; fredFG: number; sectorBreadth: number; wsScore: number }
  }
}) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const target = pulse.composite
    const duration = 1500
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [pulse.composite])

  const scoreAngle = (animatedScore / 100) * 270 - 135
  const circumference = 2 * Math.PI * 90
  const strokeProgress = (animatedScore / 100) * (circumference * 0.75)

  const components = [
    { label: 'Trend Gucu', value: pulse.components.trendScore, icon: '◆' },
    { label: 'Korku/Acgozluluk', value: pulse.components.fg, icon: '◇' },
    { label: 'FRED F&G', value: pulse.components.fredFG, icon: '◈' },
    { label: 'Sektor Genisligi', value: pulse.components.sectorBreadth, icon: '◆' },
    { label: 'Wall Street', value: pulse.components.wsScore, icon: '◇' },
  ]

  return (
    <div className={`bg-gradient-to-br from-[#12121a] via-[#151520] to-[#0e0e18] rounded-2xl border border-white/[0.06]
      shadow-2xl shadow-black/30 overflow-hidden transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="relative p-3 sm:p-4 lg:p-6">
        {/* Background pulse effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-[0.03]"
            style={{ background: `radial-gradient(circle, ${pulse.color} 0%, transparent 70%)`, animation: 'heartbeat 3s ease-in-out infinite' }} />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6">
          {/* Animated Ring Gauge */}
          <div className="relative w-52 h-52 shrink-0">
            <svg viewBox="0 0 200 200" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}>
              <defs>
                <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={pulse.color} stopOpacity="1" />
                  <stop offset="50%" stopColor={pulse.color} stopOpacity="0.7" />
                  <stop offset="100%" stopColor={pulse.color} stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="ringBg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                </linearGradient>
                <filter id="pulseGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Outer decorative ring */}
              <circle cx="100" cy="100" r="96" fill="none" stroke="url(#ringBg)" strokeWidth="1" />

              {/* Background arc track */}
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
                transform="rotate(-225 100 100)" />

              {/* Progress arc */}
              <circle cx="100" cy="100" r="90" fill="none" stroke="url(#pulseGrad)" strokeWidth="8"
                strokeLinecap="round" filter="url(#pulseGlow)"
                strokeDasharray={`${strokeProgress} ${circumference - strokeProgress}`}
                transform="rotate(-225 100 100)"
                style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />

              {/* Inner ring 1 */}
              <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4"
                strokeDasharray={`${circumference * 0.68 * 0.75} ${circumference * 0.68 * 0.25}`}
                transform="rotate(-225 100 100)" style={{ animation: 'ring-spin 20s linear infinite reverse' }} />

              {/* Inner ring 2 */}
              <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="2"
                strokeDasharray="4 8" style={{ animation: 'ring-spin 15s linear infinite' }} />

              {/* Tick marks */}
              {[0, 25, 50, 75, 100].map(tick => {
                const angle = ((tick / 100) * 270 - 135) * (Math.PI / 180)
                const x1 = 100 + 94 * Math.cos(angle)
                const y1 = 100 + 94 * Math.sin(angle)
                const x2 = 100 + 88 * Math.cos(angle)
                const y2 = 100 + 88 * Math.sin(angle)
                return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
              })}

              {/* Score needle dot */}
              {(() => {
                const angle = scoreAngle * (Math.PI / 180)
                const x = 100 + 90 * Math.cos(angle)
                const y = 100 + 90 * Math.sin(angle)
                return <circle cx={x} cy={y} r="4" fill={pulse.color} style={{ filter: `drop-shadow(0 0 6px ${pulse.color})`, transition: 'cx 1.5s, cy 1.5s' }} />
              })()}
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-white/35 uppercase tracking-widest mb-1">HERMES AI</span>
              <span className="text-2xl sm:text-4xl font-black tabular-nums" style={{ color: pulse.color, textShadow: `0 0 20px ${pulse.color}40` }}>
                {animatedScore}
              </span>
              <span className="text-[11px] font-bold mt-0.5 px-2.5 py-0.5 rounded-full"
                style={{ color: pulse.color, backgroundColor: `${pulse.color}15`, border: `1px solid ${pulse.color}30` }}>
                {pulse.label}
              </span>
            </div>
          </div>

          {/* Right side: Components breakdown */}
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 mb-4">
              <Radio size={16} style={{ color: pulse.color }} className="animate-pulse" />
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Sistem Nabzi</h3>
              <span className="text-[10px] text-white/35">Tum modullerin bilesik skoru</span>
            </div>

            <div className="space-y-2.5">
              {components.map((comp, i) => {
                const barColor = comp.value >= 60 ? '#62cbc1' : comp.value >= 45 ? '#94a3b8' : '#fb923c'
                return (
                  <div key={i} className="flex items-center gap-3 group">
                    <span className="text-[10px] w-3 text-center" style={{ color: `${barColor}80` }}>{comp.icon}</span>
                    <span className="text-[11px] text-white/50 w-32 truncate">{comp.label}</span>
                    <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${comp.value}%`,
                          background: `linear-gradient(90deg, ${barColor}60, ${barColor})`,
                          transitionDelay: `${i * 150}ms`
                        }} />
                    </div>
                    <span className="text-[12px] tabular-nums font-semibold w-8 text-right" style={{ color: barColor }}>
                      {comp.value}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Mini summary tags */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {[
                { label: '5 Modul Aktif', color: 'text-hermes-green/60 bg-hermes-green/8' },
                { label: 'Tum hisseler', color: 'text-violet-400/60 bg-violet-500/8' },
                { label: 'Canli Veri', color: 'text-blue-400/60 bg-blue-500/8' },
              ].map((tag, i) => (
                <span key={i} className={`text-[9px] font-medium px-2 py-0.5 rounded-full border border-white/[0.05] ${tag.color}`}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PIYASA ACILIS ONGORU — Mevcut market verisinden hesaplama
// Harici API cagirmaz, sadece data prop'undan turetir
// ═══════════════════════════════════════════════════════════════════

function HermesAIScoreSummary() {
  const [stats, setStats] = useState<{ total: number; strong: number; good: number; neutral: number; weak: number; bad: number; avgScore: number } | null>(null)

  useEffect(() => {
    fetch('/api/fmp-terminal/stocks')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.stocks) return
        const stocks = d.stocks as Array<{ signalScore: number; signal: string }>
        let total = 0, strong = 0, good = 0, neutral = 0, weak = 0, bad = 0, sumScore = 0
        for (const s of stocks) {
          total++
          sumScore += s.signalScore || 0
          if (s.signal === 'STRONG') strong++
          else if (s.signal === 'GOOD') good++
          else if (s.signal === 'NEUTRAL') neutral++
          else if (s.signal === 'WEAK') weak++
          else if (s.signal === 'BAD') bad++
        }
        setStats({ total, strong, good, neutral, weak, bad, avgScore: total > 0 ? sumScore / total : 50 })
      })
      .catch(() => {})
  }, [])

  if (!stats) return <div className="lg:col-span-3 bg-[#151520] rounded-2xl border border-white/[0.06] p-4 animate-pulse"><div className="h-40 bg-white/[0.03] rounded-xl" /></div>

  const healthPct = stats.total > 0 ? Math.round(((stats.strong + stats.good) / stats.total) * 100) : 50
  const riskPct = stats.total > 0 ? Math.round(((stats.weak + stats.bad) / stats.total) * 100) : 0
  const healthColor = healthPct >= 40 ? 'text-hermes-green' : healthPct >= 25 ? 'text-gold-300' : 'text-red-400'
  const healthLabel = healthPct >= 40 ? 'GUCLU PIYASA' : healthPct >= 25 ? 'DENGELI' : 'ZAYIF PIYASA'

  return (
    <div className="lg:col-span-3 bg-[#151520] rounded-2xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-violet-400" />
        <div>
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">HERMES AI Skor</h3>
          <p className="text-[11px] text-white/40">Temel analiz piyasa saglik ozeti</p>
        </div>
      </div>
      <div className="flex flex-col items-center mb-4">
        <div className={`text-3xl font-black tabular-nums ${healthColor}`}>{healthPct}%</div>
        <span className={`text-xs font-semibold ${healthColor}`}>{healthLabel}</span>
        <span className="text-[10px] text-white/30 mt-0.5">Ort. Skor: {stats.avgScore.toFixed(0)} / 100</span>
      </div>
      <div className="space-y-1.5">
        {[
          { label: 'STRONG', count: stats.strong, color: 'bg-gold-400', text: 'text-gold-300' },
          { label: 'GOOD', count: stats.good, color: 'bg-hermes-green', text: 'text-hermes-green' },
          { label: 'NOTR', count: stats.neutral, color: 'bg-slate-500', text: 'text-slate-400' },
          { label: 'WEAK', count: stats.weak, color: 'bg-orange-400', text: 'text-orange-400' },
          { label: 'BAD', count: stats.bad, color: 'bg-red-500', text: 'text-red-400' },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-2">
            <span className={`text-[10px] w-14 ${row.text} font-bold`}>{row.label}</span>
            <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <div className={`h-full rounded-full ${row.color} transition-all duration-700`} style={{ width: `${stats.total > 0 ? (row.count / stats.total) * 100 : 0}%` }} />
            </div>
            <span className="text-[10px] text-white/50 font-mono w-8 text-right">{row.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[9px] text-white/30">
        <span>Tum hisseler analiz edildi</span>
        <span className="text-red-400/60">Risk: {riskPct}%</span>
      </div>
    </div>
  )
}

function MarketOpenForecast({ data }: { data: MarketDashboardData }) {
  const signals: { label: string; value: string; positive: boolean; weight: number }[] = []

  // === 1. PIYASA YAPISI (Structure) ===

  // 1a. Endeks trendi
  const idxs = data.indexes || []
  const idxUp = idxs.filter((i: IndexQuote) => (i.changesPercentage ?? 0) > 0).length
  const idxDown = idxs.filter((i: IndexQuote) => (i.changesPercentage ?? 0) < 0).length
  if (idxs.length > 0) signals.push({ label: 'Endeks Trendi', value: `${idxUp}Y / ${idxDown}D`, positive: idxUp > idxDown, weight: 1 })

  // 1b. Breadth — Gainer vs Loser sayisi
  const gainers = data.topGainers || []
  const losers = data.topLosers || []
  const gCount = gainers.length
  const lCount = losers.length
  const breadthPct = (gCount + lCount) > 0 ? Math.round((gCount / (gCount + lCount)) * 100) : 50
  signals.push({ label: 'Breadth', value: `${breadthPct}% yukselis`, positive: breadthPct > 50, weight: 1 })

  // === 2. MOMENTUM ===

  // 2a. Gainer vs Loser gucu (ortalama degisim)
  const gStr = gainers.length > 0 ? gainers.reduce((s: number, g: MarketGainerLoser) => s + Math.abs(g.changesPercentage || 0), 0) / gainers.length : 0
  const lStr = losers.length > 0 ? losers.reduce((s: number, l: MarketGainerLoser) => s + Math.abs(l.changesPercentage || 0), 0) / losers.length : 0
  signals.push({ label: 'Momentum Gucu', value: `+${gStr.toFixed(1)}% / -${lStr.toFixed(1)}%`, positive: gStr > lStr, weight: 1 })

  // === 3. SEKTOR ROTASYONU ===

  const sectors = data.sectorPerformance || []
  const secUp = sectors.filter((s: SectorPerformance) => (Number(s.changesPercentage) || 0) > 0).length
  const secTotal = sectors.length || 1
  const sectorBreadth = Math.round((secUp / secTotal) * 100)
  signals.push({ label: 'Sektor Rotasyonu', value: `${secUp}/${secTotal} pozitif`, positive: secUp > secTotal / 2, weight: 1 })

  // === 4. HACIM TRENDI ===

  const actives = data.mostActive || []
  const actUp = actives.filter((a: MarketGainerLoser) => (a.changesPercentage ?? 0) > 0).length
  const actDown = actives.filter((a: MarketGainerLoser) => (a.changesPercentage ?? 0) < 0).length
  const actTotal = actUp + actDown || 1
  signals.push({ label: 'Hacim Yonu', value: `${Math.round((actUp / actTotal) * 100)}% yukari`, positive: actUp > actDown, weight: 1 })

  // === 5. MEAN REVERSION (V4 en guclu bilesan) ===

  const avgGainerChg = gStr
  const avgLoserChg = lStr
  const isOversold = avgLoserChg > 8 && breadthPct < 30
  const isPanicSell = avgLoserChg > 12 && breadthPct < 20
  const isOverbought = avgGainerChg > 8 && breadthPct > 80
  const isCapitulation = avgLoserChg > 15 && sectorBreadth < 20

  // === 6. RISK ISTAHI ===
  const offensiveSectors = ['Technology', 'Consumer Cyclical', 'Communication Services', 'Financial Services', 'Industrials']
  const defensiveSectors = ['Consumer Defensive', 'Utilities', 'Healthcare', 'Real Estate']
  let offAvg = 0, defAvg = 0, offN = 0, defN = 0
  for (const s of sectors) {
    const chg = Number(s.changesPercentage) || 0
    if (offensiveSectors.includes(s.sector)) { offAvg += chg; offN++ }
    if (defensiveSectors.includes(s.sector)) { defAvg += chg; defN++ }
  }
  offAvg = offN > 0 ? offAvg / offN : 0
  defAvg = defN > 0 ? defAvg / defN : 0
  const riskAppetite = offAvg - defAvg
  signals.push({ label: 'Risk Istahi', value: `${riskAppetite > 0 ? '+' : ''}${riskAppetite.toFixed(2)}%`, positive: riskAppetite > 0, weight: 1 })

  // === COMPOSITE HESAPLAMA (V4 Adaptif Agirliklar) ===

  const posCount = signals.filter(s => s.positive).length
  const totalSig = signals.length
  const basePct = totalSig > 0 ? Math.round((posCount / totalSig) * 100) : 50

  // V4 Ozel Sinyaller
  const specialSignals: { label: string; type: 'bullish' | 'bearish' }[] = []
  if (isOversold) specialSignals.push({ label: 'OVERSOLD', type: 'bullish' })
  if (isPanicSell) specialSignals.push({ label: 'PANIC SELL', type: 'bullish' })
  if (isCapitulation) specialSignals.push({ label: 'CAPITULATION', type: 'bullish' })
  if (isOverbought) specialSignals.push({ label: 'OVERBOUGHT', type: 'bearish' })
  if (sectorBreadth < 20) specialSignals.push({ label: 'BREADTH < 20%', type: 'bullish' })
  if (sectorBreadth > 90) specialSignals.push({ label: 'EUPHORIA', type: 'bearish' })

  // Confidence: kac alt-sinyal uyumlu
  const bullishSigs = signals.filter(s => s.positive).length + specialSignals.filter(s => s.type === 'bullish').length
  const bearishSigs = signals.filter(s => !s.positive).length + specialSignals.filter(s => s.type === 'bearish').length
  const maxAlign = Math.max(bullishSigs, bearishSigs)
  const totalPossible = totalSig + specialSignals.length
  const confidence = totalPossible > 0 ? Math.round((maxAlign / totalPossible) * 100) : 50

  // V4 Bias
  let pct = basePct
  const bullishSpecials = specialSignals.filter(s => s.type === 'bullish')
  const bearishSpecials = specialSignals.filter(s => s.type === 'bearish')

  // Ozel sinyal boost (V4 mean reversion)
  if (bullishSpecials.length >= 2) pct = Math.min(pct + 15, 95)
  else if (bullishSpecials.length === 1) pct = Math.min(pct + 8, 90)
  if (bearishSpecials.length >= 2) pct = Math.max(pct - 15, 5)
  else if (bearishSpecials.length === 1) pct = Math.max(pct - 8, 10)

  const isGoldenSignal = specialSignals.length >= 3
  const bias = pct >= 65 ? 'POZITIF ACILIS BEKLENTISI' : pct <= 35 ? 'NEGATIF ACILIS BEKLENTISI' : 'NOTR ACILIS BEKLENTISI'
  const biasShort = pct >= 65 ? 'POZITIF' : pct <= 35 ? 'NEGATIF' : 'NOTR'

  const cardGlow = isGoldenSignal ? 'signal-fire-gold' : pct >= 65 ? 'signal-fire-green' : pct <= 35 ? 'signal-fire-red' : ''
  const borderColor = isGoldenSignal ? 'border-gold-400/40' : pct >= 65 ? 'border-emerald-500/30' : pct <= 35 ? 'border-red-500/30' : 'border-white/10'
  const bgColor = isGoldenSignal ? 'bg-gold-400/[0.04]' : pct >= 65 ? 'bg-emerald-500/[0.04]' : pct <= 35 ? 'bg-red-500/[0.04]' : 'bg-white/[0.02]'
  const accentColor = isGoldenSignal ? '#B3945B' : pct >= 65 ? '#62cbc1' : pct <= 35 ? '#ef4444' : '#94a3b8'

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 shadow-xl shadow-black/20 transition-all duration-500 ${borderColor} ${bgColor} ${cardGlow}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <Radio size={14} className="text-gold-300" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-gold-400 live-dot" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-gold-300">PIYASA ACILIS ONGORU</span>
        {isGoldenSignal && (
          <span className="badge-enter ml-1 px-1.5 py-0.5 rounded-full bg-gold-400/20 border border-gold-400/40 text-[9px] font-bold text-gold-300 combo-pulse">
            GOLDEN SIGNAL
          </span>
        )}
        <span className="text-[10px] text-white/25 ml-auto tabular-nums">{posCount}/{totalSig} uyumlu</span>
      </div>

      {/* Score + Bias */}
      <div className="flex items-start gap-4 mb-3">
        <div className="relative">
          <div className="text-4xl font-black tabular-nums animate-number-glow" style={{ color: accentColor }}>
            {pct}
          </div>
          <span className="absolute -top-1 -right-3 text-[10px] font-bold" style={{ color: accentColor }}>%</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold" style={{ color: accentColor }}>{bias}</div>
          <div className="text-[10px] text-white/30 mt-0.5">V4 Adaptif Model — {specialSignals.length > 0 ? `${specialSignals.length} ozel sinyal aktif` : '6 bilesen analizi'}</div>

          {/* Confidence Bar */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] text-white/35 w-14 shrink-0">Guven</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full confidence-bar transition-all"
                style={{ '--conf-width': `${confidence}%`, backgroundColor: confidence >= 60 ? '#62cbc1' : confidence >= 40 ? '#B3945B' : '#f87171' } as React.CSSProperties}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: confidence >= 60 ? '#62cbc1' : confidence >= 40 ? '#B3945B' : '#f87171' }}>{confidence}%</span>
          </div>
        </div>
      </div>

      {/* Special Signals (V4 Ozel Sinyaller) */}
      {specialSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {specialSignals.map((ss, i) => (
            <span
              key={i}
              className={`badge-enter inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                ss.type === 'bullish'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {ss.type === 'bullish' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {ss.label}
            </span>
          ))}
        </div>
      )}

      {/* Signal Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {signals.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] rounded-lg px-2 py-1.5 transition-all duration-200"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-[10px] text-white/45 truncate mr-1">{s.label}</span>
            <span className={`text-[10px] font-mono shrink-0 ${s.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {s.positive ? '▲' : '▼'} {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* V4 Model Badge */}
      <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield size={10} className="text-white/20" />
          <span className="text-[9px] text-white/20">Backtest Hit Rate: %{isGoldenSignal ? '68.8 (1G) / %81.2 (3G)' : pct >= 65 || pct <= 35 ? '59.1 (1G)' : '--'}</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] text-white/15 font-mono">V4</span>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in">
      <AlertTriangle size={36} className="text-red-400/40 mb-3" />
      <p className="text-white/50 text-base">{message}</p>
      <button onClick={() => window.location.reload()}
        className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium
                   hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-500/20 transition-all duration-200">
        Tekrar Dene
      </button>
    </div>
  )
}
