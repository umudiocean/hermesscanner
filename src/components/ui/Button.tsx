'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Button — premium primitive (5 variants × 4 sizes)
// ═══════════════════════════════════════════════════════════════════

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center font-medium select-none ' +
  'transition-all duration-150 ease-snap ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 ' +
  'active:scale-[0.98]'

const variants: Record<Variant, string> = {
  primary:
    'bg-gold-400 text-surface-0 hover:bg-gold-300 hover:shadow-glow-gold ' +
    'shadow-depth-1 hover:shadow-depth-2',
  secondary:
    'bg-surface-3 text-text-primary border border-stroke hover:bg-surface-4 hover:border-stroke-strong',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-3 hover:text-text-primary',
  danger:
    'bg-danger-400 text-white hover:bg-danger-500 shadow-depth-1 hover:shadow-glow-danger',
  success:
    'bg-success-400 text-surface-0 hover:bg-success-500 shadow-depth-1 hover:shadow-glow-success',
}

const sizes: Record<Size, string> = {
  xs: 'h-7  px-2.5 text-xs    rounded-md  gap-1.5',
  sm: 'h-8  px-3   text-sm    rounded-md  gap-2',
  md: 'h-9  px-4   text-sm    rounded-lg  gap-2',
  lg: 'h-11 px-5   text-md    rounded-lg  gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    leftIcon,
    rightIcon,
    fullWidth,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
          <path
            fill="currentColor"
            d="M12 3a9 9 0 0 1 9 9h-2.5a6.5 6.5 0 0 0-6.5-6.5V3z"
          />
        </svg>
      )}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})
