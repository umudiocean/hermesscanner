'use client'

import { createContext, useContext, useId, useRef, type ReactNode, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Tabs — semantic, ARIA-compliant, animated underline
// Variants: pills | underline | segmented
// Composition: <Tabs.Root> <Tabs.List> <Tabs.Trigger> <Tabs.Content>
// ═══════════════════════════════════════════════════════════════════

type Variant = 'pills' | 'underline' | 'segmented'

interface TabsContextValue {
  value: string
  onChange: (v: string) => void
  variant: Variant
  baseId: string
}

const TabsCtx = createContext<TabsContextValue | null>(null)

function useTabs(): TabsContextValue {
  const ctx = useContext(TabsCtx)
  if (!ctx) throw new Error('Tabs subcomponents must be rendered inside <Tabs.Root>')
  return ctx
}

function Root({
  value,
  onChange,
  variant = 'pills',
  className,
  children,
}: {
  value: string
  onChange: (v: string) => void
  variant?: Variant
  className?: string
  children: ReactNode
}) {
  const baseId = useId()
  return (
    <TabsCtx.Provider value={{ value, onChange, variant, baseId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsCtx.Provider>
  )
}

function List({
  className,
  children,
  ariaLabel,
}: {
  className?: string
  children: ReactNode
  ariaLabel?: string
}) {
  const { variant } = useTabs()
  const listRef = useRef<HTMLDivElement>(null)

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    const idx = tabs.findIndex((t) => t === document.activeElement)
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    if (e.key === 'ArrowLeft')  next = (idx - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End')  next = tabs.length - 1
    tabs[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKey}
      className={cn(
        'flex items-center',
        variant === 'pills'      && 'gap-1 p-1 bg-surface-2 border border-stroke rounded-lg',
        variant === 'underline'  && 'gap-1 border-b border-stroke',
        variant === 'segmented'  && 'p-0.5 bg-surface-2 border border-stroke rounded-lg',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Trigger({
  value: tabValue,
  className,
  children,
  icon,
}: {
  value: string
  className?: string
  children: ReactNode
  icon?: ReactNode
}) {
  const { value, onChange, variant, baseId } = useTabs()
  const active = value === tabValue
  return (
    <button
      role="tab"
      type="button"
      id={`${baseId}-trigger-${tabValue}`}
      aria-selected={active}
      aria-controls={`${baseId}-panel-${tabValue}`}
      tabIndex={active ? 0 : -1}
      onClick={() => onChange(tabValue)}
      className={cn(
        'inline-flex items-center gap-2 font-medium transition-all duration-150 ease-snap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',

        variant === 'pills' && [
          'h-8 px-3 text-sm rounded-md',
          active ? 'bg-surface-4 text-text-primary shadow-depth-1' : 'text-text-secondary hover:text-text-primary hover:bg-surface-3',
        ],
        variant === 'underline' && [
          'h-9 px-3 text-sm relative -mb-px',
          active ? 'text-gold-400 border-b-2 border-gold-400' : 'text-text-secondary border-b-2 border-transparent hover:text-text-primary hover:border-stroke-strong',
        ],
        variant === 'segmented' && [
          'flex-1 h-7 px-3 text-xs rounded-md',
          active ? 'bg-surface-4 text-text-primary shadow-depth-1' : 'text-text-secondary hover:text-text-primary',
        ],

        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function Content({
  value: tabValue,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  const { value, baseId } = useTabs()
  if (value !== tabValue) return null
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${tabValue}`}
      aria-labelledby={`${baseId}-trigger-${tabValue}`}
      tabIndex={0}
      className={cn('mt-4 animate-fade-in-up focus:outline-none', className)}
    >
      {children}
    </div>
  )
}

export const Tabs = { Root, List, Trigger, Content }
