'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab 2: HISSE PROFILI (Stock Deep Dive)
// Score Gauge + DNA Barcode + Key Metrics + DCF + Analist + Insider
// Anchor scroll ile bölümlere atlama
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { StockDetailData, getScoreLevel, getScoreColor, getScoreBgColor, SCORE_LABELS, FMP_SCORE_WEIGHTS, CATEGORY_LABELS } from '@/lib/fmp-terminal/fmp-types'
import { getWatchlist, toggleWatchlist } from '@/lib/store'
import ScoreGauge from './ScoreGauge'
import DNABarcode from './DNABarcode'
import RedFlags from './RedFlags'
import SharePanel from '@/components/SharePanel'

function getValuationFromScore(valScore: number): { label: string; style: string } {
  if (valScore >= 80) return { label: 'COK UCUZ', style: 'text-hermes-green bg-hermes-green/15 border-hermes-green/30' }
  if (valScore >= 65) return { label: 'UCUZ', style: 'text-hermes-green bg-hermes-green/10 border-hermes-green/20' }
  if (valScore >= 40) return { label: 'NORMAL', style: 'text-slate-300 bg-white/[0.04] border-white/10' }
  if (valScore >= 25) return { label: 'PAHALI', style: 'text-orange-400 bg-orange-500/10 border-orange-500/20' }
  return { label: 'COK PAHALI', style: 'text-red-400 bg-red-500/10 border-red-500/20' }
}

interface TabStockProps {
  symbol: string
  onSelectSymbol: (symbol: string) => void
  onAddToCompare: (symbol: string) => void
}

