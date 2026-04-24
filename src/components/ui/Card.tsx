'use client'

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Card / Panel — surface primitive
// Variants: solid, glass, outlined, ghost
// ═══════════════════════════════════════════════════════════════════

type Variant = 'solid' | 'glass' | 'outlined' | 'ghost'
type Padding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
  interactive?: boolean
  glowOnHover?: boolean
}

const variants: Record<Variant, string> = {
  solid:
    'bg-surface-2 border border-stroke shadow-depth-1',
  glass:
    'bg-surface-2/70 backdrop-blur-xl border border-stroke shadow-glass',
  outlined:
    'bg-transparent border border-stroke',
  ghost:
    'bg-surface-1 border border-stroke-subtle',
}

const paddings: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'solid', padding = 'md', interactive, glowOnHover, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl transition-all duration-250 ease-snap',
        variants[variant],
        paddings[padding],
        interactive && 'cursor-pointer hover:bg-surface-3 hover:border-stroke-strong hover:-translate-y-px hover:shadow-depth-2',
        glowOnHover && 'hover:shadow-glow-gold',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
})

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-3', className)}>
      <div className="min-w-0">
        <h3 className="text-md font-semibold text-text-primary tracking-tight truncate">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-text-tertiary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
