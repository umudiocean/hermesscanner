'use client'

import { useState, useEffect } from 'react'
import { Globe2, TrendingUp, TrendingDown, Newspaper, Leaf, Building2, Info, ExternalLink } from 'lucide-react'

interface MacroData {
  gdp: { date: string; value: number; name?: string }[]
  consumerSentiment: { date: string; value: number; name?: string }[]
  generalNews: { publishedDate: string; title: string; site: string; url: string; text: string }[]
  esgBenchmarks: { year: number; sector: string; ESGScore: number; environmentalScore: number; socialScore: number; governanceScore: number }[]
  indexConstituents: { sp500: number; nasdaq: number; dowjones: number }
  indexMembership: Record<string, string[]>
}

function fmtBig(v: number) {
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  return v.toFixed(1)
}

export default function TabMacro({ onSelectSymbol }: { onSelectSymbol?: (s: string) => void }) {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fmp-terminal/macro')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 data-stream pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14" viewBox="0 0 100 100" style={{ animation: 'ring-spin 2s linear infinite' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(179,148,91,0.06)" strokeWidth="2" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#macGold)" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="264" style={{ animation: 'ring-pulse 1.6s ease-in-out infinite' }} />
              <defs><linearGradient id="macGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#C9A96E" /><stop offset="100%" stopColor="#876b3a" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-gold-400/80 text-lg">🌐</div>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-text-secondary">Makro ekonomi verileri</p>
            <p className="text-[9px] text-text-tertiary mt-0.5">GDP, sentiment, ESG, endeksler</p>
          </div>
          <div className="w-32 h-0.5 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #876b3a, #C9A96E)' }} />
          </div>
          <div className="flex gap-2">
            {['GDP', 'Sentiment', 'News', 'ESG'].map((t, i) => (
              <div key={i} className="px-2 py-1 rounded-md bg-surface-2 border border-stroke-subtle opacity-0"
                style={{ animation: `card-reveal 0.3s ease-out ${0.4 + i * 0.15}s forwards` }}>
                <span className="text-[8px] text-text-quaternary font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-center py-12 text-text-quaternary">Makro veri alinamadi</div>
  }

  const latestGdp = data.gdp?.[0]
  const prevGdp = data.gdp?.[1]
  const gdpGrowth = latestGdp && prevGdp && prevGdp.value > 0
    ? ((latestGdp.value - prevGdp.value) / prevGdp.value * 100).toFixed(1)
    : null

  const latestSentiment = data.consumerSentiment?.[0]
  const prevSentiment = data.consumerSentiment?.[1]
  const sentimentChange = latestSentiment && prevSentiment
    ? (latestSentiment.value - prevSentiment.value).toFixed(1)
    : null

  return (
    <div className="space-y-2 sm:space-y-4 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hermes-green to-teal-500 flex items-center justify-center">
            <Globe2 size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">MAKRO EKONOMI</h3>
            <p className="text-xs text-text-tertiary">ABD ekonomik gostergeleri, haberler ve ESG</p>
          </div>
        </div>

        {/* Key Macro Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">ABD GDP</div>
            <div className="text-base sm:text-lg font-bold text-white">{latestGdp ? fmtBig(latestGdp.value * 1e9) : '--'}</div>
            {gdpGrowth && (
              <span className={`text-xs ${Number(gdpGrowth) >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                {Number(gdpGrowth) >= 0 ? '+' : ''}{gdpGrowth}% QoQ
              </span>
            )}
          </div>
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">TUKETICI GUVENI</div>
            <div className="text-base sm:text-lg font-bold text-white">{latestSentiment ? latestSentiment.value.toFixed(1) : '--'}</div>
            {sentimentChange && (
              <span className={`text-xs ${Number(sentimentChange) >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                {Number(sentimentChange) >= 0 ? '+' : ''}{sentimentChange}
              </span>
            )}
          </div>
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">ENDEKS UYELERI</div>
            <div className="text-sm font-bold text-white">
              <span className="text-info-400">SP500</span> {data.indexConstituents.sp500} |
              <span className="text-info-400 ml-1">NDX</span> {data.indexConstituents.nasdaq} |
              <span className="text-gold-400 ml-1">DOW</span> {data.indexConstituents.dowjones}
            </div>
          </div>
          <div className="bg-surface-2 rounded-xl p-3 border border-stroke-subtle">
            <div className="text-[11px] text-text-tertiary font-medium mb-1">IZLENEN HISSE</div>
            <div className="text-base sm:text-lg font-bold text-white">{Object.keys(data.indexMembership).length}</div>
            <span className="text-[11px] text-text-quaternary">Endekslerde yer alan</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
        {/* GDP Trend */}
        <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
          <h4 className="text-sm font-bold text-text-secondary mb-2 sm:mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} /> GDP TRENDI {data.gdp.length > 0 ? `(Son ${Math.min(12, data.gdp.length)} Ceyrek)` : ''}
          </h4>
          {data.gdp.length > 0 ? (
            <>
              <div className="flex items-end gap-1 h-28">
                {data.gdp.slice(0, 12).reverse().map((g, i) => {
                  const items = data.gdp.slice(0, 12)
                  const vals = items.map(x => x.value).filter(v => v > 0)
                  const maxVal = vals.length > 0 ? Math.max(...vals) : 1
                  const minVal = vals.length > 0 ? Math.min(...vals) : 0
                  const range = maxVal - minVal || 1
                  const h = g.value > 0 ? ((g.value - minVal) / range) * 85 + 15 : 5
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end group/bar" title={`${g.date}: ${fmtBig(g.value * 1e9)}${g.name ? ` (${g.name})` : ''}`}>
                      <div className="bg-success-400/40 rounded-t-sm group-hover/bar:bg-success-400/70 transition-all duration-200 relative" style={{ height: `${h}%` }}>
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-white/0 group-hover/bar:text-text-secondary whitespace-nowrap transition-all">{g.value > 0 ? fmtBig(g.value * 1e9) : '—'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-text-quaternary">{data.gdp[Math.min(11, data.gdp.length - 1)]?.date}</span>
                <span className="text-[10px] text-text-quaternary">{data.gdp[0]?.date}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-28 text-text-tertiary text-xs">Veri bekleniyor...</div>
          )}
        </div>

        {/* Consumer Sentiment Trend */}
        <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
          <h4 className="text-sm font-bold text-text-secondary mb-2 sm:mb-3 flex items-center gap-1.5">
            <Building2 size={14} /> TUKETICI GUVENI TRENDI
          </h4>
          {data.consumerSentiment.length > 0 ? (
            <>
              <div className="flex items-end gap-1 h-28">
                {data.consumerSentiment.slice(0, 12).reverse().map((s, i) => {
                  const items = data.consumerSentiment.slice(0, 12)
                  const vals = items.map(x => x.value).filter(v => v > 0)
                  const maxVal = vals.length > 0 ? Math.max(...vals) : 1
                  const minVal = vals.length > 0 ? Math.min(...vals) : 0
                  const range = maxVal - minVal || 1
                  const h = s.value > 0 ? ((s.value - minVal) / range) * 85 + 15 : 5
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end group/bar" title={`${s.date}: ${s.value.toFixed(1)}${s.name ? ` (${s.name})` : ''}`}>
                      <div className="bg-info-400/40 rounded-t-sm group-hover/bar:bg-info-400/70 transition-all duration-200 relative" style={{ height: `${h}%` }}>
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-white/0 group-hover/bar:text-text-secondary whitespace-nowrap transition-all">{s.value.toFixed(1)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-text-quaternary">{data.consumerSentiment[Math.min(11, data.consumerSentiment.length - 1)]?.date}</span>
                <span className="text-[10px] text-text-quaternary">{data.consumerSentiment[0]?.date}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-28 text-text-tertiary text-xs">Veri bekleniyor...</div>
          )}
        </div>
      </div>

      {/* General News */}
      {data.generalNews.length > 0 && (
        <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
          <h4 className="text-sm font-bold text-text-secondary mb-2 sm:mb-3 flex items-center gap-1.5">
            <Newspaper size={14} /> PIYASA HABERLERI
          </h4>
          <div className="divide-y divide-white/[0.04]">
            {data.generalNews.slice(0, 10).map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                className="block py-2.5 hover:bg-surface-2 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-text-secondary group-hover:text-white transition-colors line-clamp-2">{n.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-text-tertiary">{n.site}</span>
                      <span className="text-[10px] text-text-quaternary">{new Date(n.publishedDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ExternalLink size={12} className="text-text-quaternary group-hover:text-info-400 shrink-0 mt-1" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ESG Benchmarks */}
      {data.esgBenchmarks.length > 0 && (
        <div className="bg-surface-3 rounded-2xl border border-stroke-subtle p-3 sm:p-4 lg:p-5 shadow-xl shadow-black/20">
          <h4 className="text-sm font-bold text-text-secondary mb-2 sm:mb-3 flex items-center gap-1.5">
            <Leaf size={14} /> ESG SEKTOR KARSILASTIRMASI
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke-subtle">
                  <th className="text-left py-2 px-2 text-[11px] text-text-tertiary font-medium">SEKTOR</th>
                  <th className="text-right py-2 px-2 text-[11px] text-text-tertiary font-medium">ESG</th>
                  <th className="text-right py-2 px-2 text-[11px] text-text-tertiary font-medium">CEVRE</th>
                  <th className="text-right py-2 px-2 text-[11px] text-text-tertiary font-medium">SOSYAL</th>
                  <th className="text-right py-2 px-2 text-[11px] text-text-tertiary font-medium">YONETISIM</th>
                </tr>
              </thead>
              <tbody>
                {data.esgBenchmarks
                  .filter((v, i, a) => a.findIndex(x => x.sector === v.sector) === i)
                  .slice(0, 15)
                  .sort((a, b) => b.ESGScore - a.ESGScore)
                  .map((b, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-surface-2">
                      <td className="py-1.5 px-2 text-xs text-text-secondary">{b.sector}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-white">{b.ESGScore.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-success-400/70">{b.environmentalScore.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-info-400/70">{b.socialScore.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-info-400/70">{b.governanceScore.toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 px-2 sm:px-4 py-3 bg-info-400/[0.05] rounded-xl border border-violet-500/10">
        <Info size={14} className="text-info-400/50 mt-0.5 shrink-0" />
        <p className="text-[12px] text-text-tertiary leading-relaxed">
          ABD GDP, tuketici guveni, piyasa haberleri, S&amp;P 500/NASDAQ 100/Dow Jones endeks uyelikleri
          ve sektor bazli ESG karsilastirmasi canli olarak cekilir.
        </p>
      </div>
    </div>
  )
}
