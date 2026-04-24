'use client';

import { motion } from 'framer-motion';
import { FUND_THEME, formatUSDT, type FundStats } from '@/types/hermesFund';
import { useLanguage } from '@/lib/i18n';

interface FundStatsProps {
  stats: FundStats;
  isLoading?: boolean;
}

export default function FundStatsComponent({ stats, isLoading }: FundStatsProps) {
  const { language } = useLanguage();

  const statItems = [
    {
      label: language === 'tr' ? 'Toplam Yatırılan' : 'Total Deposited',
      value: formatUSDT(stats.totalStakedUsdt),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: FUND_THEME.primary
    },
    {
      label: language === 'tr' ? 'Aktif Kullanıcı' : 'Active Users',
      value: stats.activeUserCount.toString(),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: FUND_THEME.secondary
    },
    {
      label: language === 'tr' ? 'Ödenen Kâr' : 'Profit Paid',
      value: formatUSDT(stats.totalClaimedUsdt),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: '#22C55E'
    },
    {
      label: language === 'tr' ? 'Kalan Kapasite' : 'Available Capacity',
      value: formatUSDT(stats.availableCapacity),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: FUND_THEME.accent
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          className="relative overflow-hidden rounded-xl p-4"
          style={{ 
            backgroundColor: FUND_THEME.surface,
            border: `1px solid ${item.color}20`
          }}
        >
          <div 
            className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-20"
            style={{ backgroundColor: item.color }}
          />
          
          <div className="relative z-10">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
              style={{ backgroundColor: `${item.color}20`, color: item.color }}
            >
              {item.icon}
            </div>
            
            <div 
              className="text-2xl font-bold mb-1"
              style={{ color: isLoading ? FUND_THEME.textMuted : FUND_THEME.text }}
            >
              {isLoading ? '...' : item.value}
            </div>
            
            <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
              {item.label}
            </div>
          </div>
        </motion.div>
      ))}
      
      {/* TVL Progress Bar */}
      {(() => {
        const isFull = stats.utilizationPercent >= 100;
        const isNearFull = stats.utilizationPercent >= 80;
        const progressColor = isFull ? '#F04848' : isNearFull ? '#F59E0B' : '#22C55E';
        const limitColor = isFull ? '#F04848' : '#22C55E';
        
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="col-span-2 md:col-span-4 rounded-xl p-4"
            style={{ 
              backgroundColor: FUND_THEME.surface,
              border: `1px solid ${progressColor}30`
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? 'TVL Doluluk Oranı' : 'TVL Utilization'}
              </span>
              <span style={{ color: progressColor, fontWeight: 'bold' }}>
                {stats.utilizationPercent.toFixed(1)}%
              </span>
            </div>
            
            <div 
              className="h-3 rounded-full overflow-hidden"
              style={{ backgroundColor: `${progressColor}20` }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, stats.utilizationPercent)}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full rounded-full"
                style={{ 
                  background: isFull 
                    ? '#F04848' 
                    : `linear-gradient(90deg, #22C55E, ${isNearFull ? '#F59E0B' : '#10B981'})`
                }}
              />
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                {language === 'tr' ? 'Aktif:' : 'Active:'}{' '}
                <span style={{ color: FUND_THEME.text }}>{formatUSDT(stats.totalStakedUsdt)}</span>
              </span>
              <span 
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ 
                  backgroundColor: `${limitColor}20`,
                  color: limitColor,
                  border: `1px solid ${limitColor}40`
                }}
              >
                {language === 'tr' ? 'Limit:' : 'Limit:'} {formatUSDT(stats.tvlCap)}
              </span>
            </div>
          </motion.div>
        );
      })()}
    </div>
  );
}
