'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Sheet / Drawer — slide-in panel (right/left/bottom)
// Mobile-first detail view, command results, filters.
// ═══════════════════════════════════════════════════════════════════

type Side = 'right' | 'left' | 'bottom'

interface SheetProps {
  open: boolean
  onClose: () => void
  side?: Side
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: ReactNode
  className?: string
  ariaLabel?: string
}

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
} as const

const heights = {
  sm: 'max-h-[40vh]',
  md: 'max-h-[60vh]',
  lg: 'max-h-[80vh]',
  xl: 'max-h-[90vh]',
  full: 'max-h-screen',
} as const

export function Sheet({
  open,
  onClose,
  side = 'right',
  size = 'md',
  children,
  className,
  ariaLabel,
}: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || typeof window === 'undefined') return null

  const slide =
    side === 'right'  ? 'right-0 top-0 bottom-0 w-full animate-slide-in-right ' + widths[size] :
    side === 'left'   ? 'left-0 top-0 bottom-0 w-full ' + widths[size] :
                        'left-0 right-0 bottom-0 w-full ' + heights[size]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[1000] animate-fade-in"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-surface-0/70 backdrop-blur-md"
      />
      <div
        className={cn(
          'absolute',
          slide,
          'bg-surface-2 border-stroke shadow-depth-4 overflow-y-auto',
          side === 'right'  && 'border-l rounded-l-2xl',
          side === 'left'   && 'border-r rounded-r-2xl',
          side === 'bottom' && 'border-t rounded-t-2xl',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
