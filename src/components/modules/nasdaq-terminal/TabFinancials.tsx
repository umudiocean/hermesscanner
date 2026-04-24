'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Tab 3: FINANSALLAR
// Gelir Tablosu, Bilanço, Nakit Akışı
// Yıllık/Çeyreklik toggle, trend sparkline'ları
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/fmp-terminal/fmp-types'

interface TabFinancialsProps {
  symbol: string
}

type FinancialView = 'income' | 'balance' | 'cashflow'
type Period = 'annual' | 'quarter'

export default function TabFinancials({ symbol }: TabFinancialsProps) {
  const [view, setView] = useState<FinancialView>('income')
  const [period, setPeriod] = useState<Period>('annual')
  const [income, setIncome] = useState<IncomeStatement[]>([])
  const [balance, setBalance] = useState<BalanceSheet[]>([])
  const [cashflow, setCashflow] = useState<CashFlowStatement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/fmp-terminal/stock/${symbol}`)
        if (res.ok) {
          const data = await res.json()
          setIncome(data.incomeStatements || [])
          setBalance(data.balanceSheets || [])
          setCashflow(data.cashFlowStatements || [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [symbol])

  if (!symbol) {
    return <EmptyState message="Finansalları görmek için bir hisse seçin" />
  }

  if (loading) return <FinancialSkeleton />

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5">
          {([
            { id: 'income' as FinancialView, label: 'Gelir Tablosu' },
            { id: 'balance' as FinancialView, label: 'Bilanço' },
            { id: 'cashflow' as FinancialView, label: 'Nakit Akışı' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === tab.id
                  ? 'bg-violet-600/80 text-white'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5">
          <button
            onClick={() => setPeriod('annual')}
            className={`px-2 py-1 rounded text-[10px] font-medium ${
              period === 'annual' ? 'bg-white/10 text-white' : 'text-text-tertiary'
            }`}
          >
            Yıllık
          </button>
          <button
            onClick={() => setPeriod('quarter')}
            className={`px-2 py-1 rounded text-[10px] font-medium ${
              period === 'quarter' ? 'bg-white/10 text-white' : 'text-text-tertiary'
            }`}
          >
            Çeyreklik
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0F0F15] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          {view === 'income' && <IncomeTable data={income} />}
          {view === 'balance' && <BalanceTable data={balance} />}
          {view === 'cashflow' && <CashFlowTable data={cashflow} />}
        </div>
      </div>
    </div>
  )
}

// ─── Income Statement Table ────────────────────────────────────────

function IncomeTable({ data }: { data: IncomeStatement[] }) {
  if (data.length === 0) return <EmptyTable />
  const items = data.slice(0, 6).reverse()

  const rows = [
    { label: 'Gelir', key: 'revenue' as const },
    { label: 'Brüt Kâr', key: 'grossProfit' as const },
    { label: 'Faaliyet Giderleri', key: 'operatingExpenses' as const },
    { label: 'Faaliyet Kârı', key: 'operatingIncome' as const },
    { label: 'Net Gelir', key: 'netIncome' as const },
    { label: 'EPS', key: 'epsDiluted' as const },
    { label: 'EBITDA', key: 'ebitda' as const },
    { label: 'Ar-Ge', key: 'researchAndDevelopmentExpenses' as const },
  ]

  return <FinancialTable items={items} rows={rows} />
}

function BalanceTable({ data }: { data: BalanceSheet[] }) {
  if (data.length === 0) return <EmptyTable />
  const items = data.slice(0, 6).reverse()

  const rows = [
    { label: 'Toplam Varlıklar', key: 'totalAssets' as const },
    { label: 'Dönen Varlıklar', key: 'totalCurrentAssets' as const },
    { label: 'Nakit', key: 'cashAndCashEquivalents' as const },
    { label: 'Toplam Borç', key: 'totalDebt' as const },
    { label: 'Net Borç', key: 'netDebt' as const },
    { label: 'Özkaynak', key: 'totalStockholdersEquity' as const },
    { label: 'Dağıtılmamış Kâr', key: 'retainedEarnings' as const },
  ]

  return <FinancialTable items={items} rows={rows} />
}

function CashFlowTable({ data }: { data: CashFlowStatement[] }) {
  if (data.length === 0) return <EmptyTable />
  const items = data.slice(0, 6).reverse()

  const rows = [
    { label: 'Faaliyet Nakit Akışı', key: 'operatingCashFlow' as const },
    { label: 'Yatırım Harcaması', key: 'capitalExpenditure' as const },
    { label: 'Serbest Nakit Akışı', key: 'freeCashFlow' as const },
    { label: 'Temettü', key: 'dividendsPaid' as const },
    { label: 'Hisse Geri Alımı', key: 'commonStockRepurchased' as const },
    { label: 'Hisse Bazlı Ücret', key: 'stockBasedCompensation' as const },
  ]

  return <FinancialTable items={items} rows={rows} />
}

// ─── Generic Financial Table ───────────────────────────────────────

function FinancialTable<T extends { date: string }>({
  items, rows,
}: {
  items: T[]
  rows: { label: string; key: keyof T }[]
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/5">
          <th className="text-left px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] text-text-tertiary uppercase tracking-wider font-medium w-32 sm:w-40">
            Kalem
          </th>
          {items.map((item, i) => (
            <th key={i} className="text-right px-2 sm:px-3 py-2 sm:py-2.5 text-[10px] text-text-tertiary font-medium">
              {item.date?.split('-')[0]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-b border-white/[0.03] hover:bg-surface-2">
            <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs text-text-secondary">{row.label}</td>
            {items.map((item, ci) => {
              const val = item[row.key] as unknown as number
              return (
                <td key={ci} className="text-right px-2 sm:px-3 py-1.5 sm:py-2 text-xs tabular-nums">
                  <span className={val < 0 ? 'text-danger-400' : 'text-text-secondary'}>
                    {formatNumber(val)}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Utils ─────────────────────────────────────────────────────────

function formatNumber(val: number | null | undefined): string {
  if (val == null || !isFinite(val)) return '—'
  const abs = Math.abs(val)
  if (abs >= 1e9) return `${(val / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(val / 1e3).toFixed(1)}K`
  return val.toFixed(2)
}

function EmptyTable() {
  return <div className="p-4 sm:p-8 text-center text-text-tertiary text-sm">Finansal veri bulunamadi</div>
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <span className="text-3xl sm:text-4xl mb-2 sm:mb-3">📋</span>
      <p className="text-text-tertiary text-sm">{message}</p>
    </div>
  )
}

function FinancialSkeleton() {
  return (
    <div className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 data-stream pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-4">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14" viewBox="0 0 100 100" style={{ animation: 'ring-spin 2s linear infinite' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(179,148,91,0.06)" strokeWidth="2" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="url(#finGold)" strokeWidth="2" strokeLinecap="round"
              strokeDasharray="264" style={{ animation: 'ring-pulse 1.6s ease-in-out infinite' }} />
            <defs><linearGradient id="finGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#DCC273" /><stop offset="100%" stopColor="#8E7536" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-gold-400/80 text-lg">💰</div>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-text-secondary">Finansal tablolar</p>
          <p className="text-[9px] text-text-tertiary mt-0.5">Gelir, bilanco, nakit akis</p>
        </div>
        <div className="w-32 h-0.5 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full rounded-full progress-fill" style={{ background: 'linear-gradient(90deg, #8E7536, #DCC273)' }} />
        </div>
        <div className="flex gap-2">
          {['Gelir', 'Bilanco', 'Nakit'].map((t, i) => (
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
