'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';
import { 
  FUND_THEME, 
  PLANS,
  PlanId,
  formatUSDT, 
  formatHermes,
  calculatePlanYield
} from '@/types/hermesFund';

interface PlanCardsProps {
  selectedPlan: PlanId | null;
  onSelectPlan: (planId: PlanId) => void;
  depositAmount: number;
  disabled?: boolean;
}

export default function PlanCards({ 
  selectedPlan, 
  onSelectPlan, 
  depositAmount,
  disabled = false 
}: PlanCardsProps) {
  const { language } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((plan, index) => {
        const isSelected = selectedPlan === plan.id;
        const yields = calculatePlanYield(plan.id, depositAmount || 100);
        
        return (
          <motion.button
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            onClick={() => !disabled && onSelectPlan(plan.id)}
            disabled={disabled}
            className={`relative overflow-hidden rounded-xl p-5 text-left transition-all duration-300 ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{ 
              backgroundColor: isSelected ? `${FUND_THEME.primary}20` : FUND_THEME.background,
              border: `2px solid ${isSelected ? FUND_THEME.primary : plan.highlight ? FUND_THEME.primary : `${FUND_THEME.primary}20`}`,
            }}
            whileHover={!disabled ? { scale: 1.02, y: -4 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
          >
            {/* Glow Effect for Selected */}
            {isSelected && (
              <motion.div
                className="absolute inset-0 rounded-xl -z-10"
                animate={{
                  boxShadow: [
                    `0 0 20px ${FUND_THEME.primary}40`,
                    `0 0 50px ${FUND_THEME.primary}60`,
                    `0 0 20px ${FUND_THEME.primary}40`
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}

            {/* Shimmer Effect on Selected */}
            {isSelected && (
              <motion.div
                className="absolute inset-0 opacity-20"
                style={{
                  background: `linear-gradient(90deg, transparent, ${FUND_THEME.primary}, transparent)`,
                }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            {/* HOT Badge - Artık 6 aylık için - Altın/Turuncu */}
            {plan.highlight && (
              <motion.div 
                className="absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-xl rounded-tr-xl"
                style={{ 
                  background: `linear-gradient(135deg, ${FUND_THEME.primary}, #F59E0B)`,
                  color: '#000'
                }}
                animate={{ 
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    `0 0 10px ${FUND_THEME.primary}50`,
                    `0 0 25px #F59E0B80`,
                    `0 0 10px ${FUND_THEME.primary}50`
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🔥 HOT
              </motion.div>
            )}

            {/* Selection Ring */}
            <div className="flex items-center gap-3 mb-4">
              <motion.div 
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                style={{ 
                  borderColor: isSelected ? FUND_THEME.primary : FUND_THEME.textMuted,
                  backgroundColor: isSelected ? FUND_THEME.primary : 'transparent'
                }}
                animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                {isSelected && (
                  <motion.svg 
                    className="w-4 h-4 text-black" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </motion.svg>
                )}
              </motion.div>

              {/* Plan Name */}
              <div>
                <h3 
                  className="text-xl font-bold"
                  style={{ color: isSelected ? FUND_THEME.primary : FUND_THEME.text }}
                >
                  {language === 'tr' ? plan.name : plan.nameEn}
                </h3>
                <p className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                  {plan.duration} {language === 'tr' ? 'Gün' : 'Days'}
                </p>
              </div>
            </div>

            {/* Yields - Large & Clear - Altın/Turuncu Tema */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <motion.div 
                className="p-3 rounded-lg text-center"
                style={{ backgroundColor: `${FUND_THEME.primary}15` }}
                animate={isSelected ? { 
                  backgroundColor: [`${FUND_THEME.primary}15`, `${FUND_THEME.primary}30`, `${FUND_THEME.primary}15`]
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="text-xs mb-1" style={{ color: FUND_THEME.textMuted }}>USDT</div>
                <div className="text-2xl font-bold" style={{ color: FUND_THEME.primary }}>%{plan.usdtYield}</div>
              </motion.div>

              <motion.div 
                className="p-3 rounded-lg text-center"
                style={{ backgroundColor: '#3B82F615' }}
                animate={isSelected ? { 
                  backgroundColor: ['#3B82F615', '#3B82F630', '#3B82F615']
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="text-xs mb-1" style={{ color: FUND_THEME.textMuted }}>HERMES</div>
                <div className="text-2xl font-bold" style={{ color: '#3B82F6' }}>%{plan.hermesYield}</div>
              </motion.div>
            </div>

            {/* Expected Yield Preview - Altın/Turuncu Tema */}
            {depositAmount > 0 && isSelected && (
              <motion.div 
                className="pt-3 border-t text-center"
                style={{ borderColor: `${FUND_THEME.primary}30` }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Tahmini Kazanç' : 'Expected Yield'}
                </div>
                <div className="flex justify-center gap-3 mt-1">
                  <span className="font-bold" style={{ color: FUND_THEME.primary }}>
                    +{formatUSDT(yields.totalUsdtYield)}
                  </span>
                  <span style={{ color: FUND_THEME.textMuted }}>•</span>
                  <span className="font-bold" style={{ color: '#3B82F6' }}>
                    +{formatHermes(yields.totalHermesYield)} H
                  </span>
                </div>
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