export default function TabStock({ symbol, onSelectSymbol, onAddToCompare }: TabStockProps) {
  const [data, setData] = useState<StockDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [watchlist, setWatchlist] = useState<string[]>([])

  useEffect(() => { setWatchlist(getWatchlist()) }, [])

  const handleToggleWatchlist = useCallback(() => {
    if (!symbol) return
    const result = toggleWatchlist(symbol)
    setWatchlist(result.list)
  }, [symbol])

  useEffect(() => {
    if (!symbol) return
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/fmp-terminal/stock/${symbol}`)
        if (!res.ok) throw new Error(`${symbol} verisi yüklenemedi`)
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [symbol])

  // Sembol seçilmemişse
  if (!symbol) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <span className="text-5xl mb-4">🔍</span>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Hisse Seçin</h3>
        <p className="text-white/50 text-sm mb-6">Yukarıdaki arama çubuğunu kullanın veya Pazar sekmesinden hisse seçin</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchInput) {
                onSelectSymbol(searchInput)
                setSearchInput('')
              }
            }}
            placeholder="Örn: AAPL, NVDA, MSFT..."
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white
                       placeholder-white/30 focus:outline-none focus:border-violet-500/40 w-56"
          />
          <button
            onClick={() => { if (searchInput) { onSelectSymbol(searchInput); setSearchInput('') } }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium
                       hover:from-violet-500 hover:to-blue-500 transition-all"
          >
            Git
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <StockSkeleton />
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <span className="text-3xl mb-3">⚠️</span>
      <p className="text-white/60 text-sm">{error}</p>
    </div>
  )
  if (!data) return null

  const { profile, keyMetrics, scores, dcf, analystConsensus, priceTarget, fmpScore } = data
  const scoreLevel = fmpScore?.level ?? 'NEUTRAL'

  return (
    <div className="space-y-2 sm:space-y-4 px-2 sm:px-4 lg:px-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3 bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
        <div className="flex items-center gap-4">
          {/* Logo */}
          {profile?.image && (
            <img
              src={profile.image}
              alt={symbol}
              className="w-10 h-10 rounded-lg bg-white/10 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">{symbol}</h3>
              <span className="text-xs text-white/50">{profile?.companyName}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {profile?.sector && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                  {profile.sector}
                </span>
              )}
              {profile?.industry && (
                <span className="text-[10px] text-white/40">{profile.industry}</span>
              )}
            </div>
          </div>
        </div>

        {/* Price + Actions */}
        <div className="flex items-center gap-3">
          {/* Guven + Fiyatlama badges */}
          <div className="flex flex-col items-end gap-1">
            {fmpScore && fmpScore.confidence > 0 && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                fmpScore.confidence >= 70 ? 'text-hermes-green bg-hermes-green/10 border-hermes-green/20' :
                fmpScore.confidence >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                'text-white/50 bg-white/[0.04] border-white/10'
              }`}>
                Guven: {fmpScore.confidence}%
              </span>
            )}
            {fmpScore && fmpScore.categories.valuation > 0 && (() => {
              const val = getValuationFromScore(fmpScore.categories.valuation)
              return (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${val.style}`}>
                  {val.label}
                </span>
              )
            })()}
          </div>
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">
              ${profile?.price?.toFixed(2) ?? '—'}
            </div>
            <div className={`text-sm tabular-nums ${
              (profile?.changes ?? 0) >= 0 ? 'text-hermes-green' : 'text-red-400'
            }`}>
              {(profile?.changes ?? 0) >= 0 ? '+' : ''}{profile?.changes?.toFixed(2)} ({profile?.changesPercentage?.toFixed(2)}%)
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={handleToggleWatchlist}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                watchlist.includes(symbol)
                  ? 'bg-gold-400/15 border-gold-400/30 text-gold-300 hover:bg-gold-400/25'
                  : 'border-white/10 text-white/60 hover:border-gold-400/30 hover:text-gold-300'
              }`}
            >
              {watchlist.includes(symbol) ? '★ Izleniyor' : '☆ Izle'}
            </button>
            <button
              onClick={() => onAddToCompare(symbol)}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/60
                         hover:border-violet-500/30 hover:text-violet-300 transition-all"
            >
              Karsilastir
            </button>
            <SharePanel
              title={`${symbol} — ${profile?.companyName ?? ''}`}
              subtitle={profile?.sector}
              price={profile?.price ? `$${profile.price.toFixed(2)}` : undefined}
              change={profile?.changesPercentage ? `${profile.changesPercentage >= 0 ? '+' : ''}${profile.changesPercentage.toFixed(2)}%` : undefined}
              score={fmpScore?.total}
              scoreLabel={fmpScore ? SCORE_LABELS[scoreLevel] : undefined}
              type="stock"
            />
          </div>
        </div>
      </div>

      {/* Red Flags */}
      {fmpScore && fmpScore.redFlags.length > 0 && (
        <RedFlags flags={fmpScore.redFlags} />
      )}

      {/* Score + DNA Barcode + Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3">
        {/* Score Gauge — Enhanced */}
        <div className="lg:col-span-3 relative overflow-hidden bg-[#0F0F15] rounded-xl border border-gold-400/15 p-3 sm:p-4 flex flex-col items-center justify-center group/score hover:border-gold-400/30 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-b from-gold-400/[0.03] to-transparent pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gold-400/[0.04] rounded-full blur-3xl pointer-events-none group-hover/score:bg-gold-400/[0.08] transition-all duration-700" />
          <span className="relative text-[10px] text-gold-400/60 uppercase tracking-[0.15em] font-bold mb-2 sm:mb-3">HERMES AI Skor</span>
          <div className="relative" style={{ filter: 'drop-shadow(0 0 15px rgba(179,148,91,0.15))' }}>
            <ScoreGauge score={fmpScore} size="lg" />
          </div>
        </div>

        {/* DNA Barcode */}
        <div className="lg:col-span-4 bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <span className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3 block">Kategori Detayı</span>
          {fmpScore ? (
            <DNABarcode categories={fmpScore.categories} />
          ) : (
            <p className="text-white/40 text-xs">Skor hesaplanamadı</p>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-2">
          <MetricCard
            label="P/E"
            value={keyMetrics?.peRatioTTM}
            format="ratio"
            direction="lower"
            tip="Fiyat/Kazanc Orani — dusuk = ucuz, yuksek = pahali"
          />
          <MetricCard
            label="P/B"
            value={keyMetrics?.pbRatioTTM}
            format="ratio"
            direction="lower"
            tip="Fiyat/Defter Degeri — 1'den kucuk = degerinin altinda"
          />
          <MetricCard
            label="ROE"
            value={keyMetrics?.roeTTM}
            format="percent"
            direction="higher"
            tip="Ozsermaye Getirisi — %15+ iyi, %20+ cok iyi"
          />
          <MetricCard
            label="Borc/Ozkaynak"
            value={keyMetrics?.debtToEquityTTM}
            format="ratio"
            direction="lower"
            tip="Borc/Ozsermaye orani — <1 dusuk borclanma, >2 riskli"
          />
          <MetricCard
            label="Cari Oran"
            value={keyMetrics?.currentRatioTTM}
            format="ratio"
            direction="higher"
            tip="Kisa vadeli borclarini odeme gucu — >1.5 ideal"
          />
          <MetricCard
            label="Temettu"
            value={keyMetrics?.dividendYieldTTM}
            format="percent"
            direction="higher"
            tip="Yillik temettu getirisi orani"
          />
          <MetricCard
            label="Altman Z"
            value={scores?.altmanZScore}
            format="score"
            thresholds={{ danger: 1.8, warning: 3.0 }}
            tip="Iflas riski — >3.0 guvenli, 1.8-3.0 gri bolge, <1.8 tehlike"
          />
          <MetricCard
            label="Piotroski"
            value={scores?.piotroskiScore}
            format="score"
            max={9}
            tip="Finansal saglik skoru (0-9) — 7-9 cok saglam"
          />
        </div>
      </div>

      {/* Yatirim Ozeti: Guven + Fiyatlama + Risk + Hedef + Dip + Izleme */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4 flex flex-col items-center justify-center">
          <span className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Guven Puani</span>
          {fmpScore && fmpScore.confidence > 0 ? (
            <>
              <span className={`text-2xl font-black tabular-nums ${
                fmpScore.confidence >= 70 ? 'text-hermes-green' :
                fmpScore.confidence >= 50 ? 'text-amber-400' : 'text-white/50'
              }`}>{fmpScore.confidence}%</span>
              <span className={`text-[10px] mt-1 font-semibold ${
                fmpScore.confidence >= 70 ? 'text-hermes-green/70' :
                fmpScore.confidence >= 50 ? 'text-amber-400/70' : 'text-white/40'
              }`}>{fmpScore.confidence >= 70 ? 'YUKSEK' : fmpScore.confidence >= 50 ? 'ORTA' : 'DUSUK'}</span>
            </>
          ) : (
            <span className="text-lg text-white/40">—</span>
          )}
        </div>

        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4 flex flex-col items-center justify-center">
          <span className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Fiyatlama</span>
          {fmpScore && fmpScore.categories.valuation > 0 ? (() => {
            const val = getValuationFromScore(fmpScore.categories.valuation)
            return (
              <>
                <span className={`text-base font-black px-3 py-1 rounded-lg border ${val.style}`}>{val.label}</span>
                <span className="text-[10px] text-white/35 mt-1 tabular-nums">Skor: {Math.round(fmpScore.categories.valuation)}/100</span>
              </>
            )
          })() : (
            <span className="text-lg text-white/40">—</span>
          )}
        </div>

        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4 flex flex-col items-center justify-center">
          <span className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Risk Seviyesi</span>
          {fmpScore ? (
            <>
              <span className={`text-2xl font-black tabular-nums ${
                fmpScore.total >= 66 ? 'text-hermes-green' :
                fmpScore.total >= 33 ? 'text-amber-400' : 'text-red-400'
              }`}>{Math.round(fmpScore.total)}</span>
              <span className={`text-[10px] mt-1 font-semibold ${getScoreColor(fmpScore.level)}`}>
                {SCORE_LABELS[fmpScore.level]}
              </span>
            </>
          ) : (
            <span className="text-lg text-white/40">—</span>
          )}
        </div>

        {/* Hedef Fiyat */}
        <div className={`bg-[#0F0F15] rounded-xl border p-3 sm:p-4 flex flex-col items-center justify-center ${
          (() => {
            const pt = priceTarget
            const price = profile?.price || 0
            const target = pt?.targetConsensus || pt?.targetMedian || 0
            const pct = (target > 0 && price > 0) ? ((target - price) / price) * 100 : 0
            return pct >= 30 ? 'border-emerald-500/40' : pct <= -20 ? 'border-red-500/40' : 'border-white/5'
          })()
        }`}>
          <span className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Hedef Fiyat</span>
          {(() => {
            const pt = priceTarget
            const price = profile?.price || 0
            const target = pt?.targetConsensus || pt?.targetMedian || 0
            if (target > 0 && price > 0) {
              const pct = ((target - price) / price) * 100
              return (
                <>
                  <span className={`text-2xl font-black tabular-nums ${pct >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
                    ${target.toFixed(2)}
                  </span>
                  {pct >= 30 ? (
                    <span className="text-[10px] mt-1 font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      YUKARI POTANSIYEL +{pct.toFixed(0)}%
                    </span>
                  ) : (
                    <span className={`text-[10px] mt-1 font-semibold tabular-nums ${pct >= 0 ? 'text-hermes-green/70' : 'text-red-400/70'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  )}
                </>
              )
            }
            return <span className="text-lg text-white/40">—</span>
          })()}
        </div>

        {/* Dip Fiyat */}
        <div className={`bg-[#0F0F15] rounded-xl border p-3 sm:p-4 flex flex-col items-center justify-center ${
          (() => {
            const pt = priceTarget
            const price = profile?.price || 0
            const floor = pt?.targetLow || (profile?.range ? parseFloat(profile.range.split('-')[0]) || 0 : 0)
            return (floor > 0 && price > 0 && price < floor) ? 'border-emerald-500/40' : 'border-white/5'
          })()
        }`}>
          <span className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Dip Fiyat</span>
          {(() => {
            const pt = priceTarget
            const price = profile?.price || 0
            const rangeLow = profile?.range ? parseFloat(profile.range.split('-')[0]) || 0 : 0
            const floor = pt?.targetLow || rangeLow || 0
            if (floor > 0 && price > 0) {
              const pct = ((floor - price) / price) * 100
              const belowFloor = price < floor
              return (
                <>
                  <span className={`text-2xl font-black tabular-nums ${belowFloor ? 'text-emerald-400' : pct >= -10 ? 'text-amber-400' : 'text-red-400'}`}>
                    ${floor.toFixed(2)}
                  </span>
                  {belowFloor ? (
                    <span className="text-[10px] mt-1 font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      DIP ALTINDA ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className={`text-[10px] mt-1 font-semibold tabular-nums ${pct >= -10 ? 'text-amber-400/70' : 'text-red-400/70'}`}>
                      {pct.toFixed(1)}%
                    </span>
                  )}
                </>
              )
            }
            return <span className="text-lg text-white/40">—</span>
          })()}
        </div>

        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4 flex flex-col items-center justify-center gap-2">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Izleme Listesi</span>
          <button
            onClick={handleToggleWatchlist}
            className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
              watchlist.includes(symbol)
                ? 'bg-gold-400/15 border-gold-400/30 text-gold-300 hover:bg-gold-400/25 shadow-lg shadow-gold-400/10'
                : 'border-white/10 text-white/60 hover:border-gold-400/30 hover:text-gold-300 hover:bg-gold-400/5'
            }`}
          >
            {watchlist.includes(symbol) ? '★ Izleniyor' : '☆ Izleme Listesine Ekle'}
          </button>
          <button
            onClick={() => onAddToCompare(symbol)}
            className="w-full px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/50
                       hover:border-violet-500/30 hover:text-violet-300 transition-all"
          >
            Karsilastirmaya Ekle
          </button>
        </div>
      </div>

      {/* DCF + Analyst */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        {/* DCF Değerleme */}
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">DCF Değerleme</h4>
          {dcf && profile ? (
            <DCFDisplay dcfValue={dcf.dcf} currentPrice={profile.price} />
          ) : (
            <p className="text-white/40 text-xs">DCF verisi yok</p>
          )}
        </div>

        {/* Analist Consensus */}
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">Analist Görüşü</h4>
          {analystConsensus ? (
            <AnalystDisplay consensus={analystConsensus} priceTarget={priceTarget} currentPrice={profile?.price ?? 0} />
          ) : (
            <p className="text-white/40 text-xs">Analist verisi yok</p>
          )}
        </div>
      </div>

      {/* Market Cap + Beta + Float + 52W Range */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <InfoCard label="Piyasa Değeri" value={formatMarketCap(profile?.mktCap)} />
        <InfoCard label="Beta" value={profile?.beta?.toFixed(2) ?? '—'} />
        <InfoCard label="Çalışan" value={profile?.fullTimeEmployees ?? '—'} />
        <InfoCard label="52H Aralık" value={profile?.range ?? '—'} />
      </div>

      {/* V3: Teknik Ozet Karti */}
      <TechnicalSummaryCard symbol={symbol} />

      {/* V3: Company Intelligence Cards */}
      <CompanyIntelligenceCards symbol={symbol} companyName={profile?.companyName || symbol} />

      {/* Son Haberler (compact) */}
      {data.news.length > 0 && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">Son Haberler</h4>
          <div className="space-y-2">
            {data.news.slice(0, 5).map((n, i) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 py-1.5 hover:bg-white/[0.02] rounded-md px-2 transition-all"
              >
                <span className="text-[10px] text-white/35 shrink-0 mt-0.5">
                  {new Date(n.publishedDate).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-xs text-white/70 line-clamp-1">{n.title}</span>
                <span className="text-[9px] text-white/40 shrink-0">{n.site}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Score Decomposition */}
      {fmpScore && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">Skor Dağılımı</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {(Object.keys(fmpScore.categories) as Array<keyof typeof fmpScore.categories>).map(key => {
              const val = fmpScore.categories[key]
              const weight = FMP_SCORE_WEIGHTS[key]
              const weighted = Math.round(val * weight)
              const level = getScoreLevel(val)
              const color = getScoreColor(level)

              return (
                <div key={key} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-white/50">{CATEGORY_LABELS[key]}</span>
                    <span className="text-[9px] text-white/40">{Math.round(weight * 100)}%</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-bold tabular-nums ${color}`}>{val}</span>
                    <span className="text-[9px] text-white/40">→ {weighted}p</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub Components ────────────────────────────────────────────────

function MetricCard({
  label, value, format, direction, max, thresholds, tip,
}: {
  label: string
  value?: number
  format: 'ratio' | 'percent' | 'score'
  direction?: 'lower' | 'higher'
  max?: number
  thresholds?: { danger: number; warning: number }
  tip?: string
}) {
  const hasValue = value != null && isFinite(value) && value !== 0
  const display = hasValue
    ? format === 'percent'
      ? `${(Math.abs(value!) < 2 ? value! * 100 : value!).toFixed(1)}%`
    : format === 'score' ? (max ? `${value!.toFixed(1)}/${max}` : value!.toFixed(2))
    : value!.toFixed(2)
    : '—'

  let textColor = 'text-white'
  if (!hasValue) {
    textColor = 'text-white/40'
  } else if (thresholds && value != null) {
    if (value < thresholds.danger) textColor = 'text-red-400'
    else if (value < thresholds.warning) textColor = 'text-orange-400'
    else textColor = 'text-hermes-green'
  }

  return (
    <div className="bg-[#0F0F15] rounded-lg border border-white/5 px-3 py-2.5 hover:border-white/10 transition-all"
      title={tip || ''}>
      <div className="text-[9px] text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-base font-bold tabular-nums ${textColor}`}>{display}</div>
    </div>
  )
}

function DCFDisplay({ dcfValue, currentPrice }: { dcfValue: number; currentPrice: number }) {
  const upside = ((dcfValue - currentPrice) / currentPrice) * 100
  const isUndervalued = upside > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-white/50 mb-0.5">Gerçek Değer (DCF)</div>
          <div className="text-xl font-bold text-white tabular-nums">${dcfValue.toFixed(2)}</div>
        </div>
        <div className={`text-right px-3 py-2 rounded-lg ${
          isUndervalued ? 'bg-hermes-green/10' : 'bg-red-500/10'
        }`}>
          <div className={`text-lg font-bold tabular-nums ${
            isUndervalued ? 'text-hermes-green' : 'text-red-400'
          }`}>
            {isUndervalued ? '+' : ''}{upside.toFixed(1)}%
          </div>
          <div className={`text-[9px] ${isUndervalued ? 'text-hermes-green/60' : 'text-red-400/60'}`}>
            {isUndervalued ? 'UCUZ' : 'PAHALI'}
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`absolute h-full rounded-full ${isUndervalued ? 'bg-hermes-green' : 'bg-red-400'}`}
          style={{
            width: `${Math.min(100, Math.abs(upside))}%`,
            left: isUndervalued ? '50%' : `${50 - Math.min(50, Math.abs(upside))}%`,
          }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
      </div>
    </div>
  )
}

function AnalystDisplay({
  consensus, priceTarget, currentPrice,
}: {
  consensus: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }
  priceTarget: { targetConsensus: number; targetHigh: number; targetLow: number } | null
  currentPrice: number
}) {
  const total = consensus.strongBuy + consensus.buy + consensus.hold + consensus.sell + consensus.strongSell

  const segments = [
    { label: 'S.Buy', count: consensus.strongBuy, color: 'bg-yellow-400' },
    { label: 'Buy', count: consensus.buy, color: 'bg-hermes-green' },
    { label: 'Hold', count: consensus.hold, color: 'bg-slate-400' },
    { label: 'Sell', count: consensus.sell, color: 'bg-orange-400' },
    { label: 'S.Sell', count: consensus.strongSell, color: 'bg-red-400' },
  ]

  const targetUpside = priceTarget
    ? ((priceTarget.targetConsensus - currentPrice) / currentPrice) * 100
    : 0

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-[1px]">
        {segments.map((seg, i) => (
          seg.count > 0 && (
            <div
              key={i}
              className={`${seg.color} transition-all`}
              style={{ width: `${(seg.count / total) * 100}%` }}
              title={`${seg.label}: ${seg.count}`}
            />
          )
        ))}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-[9px]">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-sm ${seg.color}`} />
            <span className="text-white/50">{seg.label}</span>
            <span className="text-white/60 font-medium">{seg.count}</span>
          </div>
        ))}
      </div>

      {/* Price Target */}
      {priceTarget && (
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div>
            <div className="text-[9px] text-white/40">Hedef Fiyat</div>
            <div className="text-base font-bold text-white tabular-nums">
              ${priceTarget.targetConsensus.toFixed(2)}
            </div>
          </div>
          <div className={`text-sm font-bold tabular-nums ${targetUpside >= 0 ? 'text-hermes-green' : 'text-red-400'}`}>
            {targetUpside >= 0 ? '▲' : '▼'} {Math.abs(targetUpside).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0F0F15] rounded-lg border border-white/5 px-3 py-2">
      <div className="text-[9px] text-white/40 uppercase mb-0.5">{label}</div>
      <div className="text-xs text-white font-medium tabular-nums">{value}</div>
    </div>
  )
}

