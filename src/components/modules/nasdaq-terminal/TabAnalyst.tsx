'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab 5: ANALIST (Analyst & Earnings)
// Grade değişiklikleri, EPS tahminleri, Earnings surprise chart
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { StockGrade, AnalystEstimate, EarningsSurprise, PriceTarget } from '@/lib/fmp-terminal/fmp-types'

interface TabAnalystProps {
  symbol: string
}

export default function TabAnalyst({ symbol }: TabAnalystProps) {
  const [grades, setGrades] = useState<StockGrade[]>([])
  const [estimates, setEstimates] = useState<AnalystEstimate[]>([])
  const [surprises, setSurprises] = useState<EarningsSurprise[]>([])
  const [priceTarget, setPriceTarget] = useState<PriceTarget | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/fmp-terminal/stock/${symbol}`)
        if (res.ok) {
          const data = await res.json()
          setGrades(data.grades || [])
          setEstimates(data.estimates || [])
          setSurprises(data.earningsSurprises || [])
          setPriceTarget(data.priceTarget || null)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [symbol])

  if (!symbol) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <span className="text-3xl sm:text-4xl mb-2 sm:mb-3">🎯</span>
        <p className="text-white/50 text-sm">Analist verilerini görmek için hisse seçin</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 data-stream pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-4">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14" viewBox="0 0 100 100" style={{ animation: 'ring-spin 2s linear infinite' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(179,148,91,0.06)" strokeWidth="2" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#analGold)" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="264" style={{ animation: 'ring-pulse 1.6s ease-in-out infinite' }} />
              <defs><linearGradient id="analGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#C9A96E" /><stop offset="100%" stopColor="#876b3a" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-gold-400/80 text-lg">🎯</div>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-white/60">Analist tahminleri</p>
            <p className="text-[9px] text-white/40 mt-0.5">Konsensus, fiyat hedefleri</p>
          </div>
          <div className="w-32 h-0.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #876b3a, #C9A96E)' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Price Target */}
      {priceTarget && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">Fiyat Hedefi</h4>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <PriceTargetCard label="Düşük" value={priceTarget.targetLow} color="red" />
            <PriceTargetCard label="Konsensüs" value={priceTarget.targetConsensus} color="violet" />
            <PriceTargetCard label="Yüksek" value={priceTarget.targetHigh} color="hermes-green" />
          </div>
        </div>
      )}

      {/* Earnings Surprises */}
      {surprises.length > 0 && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">
            Kazanç Sürprizleri (Son {Math.min(8, surprises.length)} Ceyrek)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
            {surprises.slice(0, 8).reverse().map((s, i) => {
              const beat = s.epsActual > s.epsEstimated
              const surprise = s.epsEstimated !== 0
                ? ((s.epsActual - s.epsEstimated) / Math.abs(s.epsEstimated)) * 100
                : 0

              return (
                <div key={i} className={`rounded-lg p-2 text-center border ${
                  beat ? 'bg-hermes-green/5 border-hermes-green/20' : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="text-[9px] text-white/40 mb-1">
                    {s.date?.split('-').slice(0, 2).join('/')}
                  </div>
                  <div className={`text-xs font-bold tabular-nums ${beat ? 'text-hermes-green' : 'text-red-400'}`}>
                    {beat ? '✓' : '✗'}
                  </div>
                  <div className="text-[9px] text-white/50 mt-0.5 tabular-nums">
                    {surprise >= 0 ? '+' : ''}{surprise.toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-white/40 mt-0.5">
                    ${s.epsActual?.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grade Changes */}
      {grades.length > 0 && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">
            Analist Derecelendirme Degisiklikleri
          </h4>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {grades.slice(0, 20).map((g, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-white/[0.02]">
                <span className="text-[10px] text-white/40 w-20 shrink-0">
                  {new Date(g.date).toLocaleDateString('tr-TR')}
                </span>
                <span className="text-xs text-white/60 truncate max-w-[120px]">
                  {g.gradingCompany}
                </span>
                <div className="flex items-center gap-1 flex-1">
                  <GradeBadge grade={g.previousGrade} />
                  <span className="text-white/40">→</span>
                  <GradeBadge grade={g.newGrade} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EPS Estimates */}
      {estimates.length > 0 && (
        <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 sm:mb-3">
            Gelecek Ceyrek Tahminleri
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-3 py-2 text-[10px] text-white/40">Dönem</th>
                  <th className="text-right px-3 py-2 text-[10px] text-white/40">EPS Tahmin</th>
                  <th className="text-right px-3 py-2 text-[10px] text-white/40">Gelir Tahmin</th>
                  <th className="text-right px-3 py-2 text-[10px] text-white/40">Analist #</th>
                </tr>
              </thead>
              <tbody>
                {estimates.slice(0, 6).map((e, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-xs text-white/60">{e.date}</td>
                    <td className="px-3 py-1.5 text-xs text-white/70 text-right tabular-nums">
                      ${e.estimatedEpsAvg?.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-white/70 text-right tabular-nums">
                      {formatB(e.estimatedRevenueAvg)}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-white/50 text-right">
                      {e.numberAnalystsEstimatedEps || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub Components ────────────────────────────────────────────────

function PriceTargetCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-2 sm:p-3 text-center border ${
      color === 'hermes-green' ? 'bg-hermes-green/5 border-hermes-green/15' :
      color === 'red' ? 'bg-red-500/5 border-red-500/15' :
      'bg-violet-500/5 border-violet-500/15'
    }`}>
      <div className="text-[9px] text-white/40 uppercase mb-1">{label}</div>
      <div className={`text-base sm:text-lg font-bold tabular-nums ${
        color === 'hermes-green' ? 'text-hermes-green' :
        color === 'red' ? 'text-red-400' :
        'text-violet-400'
      }`}>
        ${value?.toFixed(2)}
      </div>
    </div>
  )
}

function GradeBadge({ grade }: { grade: string }) {
  const g = grade?.toLowerCase() || ''
  const isPositive = g.includes('buy') || g.includes('overweight') || g.includes('outperform')
  const isNegative = g.includes('sell') || g.includes('underweight') || g.includes('underperform')

  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
      isPositive ? 'bg-hermes-green/15 text-hermes-green' :
      isNegative ? 'bg-red-500/15 text-red-400' :
      'bg-white/5 text-white/50'
    }`}>
      {grade || '—'}
    </span>
  )
}

function formatB(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return '—'
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
  return `$${val.toLocaleString()}`
}
