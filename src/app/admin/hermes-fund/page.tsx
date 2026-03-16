'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FUND_THEME, PLANS } from '@/types/hermesFund';

// ============================================================================
// HERMES AI FUND - ADMIN MODULE
// Plan bazlı görünüm + Nickname + Countdown
// ============================================================================

interface UserPosition {
  address: string;
  planId: number;
  planName: string;
  status: number;
  statusText: string;
  usdtPrincipal: string;
  hermesStaked: string;
  startTime: number;
  endTime: number;
  unlockTime: number;
  claimedUsdt: string;
  claimedHermes: string;
  claimableUsdt: string;
  claimableHermes: string;
  pendingUsdtClaim: string;
  pendingHermesClaim: string;
  pendingUsdtWithdraw: boolean;
  pendingHermesUnstake: boolean;
  isUnlocked: boolean;
  usdtPaid: boolean;
  hermesUnstaked: boolean;
}

interface FundStats {
  totalStakedUsdt: string;
  totalStakedHermes: string;
  totalClaimedUsdt: string;
  totalClaimedHermes: string;
  activeUserCount: number;
  totalUserCount: number;
  tvlCap: string;
  tvlPercent: number;
}

interface PlanGroup {
  planId: number;
  planName: string;
  duration: number;
  usdtYield: number;
  hermesYield: number;
  totalUsdt: number;
  totalHermes: number;
  userCount: number;
  users: UserPosition[];
}

// Admin auth helpers
function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hermes_admin_token');
}
function setAdminToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hermes_admin_token', token);
    document.cookie = `admin_session=${encodeURIComponent(JSON.stringify({ token }))};path=/;max-age=${7*24*3600}`;
  }
}
function clearAdminToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('hermes_admin_token');
    document.cookie = 'admin_session=;path=/;max-age=0';
  }
}

