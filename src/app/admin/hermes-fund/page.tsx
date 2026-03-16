'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { JsonRpcProvider, Contract } from 'ethers';
import { 
  FUND_THEME, 
  FUND_CONSTANTS,
  PLANS,
  formatUSDT,
  formatHermes,
  formatAddress,
  type FundStats,
  type AdminPendingPayment
} from '@/types/hermesFund';
import { CONTRACT_ADDRESSES, HERMES_FUND_ABI, weiToNumber } from '@/lib/hermes-fund/contract';
import { useLanguage } from '@/lib/i18n';

const BSC_RPC = 'https://bsc-dataseed.binance.org/';

// Admin auth helpers
function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hermes_admin_token');
}

function setAdminToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hermes_admin_token', token);
    // Also set cookie for API route auth
    document.cookie = `admin_session=${encodeURIComponent(JSON.stringify({ token }))};path=/;max-age=${7 * 24 * 3600}`;
  }
}

function clearAdminToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('hermes_admin_token');
    document.cookie = 'admin_session=;path=/;max-age=0';
  }
}

// ============================================================================
// USER POSITION TYPE (from contract/API)
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
  usdtPaid: boolean;
  hermesUnstaked: boolean;
}

export default function AdminHermesFundPage() {
  const { language } = useLanguage();
  
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Data
  const [stats, setStats] = useState<FundStats | null>(null);
  const [pendingUnstakes, setPendingUnstakes] = useState<AdminPendingPayment[]>([]);
  const [allUsers, setAllUsers] = useState<UserPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Nicknames
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');

  // Time countdown
  const [now, setNow] = useState(Date.now());

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'nicknames'>('overview');

  const TREASURY_ADDRESS = FUND_CONSTANTS.TREASURY_ADDRESS;

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auth check on mount
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      // Verify token by making a test API call
      fetch('/api/admin/wallet-nicknames', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setIsAuthenticated(true);
            if (data.nicknames) setNicknames(data.nicknames);
          } else {
            clearAdminToken();
          }
        })
        .catch(() => clearAdminToken())
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Login handler
  const handleLogin = async () => {
    if (!loginPassword.trim()) {
      setLoginError('Şifre gerekli');
      return;
    }
    
    try {
      // Test the password against the nicknames API
      const res = await fetch('/api/admin/wallet-nicknames', {
        headers: { Authorization: `Bearer ${loginPassword}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setAdminToken(loginPassword);
        setIsAuthenticated(true);
        setLoginError('');
        if (data.nicknames) setNicknames(data.nicknames);
      } else {
        setLoginError('Geçersiz şifre');
      }
    } catch {
      setLoginError('Bağlantı hatası');
    }
  };

  // Logout
  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
  };

  // Load nicknames
  const loadNicknames = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/wallet-nicknames', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.nicknames) {
        setNicknames(json.nicknames);
      }
    } catch (error) {
      console.error('Nicknames load failed:', error);
    }
  }, []);

  // Save nickname
  const saveNickname = useCallback(async (address: string, nickname: string) => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/wallet-nicknames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address, nickname }),
      });
      const json = await res.json();
      if (json.success && json.nicknames) {
        setNicknames(json.nicknames);
      }
    } catch (error) {
      console.error('Nickname save failed:', error);
    }
    setEditingNickname(null);
    setNicknameInput('');
  }, []);

  // Get nickname
  const getNickname = useCallback((address: string): string | null => {
    return nicknames[address.toLowerCase()] || null;
  }, [nicknames]);

  // Start editing
  const startEditNickname = useCallback((address: string) => {
    setEditingNickname(address);
    setNicknameInput(nicknames[address.toLowerCase()] || '');
  }, [nicknames]);

  // Fetch contract data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const provider = new JsonRpcProvider(BSC_RPC);
      const contract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider);

      const [
        totalStakedHermes, totalStakedUsdt,
        totalGeneratedHermes, totalGeneratedUsdt,
        totalClaimedHermes, totalClaimedUsdt,
        activeUserCount, minDeposit, maxDeposit, tvlCap, userCount
      ] = await Promise.all([
        contract.totalStakedHermes(), contract.totalStakedUsdt(),
        contract.totalGeneratedHermes(), contract.totalGeneratedUsdt(),
        contract.totalClaimedHermes(), contract.totalClaimedUsdt(),
        contract.activeUserCount(), contract.minDeposit(),
        contract.maxDeposit(), contract.tvlCap(), contract.getUserCount()
      ]);

      const totalStakedUsdtNum = weiToNumber(totalStakedUsdt);
      const tvlCapNum = weiToNumber(tvlCap);
      const activeUserCountNum = Number(activeUserCount);
      const availableCapacity = tvlCapNum - totalStakedUsdtNum;
      const utilizationPercent = tvlCapNum > 0 ? (totalStakedUsdtNum / tvlCapNum) * 100 : 0;

      setStats({
        totalStakedHermes: weiToNumber(totalStakedHermes),
        totalStakedUsdt: totalStakedUsdtNum,
        totalGeneratedHermes: weiToNumber(totalGeneratedHermes),
        totalGeneratedUsdt: weiToNumber(totalGeneratedUsdt),
        totalClaimedHermes: weiToNumber(totalClaimedHermes),
        totalClaimedUsdt: weiToNumber(totalClaimedUsdt),
        activeUserCount: activeUserCountNum,
        minDeposit: weiToNumber(minDeposit),
        maxDeposit: weiToNumber(maxDeposit),
        tvlCap: tvlCapNum,
        availableCapacity,
        utilizationPercent,
        averageDeposit: activeUserCountNum > 0 ? totalStakedUsdtNum / activeUserCountNum : 0,
        isFull: utilizationPercent >= 100
      });

      // Fetch all users from contract
      const totalUsers = Number(userCount);
      const users: UserPosition[] = [];
      for (let i = 0; i < totalUsers; i++) {
        try {
          const addr = await contract.getUserAtIndex(i);
          const pos = await contract.getPosition(addr);
          const statusNum = Number(pos.status);
          const planId = Number(pos.planId);
          const plan = PLANS[planId] || PLANS[0];
          
          users.push({
            address: addr,
            planId,
            planName: plan.name,
            status: statusNum,
            statusText: ['Yok', 'Aktif', 'Vadesi Doldu', 'Kilit Açık', 'Kapalı'][statusNum] || 'Bilinmeyen',
            usdtPrincipal: weiToNumber(pos.usdtPrincipal).toFixed(2),
            hermesStaked: weiToNumber(pos.hermesStaked).toFixed(0),
            startTime: Number(pos.startTime),
            endTime: Number(pos.endTime),
            unlockTime: Number(pos.unlockTime),
            claimedUsdt: weiToNumber(pos.claimedUsdt).toFixed(2),
            claimedHermes: weiToNumber(pos.claimedHermes).toFixed(0),
            claimableUsdt: '0',
            claimableHermes: '0',
            usdtPaid: pos.usdtPaid || false,
            hermesUnstaked: pos.hermesUnstaked || false,
          });
        } catch (err) {
          console.error(`User ${i} fetch error:`, err);
        }
      }
      setAllUsers(users);
      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(language === 'tr' ? 'Veri yüklenemedi' : 'Failed to load data');
      setIsLoading(false);
    }
  }, [language]);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      loadNicknames();
      const interval = setInterval(fetchData, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchData, loadNicknames]);

  // Format countdown
  const formatCountdown = (endTimeMs: number) => {
    const diff = endTimeMs - now;
    if (diff <= 0) return { text: 'VADESİ DOLDU!', isUrgent: true, color: FUND_THEME.error };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days <= 3) return { text: `${days}g ${hours}s ${minutes}d`, isUrgent: true, color: FUND_THEME.error };
    if (days <= 7) return { text: `${days}g ${hours}s`, isUrgent: false, color: FUND_THEME.warning };
    return { text: `${days} gün`, isUrgent: false, color: FUND_THEME.success };
  };

  // Urgent users (within 3 days)
  const urgentUsers = useMemo(() => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return allUsers.filter(user => {
      if (user.status === 4 || user.usdtPaid) return false;
      const endTimeMs = user.endTime * 1000;
      const timeUntilEnd = endTimeMs - now;
      return timeUntilEnd > 0 && timeUntilEnd <= threeDaysMs;
    }).sort((a, b) => a.endTime - b.endTime);
  }, [allUsers, now]);

  // ============================================================================
  // LOGIN SCREEN
  // ============================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: FUND_THEME.background }}>
        <div className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full"
          style={{ borderColor: `${FUND_THEME.primary} transparent` }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: FUND_THEME.background }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl p-8"
          style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.primary}30` }}
        >
          <div className="text-center mb-8">
            <motion.div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})` }}
              animate={{ boxShadow: [`0 0 20px ${FUND_THEME.primary}40`, `0 0 40px ${FUND_THEME.primary}60`, `0 0 20px ${FUND_THEME.primary}40`] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🔐
            </motion.div>
            <h1 className="text-2xl font-bold" style={{ color: FUND_THEME.primary }}>Admin Girişi</h1>
            <p className="text-sm mt-2" style={{ color: FUND_THEME.textMuted }}>Hermes AI Fund Yönetim Paneli</p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Admin Şifresi"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{ 
                backgroundColor: FUND_THEME.background, 
                color: FUND_THEME.text,
                border: `1px solid ${loginError ? FUND_THEME.error : FUND_THEME.primary}30`,
              }}
            />
            
            {loginError && (
              <div className="text-sm text-center" style={{ color: FUND_THEME.error }}>{loginError}</div>
            )}
            
            <motion.button
              onClick={handleLogin}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: FUND_THEME.primary, color: '#000' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Giriş Yap
            </motion.button>
          </div>
          
          <div className="text-center mt-6">
            <Link href="/" className="text-sm" style={{ color: FUND_THEME.textMuted }}>
              ← Ana Sayfaya Dön
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============================================================================
  // MAIN ADMIN PANEL
  // ============================================================================
  if (isLoading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: FUND_THEME.background }}>
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full mx-auto mb-4"
            style={{ borderColor: `${FUND_THEME.primary} transparent` }}
          />
          <p style={{ color: FUND_THEME.textMuted }}>Kontrat verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: FUND_THEME.background }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ backgroundColor: `${FUND_THEME.background}90`, borderBottom: `1px solid ${FUND_THEME.primary}20` }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm transition-colors hover:opacity-80" style={{ color: FUND_THEME.textMuted }}>
              ← Ana Sayfa
            </Link>
            <h1 className="text-lg font-bold" style={{ color: FUND_THEME.primary }}>
              🔐 HERMES AI Fund Admin
            </h1>
            {urgentUsers.length > 0 && (
              <motion.span
                className="px-2 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: FUND_THEME.error, color: '#fff' }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ⚠️ {urgentUsers.length} ACİL
              </motion.span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                {lastUpdate.toLocaleTimeString('tr-TR')}
              </span>
            )}
            <motion.button
              onClick={fetchData}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: FUND_THEME.primary, color: '#000' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              🔄 Yenile
            </motion.button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: `${FUND_THEME.error}20`, color: FUND_THEME.error }}
            >
              Çıkış
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-2">
          {[
            { id: 'overview' as const, label: '📊 Genel Bakış' },
            { id: 'users' as const, label: `👥 Kullanıcılar (${allUsers.length})` },
            { id: 'nicknames' as const, label: `🏷️ Nicknames (${Object.keys(nicknames).length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? FUND_THEME.primary : FUND_THEME.surface,
                color: activeTab === tab.id ? '#000' : FUND_THEME.text,
                border: `1px solid ${activeTab === tab.id ? FUND_THEME.primary : FUND_THEME.primary + '30'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ============ OVERVIEW TAB ============ */}
          {activeTab === 'overview' && stats && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Toplam USDT" value={formatUSDT(stats.totalStakedUsdt)} subtitle={`%${stats.utilizationPercent.toFixed(1)} doluluk`} color={FUND_THEME.primary} icon="💰" />
                <StatCard title="Toplam HERMES" value={formatHermes(stats.totalStakedHermes)} subtitle="Stake edilmiş" color={FUND_THEME.accent} icon="🔒" />
                <StatCard title="Aktif Kullanıcı" value={String(stats.activeUserCount)} subtitle={`Toplam: ${allUsers.length}`} color={FUND_THEME.success} icon="👥" />
                <StatCard title="Ödenen USDT" value={formatUSDT(stats.totalClaimedUsdt)} subtitle="Claim edilen" color={FUND_THEME.warning} icon="💵" />
              </div>

              {/* Generated / Claimed */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat title="Üretilen USDT" value={formatUSDT(stats.totalGeneratedUsdt)} color={FUND_THEME.success} />
                <MiniStat title="Claim Edilen USDT" value={formatUSDT(stats.totalClaimedUsdt)} color={FUND_THEME.text} />
                <MiniStat title="Üretilen HERMES" value={formatHermes(stats.totalGeneratedHermes)} color={FUND_THEME.accent} />
                <MiniStat title="Claim Edilen HERMES" value={formatHermes(stats.totalClaimedHermes)} color={FUND_THEME.text} />
              </div>

              {/* Urgent Warning */}
              {urgentUsers.length > 0 && (
                <motion.div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: `${FUND_THEME.error}10`, border: `2px solid ${FUND_THEME.error}` }}
                  animate={{ boxShadow: [`0 0 10px ${FUND_THEME.error}30`, `0 0 30px ${FUND_THEME.error}50`, `0 0 10px ${FUND_THEME.error}30`] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: FUND_THEME.error }}>
                    🚨 ACİL: {urgentUsers.length} Kullanıcının Vadesi 3 Gün İçinde Doluyor!
                  </h3>
                  <div className="space-y-2">
                    {urgentUsers.map((user, idx) => {
                      const countdown = formatCountdown(user.endTime * 1000);
                      const nickname = getNickname(user.address);
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: FUND_THEME.background }}>
                          <div className="flex items-center gap-3">
                            {nickname ? (
                              <span className="font-semibold" style={{ color: FUND_THEME.primary }}>🏷️ {nickname}</span>
                            ) : (
                              <span className="font-mono text-sm" style={{ color: FUND_THEME.accent }}>{formatAddress(user.address)}</span>
                            )}
                            <span className="text-sm" style={{ color: FUND_THEME.textMuted }}>{user.planName}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold" style={{ color: FUND_THEME.primary }}>${Number(user.usdtPrincipal).toFixed(0)}</span>
                            <span className="px-3 py-1 rounded-full font-bold text-sm" style={{ backgroundColor: countdown.color, color: '#000' }}>
                              ⏱️ {countdown.text}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Quick Access */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <a href={`https://bscscan.com/address/${TREASURY_ADDRESS}`} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl p-4 transition-all hover:scale-105" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.accent}30` }}>
                  <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Treasury</div>
                  <div className="font-mono text-sm mt-1" style={{ color: FUND_THEME.accent }}>{formatAddress(TREASURY_ADDRESS)}</div>
                </a>
                <a href={`https://bscscan.com/address/${CONTRACT_ADDRESSES.FUND}`} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl p-4 transition-all hover:scale-105" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.primary}30` }}>
                  <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Contract</div>
                  <div className="font-mono text-sm mt-1" style={{ color: FUND_THEME.primary }}>{formatAddress(CONTRACT_ADDRESSES.FUND)}</div>
                </a>
                <Link href="/hermes-fund" className="rounded-xl p-4 transition-all hover:scale-105" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.secondary}30` }}>
                  <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Kullanıcı Sayfası</div>
                  <div className="text-sm mt-1" style={{ color: FUND_THEME.secondary }}>Görüntüle →</div>
                </Link>
                <button onClick={fetchData} className="rounded-xl p-4 text-left transition-all hover:scale-105" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.success}30` }}>
                  <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>Yenile</div>
                  <div className="text-sm mt-1" style={{ color: FUND_THEME.success }}>Verileri Güncelle</div>
                </button>
              </div>

              {/* Plan Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                  <div key={plan.id} className="rounded-xl p-4" style={{ backgroundColor: FUND_THEME.surface, border: plan.highlight ? `2px solid ${FUND_THEME.primary}40` : `1px solid ${FUND_THEME.surface}` }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold" style={{ color: FUND_THEME.text }}>{plan.name}</h3>
                      {plan.highlight && <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${FUND_THEME.primary}20`, color: FUND_THEME.primary }}>HOT</span>}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span style={{ color: FUND_THEME.textMuted }}>Süre</span><span style={{ color: FUND_THEME.text }}>{plan.duration} gün</span></div>
                      <div className="flex justify-between"><span style={{ color: FUND_THEME.textMuted }}>USDT Yield</span><span style={{ color: FUND_THEME.success }}>%{plan.usdtYield}</span></div>
                      <div className="flex justify-between"><span style={{ color: FUND_THEME.textMuted }}>HERMES Yield</span><span style={{ color: FUND_THEME.accent }}>%{plan.hermesYield}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ============ USERS TAB ============ */}
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.primary}20` }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${FUND_THEME.primary}20` }}>
                      <th className="px-4 py-3 text-left text-xs" style={{ color: FUND_THEME.textMuted }}>Adres / Nickname</th>
                      <th className="px-4 py-3 text-left text-xs" style={{ color: FUND_THEME.textMuted }}>Plan</th>
                      <th className="px-4 py-3 text-left text-xs" style={{ color: FUND_THEME.textMuted }}>USDT</th>
                      <th className="px-4 py-3 text-left text-xs" style={{ color: FUND_THEME.textMuted }}>Durum</th>
                      <th className="px-4 py-3 text-left text-xs" style={{ color: FUND_THEME.textMuted }}>Vade</th>
                      <th className="px-4 py-3 text-left text-xs" style={{ color: FUND_THEME.textMuted }}>Nickname</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((user, idx) => {
                      const countdown = formatCountdown(user.endTime * 1000);
                      const nickname = getNickname(user.address);
                      const isEditing = editingNickname === user.address;
                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${FUND_THEME.primary}10` }}>
                          <td className="px-4 py-3">
                            {nickname && <div className="text-xs font-bold mb-0.5" style={{ color: FUND_THEME.primary }}>🏷️ {nickname}</div>}
                            <a href={`https://bscscan.com/address/${user.address}`} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-xs hover:underline" style={{ color: FUND_THEME.accent }}>
                              {formatAddress(user.address)}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: FUND_THEME.text }}>{user.planName}</td>
                          <td className="px-4 py-3 text-xs font-bold" style={{ color: FUND_THEME.primary }}>${user.usdtPrincipal}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded" style={{ 
                              backgroundColor: user.status === 1 ? `${FUND_THEME.success}20` : user.status === 2 ? `${FUND_THEME.warning}20` : `${FUND_THEME.textMuted}20`,
                              color: user.status === 1 ? FUND_THEME.success : user.status === 2 ? FUND_THEME.warning : FUND_THEME.textMuted
                            }}>
                              {user.statusText}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {user.status !== 4 && (
                              <span className="text-xs font-bold" style={{ color: countdown.color }}>
                                {countdown.text}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={nicknameInput}
                                  onChange={(e) => setNicknameInput(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveNickname(user.address, nicknameInput)}
                                  className="w-24 px-2 py-1 rounded text-xs outline-none"
                                  style={{ backgroundColor: FUND_THEME.background, color: FUND_THEME.text, border: `1px solid ${FUND_THEME.primary}30` }}
                                  autoFocus
                                />
                                <button onClick={() => saveNickname(user.address, nicknameInput)} className="text-xs" style={{ color: FUND_THEME.success }}>✓</button>
                                <button onClick={() => setEditingNickname(null)} className="text-xs" style={{ color: FUND_THEME.error }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => startEditNickname(user.address)} className="text-xs px-2 py-1 rounded hover:opacity-80"
                                style={{ backgroundColor: `${FUND_THEME.primary}15`, color: FUND_THEME.primary }}>
                                {nickname ? '✏️' : '+ İsim'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {allUsers.length === 0 && (
                  <div className="p-8 text-center" style={{ color: FUND_THEME.textMuted }}>Henüz kullanıcı yok</div>
                )}
              </div>
            </motion.div>
          )}

          {/* ============ NICKNAMES TAB ============ */}
          {activeTab === 'nicknames' && (
            <motion.div
              key="nicknames"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="rounded-xl p-6" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${FUND_THEME.primary}20` }}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: FUND_THEME.text }}>
                  🏷️ Cüzdan Nicknames
                </h2>
                
                {Object.keys(nicknames).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(nicknames).map(([addr, nick]) => (
                      <div key={addr} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: FUND_THEME.background }}>
                        <div className="flex items-center gap-3">
                          <span className="font-bold" style={{ color: FUND_THEME.primary }}>🏷️ {nick}</span>
                          <a href={`https://bscscan.com/address/${addr}`} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-xs hover:underline" style={{ color: FUND_THEME.accent }}>
                            {formatAddress(addr)}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEditNickname(addr)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${FUND_THEME.primary}15`, color: FUND_THEME.primary }}>✏️ Düzenle</button>
                          <button onClick={() => saveNickname(addr, '')} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${FUND_THEME.error}15`, color: FUND_THEME.error }}>🗑️ Sil</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8" style={{ color: FUND_THEME.textMuted }}>
                    Henüz nickname eklenmemiş. Kullanıcılar sekmesinden ekleyebilirsiniz.
                  </div>
                )}

                {editingNickname && Object.keys(nicknames).includes(editingNickname) && (
                  <div className="mt-4 p-4 rounded-lg flex items-center gap-3" style={{ backgroundColor: FUND_THEME.background }}>
                    <span className="text-sm" style={{ color: FUND_THEME.textMuted }}>Yeni isim:</span>
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveNickname(editingNickname, nicknameInput)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ backgroundColor: FUND_THEME.surface, color: FUND_THEME.text, border: `1px solid ${FUND_THEME.primary}30` }}
                      autoFocus
                    />
                    <button onClick={() => saveNickname(editingNickname, nicknameInput)} className="px-3 py-2 rounded-lg text-sm font-bold" style={{ backgroundColor: FUND_THEME.success, color: '#000' }}>Kaydet</button>
                    <button onClick={() => setEditingNickname(null)} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: `${FUND_THEME.error}20`, color: FUND_THEME.error }}>İptal</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatCard({ title, value, subtitle, color, icon }: {
  title: string; value: string; subtitle: string; color: string; icon: string;
}) {
  return (
    <motion.div className="rounded-xl p-4" style={{ backgroundColor: FUND_THEME.surface, border: `1px solid ${color}30` }} whileHover={{ scale: 1.02 }}>
      <div className="flex items-center gap-2 mb-1"><span className="text-lg">{icon}</span><span className="text-xs" style={{ color: FUND_THEME.textMuted }}>{title}</span></div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>{subtitle}</div>
    </motion.div>
  );
}

function MiniStat({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: FUND_THEME.surface }}>
      <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>{title}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
