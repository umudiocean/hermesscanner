'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Dialog — accessible modal (focus trap, esc, backdrop, aria-modal)
// ═══════════════════════════════════════════════════════════════════

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  closeOnBackdrop?: boolean
  ariaLabel?: string
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const

export function Dialog({
  open,
  onClose,
  children,
  size = 'md',
  className,
  closeOnBackdrop = true,
  ariaLabel,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // focus first focusable
    const t = setTimeout(() => {
      const node = ref.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      node?.focus()
    }, 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      clearTimeout(t)
    }
  }, [open, onClose])

  if (!open || typeof window === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 bg-surface-0/70 backdrop-blur-md"
      />
      <div
        ref={ref}
        className={cn(
          'relative w-full animate-scale-in',
          'bg-surface-2 border border-stroke rounded-2xl shadow-depth-4',
          sizes[size],
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
