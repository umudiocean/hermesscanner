'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';
import { 
  FUND_THEME, 
  FUND_CONSTANTS,
  DepositStatus,
  formatUSDT, 
  formatHermes,
  formatTimeRemaining,
  getStatusLabel,
  getStatusColor,
  type UserInfo 
} from '@/types/hermesFund';

interface UserDashboardProps {
  userInfo: UserInfo;
  onClaimUsdt: () => Promise<void>;
  onClaimHermes: () => Promise<void>;
  onWithdrawUsdt: () => Promise<void>;
  onUnstakeHermes: () => Promise<void>;
  isClaimUsdtLoading?: boolean;
  isClaimHermesLoading?: boolean;
  isWithdrawUsdtLoading?: boolean;
  isUnstakeHermesLoading?: boolean;
}

export default function UserDashboard({ 
  userInfo, 
  onClaimUsdt,
  onClaimHermes,
  onWithdrawUsdt,
  onUnstakeHermes,
  isClaimUsdtLoading,
  isClaimHermesLoading,
  isWithdrawUsdtLoading,
  isUnstakeHermesLoading
}: UserDashboardProps) {
  const { language } = useLanguage();
  
  const statusColor = getStatusColor(userInfo.position.status);
  const statusKey = getStatusLabel(userInfo.position.status);
  
  const statusLabels: Record<string, string> = {
    none: language === 'tr' ? 'Yok' : 'None',
    active: language === 'tr' ? 'Aktif' : 'Active',
    matured: language === 'tr' ? 'Vadesi Doldu' : 'Matured',
    unlocked: language === 'tr' ? 'Çekilebilir' : 'Unlocked',
    closed: language === 'tr' ? 'Kapalı' : 'Closed',
    unknown: language === 'tr' ? 'Bilinmiyor' : 'Unknown'
  };
  const statusLabel = statusLabels[statusKey];

  // Cooldown hesaplamaları
  const now = Date.now();
  const usdtCooldownMs = userInfo.nextClaimUsdtTime - now;
  const hermesCooldownMs = userInfo.nextClaimHermesTime - now;
  const usdtTimeRemaining = formatTimeRemaining(usdtCooldownMs);
  const hermesTimeRemaining = formatTimeRemaining(hermesCooldownMs);

  const isUnlocked = userInfo.position.status === DepositStatus.UNLOCKED;
  const isMatured = userInfo.position.status === DepositStatus.MATURED;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Position Header */}
      <div 
        className="rounded-xl overflow-hidden"
        style={{ 
          backgroundColor: FUND_THEME.surface,
          border: `1px solid ${statusColor}40`
        }}
      >
        {/* Header */}
        <div 
          className="p-5 flex items-center justify-between"
          style={{ 
            background: `linear-gradient(135deg, ${FUND_THEME.secondary}20, ${statusColor}20)`
          }}
        >
          <div>
            <h3 className="text-xl font-bold" style={{ color: FUND_THEME.text }}>
              {language === 'tr' ? 'Pozisyonunuz' : 'Your Position'}
            </h3>
            <p className="text-sm" style={{ color: FUND_THEME.textMuted }}>
              {language === 'tr' ? userInfo.plan.name : userInfo.plan.nameEn} • 
              {' '}{language === 'tr' ? 'Gün' : 'Day'} {userInfo.daysElapsed}/{userInfo.plan.duration}
            </p>
          </div>
          
          <div 
            className="px-4 py-2 rounded-full text-sm font-bold"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {statusLabel}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Progress Ring + Stats */}
          <div className="flex items-center gap-6">
            {/* Progress Ring */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="42"
                  stroke={`${FUND_THEME.primary}20`}
                  strokeWidth="10"
                  fill="none"
                />
                <motion.circle
                  cx="50" cy="50" r="42"
                  stroke={FUND_THEME.primary}
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: '0 264' }}
                  animate={{ 
                    strokeDasharray: `${(userInfo.progressPercent / 100) * 264} 264` 
                  }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold" style={{ color: FUND_THEME.primary }}>
                  {userInfo.progressPercent.toFixed(0)}%
                </span>
                <span className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Tamamlandı' : 'Complete'}
                </span>
              </div>
            </div>

            {/* Position Stats */}
            <div className="flex-1 space-y-3">
              <div className="flex justify-between">
                <span style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'USDT Yatırım' : 'USDT Deposit'}
                </span>
                <span className="font-mono font-bold" style={{ color: FUND_THEME.text }}>
                  {formatUSDT(userInfo.position.usdtPrincipal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'HERMES Stake' : 'HERMES Staked'}
                </span>
                <span className="font-mono font-bold" style={{ color: FUND_THEME.accent }}>
                  {formatHermes(userInfo.position.hermesStaked)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Kalan Gün' : 'Days Left'}
                </span>
                <span className="font-mono" style={{ color: statusColor }}>
                  {userInfo.daysRemaining} {language === 'tr' ? 'gün' : 'days'}
                </span>
              </div>
            </div>
          </div>

          {/* Earnings Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div 
              className="p-4 rounded-xl"
              style={{ backgroundColor: `${FUND_THEME.success}10` }}
            >
              <div className="text-sm mb-1 flex items-center gap-1" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? 'USDT Kazanç' : 'USDT Earned'}
                <span className="text-xs" style={{ color: FUND_THEME.success }}>
                  ⚡ {language === 'tr' ? 'Anlık' : 'Live'}
                </span>
              </div>
              <div className="text-xl font-bold font-mono" style={{ color: FUND_THEME.success }}>
                +{formatUSDT(userInfo.earnedUsdt)}
              </div>
              <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? 'Claim:' : 'Claimed:'} {formatUSDT(userInfo.position.claimedUsdt)}
              </div>
            </div>
            
            <div 
              className="p-4 rounded-xl"
              style={{ backgroundColor: `${FUND_THEME.accent}10` }}
            >
              <div className="text-sm mb-1 flex items-center gap-1" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? 'HERMES Kazanç' : 'HERMES Earned'}
                <span className="text-xs" style={{ color: FUND_THEME.accent }}>
                  ⚡ {language === 'tr' ? 'Anlık' : 'Live'}
                </span>
              </div>
              <div className="text-xl font-bold font-mono" style={{ color: FUND_THEME.accent }}>
                +{formatHermes(userInfo.earnedHermes)}
              </div>
              <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? 'Claim:' : 'Claimed:'} {formatHermes(userInfo.position.claimedHermes)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* USDT Claim Card */}
        <div 
          className="rounded-xl p-5"
          style={{ 
            backgroundColor: FUND_THEME.surface,
            border: `1px solid ${userInfo.canClaimUsdt ? FUND_THEME.success : 'transparent'}40`
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${FUND_THEME.success}20` }}
            >
              <span className="font-bold text-sm" style={{ color: FUND_THEME.success }}>$</span>
            </div>
            <span className="font-bold" style={{ color: FUND_THEME.text }}>
              {language === 'tr' ? 'USDT Claim' : 'Claim USDT'}
            </span>
          </div>

          <div 
            className="text-3xl font-bold font-mono mb-2"
            style={{ color: userInfo.claimableUsdt > 0 ? FUND_THEME.success : FUND_THEME.textMuted }}
          >
            {formatUSDT(userInfo.claimableUsdt)}
          </div>

          {/* Cooldown Info */}
          {!usdtTimeRemaining.isNow && userInfo.claimableUsdt > 0 && (
            <div className="text-sm mb-3" style={{ color: FUND_THEME.warning }}>
              ⏱ {usdtTimeRemaining.hours}h {usdtTimeRemaining.minutes}m {language === 'tr' ? 'kaldı' : 'left'}
            </div>
          )}

          {/* Pending Request Info */}
          {userInfo.hasPendingUsdtClaim && (
            <div className="text-sm mb-3 flex items-center gap-2" style={{ color: FUND_THEME.accent }}>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {language === 'tr' ? 'Ödeme bekleniyor...' : 'Payment pending...'}
            </div>
          )}

          <button
            onClick={onClaimUsdt}
            disabled={!userInfo.canClaimUsdt || isClaimUsdtLoading}
            className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{ 
              backgroundColor: userInfo.canClaimUsdt ? FUND_THEME.success : `${FUND_THEME.success}30`,
              color: userInfo.canClaimUsdt ? '#fff' : FUND_THEME.textMuted
            }}
          >
            {isClaimUsdtLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {language === 'tr' ? 'İşleniyor...' : 'Processing...'}
              </span>
            ) : (
              language === 'tr' ? 'USDT Claim Et' : 'Claim USDT'
            )}
          </button>
        </div>

        {/* HERMES Claim Card */}
        <div 
          className="rounded-xl p-5"
          style={{ 
            backgroundColor: FUND_THEME.surface,
            border: `1px solid ${userInfo.canClaimHermes ? FUND_THEME.accent : 'transparent'}40`
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${FUND_THEME.accent}20` }}
            >
              <span className="font-bold text-sm" style={{ color: FUND_THEME.accent }}>H</span>
            </div>
            <span className="font-bold" style={{ color: FUND_THEME.text }}>
              {language === 'tr' ? 'HERMES Claim' : 'Claim HERMES'}
            </span>
          </div>

          <div 
            className="text-3xl font-bold font-mono mb-2"
            style={{ color: userInfo.claimableHermes > 0 ? FUND_THEME.accent : FUND_THEME.textMuted }}
          >
            {formatHermes(userInfo.claimableHermes)}
          </div>

          {/* Cooldown Info */}
          {!hermesTimeRemaining.isNow && userInfo.claimableHermes > 0 && (
            <div className="text-sm mb-3" style={{ color: FUND_THEME.warning }}>
              ⏱ {hermesTimeRemaining.hours}h {hermesTimeRemaining.minutes}m {language === 'tr' ? 'kaldı' : 'left'}
            </div>
          )}

          {/* Pending Request Info */}
          {userInfo.hasPendingHermesClaim && (
            <div className="text-sm mb-3 flex items-center gap-2" style={{ color: FUND_THEME.accent }}>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {language === 'tr' ? 'Ödeme bekleniyor...' : 'Payment pending...'}
            </div>
          )}

          <button
            onClick={onClaimHermes}
            disabled={!userInfo.canClaimHermes || isClaimHermesLoading}
            className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{ 
              backgroundColor: userInfo.canClaimHermes ? FUND_THEME.accent : `${FUND_THEME.accent}30`,
              color: userInfo.canClaimHermes ? '#fff' : FUND_THEME.textMuted
            }}
          >
            {isClaimHermesLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {language === 'tr' ? 'İşleniyor...' : 'Processing...'}
              </span>
            ) : (
              language === 'tr' ? 'HERMES Claim Et' : 'Claim HERMES'
            )}
          </button>
        </div>
      </div>

      {/* Withdraw & Unstake Section - Her zaman görünür, süre dolmadan pasif */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* USDT Principal Withdraw */}
        <div 
          className="rounded-xl p-5 relative overflow-hidden"
          style={{ 
            backgroundColor: `${FUND_THEME.primary}10`,
            border: `1px solid ${isUnlocked ? FUND_THEME.primary : FUND_THEME.primary + '30'}`,
            opacity: isUnlocked || isMatured ? 1 : 0.7
          }}
        >
          {/* Lock Overlay for not unlocked */}
          {!isUnlocked && !isMatured && (
            <div className="absolute top-3 right-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${FUND_THEME.warning}20` }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={FUND_THEME.warning}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={FUND_THEME.primary}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold" style={{ color: FUND_THEME.text }}>
              {language === 'tr' ? 'USDT Ana Para' : 'USDT Principal'}
            </span>
          </div>

          <div className="text-2xl font-bold font-mono mb-3" style={{ color: FUND_THEME.primary }}>
            {formatUSDT(userInfo.position.usdtPrincipal)}
          </div>

          {userInfo.position.usdtPaid && (
            <div className="text-sm mb-3 flex items-center gap-2" style={{ color: FUND_THEME.success }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {language === 'tr' ? 'Ödendi' : 'Paid'}
            </div>
          )}

          {userInfo.hasPendingUsdtWithdraw && (
            <div className="text-sm mb-3 flex items-center gap-2" style={{ color: FUND_THEME.accent }}>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {language === 'tr' ? 'İşlem bekleniyor...' : 'Pending...'}
            </div>
          )}

          <button
            onClick={onWithdrawUsdt}
            disabled={!userInfo.canWithdrawUsdt || isWithdrawUsdtLoading}
            className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{ 
              background: userInfo.canWithdrawUsdt 
                ? `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`
                : `${FUND_THEME.primary}30`,
              color: userInfo.canWithdrawUsdt ? '#fff' : FUND_THEME.textMuted
            }}
          >
            {isWithdrawUsdtLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            ) : (
              language === 'tr' ? 'USDT Çek' : 'Withdraw USDT'
            )}
          </button>
        </div>

        {/* HERMES Unstake */}
        <div 
          className="rounded-xl p-5 relative overflow-hidden"
          style={{ 
            backgroundColor: `${FUND_THEME.accent}10`,
            border: `1px solid ${isUnlocked ? FUND_THEME.accent : FUND_THEME.accent + '30'}`,
            opacity: isUnlocked || isMatured ? 1 : 0.7
          }}
        >
          {/* Lock Overlay for not unlocked */}
          {!isUnlocked && !isMatured && (
            <div className="absolute top-3 right-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${FUND_THEME.warning}20` }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={FUND_THEME.warning}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={FUND_THEME.accent}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-bold" style={{ color: FUND_THEME.text }}>
              {language === 'tr' ? 'HERMES Unstake' : 'Unstake HERMES'}
            </span>
          </div>

          <div className="text-2xl font-bold font-mono mb-3" style={{ color: FUND_THEME.accent }}>
            {formatHermes(userInfo.position.hermesStaked)}
          </div>

          {userInfo.position.hermesUnstaked && (
            <div className="text-sm mb-3 flex items-center gap-2" style={{ color: FUND_THEME.success }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {language === 'tr' ? 'Gönderildi' : 'Sent'}
            </div>
          )}

          {userInfo.hasPendingHermesUnstake && (
            <div className="text-sm mb-3 flex items-center gap-2" style={{ color: FUND_THEME.accent }}>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {language === 'tr' ? 'İşlem bekleniyor...' : 'Pending...'}
            </div>
          )}

          <button
            onClick={onUnstakeHermes}
            disabled={!userInfo.canUnstakeHermes || isUnstakeHermesLoading}
            className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{ 
              backgroundColor: userInfo.canUnstakeHermes ? FUND_THEME.accent : `${FUND_THEME.accent}30`,
              color: userInfo.canUnstakeHermes ? '#fff' : FUND_THEME.textMuted
            }}
          >
            {isUnstakeHermesLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            ) : (
              language === 'tr' ? 'HERMES Al' : 'Unstake HERMES'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