export default function FundAdminPage() {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data
  const [fundStats, setFundStats] = useState<FundStats | null>(null);
  const [allUsers, setAllUsers] = useState<UserPosition[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Nicknames
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');

  // Time
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'plan0' | 'plan1' | 'plan2' | 'urgent'>('overview');

  // Auth check
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      fetch('/api/admin/wallet-nicknames', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.success) { setIsAuthenticated(true); if (d.nicknames) setNicknames(d.nicknames); }
          else clearAdminToken();
        })
        .catch(() => clearAdminToken())
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Login
  const handleLogin = async () => {
    if (!loginPassword.trim()) { setLoginError('Şifre gerekli'); return; }
    try {
      const res = await fetch('/api/admin/wallet-nicknames', { headers: { Authorization: `Bearer ${loginPassword}` } });
      const d = await res.json();
      if (d.success) { setAdminToken(loginPassword); setIsAuthenticated(true); setLoginError(''); if (d.nicknames) setNicknames(d.nicknames); }
      else setLoginError('Geçersiz şifre');
    } catch { setLoginError('Bağlantı hatası'); }
  };

  // Nicknames
  const loadNicknames = useCallback(async () => {
    const token = getAdminToken(); if (!token) return;
    try {
      const r = await fetch('/api/admin/wallet-nicknames', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success && d.nicknames) setNicknames(d.nicknames);
    } catch {}
  }, []);

  const saveNickname = useCallback(async (address: string, nickname: string) => {
    const token = getAdminToken(); if (!token) return;
    try {
      const r = await fetch('/api/admin/wallet-nicknames', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address, nickname }),
      });
      const d = await r.json();
      if (d.success && d.nicknames) setNicknames(d.nicknames);
    } catch {}
    setEditingNickname(null); setNicknameInput('');
  }, []);

  const getNickname = useCallback((addr: string) => nicknames[addr.toLowerCase()] || null, [nicknames]);
  const startEditNickname = useCallback((addr: string) => {
    setEditingNickname(addr); setNicknameInput(nicknames[addr.toLowerCase()] || '');
  }, [nicknames]);

  // Load fund data from API
  const loadFundData = useCallback(async () => {
    const token = getAdminToken(); if (!token) return;
    try {
      setDataLoading(true); setDataError(null);
      const res = await fetch(`/api/admin/hermes-fund?ts=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) {
        setFundStats(json.stats);
        setAllUsers(json.allUsers || json.users || []);
        setLastUpdate(new Date());
      } else {
        setDataError(json.error || 'Veri yüklenemedi');
      }
    } catch (e: any) {
      setDataError(e.message || 'Bağlantı hatası');
    } finally { setDataLoading(false); }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadFundData(); loadNicknames();
      const interval = setInterval(loadFundData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loadFundData, loadNicknames]);

  // Plan groups
  const planGroups = useMemo((): PlanGroup[] => {
    const groups: PlanGroup[] = PLANS.map((plan, idx) => ({
      planId: idx, planName: plan.name, duration: plan.duration,
      usdtYield: plan.usdtYield, hermesYield: plan.hermesYield,
      totalUsdt: 0, totalHermes: 0, userCount: 0, users: [],
    }));
    allUsers.forEach(u => {
      const pid = u.planId;
      if (pid >= 0 && pid < groups.length) {
        groups[pid].totalUsdt += Number(u.usdtPrincipal) || 0;
        groups[pid].totalHermes += Number(u.hermesStaked) || 0;
        groups[pid].userCount++;
        groups[pid].users.push(u);
      }
    });
    return groups;
  }, [allUsers]);

  // Urgent users
  const urgentUsers = useMemo(() => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return allUsers.filter(u => {
      if (u.status === 4 || u.usdtPaid) return false;
      const t = u.endTime * 1000 - now;
      return t > 0 && t <= threeDaysMs;
    }).sort((a, b) => a.endTime - b.endTime);
  }, [allUsers, now]);

  // Countdown
  const formatCountdown = (endTimeMs: number) => {
    const diff = endTimeMs - now;
    if (diff <= 0) return { text: 'VADESİ DOLDU!', isUrgent: true, color: FUND_THEME.error };
    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const minutes = Math.floor((diff % (1000*60*60)) / (1000*60));
    const seconds = Math.floor((diff % (1000*60)) / 1000);
    if (days === 0 && hours < 24) return { text: `${hours}s ${minutes}d ${seconds}sn`, isUrgent: true, color: FUND_THEME.error };
    if (days <= 3) return { text: `${days}g ${hours}s ${minutes}d`, isUrgent: true, color: FUND_THEME.error };
    if (days <= 7) return { text: `${days}g ${hours}s`, isUrgent: false, color: FUND_THEME.warning };
    return { text: `${days} gün`, isUrgent: false, color: FUND_THEME.success };
  };

  // ═══════════════════ LOGIN ═══════════════════
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: FUND_THEME.background }}>
      <div className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full" style={{ borderColor: `${FUND_THEME.primary} transparent` }} />
    </div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: FUND_THEME.background }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl p-8" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.primary}30` }}>
          <div className="text-center mb-8">
            <motion.div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})` }}
              animate={{ boxShadow: [`0 0 20px ${FUND_THEME.primary}40`, `0 0 40px ${FUND_THEME.primary}60`, `0 0 20px ${FUND_THEME.primary}40`] }}
              transition={{ duration: 2, repeat: Infinity }}>🔐</motion.div>
            <h1 className="text-2xl font-bold" style={{ color: FUND_THEME.primary }}>Admin Girişi</h1>
            <p className="text-sm mt-2" style={{ color: FUND_THEME.textMuted }}>Hermes AI Fund Yönetim Paneli</p>
          </div>
          <div className="space-y-4">
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Admin Şifresi"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: FUND_THEME.background, color: FUND_THEME.text, border: `1px solid ${loginError ? FUND_THEME.error : FUND_THEME.primary}30` }} />
            {loginError && <div className="text-sm text-center" style={{ color: FUND_THEME.error }}>{loginError}</div>}
            <motion.button onClick={handleLogin} className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: FUND_THEME.primary, color: '#000' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              Giriş Yap
            </motion.button>
          </div>
          <div className="text-center mt-6"><Link href="/" className="text-sm" style={{ color: FUND_THEME.textMuted }}>← Ana Sayfaya Dön</Link></div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════ MAIN ADMIN PANEL ═══════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: FUND_THEME.background }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl" style={{ backgroundColor: `${FUND_THEME.background}95`, borderBottom: `1px solid ${FUND_THEME.primary}30` }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: FUND_THEME.surface, color: FUND_THEME.textMuted, border: `1px solid ${FUND_THEME.primary}20` }}>← Admin</Link>
              <div className="flex items-center gap-3">
                <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})` }}
                  animate={{ boxShadow: [`0 0 15px ${FUND_THEME.primary}40`, `0 0 30px ${FUND_THEME.primary}60`, `0 0 15px ${FUND_THEME.primary}40`] }}
                  transition={{ duration: 2, repeat: Infinity }}>💰</motion.div>
                <div>
                  <h1 className="text-xl font-bold" style={{ color: FUND_THEME.primary }}>Hermes AI Fund Admin</h1>
                  <p className="text-xs" style={{ color: FUND_THEME.textMuted }}>Plan bazlı kullanıcı yönetimi</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdate && <span className="text-xs" style={{ color: FUND_THEME.textMuted }}>Son: {lastUpdate.toLocaleTimeString('tr-TR')}</span>}
              {urgentUsers.length > 0 && (
                <motion.span className="px-3 py-1 rounded-full text-xs font-bold cursor-pointer" onClick={() => setActiveTab('urgent')}
                  style={{ backgroundColor: FUND_THEME.error, color: '#fff' }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                  ⚠️ {urgentUsers.length} ACİL
                </motion.span>
              )}
              <motion.button onClick={loadFundData} disabled={dataLoading} className="px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
                style={{ backgroundColor: FUND_THEME.primary, color: '#000' }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <motion.span animate={{ rotate: dataLoading ? 360 : 0 }} transition={{ duration: 1, repeat: dataLoading ? Infinity : 0, ease: 'linear' }}>🔄</motion.span>
                Yenile
              </motion.button>
              <button onClick={() => { clearAdminToken(); setIsAuthenticated(false); }} className="px-3 py-1.5 rounded-lg text-xs"
                style={{ backgroundColor: `${FUND_THEME.error}20`, color: FUND_THEME.error }}>Çıkış</button>
            </div>
          </div>

          {/* Plan Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="📊 Genel Bakış" />
            <TabBtn active={activeTab === 'plan0'} onClick={() => setActiveTab('plan0')} label={`📅 1 Aylık (${planGroups[0]?.userCount || 0})`} color={FUND_THEME.success} />
            <TabBtn active={activeTab === 'plan1'} onClick={() => setActiveTab('plan1')} label={`📅 3 Aylık (${planGroups[1]?.userCount || 0})`} color={FUND_THEME.warning} />
            <TabBtn active={activeTab === 'plan2'} onClick={() => setActiveTab('plan2')} label={`📅 6 Aylık (${planGroups[2]?.userCount || 0})`} color={FUND_THEME.primary} />
            {urgentUsers.length > 0 && <TabBtn active={activeTab === 'urgent'} onClick={() => setActiveTab('urgent')} label={`🚨 ACİL (${urgentUsers.length})`} color={FUND_THEME.error} pulse />}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {dataError && (
          <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: `${FUND_THEME.error}15`, border: `1px solid ${FUND_THEME.error}30` }}>
            <span style={{ color: FUND_THEME.error }}>Hata: {dataError}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* OVERVIEW */}
          {activeTab === 'overview' && fundStats && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Toplam TVL" value={`$${Number(fundStats.totalStakedUsdt).toLocaleString()}`} sub={`${fundStats.tvlPercent.toFixed(1)}% doluluk`} color={FUND_THEME.primary} icon="💰" />
                <StatCard title="Toplam HERMES" value={`${(Number(fundStats.totalStakedHermes)/1e9).toFixed(2)}B`} sub="Stake edilmiş" color={FUND_THEME.accent} icon="🔒" />
                <StatCard title="Aktif Kullanıcı" value={String(fundStats.activeUserCount)} sub={`Toplam: ${allUsers.length}`} color={FUND_THEME.success} icon="👥" />
                <StatCard title="Ödenen USDT" value={`$${Number(fundStats.totalClaimedUsdt).toFixed(2)}`} sub="Claim edilen" color={FUND_THEME.warning} icon="💵" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {planGroups.map((pg, idx) => {
                  const colors = [FUND_THEME.success, FUND_THEME.warning, FUND_THEME.primary];
                  const c = colors[idx] || FUND_THEME.accent;
                  return (
                    <motion.div key={idx} className="p-6 rounded-xl cursor-pointer relative" style={{ backgroundColor: FUND_THEME.surface, border: `2px solid ${c}50` }}
                      whileHover={{ scale: 1.02, y: -3 }} onClick={() => setActiveTab(`plan${idx}` as any)}>
                      {urgentUsers.filter(u => u.planId === idx).length > 0 && (
                        <motion.div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: FUND_THEME.error, color: '#fff' }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                          ⚠️ {urgentUsers.filter(u => u.planId === idx).length}
                        </motion.div>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold" style={{ backgroundColor: `${c}20`, color: c }}>{pg.duration}g</div>
                        <div><h3 className="text-xl font-bold" style={{ color: c }}>{pg.planName}</h3><p className="text-sm" style={{ color: FUND_THEME.textMuted }}>USDT %{pg.usdtYield} | HERMES %{pg.hermesYield}</p></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="text-2xl font-bold" style={{ color: FUND_THEME.primary }}>${pg.totalUsdt.toLocaleString()}</div><div className="text-xs" style={{ color: FUND_THEME.textMuted }}>Toplam USDT</div></div>
                        <div><div className="text-2xl font-bold" style={{ color: c }}>{pg.userCount}</div><div className="text-xs" style={{ color: FUND_THEME.textMuted }}>Kullanıcı</div></div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {urgentUsers.length > 0 && (
                <motion.div className="p-6 rounded-xl" style={{ backgroundColor: `${FUND_THEME.error}10`, border: `2px solid ${FUND_THEME.error}` }}
                  animate={{ boxShadow: [`0 0 10px ${FUND_THEME.error}30`, `0 0 30px ${FUND_THEME.error}50`, `0 0 10px ${FUND_THEME.error}30`] }} transition={{ duration: 2, repeat: Infinity }}>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: FUND_THEME.error }}>🚨 ACİL: {urgentUsers.length} Kullanıcının Vadesi 3 Gün İçinde Doluyor!</h3>
                  <div className="space-y-2">{urgentUsers.slice(0,5).map((u, i) => {
                    const cd = formatCountdown(u.endTime*1000); const nick = getNickname(u.address);
                    return <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: FUND_THEME.background }}>
                      <div className="flex items-center gap-3">
                        {nick ? <span className="font-semibold" style={{ color: FUND_THEME.primary }}>🏷️ {nick}</span> : <span className="font-mono text-sm" style={{ color: FUND_THEME.accent }}>{u.address.slice(0,10)}...{u.address.slice(-6)}</span>}
                        <span className="text-sm" style={{ color: FUND_THEME.textMuted }}>{u.planName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold" style={{ color: FUND_THEME.primary }}>${Number(u.usdtPrincipal).toFixed(0)}</span>
                        <motion.span className="px-3 py-1 rounded-full font-bold text-sm" style={{ backgroundColor: cd.color, color: '#000' }}
                          animate={cd.isUrgent ? { scale: [1,1.05,1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>⏱️ {cd.text}</motion.span>
                      </div>
                    </div>;
                  })}</div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* PLAN TABS */}
          {['plan0','plan1','plan2'].includes(activeTab) && (
            <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <PlanDetailView
                plan={planGroups[parseInt(activeTab.replace('plan',''))]}
                formatCountdown={formatCountdown}
                now={now}
                getNickname={getNickname}
                editingNickname={editingNickname}
                nicknameInput={nicknameInput}
                setNicknameInput={setNicknameInput}
                startEditNickname={startEditNickname}
                saveNickname={saveNickname}
              />
            </motion.div>
          )}

          {/* URGENT TAB */}
          {activeTab === 'urgent' && (
            <motion.div key="urgent" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="p-6 rounded-xl" style={{ backgroundColor: FUND_THEME.surface, border: `2px solid ${FUND_THEME.error}` }}>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{ color: FUND_THEME.error }}>
                  <motion.span animate={{ scale: [1,1.2,1] }} transition={{ duration: 1, repeat: Infinity }}>🚨</motion.span>
                  ACİL - 3 Gün İçinde Vadesi Dolacak
                </h2>
                {urgentUsers.length === 0 ? <p className="text-center py-8" style={{ color: FUND_THEME.textMuted }}>✅ Acil durum yok</p> : (
                  <div className="space-y-3">{urgentUsers.map((u, i) => {
                    const cd = formatCountdown(u.endTime*1000); const nick = getNickname(u.address);
                    return <motion.div key={i} className="p-4 rounded-xl" style={{ backgroundColor: `${FUND_THEME.error}10`, border: `1px solid ${FUND_THEME.error}50` }}
                      animate={cd.isUrgent ? { boxShadow: [`0 0 5px ${FUND_THEME.error}30`, `0 0 15px ${FUND_THEME.error}50`, `0 0 5px ${FUND_THEME.error}30`] } : {}} transition={{ duration: 1.5, repeat: Infinity }}>
                      <div className="flex items-center justify-between">
                        <div>
                          {nick && <div className="font-bold mb-1" style={{ color: FUND_THEME.primary }}>🏷️ {nick}</div>}
                          <a href={`https://bscscan.com/address/${u.address}`} target="_blank" rel="noopener noreferrer" className="font-mono font-bold hover:underline" style={{ color: FUND_THEME.accent }}>{u.address.slice(0,12)}...{u.address.slice(-8)}</a>
                          <div className="text-sm mt-1" style={{ color: FUND_THEME.textMuted }}>{u.planName} | Başlangıç: {new Date(u.startTime*1000).toLocaleDateString('tr-TR')}</div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right"><div className="font-bold text-xl" style={{ color: FUND_THEME.primary }}>${Number(u.usdtPrincipal).toFixed(0)}</div><div className="text-xs" style={{ color: FUND_THEME.textMuted }}>USDT</div></div>
                          <motion.div className="px-4 py-2 rounded-xl text-center min-w-[120px]" style={{ backgroundColor: cd.color, color: '#000' }}
                            animate={cd.isUrgent ? { scale: [1,1.03,1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>
                            <div className="font-bold text-lg">⏱️ {cd.text}</div>
                            <div className="text-xs opacity-75">{new Date(u.endTime*1000).toLocaleDateString('tr-TR')}</div>
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>;
                  })}</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ═══════════════════ COMPONENTS ═══════════════════

function TabBtn({ active, onClick, label, color, pulse }: { active: boolean; onClick: () => void; label: string; color?: string; pulse?: boolean }) {
  return <motion.button onClick={onClick} className="px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all"
    style={{ backgroundColor: active ? (color||FUND_THEME.primary) : FUND_THEME.surface, color: active ? '#000' : FUND_THEME.text, border: `1px solid ${active ? (color||FUND_THEME.primary) : FUND_THEME.primary+'30'}` }}
    animate={pulse && !active ? { scale: [1,1.03,1] } : {}} transition={{ duration: 1, repeat: Infinity }}>{label}</motion.button>;
}

function StatCard({ title, value, sub, color, icon }: { title: string; value: string; sub: string; color: string; icon: string }) {
  return <motion.div className="p-6 rounded-xl" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${color}30` }} whileHover={{ scale: 1.02, y: -2 }}>
    <div className="flex items-center gap-3 mb-2"><span className="text-2xl">{icon}</span><span className="text-sm font-semibold" style={{ color: FUND_THEME.textMuted }}>{title}</span></div>
    <div className="text-3xl font-bold mb-1" style={{ color }}>{value}</div>
    <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>{sub}</div>
  </motion.div>;
}

function PlanDetailView({ plan, formatCountdown, now, getNickname, editingNickname, nicknameInput, setNicknameInput, startEditNickname, saveNickname }: {
  plan: PlanGroup; formatCountdown: (ms: number) => { text: string; isUrgent: boolean; color: string }; now: number;
  getNickname: (a: string) => string | null; editingNickname: string | null; nicknameInput: string;
  setNicknameInput: (v: string) => void; startEditNickname: (a: string) => void; saveNickname: (a: string, n: string) => void;
}) {
  const colors = [FUND_THEME.success, FUND_THEME.warning, FUND_THEME.primary];
  const color = colors[plan.planId] || FUND_THEME.accent;

  // Sortable columns
  type SortKey = 'nickname' | 'status' | 'usdt' | 'claimed' | 'claimable' | 'start' | 'end';
  const [sortKey, setSortKey] = useState<SortKey>('end');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const sorted = useMemo(() => {
    const arr = [...plan.users];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'nickname': {
          const na = getNickname(a.address) || a.address;
          const nb = getNickname(b.address) || b.address;
          cmp = na.localeCompare(nb);
          break;
        }
        case 'status': cmp = a.status - b.status; break;
        case 'usdt': cmp = Number(a.usdtPrincipal) - Number(b.usdtPrincipal); break;
        case 'claimed': cmp = Number(a.claimedUsdt) - Number(b.claimedUsdt); break;
        case 'claimable': cmp = Number(a.claimableUsdt) - Number(b.claimableUsdt); break;
        case 'start': cmp = a.startTime - b.startTime; break;
        case 'end': cmp = a.endTime - b.endTime; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [plan.users, sortKey, sortDir, getNickname]);

  const thStyle = (key: SortKey, align: string) => ({
    color: sortKey === key ? FUND_THEME.primary : FUND_THEME.textMuted,
    cursor: 'pointer' as const,
    userSelect: 'none' as const,
    textAlign: align as any,
  });

  return <>
    {/* Plan Header */}
    <div className="p-6 rounded-xl" style={{ backgroundColor: FUND_THEME.surface, border: `2px solid ${color}` }}>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: `${color}20`, color }}>{plan.duration}g</div>
        <div><h2 className="text-3xl font-bold" style={{ color }}>{plan.planName} Plan</h2><p style={{ color: FUND_THEME.textMuted }}>USDT Getiri: %{plan.usdtYield} | HERMES Getiri: %{plan.hermesYield}</p></div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl" style={{ backgroundColor: FUND_THEME.background }}><div className="text-3xl font-bold" style={{ color: FUND_THEME.primary }}>${plan.totalUsdt.toLocaleString()}</div><div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Toplam USDT</div></div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: FUND_THEME.background }}><div className="text-3xl font-bold" style={{ color: FUND_THEME.accent }}>{(plan.totalHermes/1e9).toFixed(2)}B</div><div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Toplam HERMES</div></div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: FUND_THEME.background }}><div className="text-3xl font-bold" style={{ color }}>{plan.userCount}</div><div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Kullanıcı</div></div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: FUND_THEME.background }}><div className="text-3xl font-bold" style={{ color: FUND_THEME.success }}>${plan.userCount > 0 ? (plan.totalUsdt/plan.userCount).toFixed(0) : 0}</div><div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Ortalama</div></div>
      </div>
    </div>

    {/* Users Table */}
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${color}30` }}>
      <div className="p-4" style={{ backgroundColor: FUND_THEME.background }}><h3 className="font-bold" style={{ color: FUND_THEME.text }}>{plan.planName} Kullanıcıları ({plan.userCount})</h3></div>
      {plan.users.length === 0 ? <p className="text-center py-8" style={{ color: FUND_THEME.textMuted }}>Bu planda henüz kullanıcı yok</p> : (
        <div className="overflow-x-auto"><table className="w-full"><thead>
          <tr style={{ borderBottom: `1px solid ${FUND_THEME.primary}20` }}>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('nickname','left')} onClick={() => toggleSort('nickname')}>Adres / Nickname{sortIndicator('nickname')}</th>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('status','left')} onClick={() => toggleSort('status')}>Durum{sortIndicator('status')}</th>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('usdt','right')} onClick={() => toggleSort('usdt')}>USDT{sortIndicator('usdt')}</th>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('claimed','right')} onClick={() => toggleSort('claimed')}>Kazanılan{sortIndicator('claimed')}</th>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('claimable','right')} onClick={() => toggleSort('claimable')}>Claimable{sortIndicator('claimable')}</th>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('start','center')} onClick={() => toggleSort('start')}>Başlangıç{sortIndicator('start')}</th>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('end','center')} onClick={() => toggleSort('end')}>Vade Bitiş{sortIndicator('end')}</th>
            <th className="py-3 px-4 text-sm font-semibold hover:opacity-80 transition-opacity" style={thStyle('end','center')} onClick={() => toggleSort('end')}>Geri Sayım{sortIndicator('end')}</th>
          </tr>
        </thead><tbody>
          {sorted.map((u, idx) => {
            const cd = formatCountdown(u.endTime*1000);
            const isUrg = u.endTime*1000 - now < 3*24*60*60*1000;
            const nick = getNickname(u.address);
            const isEd = editingNickname === u.address;
            return <motion.tr key={idx} style={{ borderBottom: `1px solid ${FUND_THEME.primary}10`, backgroundColor: isUrg ? `${FUND_THEME.error}10` : 'transparent' }}
              animate={isUrg ? { backgroundColor: [`${FUND_THEME.error}10`, `${FUND_THEME.error}20`, `${FUND_THEME.error}10`] } : {}} transition={{ duration: 2, repeat: Infinity }}>
              <td className="py-3 px-4"><div className="flex flex-col gap-1">
                {isEd ? <div className="flex items-center gap-2">
                  <input type="text" value={nicknameInput} onChange={e => setNicknameInput(e.target.value)} placeholder="Nickname..." className="px-2 py-1 rounded text-sm w-32"
                    style={{ backgroundColor: FUND_THEME.background, border: `1px solid ${FUND_THEME.primary}`, color: FUND_THEME.text }} autoFocus
                    onKeyDown={e => { if(e.key==='Enter') saveNickname(u.address, nicknameInput); if(e.key==='Escape') { setNicknameInput(''); startEditNickname(''); } }} />
                  <button onClick={() => saveNickname(u.address, nicknameInput)} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: FUND_THEME.success, color: '#000' }}>✓</button>
                  <button onClick={() => { setNicknameInput(''); startEditNickname(''); }} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: FUND_THEME.error, color: '#fff' }}>✕</button>
                </div> : <div className="flex items-center gap-2">
                  {nick ? <span className="font-semibold cursor-pointer hover:opacity-80" style={{ color: FUND_THEME.primary }} onClick={() => startEditNickname(u.address)}>🏷️ {nick}</span>
                    : <button onClick={() => startEditNickname(u.address)} className="text-xs px-2 py-0.5 rounded opacity-60 hover:opacity-100" style={{ backgroundColor: `${FUND_THEME.primary}20`, color: FUND_THEME.primary }}>+ Nickname</button>}
                </div>}
                <a href={`https://bscscan.com/address/${u.address}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:underline" style={{ color: FUND_THEME.accent }}>{u.address.slice(0,8)}...{u.address.slice(-6)}</a>
              </div></td>
              <td className="py-3 px-4"><span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: `${color}20`, color }}>{u.statusText}</span></td>
              <td className="py-3 px-4 text-right font-bold" style={{ color: FUND_THEME.primary }}>${Number(u.usdtPrincipal).toFixed(0)}</td>
              <td className="py-3 px-4 text-right" style={{ color: FUND_THEME.success }}>${Number(u.claimedUsdt).toFixed(2)}</td>
              <td className="py-3 px-4 text-right" style={{ color: FUND_THEME.warning }}>${Number(u.claimableUsdt).toFixed(2)}</td>
              <td className="py-3 px-4 text-center text-sm" style={{ color: FUND_THEME.textMuted }}>{new Date(u.startTime*1000).toLocaleDateString('tr-TR')}</td>
              <td className="py-3 px-4 text-center text-sm" style={{ color: FUND_THEME.textMuted }}>{new Date(u.endTime*1000).toLocaleDateString('tr-TR')}</td>
              <td className="py-3 px-4 text-center"><motion.span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: cd.color, color: '#000' }}
                animate={cd.isUrgent ? { scale: [1,1.05,1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>{cd.text}</motion.span></td>
            </motion.tr>;
          })}
        </tbody></table></div>
      )}
    </div>
  </>;
}
