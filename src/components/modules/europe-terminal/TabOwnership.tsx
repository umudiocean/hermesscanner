'use client'

import { useState, useEffect } from 'react'
import { Users, AlertTriangle } from 'lucide-react'

export default function TabOwnership({ symbol }: { symbol: string }) {
  const [loading, setLoading] = useState(false)

  if (!symbol) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center">
      <Users size={32} className="text-blue-400/30 mb-3" />
      <p className="text-white/40 text-sm">Sahiplik verisini gormek icin hisse secin</p>
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-blue-400" />
        <span className="text-sm font-bold text-white">{symbol}</span>
        <span className="text-xs text-white/40">Sahiplik ve Iceriden Islemler</span>
      </div>

      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-6 min-h-[30vh]">
        <p className="text-white/40 text-sm text-center">
          <b className="text-white/70">{symbol}</b> icin kurumsal ve iceriden sahiplik
        </p>
        <p className="text-white/25 text-xs text-center mt-2">
          Veri FMP insider-trading ve kurumsal endpoint'lerden yukleniyor
        </p>
      </div>
    </div>
  )
}