function formatMarketCap(cap?: number): string {
  if (!cap) return '—'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
  return `$${cap.toLocaleString()}`
}

// ─── V3: Company Intelligence Cards ──────────────────────────────

function CompanyIntelligenceCards({ symbol, companyName }: { symbol: string; companyName: string }) {
  const [peers, setPeers] = useState<string[]>([])
  const [executives, setExecutives] = useState<{ name: string; title: string; pay: number | null }[]>([])
  const [pressReleases, setPressReleases] = useState<{ date: string; title: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!symbol) return
    setLoaded(false)

    // Fetch peers, executives, press releases in parallel
    Promise.allSettled([
      fetch(`/api/fmp-terminal/stock/${symbol}`).then(r => r.json()),
    ]).then(([stockRes]) => {
      if (stockRes.status === 'fulfilled' && stockRes.value) {
        setPeers(stockRes.value.peers || [])
        setExecutives((stockRes.value.executives || []).slice(0, 5))
        setPressReleases((stockRes.value.pressReleases || []).slice(0, 3))
      }
      setLoaded(true)
    })
  }, [symbol])

  if (!loaded) return null

  const hasPeers = peers.length > 0
  const hasExecs = executives.length > 0
  const hasPress = pressReleases.length > 0

  if (!hasPeers && !hasExecs && !hasPress) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
      {/* Rakipler */}
      {hasPeers && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Rakipler</h4>
          <div className="flex flex-wrap gap-1">
            {peers.slice(0, 8).map(p => (
              <span key={p} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/60 hover:text-violet-400 cursor-pointer transition-colors">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Yonetim */}
      {hasExecs && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Ust Yonetim</h4>
          <div className="space-y-1.5">
            {executives.slice(0, 4).map((e, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-white/60">{e.name}</span>
                  <span className="text-[9px] text-white/35 ml-1">{e.title}</span>
                </div>
                {e.pay != null && e.pay > 0 && (
                  <span className="text-[10px] text-white/40 tabular-nums">
                    ${(e.pay / 1e6).toFixed(1)}M
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Son Aciklamalar */}
      {hasPress && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Son Aciklamalar</h4>
          <div className="space-y-1.5">
            {pressReleases.map((p, i) => (
              <div key={i}>
                <div className="text-[11px] text-white/60 line-clamp-1">{p.title}</div>
                <div className="text-[9px] text-white/40">{p.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── V3: Technical Summary Card (fetches data on-demand) ──────────

function TechnicalSummaryCard({ symbol }: { symbol: string }) {
  const [tech, setTech] = useState<{
    rsi14: number | null; sma50: number | null; sma200: number | null;
    ema20: number | null; adx14: number | null; williams14: number | null;
    goldenCross: boolean; rsiSignal: string; trendStrength: string; priceAboveEma20: boolean
  } | null>(null)

  useEffect(() => {
    if (!symbol) return
    fetch(`/api/fmp-terminal/technical/${symbol}`)
      .then(r => r.json())
      .then(d => setTech(d?.summary ?? null))
      .catch(() => {})
  }, [symbol])

  if (!tech) return null

  const TREND_COLORS: Record<string, string> = {
    'STRONG_UP': 'text-hermes-green', 'UP': 'text-hermes-green/70',
    'NEUTRAL': 'text-white/50', 'DOWN': 'text-orange-400', 'STRONG_DOWN': 'text-red-400'
  }
  const TREND_LABELS: Record<string, string> = {
    'STRONG_UP': 'GUCLU YUKSELIS', 'UP': 'YUKSELIS',
    'NEUTRAL': 'YATAY', 'DOWN': 'DUSUS', 'STRONG_DOWN': 'GUCLU DUSUS'
  }

  return (
    <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
      <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">Teknik Ozet</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] text-white/40 mb-0.5">RSI (14)</div>
          <div className={`text-base font-bold tabular-nums ${
            (tech.rsi14 ?? 50) < 30 ? 'text-hermes-green' : (tech.rsi14 ?? 50) > 70 ? 'text-red-400' : 'text-white'
          }`}>{tech.rsi14?.toFixed(1) ?? '--'}</div>
          <div className={`text-[9px] ${
            tech.rsiSignal === 'OVERSOLD' ? 'text-hermes-green/60' : tech.rsiSignal === 'OVERBOUGHT' ? 'text-red-400/60' : 'text-white/35'
          }`}>{tech.rsiSignal === 'OVERSOLD' ? 'Asiri Satim' : tech.rsiSignal === 'OVERBOUGHT' ? 'Asiri Alim' : 'Notr'}</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] text-white/40 mb-0.5">SMA CROSS</div>
          <div className={`text-sm font-bold ${tech.goldenCross ? 'text-hermes-green' : 'text-red-400'}`}>
            {tech.goldenCross ? 'GOLDEN' : 'DEATH'}
          </div>
          <div className="text-[9px] text-white/35">50/200</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] text-white/40 mb-0.5">ADX (14)</div>
          <div className="text-base font-bold text-white tabular-nums">{tech.adx14?.toFixed(1) ?? '--'}</div>
          <div className="text-[9px] text-white/35">{(tech.adx14 ?? 0) > 25 ? 'Guclu Trend' : 'Zayif'}</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] text-white/40 mb-0.5">TREND</div>
          <div className={`text-sm font-bold ${TREND_COLORS[tech.trendStrength] || 'text-white/50'}`}>
            {TREND_LABELS[tech.trendStrength] || 'YATAY'}
          </div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] text-white/40 mb-0.5">EMA 20</div>
          <div className="text-sm font-bold text-white tabular-nums">${tech.ema20?.toFixed(2) ?? '--'}</div>
          <div className={`text-[9px] ${tech.priceAboveEma20 ? 'text-hermes-green/60' : 'text-red-400/60'}`}>
            Fiyat {tech.priceAboveEma20 ? 'ustunde' : 'altinda'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────

function StockSkeleton() {
  const SECTIONS = [
    { label: 'Hisse Profili', w: 'col-span-12', h: 'h-16' },
    { label: 'Skor Analizi', w: 'col-span-3', h: 'h-44' },
    { label: 'Fiyat & Teknik', w: 'col-span-4', h: 'h-44' },
    { label: 'Metrikler', w: 'col-span-5', h: 'h-44' },
  ]
  return (
    <div className="relative space-y-4 animate-fade-in overflow-hidden">
      <div className="absolute inset-0 data-stream pointer-events-none" />
      {/* Header */}
      <div className="bg-[#1A1A1A]/60 rounded-xl border border-white/[0.05] p-4 h-16 opacity-0 overflow-hidden"
        style={{ animation: 'card-reveal 0.5s ease-out 0.1s forwards' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg skeleton-shimmer" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-32 skeleton-shimmer rounded" />
            <div className="h-2.5 w-48 skeleton-shimmer rounded" />
          </div>
          <div className="h-8 w-20 skeleton-shimmer rounded-lg" />
        </div>
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 relative z-10">
        {SECTIONS.slice(1).map((s, i) => (
          <div key={i} className={`${s.w} bg-[#1A1A1A]/60 rounded-xl border border-white/[0.05] p-3 ${s.h} opacity-0 overflow-hidden`}
            style={{ animation: `card-reveal 0.5s ease-out ${0.25 + i * 0.15}s forwards` }}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-gold-400/25" style={{ animation: 'heartbeat 2s ease-in-out infinite' }} />
              <span className="text-[9px] text-white/40 font-medium tracking-wider uppercase">{s.label}</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: i === 2 ? 6 : 4 }).map((_, j) => (
                <div key={j} className="h-2.5 skeleton-shimmer rounded" style={{ width: `${50 + Math.random() * 40}%`, animationDelay: `${j * 60}ms` }} />
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden">
              <div className="h-full w-1/4 terminal-scan-line" style={{ background: 'linear-gradient(90deg, transparent, rgba(179,148,91,0.05), transparent)' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center relative z-10 opacity-0" style={{ animation: 'card-reveal 0.4s ease-out 0.8s forwards' }}>
        <span className="text-[9px] text-white/35 font-mono">Hisse detaylari yukleniyor...</span>
      </div>
    </div>
  )
}
