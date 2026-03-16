'use client';

import { motion } from 'framer-motion';
import { FUND_THEME, PLANS } from '@/types/hermesFund';
import { useLanguage } from '@/lib/i18n';

export default function FundHeader() {
  const { language } = useLanguage();

  return (
    <div className="relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{ 
              backgroundColor: i % 2 === 0 ? FUND_THEME.primary : FUND_THEME.accent,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.3
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}

        {/* Grid Pattern */}
        <svg className="w-full h-full opacity-5" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke={FUND_THEME.primary} strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Gradient Overlays */}
      <motion.div 
        className="absolute inset-0"
        animate={{
          background: [
            `linear-gradient(135deg, ${FUND_THEME.secondary}30 0%, transparent 50%, ${FUND_THEME.primary}20 100%)`,
            `linear-gradient(135deg, ${FUND_THEME.primary}20 0%, transparent 50%, ${FUND_THEME.secondary}30 100%)`,
            `linear-gradient(135deg, ${FUND_THEME.secondary}30 0%, transparent 50%, ${FUND_THEME.primary}20 100%)`
          ]
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      
      {/* Content */}
      <div className="relative z-10 py-16 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Animated Logo */}
          <motion.div 
            className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center relative"
            style={{ 
              background: `linear-gradient(135deg, ${FUND_THEME.primary} 0%, ${FUND_THEME.secondary} 100%)`,
            }}
            animate={{
              boxShadow: [
                `0 0 20px ${FUND_THEME.primary}40`,
                `0 0 60px ${FUND_THEME.primary}60`,
                `0 0 20px ${FUND_THEME.primary}40`
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {/* Rotating Ring */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ border: `2px solid ${FUND_THEME.accent}` }}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
            
            <svg className="w-12 h-12 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </motion.div>
          
          {/* Title with Gradient */}
          <motion.h1 
            className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent"
            style={{ 
              backgroundImage: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.accent}, ${FUND_THEME.primary})`,
              backgroundSize: '200% 200%'
            }}
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
            }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            HERMES AI FUND
          </motion.h1>
          
          <motion.p 
            className="text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed"
            style={{ color: FUND_THEME.textMuted }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {language === 'tr' 
              ? 'Yatırımını yap. Hermes AI Trade Bot senin adına al-sat yapsın, işlemleri "Canlı İşlemler" ekranından anlık takip et.' 
              : 'Make your investment. Let Hermes AI Trade Bot trade for you, track transactions live on the "Live Trades" screen.'}
          </motion.p>
          
          {/* Animated Plan Badges */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="relative"
              >
                <motion.div
                  className="px-6 py-3 rounded-xl font-bold"
                  style={{ 
                    backgroundColor: `${FUND_THEME.surface}`,
                    border: plan.highlight ? `2px solid ${FUND_THEME.primary}` : `1px solid ${FUND_THEME.primary}30`
                  }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  animate={plan.highlight ? {
                    boxShadow: [
                      `0 0 10px ${FUND_THEME.primary}30`,
                      `0 0 30px ${FUND_THEME.primary}50`,
                      `0 0 10px ${FUND_THEME.primary}30`
                    ]
                  } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? plan.name : plan.nameEn}
                  </div>
                  <div className="text-lg" style={{ color: FUND_THEME.success }}>
                    %{plan.usdtYield} USDT
                  </div>
                </motion.div>
                
                {plan.highlight && (
                  <motion.span
                    className="absolute -top-2 -right-2 text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: FUND_THEME.primary, color: '#000' }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    HOT
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      
      {/* Animated Bottom Border */}
      <motion.div 
        className="h-1"
        style={{
          background: `linear-gradient(90deg, transparent, ${FUND_THEME.primary}, ${FUND_THEME.accent}, ${FUND_THEME.secondary}, transparent)`
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  );
}
