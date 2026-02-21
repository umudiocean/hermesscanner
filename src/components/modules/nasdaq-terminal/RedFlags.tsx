'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Red Flag Alert System
// Otomatik uyarı banner'ları (3/5 AI konsensüsü)
// ═══════════════════════════════════════════════════════════════════

import { RedFlag } from '@/lib/fmp-terminal/fmp-types'

interface RedFlagsProps {
  flags: RedFlag[]
  compact?: boolean
}

export default function RedFlags({ flags, compact = false }: RedFlagsProps) {
  if (flags.length === 0) return null

  const critical = flags.filter(f => f.severity === 'critical')
  const warnings = flags.filter(f => f.severity === 'warning')

  return (
    <div className="space-y-1.5">
      {critical.length > 0 && (
        <div className={`${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'} rounded-lg bg-red-500/10 border border-red-500/20`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 text-sm">⚠</span>
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
              Kritik Uyarı
            </span>
          </div>
          <div className="space-y-1">
            {critical.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-red-400/60 text-[10px] mt-0.5">●</span>
                <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-red-300/90`}>
                  {flag.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className={`${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'} rounded-lg bg-orange-500/10 border border-orange-500/20`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-orange-400 text-sm">⚡</span>
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
              Dikkat
            </span>
          </div>
          <div className="space-y-1">
            {warnings.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-orange-400/60 text-[10px] mt-0.5">●</span>
                <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-orange-300/90`}>
                  {flag.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inline version (tek satır) ────────────────────────────────────

export function RedFlagBadge({ flags }: { flags: RedFlag[] }) {
  if (flags.length === 0) return null

  const critical = flags.filter(f => f.severity === 'critical').length
  const warnings = flags.filter(f => f.severity === 'warning').length

  if (critical > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">
        ⚠ {critical}
      </span>
    )
  }

  if (warnings > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
        ⚡ {warnings}
      </span>
    )
  }

  return null
}
