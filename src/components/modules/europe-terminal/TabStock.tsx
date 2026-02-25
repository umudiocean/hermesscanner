'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, AlertTriangle, TrendingUp, TrendingDown, Star, BarChart3, Shield, Target, Users, Newspaper } from 'lucide-react'
import { EUROPE_EXCHANGES } from '@/lib/europe-config'
import { getWatchlist, toggleWatchlist } from '@/lib/store'
import { FMPScore, CATEGORY_LABELS, FMP_SCORE_WEIGHTS } from '@/lib/fmp-terminal/fmp-types'
import { downloadHermesReportPdf } from '@/lib/report-pdf'

interface StockDetailData {
  profile: any
  metrics: any
  ratios: any
  scores: any
  dcf: any
  analyst: any
  priceTarget: any
  grades: any[]
  estimates: any[]
  insiderTrades: any[]
  insiderStatistics: any
  institutional: any[]
  earnings: any[]
  news: any[]
  shareFloat: any
  priceChange: any
  esg: any
  income: any[]
  balance: any[]
  cashflow: any[]
  fmpScore: FMPScore | null
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || !isFinite(v)) return 'N/A'
  return v.toFixed(decimals)
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'N/A'
  return `${v >= 0 ? '+' : ''}${(v * (Math.abs(v) < 1 ? 100 : 1)).toFixed(2)}%`
}

function fmtMcap(v: number | null | undefined): string {
  if (!v || v <= 0) return 'N/A'
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  return v.toLocaleString()
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-hermes-green'
  if (score >= 55) return 'text-emerald-400'
  if (score >= 40) return 'text-amber-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-hermes-green/15 border-hermes-green/30'
  if (score >= 55) return 'bg-emerald-400/15 border-emerald-400/30'
  if (score >= 40) return 'bg-amber-400/15 border-amber-400/30'
  if (score >= 25) return 'bg-orange-400/15 border-orange-400/30'
  return 'bg-red-400/15 border-red-400/30'
}

function MetricCard({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div className="bg-[#151520] rounded-xl border border-white/[0.08] p-3 hover:border-violet-500/20 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300">
      <div className="text-[9px] text-white/40 font-semibold tracking-wider uppercase">{label}</div>
      <div className={`text-sm font-bold mt-1 tabular-nums ${color || 'text-white/80'}`}>{value}{suffix}</div>
    </div>
  )
}

