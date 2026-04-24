'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';
import { 
  FUND_THEME, 
  formatUSDT,
  type FundStats
} from '@/types/hermesFund';

interface PoolProgressBarProps {
  stats: FundStats;
  isLoading?: boolean;
}

export default function PoolProgressBar({ stats, isLoading }: PoolProgressBarProps) {
  const { language } = useLanguage();
  const [showPulse, setShowPulse] = useState(false);
  const [countUp, setCountUp] = useState(0);
  
  const isFull = stats.utilizationPercent >= 100;
  const isNearFull = stats.utilizationPercent >= 80;
  
  // Sayı animasyonu
  useEffect(() => {
    const target = stats.utilizationPercent;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCountUp(target);
        clearInterval(timer);
      } else {
        setCountUp(current);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [stats.utilizationPercent]);
  
  // Renk gradyanı
  const getProgressColor = () => {
    if (isFull) return '#F04848';
    if (isNearFull) return '#F59E0B';
    return '#22C55E';
  };
  
  // Animasyonlu pulse efekti
  useEffect(() => {
    if (isNearFull && !isFull) {
      const interval = setInterval(() => {
        setShowPulse(prev => !prev);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isNearFull, isFull]);

  if (isLoading) {
    return (
      <div 
        className="rounded-3xl p-8 animate-pulse"
        style={{ backgroundColor: FUND_THEME.surface }}
      >
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-6" />
        <div className="h-12 bg-gray-700 rounded-full w-full mb-6" />
        <div className="h-6 bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl"
      style={{ 
        background: `linear-gradient(145deg, ${FUND_THEME.surface} 0%, ${FUND_THEME.background} 100%)`,
        border: `2px solid ${isFull ? '#F04848' : isNearFull ? '#F59E0B' : FUND_THEME.primary}50`,
        boxShadow: `0 20px 60px ${isFull ? '#F0484830' : isNearFull ? '#F59E0B30' : `${FUND_THEME.primary}30`}`
      }}
    >
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ 
              backgroundColor: FUND_THEME.primary,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 0.6, 0],
              scale: [0, 1.5, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>
      
      {/* Background Glow */}
      <motion.div
        className="absolute inset-0"
        animate={{ 
          background: [
            `radial-gradient(ellipse at 20% 50%, ${FUND_THEME.primary}15 0%, transparent 50%)`,
            `radial-gradient(ellipse at 80% 50%, ${FUND_THEME.primary}15 0%, transparent 50%)`,
            `radial-gradient(ellipse at 20% 50%, ${FUND_THEME.primary}15 0%, transparent 50%)`
          ]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Near Full Warning Glow */}
      {isNearFull && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: showPulse ? 0.2 : 0.05 }}
          transition={{ duration: 1 }}
          style={{ 
            background: `radial-gradient(ellipse at center, ${isFull ? '#F04848' : '#F59E0B'} 0%, transparent 60%)`
          }}
        />
      )}
      
      <div className="relative z-10 p-5 sm:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            {/* Animated Icon */}
            <motion.div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{ 
                background: `linear-gradient(135deg, ${FUND_THEME.primary}30, ${FUND_THEME.secondary}30)`,
                border: `2px solid ${FUND_THEME.primary}40`
              }}
              animate={{ 
                boxShadow: [
                  `0 0 20px ${FUND_THEME.primary}40`,
                  `0 0 40px ${FUND_THEME.primary}60`,
                  `0 0 20px ${FUND_THEME.primary}40`
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <motion.div
                animate={{ rotateY: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={FUND_THEME.primary}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </motion.div>
              {/* Pulse Ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ border: `2px solid ${FUND_THEME.primary}` }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
            
            <div className="min-w-0">
              <motion.h3 
                className="font-black text-xl sm:text-2xl tracking-tight"
                style={{ color: FUND_THEME.text }}
                animate={{ textShadow: [`0 0 10px ${FUND_THEME.primary}00`, `0 0 20px ${FUND_THEME.primary}60`, `0 0 10px ${FUND_THEME.primary}00`] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {language === 'tr' ? '💎 USDT Havuzu' : '💎 USDT Pool'}
              </motion.h3>
              <p className="text-sm mt-1 flex flex-wrap items-center gap-2 min-w-0" style={{ color: FUND_THEME.textMuted }}>
                <span>{language === 'tr' ? 'Toplam Kapasite' : 'Total Capacity'}:</span>
                <motion.span 
                  className="font-bold text-base sm:text-lg"
                  style={{ color: FUND_THEME.primary }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="inline-block max-w-full truncate align-bottom">{formatUSDT(stats.tvlCap)}</span>
                </motion.span>
              </p>
            </div>
          </div>
          
          {/* Animated Percentage Badge */}
          <motion.div 
            className="relative self-start sm:self-auto"
            whileHover={{ scale: 1.1 }}
          >
            <motion.div
              className="absolute inset-0 rounded-2xl blur-lg"
              style={{ backgroundColor: getProgressColor() }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div 
              className="relative px-4 py-2 sm:px-6 sm:py-3 rounded-2xl font-black text-xl sm:text-2xl flex items-center gap-2 whitespace-nowrap"
              style={{ 
                background: `linear-gradient(135deg, ${getProgressColor()}30, ${getProgressColor()}15)`,
                color: getProgressColor(),
                border: `2px solid ${getProgressColor()}60`,
                boxShadow: `0 4px 20px ${getProgressColor()}40`
              }}
            >
              {isFull && (
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  ⚠️
                </motion.div>
              )}
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {countUp.toFixed(1)}%
              </motion.span>
            </div>
          </motion.div>
        </div>

        {/* Progress Bar Container */}
        <div className="relative mb-6 sm:mb-8">
          {/* Progress Bar Background */}
          <div 
            className="h-14 rounded-2xl overflow-hidden relative"
            style={{ 
              backgroundColor: `${getProgressColor()}15`,
              boxShadow: `inset 0 4px 10px rgba(0,0,0,0.3)`
            }}
          >
            {/* Grid Lines */}
            <div className="absolute inset-0 flex">
              {[...Array(10)].map((_, i) => (
                <div 
                  key={i}
                  className="flex-1 border-r"
                  style={{ borderColor: `${FUND_THEME.textMuted}10` }}
                />
              ))}
            </div>
            
            {/* Animated Progress Fill */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, stats.utilizationPercent)}%` }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="h-full rounded-2xl relative overflow-hidden"
              style={{ 
                background: isFull 
                  ? 'linear-gradient(90deg, #DC2626, #F04848, #F87171)' 
                  : isNearFull 
                    ? 'linear-gradient(90deg, #22C55E, #F59E0B, #FBBF24)'
                    : 'linear-gradient(90deg, #059669, #10B981, #22C55E, #34D399)'
              }}
            >
              {/* Shimmer Effect */}
              <motion.div
                className="absolute inset-0"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  width: '30%'
                }}
              />
              
              {/* Inner Glow */}
              <div 
                className="absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)' }}
              />
            </motion.div>

            {/* Current Amount Label (inside bar) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div 
                className="font-black text-base sm:text-xl tracking-tight px-3 sm:px-4 py-1 rounded-full max-w-[95%] truncate"
                style={{ 
                  color: FUND_THEME.text,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  textShadow: `0 0 10px ${getProgressColor()}`
                }}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {formatUSDT(stats.totalStakedUsdt)} / {formatUSDT(stats.tvlCap)}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Stats Row - Impressive Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Active Users */}
          <motion.div 
            className="relative p-4 sm:p-5 rounded-2xl text-center overflow-hidden"
            style={{ 
              background: `linear-gradient(145deg, ${FUND_THEME.primary}15, ${FUND_THEME.primary}05)`,
              border: `1px solid ${FUND_THEME.primary}30`
            }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 50% 0%, ${FUND_THEME.primary}20, transparent 70%)` }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="relative">
              <motion.div 
                className="text-3xl sm:text-4xl font-black mb-1 truncate"
                style={{ color: FUND_THEME.primary }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {stats.activeUserCount}
              </motion.div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? '👥 Aktif Kullanıcı' : '👥 Active Users'}
              </div>
            </div>
          </motion.div>
          
          {/* Available Capacity */}
          <motion.div 
            className="relative p-4 sm:p-5 rounded-2xl text-center overflow-hidden"
            style={{ 
              background: `linear-gradient(145deg, ${stats.availableCapacity > 0 ? FUND_THEME.success : FUND_THEME.error}15, ${stats.availableCapacity > 0 ? FUND_THEME.success : FUND_THEME.error}05)`,
              border: `1px solid ${stats.availableCapacity > 0 ? FUND_THEME.success : FUND_THEME.error}30`
            }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 50% 0%, ${stats.availableCapacity > 0 ? FUND_THEME.success : FUND_THEME.error}20, transparent 70%)` }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            />
            <div className="relative">
              <motion.div 
                className="text-2xl sm:text-3xl font-black mb-1 truncate"
                style={{ color: stats.availableCapacity > 0 ? FUND_THEME.success : FUND_THEME.error }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              >
                {formatUSDT(stats.availableCapacity)}
              </motion.div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? '💰 Kalan Kapasite' : '💰 Available'}
              </div>
            </div>
          </motion.div>
          
          {/* Average Deposit */}
          <motion.div 
            className="relative p-4 sm:p-5 rounded-2xl text-center overflow-hidden"
            style={{ 
              background: `linear-gradient(145deg, ${FUND_THEME.accent}15, ${FUND_THEME.accent}05)`,
              border: `1px solid ${FUND_THEME.accent}30`
            }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 50% 0%, ${FUND_THEME.accent}20, transparent 70%)` }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
            />
            <div className="relative">
              <motion.div 
                className="text-2xl sm:text-3xl font-black mb-1 truncate"
                style={{ color: FUND_THEME.accent }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
              >
                {formatUSDT(stats.averageDeposit)}
              </motion.div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? '📊 Ortalama Yatırım' : '📊 Avg. Deposit'}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Full Pool Warning */}
        <AnimatePresence>
          {isFull && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="mt-6 p-5 rounded-2xl relative overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, #F0484820, #DC262610)',
                border: '2px solid #F0484850'
              }}
            >
              <motion.div
                className="absolute inset-0"
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ background: 'radial-gradient(ellipse at center, #F04848, transparent 70%)' }}
              />
              <div className="relative flex items-center gap-4">
                <motion.div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#F0484830' }}
                  animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <span className="text-3xl">🚫</span>
                </motion.div>
                <div>
                  <h4 className="font-black text-xl" style={{ color: '#F04848' }}>
                    {language === 'tr' ? 'Havuz Dolu!' : 'Pool is Full!'}
                  </h4>
                  <p className="text-sm mt-1" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' 
                      ? 'Şu anda yeni katılım kabul edilmiyor. Kapasite açıldığında bildirim alın!'
                      : 'Not accepting new deposits. Get notified when capacity opens!'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Near Full Warning */}
        <AnimatePresence>
          {isNearFull && !isFull && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-4 rounded-2xl flex items-center gap-4 relative overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, #F59E0B20, #D9770610)',
                border: '2px solid #F59E0B50'
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <span className="text-2xl">⚡</span>
              </motion.div>
              <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
                {language === 'tr' 
                  ? `Acele edin! Havuz %${stats.utilizationPercent.toFixed(0)} dolu! Sadece ${formatUSDT(stats.availableCapacity)} kaldı!`
                  : `Hurry! Pool is ${stats.utilizationPercent.toFixed(0)}% full! Only ${formatUSDT(stats.availableCapacity)} remaining!`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
