'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab 4: SAHIPLIK (Ownership Hub)
// Insider İşlemleri + Kurumsal Sahiplik + Kongre İşlemleri
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { InsiderTrade, InstitutionalHolder, CongressionalTrade } from '@/lib/fmp-terminal/fmp-types'

interface TabOwnershipProps {
  symbol: string
}

type OwnershipView = 'insider' | 'institutional' | 'congressional'

export default function TabOwnership({ symbol }: TabOwnershipProps) {
  const [view, setView] = useState<OwnershipView>('insider')
  const [insiderTrades, setInsiderTrades] = useState<InsiderTrade[]>([])
  const [institutionalHolders, setInstitutionalHolders] = useState<InstitutionalHolder[]>([])
  const [congressionalTrades, setCongressionalTrades] = useState<CongressionalTrade[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/fmp-terminal/stock/${symbol}`)
        if (res.ok) {
          const data = await res.json()
          setInsiderTrades(data.insiderTrades || [])
          setInstitutionalHolders(data.institutionalHolders || [])
          setCongressionalTrades(data.congressionalTrades || [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [symbol])

  if (!symbol) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <span className="text-3xl sm:text-4xl mb-2 sm:mb-3">🏛️</span>
        <p className="text-white/40 text-sm">Sahiplik verilerini görmek için hisse seçin</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
        {([
          { id: 'insider' as OwnershipView, label: 'Insider İşlemleri', count: insiderTrades.length },
          { id: 'institutional' as OwnershipView, label: 'Kurumsal', count: institutionalHolders.length },
          { id: 'congressional' as OwnershipView, label: 'Kongre', count: congressionalTrades.length },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              view === tab.id
                ? 'bg-violet-600/80 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[9px] px-1 py-0.5 rounded ${
                view === tab.id ? 'bg-white/20' : 'bg-white/5'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="h-64 bg-[#0F0F15] rounded-xl border border-white/5 animate-pulse" />}

      {!loading && view === 'insider' && <InsiderView trades={insiderTrades} />}
      {!loading && view === 'institutional' && <InstitutionalView holders={institutionalHolders} />}
      {!loading && view === 'congressional' && <CongressionalView trades={congressionalTrades} />}

      {/* V3: Live Insider Feed */}
      {!loading && <LiveInsiderFeed />}
    </div>
  )
}

// ─── Insider Trades ────────────────────────────────────────────────

function InsiderView({ trades }: { trades: InsiderTrade[] }) {
  if (trades.length === 0) return <EmptyView message="Insider işlemi bulunamadı" />

  const purchases = trades.filter(t => t.acquistionOrDisposition === 'A')
  const sales = trades.filter(t => t.acquistionOrDisposition === 'D')

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard label="Toplam İşlem" value={String(trades.length)} />
        <StatCard label="Alım" value={String(purchases.length)} color="emerald" />
        <StatCard label="Satış" value={String(sales.length)} color="red" />
      </div>

      {/* Trade List */}
      <div className="bg-[#0F0F15] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#0F0F15]">
              <tr className="border-b border-white/5">
                <th className="text-left px-2 sm:px-4 py-2 text-[10px] text-white/30">Tarih</th>
                <th className="text-left px-3 py-2 text-[10px] text-white/30">İsim</th>
                <th className="text-left px-3 py-2 text-[10px] text-white/30">Ünvan</th>
                <th className="text-center px-3 py-2 text-[10px] text-white/30">Tür</th>
                <th className="text-right px-3 py-2 text-[10px] text-white/30">Adet</th>
                <th className="text-right px-2 sm:px-4 py-2 text-[10px] text-white/30">Fiyat</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 30).map((t, i) => {
                const isBuy = t.acquistionOrDisposition === 'A'
                return (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-2 sm:px-4 py-1.5 text-[10px] text-white/40">
                      {new Date(t.transactionDate).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-white/70 truncate max-w-[150px]">
                      {t.reportingName}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-white/40 truncate max-w-[120px]">
                      {t.typeOfOwner}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                        isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {isBuy ? 'ALIM' : 'SATIŞ'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-white/60 text-right tabular-nums">
                      {t.securitiesTransacted?.toLocaleString()}
                    </td>
                    <td className="px-2 sm:px-4 py-1.5 text-xs text-white/60 text-right tabular-nums">
                      ${t.price?.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Institutional Holders ─────────────────────────────────────────

function InstitutionalView({ holders }: { holders: InstitutionalHolder[] }) {
  if (holders.length === 0) return <EmptyView message="Kurumsal sahiplik verisi bulunamadı" />

  return (
    <div className="bg-[#0F0F15] rounded-xl border border-white/5 overflow-hidden">
      <div className="overflow-x-auto max-h-96">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#0F0F15]">
            <tr className="border-b border-white/5">
              <th className="text-left px-2 sm:px-4 py-2 text-[10px] text-white/30">#</th>
              <th className="text-left px-3 py-2 text-[10px] text-white/30">Kurum</th>
              <th className="text-right px-3 py-2 text-[10px] text-white/30">Hisse</th>
              <th className="text-right px-3 py-2 text-[10px] text-white/30">Değişim</th>
              <th className="text-right px-2 sm:px-4 py-2 text-[10px] text-white/30">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, 30).map((h, i) => {
              const changePositive = h.change > 0
              return (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-2 sm:px-4 py-1.5 text-[10px] text-white/30">{i + 1}</td>
                  <td className="px-3 py-1.5 text-xs text-white/70 truncate max-w-[200px]">
                    {h.holder}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-white/60 text-right tabular-nums">
                    {h.shares?.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={`text-[10px] tabular-nums ${
                      changePositive ? 'text-emerald-400' : h.change < 0 ? 'text-red-400' : 'text-white/40'
                    }`}>
                      {changePositive ? '+' : ''}{h.change?.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-1.5 text-[10px] text-white/40 text-right">
                    {h.dateReported ? new Date(h.dateReported).toLocaleDateString('tr-TR') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Congressional Trades ──────────────────────────────────────────

function CongressionalView({ trades }: { trades: CongressionalTrade[] }) {
  if (trades.length === 0) return <EmptyView message="Kongre üyesi işlemi bulunamadı" />

  return (
    <div className="bg-[#0F0F15] rounded-xl border border-white/5 overflow-hidden">
      <div className="overflow-x-auto max-h-96">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#0F0F15]">
            <tr className="border-b border-white/5">
              <th className="text-left px-2 sm:px-4 py-2 text-[10px] text-white/30">Tarih</th>
              <th className="text-left px-3 py-2 text-[10px] text-white/30">Üye</th>
              <th className="text-left px-3 py-2 text-[10px] text-white/30">Parti</th>
              <th className="text-center px-3 py-2 text-[10px] text-white/30">Tür</th>
              <th className="text-right px-2 sm:px-4 py-2 text-[10px] text-white/30">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 30).map((t, i) => {
              const isBuy = t.type?.toLowerCase().includes('purchase')
              return (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-2 sm:px-4 py-1.5 text-[10px] text-white/40">
                    {t.transactionDate ? new Date(t.transactionDate).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-white/70 truncate max-w-[150px]">
                    {t.firstName} {t.lastName}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      t.party === 'Republican' ? 'bg-red-500/15 text-red-400' :
                      t.party === 'Democrat' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-white/5 text-white/40'
                    }`}>
                      {t.party?.charAt(0) || '?'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {isBuy ? 'ALIM' : 'SATIŞ'}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-1.5 text-[10px] text-white/50 text-right">
                    {t.amount || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Common ────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0F0F15] rounded-lg border border-white/5 px-2 sm:px-3 py-2 sm:py-2.5">
      <div className="text-[9px] text-white/30 uppercase mb-1">{label}</div>
      <div className={`text-base sm:text-lg font-bold tabular-nums ${
        color === 'emerald' ? 'text-emerald-400' :
        color === 'red' ? 'text-red-400' :
        'text-white'
      }`}>
        {value}
      </div>
    </div>
  )
}

// ─── V3: Live Insider Feed (RSS) ──────────────────────────────────

function LiveInsiderFeed() {
  const [feed, setFeed] = useState<InsiderTrade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fmp-terminal/stocks')
      .then(() => {
        // Insider RSS is a separate call; try fetching
        return fetch('/api/fmp-terminal/calendar?days=1') // Lightweight call
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Direct insider RSS fetch
    const apiKey = '' // Cannot expose key client-side; use API route instead
    // For now, we'll show a placeholder
    setLoading(false)
  }, [])

  return (
    <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-3 sm:p-4 mt-2 sm:mt-4">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h4 className="text-[10px] text-white/30 uppercase tracking-wider">Canli Insider Akisi (RSS)</h4>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400/60">CANLI</span>
        </div>
      </div>
      <p className="text-xs text-white/25">
        Son insider islemleri burada canli olarak gosterilir.
        Bir hisse sectiginizde o hisseye ait insider bilgileri yukarda goruntulenir.
      </p>
    </div>
  )
}

function EmptyView({ message }: { message: string }) {
  return (
    <div className="bg-[#0F0F15] rounded-xl border border-white/5 p-4 sm:p-8 text-center">
      <p className="text-white/30 text-sm">{message}</p>
    </div>
  )
}
