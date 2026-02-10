'use client'

// ═══════════════════════════════════════════════════════════════════
// PLACEHOLDER Module - Henüz tamamlanmamış modüller için
// ═══════════════════════════════════════════════════════════════════

interface ModulePlaceholderProps {
  title: string
  icon: string
  description: string
  features: string[]
}

export default function ModulePlaceholder({ title, icon, description, features }: ModulePlaceholderProps) {
  return (
    <div className="max-w-[1920px] mx-auto px-6 py-4">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        {/* Icon */}
        <div className="text-6xl mb-6 animate-pulse">{icon}</div>
        
        {/* Title */}
        <h2 className="text-3xl font-bold text-white mb-3">{title}</h2>
        
        {/* Description */}
        <p className="text-white/50 max-w-lg mb-8">{description}</p>
        
        {/* Coming Soon Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/20 border border-violet-500/30 mb-8">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-sm text-violet-300">Yakında Geliyor</span>
        </div>
        
        {/* Planned Features */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 max-w-md w-full">
          <h3 className="text-sm font-semibold text-white/70 mb-4 uppercase tracking-wider">Planlanan Özellikler</h3>
          <ul className="space-y-3 text-left">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-white/60">
                <span className="text-violet-400 mt-0.5">→</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Pre-configured Placeholders
// ═══════════════════════════════════════════════════════════════════

export function Module200Day() {
  return (
    <ModulePlaceholder
      title="200 GÜN"
      icon="📈"
      description="200 günlük VWAP analizi ile daha kısa vadeli fırsatları tespit edin."
      features={[
        '200 günlük VWAP hesaplaması',
        'Daha kısa vadeli sinyal üretimi',
        '200 hafta ile karşılaştırmalı analiz',
        'Swing trade fırsatları',
      ]}
    />
  )
}

export function ModuleBestSignals() {
  return (
    <ModulePlaceholder
      title="BEST SIGNALS"
      icon="⚡"
      description="En güçlü ve en güvenilir sinyalleri tek bir yerde görün."
      features={[
        'Tüm modüllerden en iyi sinyaller',
        'Çoklu onay sistemi',
        'Risk/Ödül oranları',
        'Geçmiş başarı oranları',
      ]}
    />
  )
}

export function ModuleTrend() {
  return (
    <ModulePlaceholder
      title="TREND"
      icon="📉"
      description="Piyasa trendlerini ve momentumu analiz edin."
      features={[
        'Trend güç göstergeleri',
        'Momentum analizi',
        'Sektör trendleri',
        'Market breadth verileri',
      ]}
    />
  )
}

export function ModuleBacktest() {
  return (
    <ModulePlaceholder
      title="BACKTEST"
      icon="🔬"
      description="Geçmiş sinyallerin performansını analiz edin."
      features={[
        'Tarihsel sinyal performansı',
        'Win rate ve profit factor',
        'Drawdown analizi',
        'Strateji optimizasyonu',
      ]}
    />
  )
}
