'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL — Tab: MAKRO RADAR
// FRED API bazli detayli makro ekonomi paneli
// 5 bolum: Yield Curve, Fed, Enflasyon, Istihdam, Kredi/Likidite
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Activity, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Zap, Radio, Thermometer, Users, CreditCard } from 'lucide-react'
import type { FredDashboardData, FearGreedComponents } from '@/lib/fred-client'

interface FredFullData extends FredDashboardData {
  fearGreedV2: FearGreedComponents
}

export default function TabFred() {
  const [data, setData] = useState<FredFullData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/fmp-terminal/fred')
        if (!res.ok) throw new Error('FRED verisi yuklenemedi')
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <FredSkeleton />
  if (error) return <FredError message={error} />
  if (!data) return <FredError message="FRED verisi bulunamadi" />

  const regimeColors: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
    GOLDILOCKS: { bg: 'bg-success-400/10', text: 'text-success-400', border: 'border-success-400/25', emoji: '\u2728' },
    REFLATION: { bg: 'bg-gold-500/10', text: 'text-gold-400', border: 'border-amber-500/25', emoji: '\uD83D\uDD25' },
    STAGFLATION: { bg: 'bg-danger-400/10', text: 'text-danger-400', border: 'border-danger-400/30', emoji: '\u26A0\uFE0F' },
    DEFLATION: { bg: 'bg-info-400/10', text: 'text-info-400', border: 'border-blue-500/25', emoji: '\u2744\uFE0F' },
    UNKNOWN: { bg: 'bg-surface-3', text: 'text-text-tertiary', border: 'border-stroke', emoji: '\u2753' },
  }
  const rc = regimeColors[data.macroRegime] || regimeColors.UNKNOWN

  return (
    <div className="space-y-2 sm:space-y-4 px-2 sm:px-4 lg:px-6 animate-fade-in">

      {/* ═══ MAKRO REJIM KARTI ═══ */}
      <div className={`rounded-2xl border ${rc.border} ${rc.bg} p-3 sm:p-4 lg:p-5 shadow-glass`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio size={20} className="text-cyan-400" />
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-primary uppercase tracking-wider">Makro Ekonomi Radar</h2>
              <p className="text-xs text-text-tertiary">Federal Reserve (FRED) verileri ile canli ekonomi nabzi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Makro Rejim</div>
              <div className={`text-lg sm:text-xl font-black ${rc.text}`}>{rc.emoji} {data.macroRegime}</div>
            </div>
          </div>
        </div>
        <div className="mt-2 sm:mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Goldilocks', desc: 'Dusuk enflasyon + buyume', active: data.macroRegime === 'GOLDILOCKS' },
            { label: 'Reflation', desc: 'Yukselen enflasyon + buyume', active: data.macroRegime === 'REFLATION' },
            { label: 'Stagflation', desc: 'Yuksek enflasyon + durgunluk', active: data.macroRegime === 'STAGFLATION' },
            { label: 'Deflation', desc: 'Dusen fiyatlar + daralma', active: data.macroRegime === 'DEFLATION' },
          ].map(r => (
            <div key={r.label} className={`rounded-xl p-2 text-center border transition-all duration-300 ${
              r.active ? `${rc.border} ${rc.bg}` : 'border-stroke-subtle bg-white/[0.01]'
            }`}>
              <div className={`text-xs font-bold ${r.active ? rc.text : 'text-text-quaternary'}`}>{r.label}</div>
              <div className="text-[9px] text-text-tertiary mt-0.5">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Fear & Greed v2 Detay ═══ */}
      <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <Zap size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">FRED Korku & Acgozluluk v2</h3>
          <span className="text-[10px] text-text-quaternary ml-1">5 makro bilesen bilesimi</span>
          <div className="ml-auto">
            <span className={`text-xl sm:text-2xl font-black tabular-nums ${
              data.fearGreedV2.composite >= 60 ? 'text-success-400' :
              data.fearGreedV2.composite >= 40 ? 'text-text-secondary' : 'text-danger-400'
            }`}>{data.fearGreedV2.composite}</span>
            <span className="text-xs text-text-tertiary ml-1">/100</span>
          </div>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-600 via-orange-500 via-slate-400 to-hermes-green mb-4">
          <div className="absolute top-0 h-full w-1.5 bg-white shadow-lg shadow-white/50 rounded-full transition-all duration-700"
            style={{ left: `${Math.max(1, Math.min(99, data.fearGreedV2.composite))}%` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {[
            { name: 'VIX Momentum', score: data.fearGreedV2.vixScore, desc: 'Volatilite endeksi trendi', weight: 25 },
            { name: 'Verim Egrisi', score: data.fearGreedV2.yieldCurveScore, desc: '10Y-2Y tahvil fark', weight: 20 },
            { name: 'Kredi Spreadi', score: data.fearGreedV2.creditSpreadScore, desc: 'HY bono risk primi', weight: 20 },
            { name: 'Tuketici Guveni', score: data.fearGreedV2.consumerSentimentScore, desc: 'Michigan endeksi', weight: 20 },
            { name: 'Issiz Basvuru', score: data.fearGreedV2.joblessClaimsScore, desc: 'Haftalik basvurular', weight: 15 },
          ].map(c => (
            <div key={c.name} className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
              <div className="text-[10px] text-text-tertiary mb-1">{c.name}</div>
              <div className={`text-lg font-black tabular-nums ${
                c.score >= 60 ? 'text-success-400' : c.score >= 40 ? 'text-text-secondary' : 'text-danger-400'
              }`}>{c.score}</div>
              <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden mt-1.5">
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${c.score}%`,
                  backgroundColor: c.score >= 60 ? '#3FCAB4' : c.score >= 40 ? '#94a3b8' : '#f87171'
                }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-text-tertiary">{c.desc}</span>
                <span className="text-[9px] text-text-quaternary">{c.weight}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ DETAYLI PANELLER (2x2 + 1) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">

        {/* Yield Curve Monitor */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <TrendingUp size={16} className="text-info-400" />
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Verim Egrisi Monitor</h3>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] text-text-tertiary">10Y - 2Y Spread</div>
              <div className={`text-2xl sm:text-3xl font-black tabular-nums ${
                data.yieldCurve.spread < 0 ? 'text-danger-400' :
                data.yieldCurve.spread < 0.5 ? 'text-warning-400' : 'text-success-400'
              }`}>{data.yieldCurve.spread >= 0 ? '+' : ''}{data.yieldCurve.spread.toFixed(2)}%</div>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${
              data.yieldCurve.status === 'INVERSION' ? 'text-danger-400 bg-danger-400/10 border-danger-400/30' :
              data.yieldCurve.status === 'DIKKAT' ? 'text-warning-400 bg-orange-500/10 border-orange-500/20' :
              data.yieldCurve.status === 'GENIS' ? 'text-success-400 bg-success-400/10 border-success-400/20' :
              'text-text-secondary bg-surface-3 border-stroke'
            }`}>{data.yieldCurve.status}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricBox label="10 Yil" value={`${data.yieldCurve.dgs10.toFixed(2)}%`} />
            <MetricBox label="2 Yil" value={`${data.yieldCurve.dgs2.toFixed(2)}%`} />
          </div>
          <div className="mt-2 text-[10px] text-text-tertiary">
            {data.yieldCurve.status === 'INVERSION'
              ? 'Ters verim egrisi — resesyon sinyali (6-18 ay icinde olasi)'
              : data.yieldCurve.status === 'DIKKAT'
              ? 'Duzlesen egri — dikkatli olun, potansiyel yavaslanma'
              : 'Normal egri — ekonomi sagliklı gorunuyor'}
          </div>
          <div className="text-[9px] text-text-quaternary mt-1">{data.yieldCurve.spreadDate}</div>
        </div>

        {/* Fed Policy Tracker */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <DollarSign size={16} className="text-info-400" />
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Fed Politika Takip</h3>
          </div>
          <div className="mb-3">
            <div className="text-[10px] text-text-tertiary">Federal Fonlar Orani</div>
            <div className="text-2xl sm:text-3xl font-black text-info-400 tabular-nums">{data.fedPolicy.fedFundsRate.toFixed(2)}%</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricBox label="Bank Prime" value={`${data.fedPolicy.bankPrime.toFixed(2)}%`} />
            <MetricBox label="Son Guncelleme" value={data.fedPolicy.fedFundsDate} small />
          </div>
          <div className="mt-2 text-[10px] text-text-tertiary">
            {data.fedPolicy.fedFundsRate >= 5 ? 'Siki para politikasi — Yuksek faiz ortami'
              : data.fedPolicy.fedFundsRate >= 3 ? 'Normal faiz ortami'
              : 'Gevsek para politikasi — Dusuk faiz tesvigi'}
          </div>
        </div>

        {/* Enflasyon Barometresi */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Thermometer size={16} className="text-warning-400" />
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Enflasyon Barometresi</h3>
          </div>
          <div className="mb-3">
            <div className="text-[10px] text-text-tertiary">CPI Endeksi (Tuketici Fiyat)</div>
            <div className="text-2xl sm:text-3xl font-black text-warning-400 tabular-nums">{data.inflation.cpi.toFixed(1)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricBox label="10Y Breakeven" value={`${data.inflation.breakeven10Y.toFixed(2)}%`} />
            <MetricBox label="CPI Tarihi" value={data.inflation.cpiDate} small />
          </div>
          <div className="mt-2 text-[10px] text-text-tertiary">
            10Y Breakeven: Piyasanin enflasyon beklentisi. {data.inflation.breakeven10Y > 2.5 ? 'Yuksek enflasyon beklentisi' : 'Kontrol altinda'}
          </div>
        </div>

        {/* Istihdam Paneli */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Users size={16} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Istihdam Nabzi</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[10px] text-text-tertiary">Issizlik Orani</div>
              <div className={`text-2xl sm:text-3xl font-black tabular-nums ${
                data.employment.unemploymentRate > 5 ? 'text-danger-400' :
                data.employment.unemploymentRate > 4 ? 'text-warning-400' : 'text-success-400'
              }`}>%{data.employment.unemploymentRate.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary">Haftalik Basvurular</div>
              <div className={`text-2xl sm:text-3xl font-black tabular-nums ${
                data.employment.joblessClaims > 300000 ? 'text-danger-400' :
                data.employment.joblessClaims > 250000 ? 'text-warning-400' : 'text-success-400'
              }`}>{(data.employment.joblessClaims / 1000).toFixed(0)}K</div>
            </div>
          </div>
          <div className="text-[10px] text-text-tertiary">
            {data.employment.unemploymentRate < 4 ? 'Tam istihdam yakininda — guclu isgucu piyasasi' :
             data.employment.unemploymentRate < 5 ? 'Sagliklı istihdam seviyeleri' :
             'Artan issizlik — ekonomik yavaslanma sinyali'}
          </div>
          <div className="text-[9px] text-text-quaternary mt-1">{data.employment.unemploymentDate}</div>
        </div>
      </div>

      {/* ═══ BOTTOM ROW: VIX + KREDI + LIKIDITE + TUKETICI ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">

        {/* VIX */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-info-400" />
            <span className="text-xs font-bold text-text-secondary uppercase">Volatilite (VIX)</span>
          </div>
          <div className={`text-xl sm:text-2xl font-black tabular-nums ${
            data.volatility.status === 'PANIC' ? 'text-danger-400' :
            data.volatility.status === 'FEAR' ? 'text-warning-400' :
            data.volatility.status === 'NORMAL' ? 'text-text-secondary' : 'text-success-400'
          }`}>{data.volatility.vix.toFixed(1)}</div>
          <div className={`text-[10px] font-bold mt-1 ${
            data.volatility.status === 'PANIC' ? 'text-danger-400' :
            data.volatility.status === 'FEAR' ? 'text-warning-400' :
            data.volatility.status === 'NORMAL' ? 'text-text-secondary' : 'text-success-400'
          }`}>{data.volatility.status}</div>
          <div className="text-[9px] text-text-quaternary mt-1">{data.volatility.vixDate}</div>
        </div>

        {/* Kredi Stresi */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={14} className="text-warning-400" />
            <span className="text-xs font-bold text-text-secondary uppercase">Kredi Stresi</span>
          </div>
          <div className={`text-xl sm:text-2xl font-black tabular-nums ${
            data.creditStress.status === 'CRISIS' ? 'text-danger-400' :
            data.creditStress.status === 'HIGH' ? 'text-warning-400' :
            data.creditStress.status === 'ELEVATED' ? 'text-yellow-400' : 'text-success-400'
          }`}>{data.creditStress.highYieldSpread.toFixed(2)}%</div>
          <div className={`text-[10px] font-bold mt-1 ${
            data.creditStress.status === 'CRISIS' ? 'text-danger-400' :
            data.creditStress.status === 'HIGH' ? 'text-warning-400' : 'text-success-400'
          }`}>{data.creditStress.status}</div>
          <div className="text-[9px] text-text-quaternary mt-1">{data.creditStress.highYieldDate}</div>
        </div>

        {/* Likidite */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-cyan-400" />
            <span className="text-xs font-bold text-text-secondary uppercase">Likidite (M2)</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-400 tabular-nums">
            {data.liquidity.m2 > 0 ? `${(data.liquidity.m2 / 1000).toFixed(1)}T` : 'N/A'}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">
            Petrol: ${data.liquidity.oilPrice.toFixed(1)}
          </div>
          <div className="text-[9px] text-text-quaternary mt-1">{data.liquidity.m2Date}</div>
        </div>

        {/* Tuketici Guveni */}
        <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 shadow-glass">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-gold-400" />
            <span className="text-xs font-bold text-text-secondary uppercase">Tuketici Guveni</span>
          </div>
          <div className={`text-xl sm:text-2xl font-black tabular-nums ${
            data.consumerSentiment.value > 70 ? 'text-success-400' :
            data.consumerSentiment.value > 55 ? 'text-text-secondary' : 'text-danger-400'
          }`}>{data.consumerSentiment.value.toFixed(1)}</div>
          <div className="text-[10px] text-text-tertiary mt-1">
            Michigan Univ. Endeksi
          </div>
          <div className="text-[9px] text-text-quaternary mt-1">{data.consumerSentiment.date}</div>
        </div>
      </div>

      {/* ═══ TIMESTAMP ═══ */}
      <div className="text-center text-[10px] text-text-quaternary">
        Son guncelleme: {new Date(data.timestamp).toLocaleString('tr-TR')} — Kaynak: Federal Reserve (FRED)
      </div>
    </div>
  )
}

// ─── Helper Components ──────────────────────────────────────────

function MetricBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-surface-2 rounded-lg p-2 border border-stroke-subtle">
      <div className="text-[10px] text-text-tertiary">{label}</div>
      <div className={`${small ? 'text-xs' : 'text-sm'} font-bold text-text-secondary tabular-nums`}>{value}</div>
    </div>
  )
}

function FredSkeleton() {
  return (
    <div className="space-y-2 sm:space-y-4 px-2 sm:px-4 lg:px-6 animate-fade-in">
      <div className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-3 sm:p-4 lg:p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-2 sm:mb-4">
          <Radio size={20} className="text-cyan-400" />
          <div>
            <div className="h-5 w-48 skeleton-shimmer rounded-md" />
            <div className="h-3 w-64 skeleton-shimmer rounded-md mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
              <div className="h-3 w-16 skeleton-shimmer rounded mb-2" />
              <div className="h-8 w-20 skeleton-shimmer rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-2/70 backdrop-blur-md rounded-2xl border border-stroke p-4 h-44">
            <div className="h-4 w-32 skeleton-shimmer rounded mb-3" />
            <div className="h-10 w-24 skeleton-shimmer rounded-md mb-2" />
            <div className="h-3 w-full skeleton-shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function FredError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in px-2 sm:px-4">
      <AlertTriangle size={36} className="text-danger-400/50 mb-2 sm:mb-3" />
      <p className="text-text-tertiary text-sm sm:text-base">{message}</p>
      <p className="text-text-tertiary text-xs mt-1">FRED API baglantisi kontrol edin</p>
      <button onClick={() => window.location.reload()}
        className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium
                   hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all duration-200">
        Tekrar Dene
      </button>
    </div>
  )
}
