'use client';

import { motion } from 'framer-motion';
import { FUND_THEME, formatUSDT, type DailyClaimStats } from '@/types/hermesFund';
import { useLanguage } from '@/lib/i18n';

interface DailyClaimsChartProps {
  dailyClaims: DailyClaimStats[];
}

export default function DailyClaimsChart({ dailyClaims }: DailyClaimsChartProps) {
  const { language } = useLanguage();
  const maxClaim = Math.max(...dailyClaims.map(d => d.totalClaimed), 1);
  const totalWeeklyClaims = dailyClaims.reduce((sum, d) => sum + d.totalClaimed, 0);
  const avgDaily = dailyClaims.length > 0 ? totalWeeklyClaims / dailyClaims.length : 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl overflow-hidden"
      style={{ 
        backgroundColor: FUND_THEME.surface,
        border: `1px solid ${FUND_THEME.primary}20`
      }}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: FUND_THEME.text }}>
            {language === 'tr' ? '📊 Günlük Claim İstatistikleri' : '📊 Daily Claims Statistics'}
          </h3>
          <p className="text-sm" style={{ color: FUND_THEME.textMuted }}>
            {language === 'tr' ? 'Son 7 günün claim verileri' : 'Last 7 days claim data'}
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
            {language === 'tr' ? 'Haftalık Toplam' : 'Weekly Total'}
          </div>
          <div className="text-xl font-bold" style={{ color: '#22C55E' }}>
            {formatUSDT(totalWeeklyClaims)}
          </div>
        </div>
      </div>

      <div className="p-4 pt-0">
        {/* Chart */}
        <div className="flex items-end justify-between gap-2 h-32">
          {dailyClaims.slice().reverse().map((day, index) => {
            const height = (day.totalClaimed / maxClaim) * 100;
            const isToday = index === dailyClaims.length - 1;
            
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs" style={{ color: '#22C55E' }}>
                  {formatUSDT(day.totalClaimed)}
                </div>
                
                <div 
                  className="w-full rounded-t-md relative overflow-hidden"
                  style={{ 
                    backgroundColor: `${FUND_THEME.primary}20`,
                    height: '80px'
                  }}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="absolute bottom-0 w-full rounded-t-md"
                    style={{ 
                      background: isToday 
                        ? `linear-gradient(180deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`
                        : FUND_THEME.primary
                    }}
                  />
                </div>
                
                <div 
                  className="text-xs"
                  style={{ color: isToday ? FUND_THEME.primary : FUND_THEME.textMuted }}
                >
                  {formatDate(day.date)}
                </div>
                
                {day.claimCount !== undefined && (
                  <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                    {day.claimCount} {language === 'tr' ? 'kişi' : 'people'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div 
          className="mt-4 pt-4 grid grid-cols-2 gap-4"
          style={{ borderTop: `1px solid ${FUND_THEME.primary}20` }}
        >
          <div className="text-center">
            <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
              {language === 'tr' ? 'Günlük Ortalama' : 'Daily Average'}
            </div>
            <div className="text-lg font-bold" style={{ color: FUND_THEME.accent }}>
              {formatUSDT(avgDaily)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
              {language === 'tr' ? 'Bugünkü Claim' : "Today's Claim"}
            </div>
            <div className="text-lg font-bold" style={{ color: FUND_THEME.primary }}>
              {dailyClaims[0] ? formatUSDT(dailyClaims[0].totalClaimed) : formatUSDT(0)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
