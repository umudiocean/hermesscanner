'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - DNA Barcode Component
// V5: 8 kategori horizontal bar chart (Smart Money merged)
// ═══════════════════════════════════════════════════════════════════

import { FMPScoreBreakdown, FMP_SCORE_WEIGHTS, CATEGORY_LABELS, getScoreLevel, getScoreColor } from '@/lib/fmp-terminal/fmp-types'

interface DNABarcodeProps {
  categories: FMPScoreBreakdown
  compact?: boolean
}

const CATEGORY_ORDER: (keyof FMPScoreBreakdown)[] = [
  'valuation', 'health', 'growth',
  'analyst', 'quality', 'momentum',
  'sector', 'smartMoney',
]

export default function DNABarcode({ categories, compact = false }: DNABarcodeProps) {
  return (
    <div className={`space-y-${compact ? '1' : '1.5'} w-full`}>
      {[...CATEGORY_ORDER].sort((a, b) => (categories[b] ?? 0) - (categories[a] ?? 0)).map(key => {
        const value = categories[key]
        const weight = FMP_SCORE_WEIGHTS[key]
        const level = getScoreLevel(value)
        const colorClass = getScoreColor(level)

        // Bar rengi
        const barColor =
          level === 'STRONG' ? 'bg-yellow-400' :
          level === 'GOOD' ? 'bg-success-400' :
          level === 'NEUTRAL' ? 'bg-slate-400' :
          level === 'WEAK' ? 'bg-orange-400' :
          'bg-red-400'

        // Bar glow
        const barGlow =
          level === 'STRONG' ? 'shadow-yellow-400/30' :
          level === 'GOOD' ? 'shadow-success-400/30' :
          level === 'NEUTRAL' ? '' :
          level === 'WEAK' ? 'shadow-orange-400/30' :
          'shadow-red-400/30'

        return (
          <div key={key} className="flex items-center gap-2">
            {/* Label */}
            <div className={`${compact ? 'w-16 text-[9px]' : 'w-24 text-[10px]'} text-text-tertiary truncate`}>
              {CATEGORY_LABELS[key]}
            </div>

            {/* Bar */}
            <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor} ${barGlow} shadow-sm transition-all duration-700 ease-out`}
                style={{ width: `${Math.max(2, value)}%` }}
              />
            </div>

            {/* Value */}
            <div className={`${compact ? 'w-6 text-[9px]' : 'w-8 text-[10px]'} text-right tabular-nums font-medium ${colorClass}`}>
              {value}
            </div>

            {/* Weight */}
            {!compact && (
              <div className="w-8 text-[8px] text-text-tertiary text-right">
                {Math.round(weight * 100)}%
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini Version (tablo satırında kullanım) ───────────────────────

export function DNABarcodeMini({ categories }: { categories: FMPScoreBreakdown }) {
  return (
    <div className="flex items-center gap-[2px] h-3">
      {[...CATEGORY_ORDER].sort((a, b) => (categories[b] ?? 0) - (categories[a] ?? 0)).map(key => {
        const value = categories[key]
        const level = getScoreLevel(value)

        const color =
          level === 'STRONG' ? 'bg-yellow-400' :
          level === 'GOOD' ? 'bg-success-400' :
          level === 'NEUTRAL' ? 'bg-slate-500' :
          level === 'WEAK' ? 'bg-orange-400' :
          'bg-red-400'

        return (
          <div
            key={key}
            className={`w-1.5 rounded-sm ${color}`}
            style={{ height: `${Math.max(15, value)}%` }}
            title={`${CATEGORY_LABELS[key]}: ${value}`}
          />
        )
      })}
    </div>
  )
}