export default function TabStock({ symbol, onSelectSymbol, onAddToCompare }: {
  symbol: string; onSelectSymbol: (s: string) => void; onAddToCompare: (s: string) => void
}) {
  const [data, setData] = useState<StockDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => { setWatchlist(getWatchlist()) }, [])

  const handleToggleWatchlist = useCallback(() => {
    if (!symbol) return
    const result = toggleWatchlist(symbol)
    setWatchlist(result.list)
  }, [symbol])

  useEffect(() => {
    if (!symbol) return
    setLoading(true); setError(null)
    fetch(`/api/europe-terminal/stock/${encodeURIComponent(symbol)}`)
      .then(r => { if (!r.ok) throw new Error(`${symbol} verisi yuklenemedi`); return r.json() })
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [symbol])

  const handleDownloadPdf = useCallback(async () => {
    if (!data || !symbol || pdfLoading) return
    setPdfLoading(true)
    try {
      const p = data.profile
      const sc = data.fmpScore
      const km = data.metrics
      const pt = data.priceTarget
      const dc = data.dcf
      const ac = data.analyst
      const scores = data.scores
      const ccy = p?.currency || 'EUR'

      const valLabel = sc
        ? (sc.categories.valuation >= 65 ? 'UCUZ' : sc.categories.valuation <= 25 ? 'PAHALI' : 'NORMAL')
        : '-'
      const target = pt?.targetConsensus || pt?.targetMedian || null
      const changePct = p?.changesPercentage ?? 0
      const changeColor = changePct >= 0 ? 'green' as const : 'red' as const

      const catLabels: Record<string, string> = {
        valuation: 'Degerleme', health: 'Finansal Saglik', growth: 'Buyume',
        analyst: 'Analist', quality: 'Kalite', momentum: 'Momentum',
        sector: 'Sektor', smartMoney: 'Akilli Para',
      }
      const scoreRows = sc ? Object.entries(sc.categories).map(([k, v]) => ({
        label: catLabels[k] || k,
        value: `${Math.round(v as number)}/100`,
        color: ((v as number) >= 66 ? 'green' : (v as number) >= 33 ? 'amber' : 'red') as 'green' | 'amber' | 'red',
      })) : []

      await downloadHermesReportPdf({
        fileName: `${symbol}-europe-detail-report.pdf`,
        title: `${symbol} — Europe Stock Detail Report`,
        subtitle: `${p?.companyName || ''} | ${p?.exchangeShortName || ''} | ${p?.sector || ''}`,
        scoreSummary: sc ? {
          total: sc.total,
          level: sc.level,
          confidence: sc.confidence,
          valuationLabel: valLabel,
        } : undefined,
        sections: [
          {
            title: 'Market Snapshot',
            rows: [
              { label: 'Price', value: p?.price != null ? `${p.price.toFixed(2)} ${ccy}` : null },
              { label: 'Change', value: changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : null, color: changeColor },
              { label: 'Exchange', value: p?.exchangeShortName },
              { label: 'Sector', value: p?.sector },
              { label: 'Industry', value: p?.industry },
              { label: 'Market Cap', value: fmtMcap(p?.mktCap) },
              { label: '52W Range', value: p?.range },
            ],
          },
          {
            title: 'Key Metrics',
            rows: [
              { label: 'P/E (TTM)', value: km?.peRatioTTM?.toFixed(2) },
              { label: 'P/B (TTM)', value: km?.pbRatioTTM?.toFixed(2) },
              { label: 'Debt/Equity', value: km?.debtToEquityTTM?.toFixed(2) },
              { label: 'Current Ratio', value: km?.currentRatioTTM?.toFixed(2) },
            ],
          },
          {
            title: 'Score Breakdown',
            rows: scoreRows,
          },
          {
            title: 'Target & Valuation',
            rows: [
              { label: 'Analyst Target', value: target != null ? `${target.toFixed(2)} ${ccy}` : null },
              { label: 'DCF Fair Value', value: dc?.dcf != null ? `${dc.dcf.toFixed(2)} ${ccy}` : null },
              { label: 'Altman Z', value: scores?.altmanZScore?.toFixed(2) },
              { label: 'Piotroski', value: scores?.piotroskiScore != null ? `${scores.piotroskiScore}/9` : null },
            ],
          },
          {
            title: 'Risk Flags',
            rows: sc?.redFlags?.length ? sc.redFlags.map((f: any) => ({
              label: f.category,
              value: f.message,
              color: f.severity === 'critical' ? 'red' as const : 'amber' as const,
            })) : [{ label: 'Status', value: 'No risk flags detected', color: 'green' as const }],
          },
        ],
      })
    } finally {
      setPdfLoading(false)
    }
  }, [data, symbol, pdfLoading])

  if (!symbol) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <Eye size={40} className="text-blue-400/30 mb-3" />
      <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Hisse Secin</h3>
      <p className="text-white/50 text-sm mb-6">HISSELER tabindan secim yapin veya asagiya sembol girin</p>
      <div className="flex items-center gap-2">
        <input type="text" value={searchInput}
          onChange={e => setSearchInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter' && searchInput) { onSelectSymbol(searchInput); setSearchInput('') } }}
          placeholder="Orn: HSBA.L, SAP.DE..."
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400/40 w-56" />
        <button onClick={() => { if (searchInput) { onSelectSymbol(searchInput); setSearchInput('') } }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium hover:from-blue-500 hover:to-blue-400 transition-all">
          Git
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center">
      <AlertTriangle size={24} className="text-red-400/50 mb-2" />
      <p className="text-white/45 text-sm">{error}</p>
    </div>
  )

  if (!data) return null

  const { profile: p, scores, dcf, fmpScore, earnings, news, insiderTrades, priceTarget, analyst, priceChange, shareFloat } = data
  const km = data.metrics || {}
  const rat = data.ratios || {}
  if (!p) return null

  const exConfig = Object.values(EUROPE_EXCHANGES).find(e => p.symbol?.endsWith(e.symbolSuffix))
  const isInWatchlist = watchlist.includes(symbol)
  const chg = p.changes ?? 0
  const chgPct = p.changesPercentage ?? 0

  return (
    <div className="space-y-3 animate-fade-in">
      {/* HEADER */}
      <div className="bg-[#151520] rounded-2xl border border-white/[0.08] p-4 sm:p-5 shadow-xl shadow-black/20 hover:border-white/15 transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            {p.image && <img src={p.image} alt={p.symbol} className="w-14 h-14 rounded-xl bg-white/5 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">{p.symbol}</h2>
                {exConfig && <img src={`https://flagcdn.com/w80/${exConfig.country.toLowerCase()}.png`} alt={exConfig.country} className="w-8 h-5 object-cover rounded drop-shadow-md" title={`${exConfig.country} - ${exConfig.name}`} />}
                <span className="text-xs text-white/40 bg-white/[0.04] px-2 py-0.5 rounded-full">{exConfig?.shortLabel || p.exchangeShortName}</span>
                <span className="text-xs text-white/30">{p.currency}</span>
              </div>
              <p className="text-sm text-white/60 mt-0.5">{p.companyName}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {p.sector && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">{p.sector}</span>}
                {p.industry && <span className="text-[10px] text-white/40">{p.industry}</span>}
                {p.country && <span className="text-[10px] text-white/30">• {p.country}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-white tabular-nums">{p.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${chg >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                {chg >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {chg >= 0 ? '+' : ''}{chg.toFixed(2)} ({chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%)
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={handleToggleWatchlist}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                  isInWatchlist ? 'bg-amber-400/15 border-amber-400/30 text-amber-300' : 'border-white/10 text-white/60 hover:border-amber-400/30 hover:text-amber-300'
                }`}>
                {isInWatchlist ? '★ Izleniyor' : '☆ Izle'}
              </button>
              <button
                onClick={() => onAddToCompare(symbol)}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/60 hover:border-violet-500/30 hover:text-violet-300 transition-all"
              >
                Karsilastir
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-[10px] text-amber-300 hover:bg-amber-500/10 transition-all disabled:opacity-60"
              >
                {pdfLoading ? 'PDF hazirlaniyor...' : 'Raporu PDF indir'} <span className="ml-1 text-[9px] text-amber-200/90">PREMIUM</span>
              </button>
            </div>
          </div>
        </div>
        {p.description && <p className="text-xs text-white/40 mt-4 line-clamp-3 leading-relaxed">{p.description}</p>}
      </div>

      {/* RED FLAGS */}
      {fmpScore?.redFlags && fmpScore.redFlags.length > 0 && (
        <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-[10px] text-red-400 font-bold tracking-wider">KIRMIZI BAYRAKLAR</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fmpScore.redFlags.map((rf, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                {rf.message || rf.category}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SCORE + CATEGORIES */}
      {fmpScore && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-3 bg-[#151520] rounded-xl border border-violet-500/20 p-4 flex flex-col items-center justify-center shadow-lg shadow-violet-500/5 hover:border-violet-500/40 transition-all duration-300">
            <span className="text-[10px] text-blue-400/60 uppercase tracking-[0.15em] font-bold mb-3">HERMES AI Skor</span>
            <div className={`text-5xl font-bold tabular-nums ${getScoreColor(fmpScore.total)}`}>{fmpScore.total}</div>
            <span className={`mt-2 text-xs font-bold px-3 py-1 rounded-full border ${getScoreBg(fmpScore.total)}`}>
              {fmpScore.level}
            </span>
            {fmpScore.degraded && (
              <span className="text-[9px] text-amber-400 mt-2">Veri sinirli (Avrupa)</span>
            )}
            {fmpScore.confidence > 0 && !fmpScore.degraded && (
              <span className="text-[9px] text-white/40 mt-2">Guven: {fmpScore.confidence}%</span>
            )}
          </div>
          <div className="lg:col-span-9 bg-[#151520] rounded-xl border border-white/[0.08] p-4 hover:border-white/15 transition-all duration-300">
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-3 block">Kategori Detayi</span>
            <div className="space-y-2">
              {Object.entries(fmpScore.categories)
                .sort((a, b) => (FMP_SCORE_WEIGHTS[b[0] as keyof typeof FMP_SCORE_WEIGHTS] || 0) - (FMP_SCORE_WEIGHTS[a[0] as keyof typeof FMP_SCORE_WEIGHTS] || 0))
                .map(([cat, val]) => {
                  const hasNoData = fmpScore.missingInputs?.includes(cat)
                  const displayVal = hasNoData ? 'N/A' : String(val)
                  const barWidth = hasNoData ? 0 : val
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-[10px] text-white/50 w-20 font-medium">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}</span>
                      <span className="text-[9px] text-white/30 w-8 text-right">{FMP_SCORE_WEIGHTS[cat as keyof typeof FMP_SCORE_WEIGHTS] || 0}%</span>
                      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        {!hasNoData && (
                          <div className="h-full rounded-full transition-all duration-500" style={{
                            width: `${barWidth}%`,
                            backgroundColor: val >= 70 ? '#62cbc1' : val >= 50 ? '#fbbf24' : val >= 30 ? '#fb923c' : '#f87171',
                          }} />
                        )}
                      </div>
                      <span className={`text-[11px] tabular-nums font-bold w-10 text-right ${hasNoData ? 'text-white/30' : getScoreColor(val)}`}>{displayVal}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* KEY METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MetricCard label="Piyasa Degeri" value={fmtMcap(p.mktCap || (km as any)?.marketCapTTM)} />
        <MetricCard label="F/K (P/E)" value={fmt(km.peRatioTTM || rat.peRatioTTM || (p as any).pe)} />
        <MetricCard label="K/D (P/B)" value={fmt(km.pbRatioTTM || rat.priceToBookRatioTTM)} />
        <MetricCard label="PD/Sat (P/S)" value={fmt(km.priceToSalesRatioTTM || (rat as any).priceToSalesRatioTTM)} />
        <MetricCard label="EV/EBITDA" value={fmt(km.enterpriseValueOverEBITDATTM || (rat as any).enterpriseValueOverEBITDATTM)} />
        <MetricCard label="PEG" value={fmt(km.pegRatioTTM || rat.pegRatioTTM)} />
        <MetricCard label="P/FCF" value={fmt(km.pfcfRatioTTM || rat.priceToFreeCashFlowsRatioTTM)} />
        <MetricCard label="ROE" value={km.roeTTM ? `${(km.roeTTM * 100).toFixed(1)}%` : fmt(rat.returnOnEquityTTM ? rat.returnOnEquityTTM * 100 : null)} suffix={km.roeTTM ? '' : '%'} color={((km.roeTTM || rat.returnOnEquityTTM || 0) * 100) > 15 ? 'text-hermes-green' : undefined} />
        <MetricCard label="ROIC" value={km.roicTTM ? `${(km.roicTTM * 100).toFixed(1)}%` : fmt(rat.roicTTM ? rat.roicTTM * 100 : null)} suffix={km.roicTTM ? '' : '%'} color={(km.roicTTM || (rat as any).roicTTM || 0) * 100 > 10 ? 'text-hermes-green' : undefined} />
        <MetricCard label="Borc/Oz" value={fmt(rat.debtEquityRatioTTM || rat.debtToEquityRatioTTM)} color={(rat.debtEquityRatioTTM || (rat as any).debtToEquityRatioTTM || 0) > 2 ? 'text-red-400' : undefined} />
        <MetricCard label="Cari Oran" value={fmt(rat.currentRatioTTM || km.currentRatioTTM)} color={(rat.currentRatioTTM || km.currentRatioTTM || 0) > 1.5 ? 'text-hermes-green' : undefined} />
        <MetricCard label="Temettu" value={((rat as any).dividendYielTTM ?? rat.dividendYieldTTM) != null ? `${(((rat as any).dividendYielTTM ?? rat.dividendYieldTTM) * 100).toFixed(2)}%` : 'N/A'} />
        <MetricCard label="Beta" value={fmt(p.beta)} />
      </div>

      {/* VALUATION + HEALTH ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* DCF */}
        <div className="bg-[#151520] rounded-xl border border-white/[0.08] p-4 hover:border-violet-500/15 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-blue-400" />
            <span className="text-[10px] text-white/40 font-bold tracking-wider">DCF DEGERLEME</span>
          </div>
          {dcf ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-white/50">Adil Deger (DCF)</span>
                <span className="text-sm font-bold text-white tabular-nums">{dcf.dcf?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/50">Guncel Fiyat</span>
                <span className="text-sm text-white/70 tabular-nums">{p.price?.toFixed(2)}</span>
              </div>
              {dcf.dcf > 0 && p.price > 0 && (
                <div className="flex justify-between border-t border-white/[0.06] pt-2">
                  <span className="text-xs text-white/50">Potansiyel</span>
                  <span className={`text-sm font-bold tabular-nums ${dcf.dcf > p.price ? 'text-hermes-green' : 'text-red-400'}`}>
                    {((dcf.dcf - p.price) / p.price * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          ) : <p className="text-xs text-white/30">DCF verisi yok</p>}
        </div>

        {/* Altman Z + Piotroski */}
        <div className="bg-[#151520] rounded-xl border border-white/[0.08] p-4 hover:border-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-emerald-400" />
            <span className="text-[10px] text-white/40 font-bold tracking-wider">FINANSAL SAGLIK</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-white/50">Altman Z-Score</span>
                <span className={`text-sm font-bold tabular-nums ${
                  (scores?.altmanZScore || 0) > 3 ? 'text-hermes-green' : (scores?.altmanZScore || 0) > 1.8 ? 'text-amber-400' : 'text-red-400'
                }`}>{scores?.altmanZScore?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="text-[9px] text-white/30">
                {(scores?.altmanZScore || 0) > 3 ? 'Guvenli bolge' : (scores?.altmanZScore || 0) > 1.8 ? 'Gri bolge' : 'Iflas riski'}
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-white/50">Piotroski F-Score</span>
                <span className={`text-sm font-bold tabular-nums ${
                  (scores?.piotroskiScore || 0) >= 7 ? 'text-hermes-green' : (scores?.piotroskiScore || 0) >= 4 ? 'text-amber-400' : 'text-red-400'
                }`}>{scores?.piotroskiScore ?? 'N/A'}/9</span>
              </div>
              <div className="text-[9px] text-white/30">
                {(scores?.piotroskiScore || 0) >= 7 ? 'Guclu finansallar' : (scores?.piotroskiScore || 0) >= 4 ? 'Orta' : 'Zayif'}
              </div>
            </div>
          </div>
        </div>

        {/* Analyst Consensus */}
        <div className="bg-[#151520] rounded-xl border border-white/[0.08] p-4 hover:border-violet-500/15 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-violet-400" />
            <span className="text-[10px] text-white/40 font-bold tracking-wider">ANALIST KONSENSUS</span>
          </div>
          {analyst ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-lg font-bold ${
                  analyst.consensus === 'Buy' || analyst.consensus === 'Strong Buy' ? 'text-hermes-green' :
                  analyst.consensus === 'Sell' || analyst.consensus === 'Strong Sell' ? 'text-red-400' : 'text-amber-400'
                }`}>{analyst.consensus || 'N/A'}</span>
              </div>
              <div className="flex gap-1 text-[9px]">
                {[
                  { label: 'G.Alis', val: analyst.strongBuy, c: 'bg-hermes-green/20 text-hermes-green' },
                  { label: 'Alis', val: analyst.buy, c: 'bg-emerald-400/15 text-emerald-400' },
                  { label: 'Tut', val: analyst.hold, c: 'bg-amber-400/15 text-amber-400' },
                  { label: 'Sat', val: analyst.sell, c: 'bg-orange-400/15 text-orange-400' },
                  { label: 'G.Sat', val: analyst.strongSell, c: 'bg-red-400/15 text-red-400' },
                ].map(r => r.val > 0 && (
                  <span key={r.label} className={`px-1.5 py-0.5 rounded ${r.c} font-medium`}>{r.label}: {r.val}</span>
                ))}
              </div>
              {priceTarget?.targetConsensus > 0 && (
                <div className="flex justify-between border-t border-white/[0.06] pt-2 mt-1">
                  <span className="text-xs text-white/50">Hedef Fiyat</span>
                  <span className={`text-sm font-bold tabular-nums ${priceTarget.targetConsensus > p.price ? 'text-hermes-green' : 'text-red-400'}`}>
                    {priceTarget.targetConsensus.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          ) : <p className="text-xs text-white/30">Analist verisi yok</p>}
        </div>
      </div>

      {/* COMPANY INFO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Calisan" value={p.fullTimeEmployees?.toLocaleString() || 'N/A'} />
        <MetricCard label="CEO" value={p.ceo || 'N/A'} />
        <MetricCard label="Halka Arz" value={p.ipoDate || 'N/A'} />
        <MetricCard label="Borsa" value={exConfig?.name || p.exchangeShortName || 'N/A'} />
      </div>

      {/* EARNINGS + INSIDER + NEWS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Earnings */}
        {earnings && earnings.length > 0 && (
          <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
            <span className="text-[10px] text-white/40 font-bold tracking-wider mb-3 block">SON KAZANC RAPORLARI</span>
            <div className="space-y-1.5">
              {earnings.slice(0, 6).map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.03] last:border-0">
                  <span className="text-white/50 w-24">{e.date}</span>
                  <span className="text-white/60 tabular-nums">Bkln: {e.estimatedEarning?.toFixed(2) || 'N/A'}</span>
                  <span className="text-white/60 tabular-nums">Grcl: {e.actualEarningResult?.toFixed(2) || 'N/A'}</span>
                  <span className={`font-bold tabular-nums ${
                    (e.actualEarningResult || 0) > (e.estimatedEarning || 0) ? 'text-hermes-green' : 'text-red-400'
                  }`}>
                    {(e.actualEarningResult || 0) > (e.estimatedEarning || 0) ? 'BEAT' : 'MISS'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insider Activity */}
        {insiderTrades && insiderTrades.length > 0 && (
          <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-amber-400" />
              <span className="text-[10px] text-white/40 font-bold tracking-wider">ICERIDEN ISLEMLER</span>
            </div>
            <div className="space-y-1.5">
              {insiderTrades.slice(0, 6).map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.03] last:border-0">
                  <span className="text-white/50 w-20 truncate">{t.transactionDate || t.filingDate}</span>
                  <span className="text-white/60 truncate max-w-[120px]">{t.reportingName}</span>
                  <span className={`font-bold ${t.transactionType === 'P-Purchase' ? 'text-hermes-green' : 'text-red-400'}`}>
                    {t.transactionType === 'P-Purchase' ? 'ALIS' : 'SATIS'}
                  </span>
                  <span className="text-white/50 tabular-nums">{t.securitiesTransacted?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* NEWS */}
      {news && news.length > 0 && (
        <div className="bg-[#151520] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper size={14} className="text-blue-400" />
            <span className="text-[10px] text-white/40 font-bold tracking-wider">SON HABERLER</span>
          </div>
          <div className="space-y-2">
            {news.slice(0, 5).map((n: any, i: number) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                className="block py-2 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors">
                <div className="text-xs text-white/70 line-clamp-1">{n.title}</div>
                <div className="text-[9px] text-white/30 mt-0.5">{n.publishedDate?.split('T')[0]} • {n.site}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
