'use client'

import { useState, useEffect } from 'react'
import { PieChart, AlertTriangle } from 'lucide-react'

export default function TabFinancials({ symbol }: { symbol: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<'income' | 'balance' | 'cashflow'>('income')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetch(`/api/europe-terminal/stock/${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [symbol])

  if (!symbol) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center">
      <PieChart size={32} className="text-blue-400/30 mb-3" />
      <p className="text-white/40 text-sm">Finansallari gormek icin hisse secin</p>
    </div>
  )

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <PieChart size={16} className="text-blue-400" />
        <span className="text-sm font-bold text-white">{symbol}</span>
        <span className="text-xs text-white/40">Finansal Tablolar</span>
      </div>

      <div className="flex items-center gap-1.5">
        {(['income', 'balance', 'cashflow'] as const).map(v => (
          <button key={v} onClick={() => setActiveView(v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
              activeView === v ? 'text-blue-300 bg-blue-500/15 border-blue-500/25' : 'text-white/40 bg-white/[0.02] border-white/[0.05] hover:border-white/10'
            }`}>{v === 'income' ? 'Gelir Tablosu' : v === 'balance' ? 'Bilanco' : 'Nakit Akis'}</button>
        ))}
      </div>

      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-6 min-h-[30vh]">
        <p className="text-white/40 text-sm text-center">
          <b className="text-white/70">{symbol}</b> icin finansal veri — {activeView === 'income' ? 'Gelir Tablosu' : activeView === 'balance' ? 'Bilanco' : 'Nakit Akis Tablosu'}
        </p>
        <p className="text-white/25 text-xs text-center mt-2">
          Veri FMP Stable API uzerinden canli yukleniyor
        </p>
      </div>
    </div>
  )
}
