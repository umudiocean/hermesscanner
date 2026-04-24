'use client'

import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Badge — semantic state pills (LONG / SHORT / NEUTRAL / etc.)
// ═══════════════════════════════════════════════════════════════════

type Tone = 'gold' | 'success' | 'danger' | 'warning' | 'info' | 'neutral'
type Size = 'xs' | 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: Size
  dot?: boolean
  pulse?: boolean
  icon?: ReactNode
}

const tones: Record<Tone, string> = {
  gold:    'bg-gold-400/12     text-gold-300    border-gold-400/30',
  success: 'bg-success-400/12  text-success-300 border-success-400/30',
  danger:  'bg-danger-400/12   text-danger-300  border-danger-400/30',
  warning: 'bg-warning-400/12  text-warning-400 border-warning-400/30',
  info:    'bg-info-400/12     text-info-400    border-info-400/30',
  neutral: 'bg-surface-3       text-text-secondary border-stroke',
}

const dotTones: Record<Tone, string> = {
  gold:    'bg-gold-400',
  success: 'bg-success-400',
  danger:  'bg-danger-400',
  warning: 'bg-warning-400',
  info:    'bg-info-400',
  neutral: 'bg-text-tertiary',
}

const sizes: Record<Size, string> = {
  xs: 'h-5  px-1.5 text-2xs gap-1   rounded',
  sm: 'h-6  px-2   text-xs  gap-1.5 rounded-md',
  md: 'h-7  px-2.5 text-sm  gap-1.5 rounded-md',
}

export function Badge({
  tone = 'neutral',
  size = 'sm',
  dot,
  pulse,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border tabular-nums tracking-wide',
        tones[tone],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', dotTones[tone])} />
          )}
          <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', dotTones[tone])} />
        </span>
      )}
      {icon}
      {children}
    </span>
  )
}
