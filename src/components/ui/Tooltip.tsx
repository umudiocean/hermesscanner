'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Tooltip — zero-dep floating tooltip (top/bottom/left/right)
// 200ms delay, arrow, follows trigger via fixed positioning.
// ═══════════════════════════════════════════════════════════════════

type Side = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  side?: Side
  delay?: number
  children: ReactNode
  className?: string
}

export function Tooltip({
  content,
  side = 'top',
  delay = 200,
  children,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      let x = 0, y = 0
      switch (side) {
        case 'top':    x = r.left + r.width / 2; y = r.top - 8; break
        case 'bottom': x = r.left + r.width / 2; y = r.bottom + 8; break
        case 'left':   x = r.left - 8; y = r.top + r.height / 2; break
        case 'right':  x = r.right + 8; y = r.top + r.height / 2; break
      }
      setCoords({ x, y })
      setOpen(true)
    }, delay)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const transform =
    side === 'top'    ? 'translate(-50%, -100%)' :
    side === 'bottom' ? 'translate(-50%, 0)'     :
    side === 'left'   ? 'translate(-100%, -50%)' :
                        'translate(0, -50%)'

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>
      {open && (
        <div
          role="tooltip"
          style={{ position: 'fixed', left: coords.x, top: coords.y, transform, zIndex: 9999 }}
          className={cn(
            'pointer-events-none animate-fade-in',
            'px-2.5 py-1.5 rounded-md',
            'bg-surface-4 text-text-primary text-xs font-medium',
            'border border-stroke-strong shadow-depth-3',
            'whitespace-nowrap max-w-xs',
            className,
          )}
        >
          {content}
        </div>
      )}
    </>
  )
}
