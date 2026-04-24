'use client'

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Kbd — keyboard shortcut chip (e.g. ⌘K, Esc)
// ═══════════════════════════════════════════════════════════════════

interface KbdProps extends HTMLAttributes<HTMLElement> {
  size?: 'xs' | 'sm' | 'md'
}

const sizes = {
  xs: 'h-4   min-w-[16px] px-1   text-[10px]',
  sm: 'h-5   min-w-[20px] px-1.5 text-[11px]',
  md: 'h-6   min-w-[24px] px-2   text-xs',
} as const

export function Kbd({ size = 'sm', className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center font-mono font-medium',
        'bg-surface-3 text-text-secondary border border-stroke rounded',
        'shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]',
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  )
}
