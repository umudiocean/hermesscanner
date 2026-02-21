'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, LogOut, RefreshCw, Users, Eye, Globe, Smartphone,
  Server, Database, Activity, ToggleLeft, ToggleRight, Trash2,
  TrendingUp, Zap, Cpu,
} from 'lucide-react'

interface AnalyticsData {
  analytics: {
    pageViews: { date: string; count: number }[]
    uniqueVisitors: { date: string; count: number }[]
    topPages: { path: string; count: number }[]
    referrers: { source: string; count: number }[]
    devices: { type: string; count: number }[]
    apiCalls: { endpoint: string; count: number }[]
    externalApis: { provider: string; count: number }[]
    totals: { pv: number; uv: number; api: number }
  }
  cache: {
    redis: { available: boolean; connected: boolean; keyCount: number; prefixes: Record<string, number> }
    fmpMemory: { memoryEntries: number; maxEntries: number; oldestEntry: number | null }
    cryptoMemory: { memoryEntries: number; maxEntries: number; oldestEntry: number | null }
  }
  system: Record<string, unknown>
  generatedAt: string
}

interface FlagMap { [key: string]: boolean }

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-[#151520] rounded-2xl border border-white/8 p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-[#B3945B]" />
        <h3 className="text-xs uppercase tracking-wider text-white/50 font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-white/90 tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>}
    </div>
  )
}

