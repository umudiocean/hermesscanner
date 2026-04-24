'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// EmptyState — placeholder for zero-data, no-results, errors
// ═══════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  variant?: 'default' | 'subtle' | 'error'
  className?: string
}

const variants = {
  default: 'border-stroke',
  subtle:  'border-stroke-subtle',
  error:   'border-danger-400/30 bg-danger-400/5',
} as const

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-12 px-6 rounded-xl border border-dashed',
        variants[variant],
        className,
      )}
    >
      {icon && (
        <div className={cn(
          'mb-4 w-12 h-12 rounded-2xl flex items-center justify-center',
          variant === 'error' ? 'bg-danger-400/15 text-danger-400' : 'bg-surface-3 text-text-tertiary',
        )}>
          {icon}
        </div>
      )}
      <h4 className="text-md font-semibold text-text-primary tracking-tight">
        {title}
      </h4>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-text-tertiary leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
