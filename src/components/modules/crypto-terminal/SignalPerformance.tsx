// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Signal Performance Dashboard (K7)
// Shows tracked signal hit rates, PnL, and performance stats
// ═══════════════════════════════════════════════════════════════════
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Trash2, TrendingUp, TrendingDown, Clock, Target, X, RefreshCw } from 'lucide-react'
import {
  loadTrackedSignals,
  getSignalStats,
  clearSignalHistory,
  type TrackedSignal,
  type SignalStats
} from '@/lib/crypto-terminal/signalTracker'

interface SignalPerformanceProps {
  isOpen: boolean
  onClose: () => void
}

export default function SignalPerformance({ isOpen, onClose }: SignalPerformanceProps) {
  const [signals, setSignals] = useState<TrackedSignal[]>([])
  const [stats, setStats] = useState<SignalStats | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'TP_HIT' | 'SL_HIT' | 'EXPIRED'>('ALL')

  const refresh = useCallback(async () => {
    const all = loadTrackedSignals()
    
    // Update active signals with current prices
    const activeSignals = all.filter(s => s.status === 'ACTIVE')
    if (activeSignals.length > 0) {
      try {
        const uniqueCoinIds = [...new Set(activeSignals.map(s => s.coinId))]
        const idsParam = uniqueCoinIds.join(',')
        const res = await fetch(`/api/crypto-terminal/watchlist?ids=${encodeURIComponent(idsParam)}`)
        if (res.ok) {
          const data = await res.json()
          const priceMap = new Map<string, number>()
          for (const coin of (data.coins || [])) {
            priceMap.set(coin.id, coin.current_price)
          }
          // Update each active signal
          for (const sig of activeSignals) {
            const currentPrice = priceMap.get(sig.coinId)
            if (currentPrice && currentPrice > 0) {
              const { updateSignalStatus } = await import('@/lib/crypto-terminal/signalTracker')
              updateSignalStatus(sig.id, currentPrice)
            }
          }
        }
      } catch { /* silent — still show cached data */ }
    }

    // Reload after updates
    const updated = loadTrackedSignals()
    setSignals(updated.sort((a, b) => b.timestamp - a.timestamp))
    setStats(getSignalStats())
  }, [])

  useEffect(() => {
    if (isOpen) refresh()
  }, [isOpen, refresh])

  if (!isOpen) return null

  const filtered = filter === 'ALL' ? signals : signals.filter(s => s.status === filter)

  const handleClear = () => {
    if (confirm('Tum sinyal gecmisi silinecek. Emin misiniz?')) {
      clearSignalHistory()
      refresh()
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-blue-400'
      case 'TP_HIT': return 'text-emerald-400'
      case 'SL_HIT': return 'text-red-400'
      case 'EXPIRED': return 'text-white/40'
      default: return 'text-white/50'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'AKTIF'
      case 'TP_HIT': return 'TP'
      case 'SL_HIT': return 'SL'
      case 'EXPIRED': return 'SURESI DOLDU'
      default: return status
    }
  }

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 24) return `${Math.floor(h / 24)}g once`
    if (h > 0) return `${h}s ${m}dk once`
    return `${m}dk once`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-[#151520] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-amber-400" />
            <span className="text-white font-semibold text-sm">SINYAL PERFORMANS TAKIBI</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="p-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white hover:shadow-sm hover:shadow-white/5 transition-all duration-200">
              <RefreshCw size={14} />
            </button>
            <button onClick={handleClear} className="p-1.5 rounded-xl hover:bg-red-500/20 text-white/50 hover:text-red-400 hover:shadow-sm hover:shadow-red-500/10 transition-all duration-200">
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white hover:shadow-sm hover:shadow-white/5 transition-all duration-200">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 border-b border-white/5">
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Toplam</div>
              <div className="text-lg font-bold text-white">{stats.total}</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Win Rate</div>
              <div className={`text-lg font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Ort PnL</div>
              <div className={`text-lg font-bold ${stats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(2)}%
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Aktif</div>
              <div className="text-lg font-bold text-blue-400">{stats.active}</div>
            </div>
          </div>
        )}

        {/* Hit Rate Breakdown */}
        {stats && stats.total > 0 && (
          <div className="flex items-center gap-1 px-4 pt-3">
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden flex">
              {stats.tpHit > 0 && (
                <div className="h-full bg-emerald-500" style={{ width: `${(stats.tpHit / stats.total) * 100}%` }} />
              )}
              {stats.active > 0 && (
                <div className="h-full bg-blue-500" style={{ width: `${(stats.active / stats.total) * 100}%` }} />
              )}
              {stats.slHit > 0 && (
                <div className="h-full bg-red-500" style={{ width: `${(stats.slHit / stats.total) * 100}%` }} />
              )}
              {stats.expired > 0 && (
                <div className="h-full bg-white/20" style={{ width: `${(stats.expired / stats.total) * 100}%` }} />
              )}
            </div>
            <div className="flex items-center gap-3 ml-3 text-[10px]">
              <span className="text-emerald-400">TP {stats.tpHit}</span>
              <span className="text-blue-400">Aktif {stats.active}</span>
              <span className="text-red-400">SL {stats.slHit}</span>
              <span className="text-white/30">Expired {stats.expired}</span>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-1 px-4 py-3">
          {(['ALL', 'ACTIVE', 'TP_HIT', 'SL_HIT', 'EXPIRED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[10px] rounded-lg transition-colors ${
                filter === f
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-white/[0.04] text-white/40 border border-white/5 hover:text-white/70'
              }`}
            >
              {f === 'ALL' ? 'TUMU' : statusLabel(f)}
            </button>
          ))}
        </div>

        {/* Signal List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm">
              <Activity size={24} className="mb-2 opacity-50" />
              <p>Henuz takip edilen sinyal yok</p>
              <p className="text-[10px] mt-1">Trade AI veya AI Signals modulunde sinyal takip edebilirsiniz</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors">
                  {/* Direction Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    s.signal.includes('LONG') || s.signal.includes('BUY') ? 'bg-emerald-500/20' : 'bg-red-500/20'
                  }`}>
                    {s.signal.includes('LONG') || s.signal.includes('BUY')
                      ? <TrendingUp size={12} className="text-emerald-400" />
                      : <TrendingDown size={12} className="text-red-400" />
                    }
                  </div>

                  {/* Coin + Signal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-medium">{s.symbol.toUpperCase()}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium truncate">
                        {s.signal}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/30 mt-0.5">
                      <Clock size={9} />
                      <span>{timeAgo(s.timestamp)}</span>
                      <span>Giris: ${s.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                    </div>
                  </div>

                  {/* TP / SL targets */}
                  <div className="text-right text-[10px] hidden sm:block">
                    <div className="flex items-center gap-1 text-emerald-400/70">
                      <Target size={9} />
                      TP: ${s.tpPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </div>
                    <div className="flex items-center gap-1 text-red-400/70">
                      <Target size={9} />
                      SL: ${s.slPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </div>
                  </div>

                  {/* Status + PnL */}
                  <div className="text-right min-w-[60px]">
                    <div className={`text-[10px] font-medium ${statusColor(s.status)}`}>
                      {statusLabel(s.status)}
                    </div>
                    {s.pnlPercent != null && (
                      <div className={`text-xs font-bold ${s.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.pnlPercent >= 0 ? '+' : ''}{s.pnlPercent.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Best/Worst Signal */}
        {stats && stats.bestSignal !== '-' && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[10px] text-white/30">
            <span>En Iyi Sinyal: <span className="text-emerald-400">{stats.bestSignal}</span></span>
            <span>En Kotu Sinyal: <span className="text-red-400">{stats.worstSignal}</span></span>
          </div>
        )}
      </div>
    </div>
  )
}
