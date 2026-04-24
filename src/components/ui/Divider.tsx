'use client'

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Divider — horizontal/vertical separator (subtle / strong / gold)
// ═══════════════════════════════════════════════════════════════════

interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  tone?: 'subtle' | 'default' | 'strong' | 'gold'
}

const tones = {
  subtle:  'bg-stroke-subtle',
  default: 'bg-stroke',
  strong:  'bg-stroke-strong',
  gold:    'bg-gradient-to-r from-transparent via-gold-400/40 to-transparent',
} as const

export function Divider({
  orientation = 'horizontal',
  tone = 'default',
  className,
  ...rest
}: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        tones[tone],
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full self-stretch',
        className,
      )}
      {...rest}
    />
  )
}
