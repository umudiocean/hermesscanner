'use client'

import { useState, useEffect } from 'react'
import { Target, AlertTriangle } from 'lucide-react'

export default function TabAnalyst({ symbol }: { symbol: string }) {
  if (!symbol) return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center">
      <Target size={32} className="text-blue-400/30 mb-3" />
      <p className="text-white/40 text-sm">Analist tahminlerini gormek icin hisse secin</p>
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Target size={16} className="text-blue-400" />
        <span className="text-sm font-bold text-white">{symbol}</span>
        <span className="text-xs text-white/40">Analist Tahminleri ve Fiyat Hedefleri</span>
      </div>

      <div className="bg-[#151520] rounded-2xl border border-white/[0.06] p-6 min-h-[30vh]">
        <p className="text-white/40 text-sm text-center">
          <b className="text-white/70">{symbol}</b> icin analist konsensus ve fiyat hedefleri
        </p>
        <p className="text-white/25 text-xs text-center mt-2">
          Veri FMP analist tahmin ve fiyat hedefi endpoint'lerinden yukleniyor
        </p>
      </div>
    </div>
  )
}