function MiniBar({ items, max }: { items: { label: string; value: number }[]; max: number }) {
  return (
    <div className="space-y-1.5">
      {items.slice(0, 8).map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 w-24 truncate">{item.label}</span>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#B3945B] to-[#8B7340] rounded-full transition-all duration-500"
              style={{ width: `${max > 0 ? Math.max(2, (item.value / max) * 100) : 0}%` }}
            />
          </div>
          <span className="text-[10px] text-white/60 tabular-nums w-10 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

interface BootstrapState {
  running: boolean
  completed: number
  total: number
  lastSymbol: string
  status: string
  barCacheCount: number
  error: string | null
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [flags, setFlags] = useState<FlagMap>({})
  const [loading, setLoading] = useState(true)
  const [flagLoading, setFlagLoading] = useState<string | null>(null)
  const [bootstrap, setBootstrap] = useState<BootstrapState>({
    running: false, completed: 0, total: 0, lastSymbol: '', status: 'unknown', barCacheCount: 0, error: null,
  })
  const router = useRouter()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, flagsRes] = await Promise.all([
        fetch('/api/admin/stats?days=7'),
        fetch('/api/admin/flags'),
      ])
      if (statsRes.ok) setData(await statsRes.json())
      if (flagsRes.ok) setFlags(await flagsRes.json())
    } catch {
      // retry later
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  async function toggleFlag(key: string) {
    setFlagLoading(key)
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: !flags[key] }),
      })
      if (res.ok) {
        setFlags(prev => ({ ...prev, [key]: !prev[key] }))
      }
    } catch {
      // silent
    } finally {
      setFlagLoading(null)
    }
  }

  async function clearCache(type: 'fmp' | 'crypto' | 'all') {
    try {
      await fetch('/api/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'admin',
        },
        body: JSON.stringify({ type }),
      })
      fetchData()
    } catch {
      // silent
    }
  }

  const fetchBootstrapStatus = useCallback(async () => {
    try {
      const cronSecret = 'hermes-scanner-cron-2026'
      const res = await fetch('/api/cron/bootstrap', {
        headers: { 'Authorization': `Bearer ${cronSecret}` },
      })
      if (res.ok) {
        const d = await res.json()
        setBootstrap(prev => ({
          ...prev,
          completed: d.progress?.completed || 0,
          total: d.progress?.total || 0,
          lastSymbol: d.progress?.lastSymbol || '',
          status: d.progress?.status || 'not_started',
          barCacheCount: d.barCacheCount || 0,
          error: null,
        }))
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => { fetchBootstrapStatus() }, [fetchBootstrapStatus])

  // Poll bootstrap progress while running
  useEffect(() => {
    if (!bootstrap.running) return
    const interval = setInterval(fetchBootstrapStatus, 5000)
    return () => clearInterval(interval)
  }, [bootstrap.running, fetchBootstrapStatus])

  // Auto-stop polling when bootstrap completes
  useEffect(() => {
    if (bootstrap.running && (bootstrap.status === 'complete' || (bootstrap.total > 0 && bootstrap.completed >= bootstrap.total))) {
      setBootstrap(prev => ({ ...prev, running: false }))
    }
  }, [bootstrap.running, bootstrap.status, bootstrap.completed, bootstrap.total])

  async function startBootstrap() {
    setBootstrap(prev => ({ ...prev, running: true, error: null }))
    try {
      const cronSecret = 'hermes-scanner-cron-2026'
      const res = await fetch('/api/cron/bootstrap', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cronSecret}` },
      })
      if (res.ok) {
        const d = await res.json()
        setBootstrap(prev => ({
          ...prev,
          completed: d.completed || prev.completed,
          total: d.total || prev.total,
          status: d.status || 'running',
        }))
        // If partial, keep calling until complete
        if (d.status === 'partial' && d.remaining > 0) {
          // Auto-continue: call again after a short delay
          setTimeout(() => startBootstrap(), 2000)
        } else {
          setBootstrap(prev => ({ ...prev, running: false }))
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setBootstrap(prev => ({ ...prev, running: false, error: err.error || 'Bootstrap failed' }))
      }
    } catch (err) {
      setBootstrap(prev => ({ ...prev, running: false, error: (err as Error).message }))
    }
  }

  const a = data?.analytics
  const c = data?.cache
  const todayPV = a?.pageViews?.[0]?.count || 0
  const todayUV = a?.uniqueVisitors?.[0]?.count || 0
  const yesterdayPV = a?.pageViews?.[1]?.count || 0
  const weekPV = a?.pageViews?.reduce((s, d) => s + d.count, 0) || 0
  const totalDevices = a?.devices?.reduce((s, d) => s + d.count, 0) || 1

  const FLAG_LABELS: Record<string, string> = {
    'excel-download': 'CSV / Excel Indirme',
    'crypto-terminal': 'Crypto Terminal',
    'ai-signals': 'AI Signals Modulu',
    'share-panel': 'Sosyal Medya Paylasma',
    'manifesto-splash': 'Acilis Manifesto Ekrani',
  }

  return (
    <div className="min-h-screen bg-[#0c0c14] p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B3945B]/20 to-[#B3945B]/5 border border-[#B3945B]/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#B3945B]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white/90">HERMES AI Admin</h1>
            <p className="text-[10px] text-white/30">
              {data?.generatedAt ? new Date(data.generatedAt).toLocaleString('tr-TR') : '...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cikis
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#B3945B]/30 border-t-[#B3945B] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* 1. Visitor Summary */}
          <Card title="Ziyaretci Ozeti" icon={Users}>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Stat label="Bugun" value={todayPV} sub={`${todayUV} tekil`} />
              <Stat label="Dun" value={yesterdayPV} />
              <Stat label="7 Gun" value={weekPV} />
            </div>
            <div className="space-y-1">
              {a?.pageViews?.slice(0, 7).map(d => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="text-[9px] text-white/30 w-16">{d.date.slice(5)}</span>
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B3945B]/60 rounded-full"
                      style={{ width: `${weekPV > 0 ? Math.max(2, (d.count / Math.max(...(a?.pageViews?.map(x => x.count) || [1]))) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-white/40 tabular-nums w-8 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 2. Top Pages */}
          <Card title="Sayfa Bazli Trafik" icon={Eye}>
            {(a?.topPages?.length || 0) > 0 ? (
              <MiniBar
                items={a!.topPages.map(p => ({ label: p.path, value: p.count }))}
                max={a!.topPages[0]?.count || 1}
              />
            ) : (
              <p className="text-white/20 text-xs">Henuz veri yok</p>
            )}
          </Card>

          {/* 3. Referrer Sources */}
          <Card title="Kaynak Analizi" icon={Globe}>
            {(a?.referrers?.length || 0) > 0 ? (
              <MiniBar
                items={a!.referrers.map(r => ({ label: r.source, value: r.count }))}
                max={a!.referrers[0]?.count || 1}
              />
            ) : (
              <p className="text-white/20 text-xs">Henuz veri yok</p>
            )}
          </Card>

          {/* 4. Device Distribution */}
          <Card title="Cihaz Dagilimi" icon={Smartphone}>
            <div className="space-y-3">
              {(a?.devices || []).map(d => {
                const pct = totalDevices > 0 ? ((d.count / totalDevices) * 100).toFixed(1) : '0'
                const colors: Record<string, string> = {
                  desktop: 'from-blue-500 to-blue-600',
                  mobile: 'from-emerald-500 to-emerald-600',
                  tablet: 'from-amber-500 to-amber-600',
                }
                return (
                  <div key={d.type}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-white/60 capitalize">{d.type}</span>
                      <span className="text-xs text-white/40">{pct}% ({d.count})</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${colors[d.type] || 'from-violet-500 to-violet-600'} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {(a?.devices?.length || 0) === 0 && (
                <p className="text-white/20 text-xs">Henuz veri yok</p>
              )}
            </div>
          </Card>

          {/* 5. API Usage */}
          <Card title="API Kullanim" icon={Zap}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Stat label="Bugun API" value={a?.totals?.api || 0} />
              <div>
                {(a?.externalApis || []).map(e => (
                  <div key={e.provider} className="flex justify-between">
                    <span className="text-[10px] text-white/40 uppercase">{e.provider}</span>
                    <span className="text-[10px] text-white/60 tabular-nums">{e.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {(a?.apiCalls?.length || 0) > 0 ? (
              <MiniBar
                items={a!.apiCalls.slice(0, 6).map(c => ({ label: c.endpoint, value: c.count }))}
                max={a!.apiCalls[0]?.count || 1}
              />
            ) : (
              <p className="text-white/20 text-xs">Henuz veri yok</p>
            )}
          </Card>

          {/* 6. System Health */}
          <Card title="Sistem Sagligi" icon={Activity}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${c?.redis?.connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-xs text-white/60">Redis: {c?.redis?.connected ? 'Bagli' : 'Bagli Degil'}</span>
                {c?.redis?.keyCount !== undefined && (
                  <span className="text-[10px] text-white/30 ml-auto">{c.redis.keyCount} key</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-white/30" />
                <span className="text-xs text-white/60">FMP Memory Cache</span>
                <span className="text-[10px] text-white/30 ml-auto">{c?.fmpMemory?.memoryEntries || 0}/{c?.fmpMemory?.maxEntries || 500}</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-white/30" />
                <span className="text-xs text-white/60">Crypto Memory Cache</span>
                <span className="text-[10px] text-white/30 ml-auto">{c?.cryptoMemory?.memoryEntries || 0}/{c?.cryptoMemory?.maxEntries || 1000}</span>
              </div>
              {c?.redis?.prefixes && Object.keys(c.redis.prefixes).length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <span className="text-[9px] text-white/25 uppercase">Redis Key Dagilimi</span>
                  {Object.entries(c.redis.prefixes).map(([p, n]) => (
                    <div key={p} className="flex justify-between mt-1">
                      <span className="text-[10px] text-white/30">{p}</span>
                      <span className="text-[10px] text-white/40 tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* 7. Feature Flags */}
          <Card title="Ozellik Kontrol" icon={Cpu}>
            <div className="space-y-3">
              {Object.entries(FLAG_LABELS).map(([key, label]) => {
                const enabled = flags[key] !== false
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-white/60">{label}</span>
                    <button
                      onClick={() => toggleFlag(key)}
                      disabled={flagLoading === key}
                      className="transition-all"
                    >
                      {enabled ? (
                        <ToggleRight className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-white/20" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* 8. Cache Management */}
          <Card title="Cache Yonetimi" icon={Server}>
            <div className="space-y-2">
              <button
                onClick={() => clearCache('fmp')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                FMP Cache Temizle
              </button>
              <button
                onClick={() => clearCache('crypto')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Crypto Cache Temizle
              </button>
              <button
                onClick={() => clearCache('all')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Tum Cache Temizle
              </button>
            </div>
          </Card>

          {/* 9. Quick Stats */}
          <Card title="Performans" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Redis Key"
                value={c?.redis?.keyCount || 0}
                sub={c?.redis?.connected ? 'Aktif' : 'Pasif'}
              />
              <Stat
                label="Memory Cache"
                value={(c?.fmpMemory?.memoryEntries || 0) + (c?.cryptoMemory?.memoryEntries || 0)}
                sub="FMP + Crypto"
              />
            </div>
          </Card>

          {/* 10. Bootstrap — Trade AI Data */}
          <Card title="Trade AI Bootstrap" icon={Database}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Redis Bar Cache" value={bootstrap.barCacheCount} sub="hisse" />
                <Stat label="Durum" value={
                  bootstrap.status === 'complete' ? 'Tamamlandi' :
                  bootstrap.status === 'running' ? 'Calisiyor...' :
                  bootstrap.status === 'partial' ? 'Kismi' : 'Baslamadi'
                } />
              </div>

              {bootstrap.total > 0 && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-white/40">Ilerleme</span>
                    <span className="text-[10px] text-white/50 tabular-nums">
                      {bootstrap.completed} / {bootstrap.total} ({bootstrap.total > 0 ? Math.round((bootstrap.completed / bootstrap.total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        bootstrap.status === 'complete'
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : 'bg-gradient-to-r from-[#B3945B] to-amber-400'
                      }`}
                      style={{ width: `${bootstrap.total > 0 ? Math.max(1, (bootstrap.completed / bootstrap.total) * 100) : 0}%` }}
                    />
                  </div>
                  {bootstrap.lastSymbol && (
                    <p className="text-[9px] text-white/25 mt-1">Son: {bootstrap.lastSymbol}</p>
                  )}
                </div>
              )}

              {bootstrap.error && (
                <p className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-2 py-1">{bootstrap.error}</p>
              )}

              <button
                onClick={startBootstrap}
                disabled={bootstrap.running}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  bootstrap.running
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 cursor-wait'
                    : bootstrap.status === 'complete'
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400'
                    : 'bg-gradient-to-r from-[#B3945B] to-amber-600 hover:from-[#C4A56C] hover:to-amber-500 text-black'
                }`}
              >
                {bootstrap.running ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Bootstrap Calisiyor...
                  </>
                ) : bootstrap.status === 'complete' ? (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    Yeniden Bootstrap (Tamamlandi)
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    Bootstrap Baslat
                  </>
                )}
              </button>

              <p className="text-[9px] text-white/20 leading-relaxed">
                Ilk calistirmada tum hisseler icin 3 yillik 15dk veri cekilir ve Redis&apos;e yazilir.
                Saatler surebilir. Sonraki cron&apos;lar sadece delta (son 2 gun) gunceller.
              </p>
            </div>
          </Card>

        </div>
      )}
    </div>
  )
}
