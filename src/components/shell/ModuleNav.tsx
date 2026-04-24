'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// ModuleNav — premium underline tab bar for top-level modules
// Linear-style: subtle hover, gold underline, animated indicator.
// ═══════════════════════════════════════════════════════════════════

export interface ModuleNavItem<T extends string = string> {
  id: T
  label: string
  shortLabel?: string          // mobile fallback
  icon?: ReactNode
  premium?: boolean
  comingSoon?: boolean
  premiumTooltip?: string
}

interface ModuleNavProps<T extends string = string> {
  items: ModuleNavItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

export function ModuleNav<T extends string = string>({
  items,
  active,
  onChange,
  className,
}: ModuleNavProps<T>) {
  return (
    <nav
      role="tablist"
      aria-label="Modül navigasyonu"
      className={cn(
        'flex items-center gap-0.5 -mb-px overflow-x-auto scrollbar-hide',
        className,
      )}
    >
      {items.map((mod) => {
        const isActive = active === mod.id
        return (
          <button
            key={mod.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => !mod.comingSoon && onChange(mod.id)}
            disabled={mod.comingSoon}
            className={cn(
              'relative inline-flex items-center gap-1.5 shrink-0',
              'h-10 px-3 sm:px-4 text-xs sm:text-sm font-semibold tracking-wide whitespace-nowrap',
              'transition-colors duration-150 ease-snap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 rounded-sm',
              isActive
                ? 'text-gold-400'
                : mod.comingSoon
                  ? 'text-text-quaternary cursor-not-allowed'
                  : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            {mod.icon && <span className="text-base leading-none">{mod.icon}</span>}
            <span className="hidden sm:inline">{mod.label}</span>
            {mod.shortLabel && <span className="sm:hidden">{mod.shortLabel}</span>}

            {mod.premium && (
              <span
                title={mod.premiumTooltip}
                className={cn(
                  'ml-1 px-1.5 h-4 rounded-full text-[8px] font-bold tracking-wider',
                  'bg-gold-400/15 text-gold-300 border border-gold-400/30',
                  'flex items-center',
                )}
              >
                PREMIUM
              </span>
            )}
            {mod.comingSoon && (
              <span className="ml-1 px-1.5 h-4 rounded-full text-[8px] font-bold tracking-wider bg-surface-3 text-text-quaternary border border-stroke flex items-center">
                SOON
              </span>
            )}

            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-gold-400/60 via-gold-300 to-gold-400/60" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
