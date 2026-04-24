'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI TERMINAL - Score Gauge Component
// Büyük dairesel skor göstergesi + count-up animasyon + glow efekti
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { FMPScore, getScoreColor, getScoreGradient, getScoreGlow, SCORE_LABELS } from '@/lib/fmp-terminal/fmp-types'

interface ScoreGaugeProps {
  score: FMPScore | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  animate?: boolean
}

export default function ScoreGauge({ score, size = 'lg', showLabel = true, animate = true }: ScoreGaugeProps) {
  const [displayValue, setDisplayValue] = useState(0)

  const total = score?.total ?? 0
  const level = score?.level ?? 'NEUTRAL'

  // Count-up animasyonu
  useEffect(() => {
    if (!animate) {
      setDisplayValue(total)
      return
    }
    setDisplayValue(0)
    const duration = 1200
    const steps = 40
    const increment = total / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= total) {
        setDisplayValue(total)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.round(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [total, animate])

  // Boyutlar
  const dims = {
    sm: { size: 80, stroke: 4, textSize: 'text-xl', labelSize: 'text-[9px]', radius: 34 },
    md: { size: 120, stroke: 5, textSize: 'text-3xl', labelSize: 'text-[10px]', radius: 52 },
    lg: { size: 160, stroke: 6, textSize: 'text-4xl', labelSize: 'text-xs', radius: 70 },
  }
  const d = dims[size]
  const circumference = 2 * Math.PI * d.radius
  const progress = (displayValue / 100) * circumference

  // Renk
  const colorClass = getScoreColor(level)
  const gradient = getScoreGradient(level)
  const glow = getScoreGlow(level)

  // SVG renk (tailwind class'larını SVG'de kullanamayız, direkt renk)
  const svgColors: Record<string, { stroke: string; glow: string }> = {
    STRONG: { stroke: '#facc15', glow: 'rgba(250,204,21,0.3)' },
    GOOD: { stroke: '#62cbc1', glow: 'rgba(52,211,153,0.3)' },
    NEUTRAL: { stroke: '#94a3b8', glow: 'rgba(148,163,184,0.15)' },
    WEAK: { stroke: '#fb923c', glow: 'rgba(251,146,60,0.3)' },
    BAD: { stroke: '#f87171', glow: 'rgba(248,113,113,0.3)' },
  }
  const colors = svgColors[level] || svgColors.NEUTRAL

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative shadow-lg ${glow}`} style={{ width: d.size, height: d.size }}>
        <svg width={d.size} height={d.size} viewBox={`0 0 ${d.size} ${d.size}`} className="w-full h-full -rotate-90">
          {/* Background track */}
          <circle
            cx={d.size / 2}
            cy={d.size / 2}
            r={d.radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={d.stroke}
          />
          {/* Progress arc */}
          <circle
            cx={d.size / 2}
            cy={d.size / 2}
            r={d.radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={d.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${colors.glow})`,
              transition: animate ? 'stroke-dashoffset 1.2s ease-out' : 'none',
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${d.textSize} font-bold tabular-nums ${colorClass}`}>
            {displayValue}
          </span>
          {score?.gated && (
            <span className="text-[8px] text-red-400 font-medium">GATE</span>
          )}
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
          level === 'STRONG' ? 'bg-yellow-500/15 border-yellow-500/30' :
          level === 'GOOD' ? 'bg-success-400/15 border-success-400/30' :
          level === 'NEUTRAL' ? 'bg-slate-500/15 border-slate-500/30' :
          level === 'WEAK' ? 'bg-orange-500/15 border-orange-500/30' :
          'bg-red-500/15 border-red-500/30'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            level === 'STRONG' ? 'bg-yellow-400' :
            level === 'GOOD' ? 'bg-success-400' :
            level === 'NEUTRAL' ? 'bg-slate-400' :
            level === 'WEAK' ? 'bg-orange-400' :
            'bg-red-400'
          }`} />
          <span className={`${d.labelSize} font-semibold tracking-wider ${colorClass}`}>
            {SCORE_LABELS[level]}
          </span>
        </div>
      )}

      {/* Confidence */}
      {score && score.confidence < 80 && (
        <span className="text-[9px] text-text-tertiary">
          Veri: %{score.confidence}
        </span>
      )}
    </div>
  )
}
