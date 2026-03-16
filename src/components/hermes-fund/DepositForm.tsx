'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';
import { 
  FUND_THEME, 
  FUND_CONSTANTS,
  PLANS,
  PlanId,
  formatUSDT, 
  formatHermes,
  calculatePlanYield,
  calculateLiveEarnings,
  type FundStats,
  type EligibilityCheck
} from '@/types/hermesFund';
import PlanCards from './PlanCards';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { ethereum?: any } }

interface DepositFormProps {
  fundStats: FundStats | null;
  eligibility: EligibilityCheck | null;
  hasActiveDeposit: boolean;
  onJoin: (planId: PlanId, amount: number) => Promise<void>;
}

export default function DepositForm({ 
  fundStats, 
  eligibility, 
  hasActiveDeposit,
  onJoin 
}: DepositFormProps) {
  const { language } = useLanguage();
  // Direct wallet state from window.ethereum
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  
  useEffect(() => {
    const check = async () => {
      if (!window.ethereum) return;
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setIsConnected(true);
          const chain = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(parseInt(chain, 16));
        }
      } catch {}
    };
    check();
    if (window.ethereum) {
      window.ethereum.on?.('accountsChanged', (accs: string[]) => setIsConnected(accs.length > 0));
      window.ethereum.on?.('chainChanged', (c: string) => setChainId(parseInt(c, 16)));
    }
  }, []);

  const isCorrectChain = chainId === 56;
  
  const handleConnect = async () => {
    if (!window.ethereum) { window.open('https://metamask.io/download/', '_blank'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setIsConnected(true);
        const chain = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chain, 16));
      }
    } catch {}
  };
  
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Simulated start time for live earnings preview (starts 1 hour ago for demo)
  const simulatedStartTimeRef = useRef<number | null>(null);
  const [liveEarnings, setLiveEarnings] = useState<{ earnedUsdt: number; earnedHermes: number; progressPercent: number } | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const minDeposit = fundStats?.minDeposit || FUND_CONSTANTS.MIN_DEPOSIT_USDT;
  const maxDeposit = fundStats?.maxDeposit || FUND_CONSTANTS.MAX_DEPOSIT_USDT;
  const availableCapacity = fundStats?.availableCapacity || 0;
  const isFull = fundStats?.isFull || false;

  // Seçili plana göre hesaplamalar
  const selectedPlanData = selectedPlan !== null ? PLANS[selectedPlan] : null;
  const yields = selectedPlan !== null ? calculatePlanYield(selectedPlan, amountNum) : null;

  // Initialize simulated start time when plan and amount are selected (for users without active deposit)
  useEffect(() => {
    if (selectedPlan !== null && amountNum >= minDeposit && !hasActiveDeposit) {
      // Set simulated start time to 1 hour ago for demo purposes
      if (simulatedStartTimeRef.current === null) {
        simulatedStartTimeRef.current = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      }
    } else {
      simulatedStartTimeRef.current = null;
      setLiveEarnings(null);
    }
  }, [selectedPlan, amountNum, minDeposit, hasActiveDeposit]);

  // Update live earnings every second when preview is active (for users without active deposit)
  useEffect(() => {
    if (selectedPlan !== null && amountNum >= minDeposit && simulatedStartTimeRef.current !== null && !hasActiveDeposit) {
      const updateEarnings = () => {
        const earnings = calculateLiveEarnings(selectedPlan, amountNum, simulatedStartTimeRef.current!);
        setLiveEarnings({
          earnedUsdt: earnings.earnedUsdt,
          earnedHermes: earnings.earnedHermes,
          progressPercent: earnings.progressPercent,
        });
      };

      updateEarnings(); // Initial update
      const interval = setInterval(updateEarnings, 1000); // Update every second
      return () => clearInterval(interval);
    }
  }, [selectedPlan, amountNum, minDeposit, hasActiveDeposit]);

  // Join yapılabilir mi?
  const canJoin = 
    isConnected && 
    isCorrectChain &&
    eligibility?.hasEnoughHermes && 
    eligibility?.hasEnoughUsdt &&
    !hasActiveDeposit &&
    !isFull &&
    selectedPlan !== null &&
    amountNum >= minDeposit && 
    amountNum <= maxDeposit &&
    amountNum <= availableCapacity;

  const handleSubmit = async () => {
    if (!canJoin || selectedPlan === null) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onJoin(selectedPlan, amountNum);
      setAmount('');
      setSelectedPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const setQuickAmount = (value: number) => {
    setAmount(Math.min(value, maxDeposit, availableCapacity).toString());
  };

  // Cüzdan bağlı değilse ve plan seçilmişse - Cüzdan bağlama prompt'u
  const showWalletPrompt = !isConnected && selectedPlan !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Disabled States */}
      <AnimatePresence>
        {hasActiveDeposit && (
          <motion.div 
            className="p-4 rounded-xl text-center"
            style={{ backgroundColor: `${FUND_THEME.secondary}20`, border: `1px solid ${FUND_THEME.secondary}40` }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <p style={{ color: FUND_THEME.accent }}>
              {language === 'tr' 
                ? '⚠️ Zaten aktif bir pozisyonunuz var.'
                : '⚠️ You already have an active position.'}
            </p>
          </motion.div>
        )}

        {isFull && !hasActiveDeposit && (
          <motion.div 
            className="p-4 rounded-xl text-center"
            style={{ backgroundColor: `${FUND_THEME.error}20`, border: `1px solid ${FUND_THEME.error}40` }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <p style={{ color: FUND_THEME.error }}>
              {language === 'tr' 
                ? '🔒 Havuz şu anda dolu!'
                : '🔒 Pool is currently full!'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 1: Plan Selection */}
      <motion.div 
        className="rounded-xl p-5"
        style={{ 
          backgroundColor: FUND_THEME.surface,
          border: `1px solid ${selectedPlan !== null ? FUND_THEME.primary : 'transparent'}30`
        }}
        whileHover={{ borderColor: `${FUND_THEME.primary}50` }}
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div 
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ 
              background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`,
              color: '#000'
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            1
          </motion.div>
          <h3 className="font-bold text-lg" style={{ color: FUND_THEME.text }}>
            {language === 'tr' ? 'Plan Seç' : 'Select Plan'}
          </h3>
        </div>

        <PlanCards
          selectedPlan={selectedPlan}
          onSelectPlan={setSelectedPlan}
          depositAmount={amountNum}
          disabled={hasActiveDeposit || isFull}
        />
      </motion.div>

      {/* Wallet Connect Prompt - Plan seçildiğinde ve cüzdan bağlı değilse */}
      <AnimatePresence>
        {showWalletPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            className="rounded-xl overflow-hidden relative"
            style={{ 
              backgroundColor: FUND_THEME.surface,
              border: `2px solid ${FUND_THEME.primary}50`
            }}
          >
            {/* Animated Background */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${FUND_THEME.primary}20, transparent 70%)`
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            />

            {/* Floating Particles */}
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full"
                style={{ 
                  backgroundColor: FUND_THEME.primary,
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                }}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0.3, 0.8, 0.3],
                  scale: [1, 1.5, 1]
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2
                }}
              />
            ))}

            <div className="relative z-10 p-8 text-center">
              {/* Animated Lock Icon */}
              <motion.div 
                className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                style={{ 
                  background: `linear-gradient(135deg, ${FUND_THEME.primary}30, ${FUND_THEME.secondary}30)`,
                  border: `2px solid ${FUND_THEME.primary}50`
                }}
                animate={{
                  boxShadow: [
                    `0 0 20px ${FUND_THEME.primary}30`,
                    `0 0 50px ${FUND_THEME.primary}60`,
                    `0 0 20px ${FUND_THEME.primary}30`
                  ],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <motion.svg 
                  className="w-10 h-10" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke={FUND_THEME.primary}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </motion.svg>
              </motion.div>
              
              <motion.h3 
                className="text-2xl font-bold mb-3"
                style={{ color: FUND_THEME.text }}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {language === 'tr' ? 'Cüzdanını Bağla' : 'Connect Your Wallet'}
              </motion.h3>
              
              {/* Yeni Açıklama */}
              <p className="mb-6 max-w-md mx-auto" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' 
                  ? 'Yatırımını yap. Hermes AI Trade Bot senin adına al-sat yapsın, işlemleri "Canlı İşlemler" ekranından anlık takip et.'
                  : 'Make your investment. Let Hermes AI Trade Bot trade for you, track transactions live on the "Live Trades" screen.'}
              </p>

              {/* Selected Plan Preview */}
              {selectedPlanData && (
                <motion.div 
                  className="mb-6 p-4 rounded-xl inline-block"
                  style={{ backgroundColor: FUND_THEME.background }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? 'Seçilen Plan' : 'Selected Plan'}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="font-bold" style={{ color: FUND_THEME.primary }}>
                      {language === 'tr' ? selectedPlanData.name : selectedPlanData.nameEn}
                    </span>
                    <span style={{ color: FUND_THEME.success }}>%{selectedPlanData.usdtYield} USDT</span>
                    <span style={{ color: FUND_THEME.accent }}>%{selectedPlanData.hermesYield} HERMES</span>
                  </div>
                </motion.div>
              )}
              
              {/* Connect Button - MEGA ANIMATED */}
              <motion.button
                onClick={() => open()}
                className="px-8 py-4 rounded-xl font-bold text-lg relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`,
                  color: '#000',
                }}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: [
                    `0 0 20px ${FUND_THEME.primary}40`,
                    `0 0 50px ${FUND_THEME.primary}70`,
                    `0 0 20px ${FUND_THEME.primary}40`
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {/* Shimmer */}
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    🔗
                  </motion.span>
                  {language === 'tr' ? 'Cüzdanı Bağla' : 'Connect Wallet'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2: Amount Input - Sadece cüzdan bağlıysa */}
      <AnimatePresence>
        {selectedPlan !== null && isConnected && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="rounded-xl p-5 overflow-hidden"
            style={{ 
              backgroundColor: FUND_THEME.surface,
              border: `1px solid ${amountNum > 0 ? FUND_THEME.primary : 'transparent'}30`
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ 
                    background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`,
                    color: '#000'
                  }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                >
                  2
                </motion.div>
                <h3 className="font-bold text-lg" style={{ color: FUND_THEME.text }}>
                  {language === 'tr' ? 'USDT Miktarı' : 'USDT Amount'}
                </h3>
              </div>
              
              {/* User's Wallet USDT Balance */}
              {eligibility && (
                <motion.div 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: FUND_THEME.background }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? 'Bakiye:' : 'Balance:'}
                  </span>
                  <span 
                    className="font-mono font-bold"
                    style={{ color: eligibility.hasEnoughUsdt ? FUND_THEME.success : FUND_THEME.error }}
                  >
                    {formatUSDT(eligibility.currentUsdtBalance)}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <div className="relative">
                <motion.input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`${minDeposit} - ${maxDeposit} USDT`}
                  disabled={!isConnected || !eligibility?.hasEnoughHermes || hasActiveDeposit}
                  className="w-full px-4 py-4 rounded-xl text-xl font-mono outline-none transition-all"
                  style={{ 
                    backgroundColor: FUND_THEME.background,
                    border: `2px solid ${amountNum > 0 && canJoin ? FUND_THEME.primary : 'transparent'}`,
                    color: FUND_THEME.text
                  }}
                  whileFocus={{ scale: 1.01 }}
                />
                <span 
                  className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-lg"
                  style={{ color: FUND_THEME.primary }}
                >
                  USDT
                </span>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[100, 250, 500, 1000].map((val, i) => (
                <motion.button
                  key={val}
                  onClick={() => setQuickAmount(val)}
                  disabled={!isConnected || !eligibility?.hasEnoughHermes || hasActiveDeposit}
                  className="py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  style={{ 
                    backgroundColor: amountNum === val ? FUND_THEME.primary : `${FUND_THEME.primary}20`,
                    color: amountNum === val ? '#000' : FUND_THEME.primary
                  }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  ${val}
                </motion.button>
              ))}
              {/* MAX Button */}
              <motion.button
                onClick={() => {
                  if (eligibility) {
                    const maxPossible = Math.min(
                      eligibility.currentUsdtBalance,
                      maxDeposit,
                      availableCapacity
                    );
                    setAmount(Math.floor(maxPossible).toString());
                  }
                }}
                disabled={!isConnected || !eligibility?.hasEnoughHermes || hasActiveDeposit || !eligibility?.currentUsdtBalance}
                className="py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                style={{ 
                  backgroundColor: FUND_THEME.success,
                  color: '#000'
                }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                MAX
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3: Summary & Confirm */}
      <AnimatePresence>
        {selectedPlan !== null && amountNum > 0 && yields && selectedPlanData && isConnected && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="rounded-xl overflow-hidden"
            style={{ 
              backgroundColor: FUND_THEME.surface,
              border: `2px solid ${FUND_THEME.primary}40`
            }}
          >
            {/* Summary Header */}
            <motion.div 
              className="p-4"
              style={{ 
                background: `linear-gradient(135deg, ${FUND_THEME.primary}30, ${FUND_THEME.secondary}30)`
              }}
              animate={{
                background: [
                  `linear-gradient(135deg, ${FUND_THEME.primary}30, ${FUND_THEME.secondary}30)`,
                  `linear-gradient(135deg, ${FUND_THEME.secondary}30, ${FUND_THEME.primary}30)`,
                  `linear-gradient(135deg, ${FUND_THEME.primary}30, ${FUND_THEME.secondary}30)`
                ]
              }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ 
                    background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`,
                    color: '#000'
                  }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                >
                  ✓
                </motion.div>
                <h3 className="font-bold text-lg" style={{ color: FUND_THEME.text }}>
                  {language === 'tr' ? 'Özet & Onayla' : 'Summary & Confirm'}
                </h3>
              </div>
            </motion.div>

            <div className="p-5 space-y-4">
              {/* Plan Summary */}
              <div 
                className="p-4 rounded-xl"
                style={{ backgroundColor: FUND_THEME.background }}
              >
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>Plan</div>
                    <div className="font-bold" style={{ color: FUND_THEME.primary }}>
                      {language === 'tr' ? selectedPlanData.name : selectedPlanData.nameEn}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>USDT</div>
                    <div className="font-bold font-mono" style={{ color: FUND_THEME.text }}>
                      ${amountNum}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>HERMES</div>
                    <div className="font-bold font-mono" style={{ color: FUND_THEME.accent }}>
                      1B
                    </div>
                  </div>
                </div>
              </div>

              {/* Expected Returns - Animated */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div 
                  className="p-4 rounded-xl text-center relative overflow-hidden"
                  style={{ backgroundColor: `${FUND_THEME.success}15` }}
                  whileHover={{ scale: 1.02 }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-20"
                    style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.success}, transparent)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <div className="relative">
                    <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                      {language === 'tr' ? 'USDT Getiri' : 'USDT Yield'}
                    </div>
                    <motion.div 
                      className="text-2xl font-bold"
                      style={{ color: FUND_THEME.success }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      +{formatUSDT(yields.totalUsdtYield)}
                    </motion.div>
                    <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                      %{selectedPlanData.usdtYield}
                    </div>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="p-4 rounded-xl text-center relative overflow-hidden"
                  style={{ backgroundColor: `${FUND_THEME.accent}15` }}
                  whileHover={{ scale: 1.02 }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-20"
                    style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.accent}, transparent)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                  />
                  <div className="relative">
                    <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                      {language === 'tr' ? 'HERMES Getiri' : 'HERMES Yield'}
                    </div>
                    <motion.div 
                      className="text-2xl font-bold"
                      style={{ color: FUND_THEME.accent }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    >
                      +{formatHermes(yields.totalHermesYield)}
                    </motion.div>
                    <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                      %{selectedPlanData.hermesYield}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Error */}
              {error && (
                <motion.div 
                  className="p-3 rounded-lg text-sm"
                  style={{ backgroundColor: '#EF444420', color: '#EF4444' }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {error}
                </motion.div>
              )}

              {/* Submit Button - MEGA ANIMATED */}
              <motion.button
                onClick={handleSubmit}
                disabled={!canJoin || isLoading}
                className="w-full py-5 rounded-xl font-bold text-lg relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  background: canJoin 
                    ? `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`
                    : FUND_THEME.background,
                  color: canJoin ? '#000' : FUND_THEME.textMuted,
                }}
                whileHover={canJoin ? { scale: 1.02, y: -2 } : {}}
                whileTap={canJoin ? { scale: 0.98 } : {}}
                animate={canJoin ? {
                  boxShadow: [
                    `0 0 20px ${FUND_THEME.primary}40`,
                    `0 0 50px ${FUND_THEME.primary}60`,
                    `0 0 20px ${FUND_THEME.primary}40`
                  ]
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {/* Shimmer Effect */}
                {canJoin && (
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}

                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <motion.svg 
                        className="w-6 h-6" 
                        viewBox="0 0 24 24"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </motion.svg>
                      {language === 'tr' ? 'İşlem Sürüyor...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        🚀
                      </motion.span>
                      {language === 'tr' ? 'FONA KATIL' : 'JOIN FUND'}
                    </>
                  )}
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Earnings Preview - Show for users without active deposit (stake etmemiş kullanıcılar) */}
      <AnimatePresence>
        {!hasActiveDeposit && selectedPlan !== null && amountNum >= minDeposit && liveEarnings && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-xl overflow-hidden"
            style={{ 
              backgroundColor: FUND_THEME.surface,
              border: `2px solid ${FUND_THEME.primary}40`
            }}
          >
            {/* Header */}
            <motion.div 
              className="p-4 flex items-center justify-between"
              style={{ 
                background: `linear-gradient(135deg, ${FUND_THEME.primary}20, ${FUND_THEME.secondary}20)`
              }}
            >
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: FUND_THEME.success }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <h3 className="font-bold text-lg" style={{ color: FUND_THEME.text }}>
                  ⚡ {language === 'tr' ? 'Anlık Biriken Ödüller' : 'Live Accumulating Rewards'}
                </h3>
              </div>
              <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                {liveEarnings.progressPercent.toFixed(2)}% {language === 'tr' ? 'tamamlandı' : 'complete'}
              </div>
            </motion.div>

            {/* Live Earnings Display */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* USDT Earnings */}
                <motion.div 
                  className="p-4 rounded-xl text-center relative overflow-hidden"
                  style={{ backgroundColor: `${FUND_THEME.success}10` }}
                  animate={{ 
                    boxShadow: [
                      `0 0 10px ${FUND_THEME.success}20`,
                      `0 0 20px ${FUND_THEME.success}40`,
                      `0 0 10px ${FUND_THEME.success}20`
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-10"
                    style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.success}, transparent)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <div className="relative">
                    <div className="text-xs mb-1 flex items-center justify-center gap-1" style={{ color: FUND_THEME.textMuted }}>
                      {language === 'tr' ? 'USDT Kazanç' : 'USDT Earned'}
                      <span className="text-xs" style={{ color: FUND_THEME.success }}>⚡</span>
                    </div>
                    <motion.div 
                      className="text-2xl font-bold font-mono"
                      style={{ color: FUND_THEME.success }}
                      key={liveEarnings.earnedUsdt}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.5 }}
                    >
                      +{formatUSDT(liveEarnings.earnedUsdt)}
                    </motion.div>
                    <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                      {language === 'tr' ? 'Sürekli artıyor' : 'Growing continuously'}
                    </div>
                  </div>
                </motion.div>

                {/* HERMES Earnings */}
                <motion.div 
                  className="p-4 rounded-xl text-center relative overflow-hidden"
                  style={{ backgroundColor: `${FUND_THEME.accent}10` }}
                  animate={{ 
                    boxShadow: [
                      `0 0 10px ${FUND_THEME.accent}20`,
                      `0 0 20px ${FUND_THEME.accent}40`,
                      `0 0 10px ${FUND_THEME.accent}20`
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-10"
                    style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.accent}, transparent)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                  />
                  <div className="relative">
                    <div className="text-xs mb-1 flex items-center justify-center gap-1" style={{ color: FUND_THEME.textMuted }}>
                      {language === 'tr' ? 'HERMES Kazanç' : 'HERMES Earned'}
                      <span className="text-xs" style={{ color: FUND_THEME.accent }}>⚡</span>
                    </div>
                    <motion.div 
                      className="text-2xl font-bold font-mono"
                      style={{ color: FUND_THEME.accent }}
                      key={liveEarnings.earnedHermes}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.5 }}
                    >
                      +{formatHermes(liveEarnings.earnedHermes)}
                    </motion.div>
                    <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                      {language === 'tr' ? 'Sürekli artıyor' : 'Growing continuously'}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1" style={{ color: FUND_THEME.textMuted }}>
                  <span>{language === 'tr' ? 'İlerleme' : 'Progress'}</span>
                  <span>{liveEarnings.progressPercent.toFixed(2)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${FUND_THEME.primary}20` }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ 
                      background: `linear-gradient(90deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${liveEarnings.progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Info Message */}
              <div className="text-xs text-center p-3 rounded-lg" style={{ backgroundColor: `${FUND_THEME.primary}10` }}>
                <span style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' 
                    ? '💡 Bu ödüller stake ettiğinizde anlık olarak birikmeye başlayacak!'
                    : '💡 These rewards will start accumulating instantly when you stake!'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
