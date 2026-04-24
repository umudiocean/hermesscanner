'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Dropdown — click-trigger menu (closes on outside click + Escape)
// ═══════════════════════════════════════════════════════════════════

interface DropdownItem {
  label: ReactNode
  value?: string
  icon?: ReactNode
  shortcut?: ReactNode
  onClick?: () => void
  href?: string
  destructive?: boolean
  divider?: boolean
  disabled?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
  width?: number | string
  className?: string
}

export function Dropdown({
  trigger,
  items,
  align = 'right',
  width = 220,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((v) => !v)} className="inline-flex">{trigger}</div>
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={cn(
            'absolute mt-1.5 z-50 animate-fade-in-up',
            'bg-surface-3 border border-stroke rounded-lg shadow-depth-3',
            'p-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return <div key={i} role="separator" className="my-1 h-px bg-stroke-subtle" />
            }
            const Comp = item.href ? 'a' : 'button'
            return (
              <Comp
                key={i}
                role="menuitem"
                href={item.href}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return
                  item.onClick?.()
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-md',
                  'transition-colors duration-100',
                  'focus-visible:outline-none focus-visible:bg-surface-4',
                  item.disabled && 'opacity-40 cursor-not-allowed',
                  item.destructive
                    ? 'text-danger-400 hover:bg-danger-400/10'
                    : 'text-text-secondary hover:bg-surface-4 hover:text-text-primary',
                )}
              >
                {item.icon && <span className="shrink-0 w-4 h-4 flex items-center justify-center">{item.icon}</span>}
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.shortcut && <span className="text-xs text-text-quaternary font-mono">{item.shortcut}</span>}
              </Comp>
            )
          })}
        </div>
      )}
    </div>
  )
}
