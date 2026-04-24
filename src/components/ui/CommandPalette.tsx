'use client'

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { Kbd } from './Kbd'

// ═══════════════════════════════════════════════════════════════════
// CommandPalette (Cmd+K) — Raycast/Linear-style fuzzy search
// Zero-dep, fully accessible, keyboard-driven.
//
// USAGE:
//   const [open, setOpen] = useState(false)
//   useCommandPaletteShortcut(() => setOpen((v) => !v))
//   <CommandPalette open={open} onOpenChange={setOpen} commands={...} />
// ═══════════════════════════════════════════════════════════════════

export interface CommandItem {
  id: string
  label: string
  description?: string
  group?: string
  icon?: ReactNode
  shortcut?: string[]            // ['⌘', 'K']
  keywords?: string[]            // extra search terms
  onSelect: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: CommandItem[]
  placeholder?: string
  emptyMessage?: string
}

// ─── Hook: bind ⌘K / Ctrl+K globally ────────────────────────────────
export function useCommandPaletteShortcut(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
}

// ─── Tiny fuzzy match: every input char appears in order ─────────────
function fuzzyScore(query: string, target: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  // Prefix bonus
  if (t.startsWith(q)) return 100 - (t.length - q.length) * 0.1
  // Substring bonus
  const idx = t.indexOf(q)
  if (idx >= 0) return 50 - idx * 0.5
  // Subsequence
  let qi = 0, score = 0, gap = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { score += 1; qi++; gap = 0 }
    else gap++
  }
  if (qi !== q.length) return 0
  return score - gap * 0.05
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  placeholder = 'Komut, sembol veya modül ara…',
  emptyMessage = 'Sonuç bulunamadı.',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Body scroll lock
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Filter + sort
  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    return commands
      .map((cmd) => {
        const haystacks = [cmd.label, cmd.description ?? '', ...(cmd.keywords ?? [])]
        const score = Math.max(...haystacks.map((h) => fuzzyScore(query, h)))
        return { cmd, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.cmd)
  }, [commands, query])

  // Group items
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const cmd of filtered) {
      const key = cmd.group ?? 'Genel'
      const arr = map.get(key) ?? []
      arr.push(cmd)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [filtered])

  const flatList = filtered

  // Reset active when query changes
  useEffect(() => { setActiveIdx(0) }, [query])

  // Scroll active into view
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIdx}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, flatList.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = flatList[activeIdx]
        if (cmd) {
          cmd.onSelect()
          onOpenChange(false)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
    },
    [flatList, activeIdx, onOpenChange],
  )

  if (!open || typeof window === 'undefined') return null

  let runningIdx = -1

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Komut paleti"
      className="fixed inset-0 z-[2000] flex items-start justify-center pt-[12vh] px-4 animate-fade-in"
    >
      <div
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-surface-0/75 backdrop-blur-md"
      />
      <div
        className={cn(
          'relative w-full max-w-2xl animate-scale-in',
          'bg-surface-2/95 backdrop-blur-2xl',
          'border border-stroke-strong rounded-2xl shadow-depth-4',
          'overflow-hidden',
        )}
      >
        {/* ─── Search input ─── */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-stroke">
          <svg
            className="w-4 h-4 text-text-tertiary shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={cn(
              'flex-1 bg-transparent border-0 outline-none',
              'text-md text-text-primary placeholder:text-text-quaternary',
              'font-sans',
            )}
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd size="sm">Esc</Kbd>
        </div>

        {/* ─── Results list ─── */}
        <div
          ref={listRef}
          role="listbox"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {flatList.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-sm text-text-tertiary">{emptyMessage}</div>
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-2 last:mb-0">
                <div className="px-2.5 pt-2 pb-1 text-2xs font-semibold uppercase tracking-widest text-text-quaternary">
                  {group}
                </div>
                {items.map((cmd) => {
                  runningIdx++
                  const idx = runningIdx
                  const active = idx === activeIdx
                  return (
                    <button
                      key={cmd.id}
                      data-cmd-idx={idx}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => {
                        cmd.onSelect()
                        onOpenChange(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left',
                        'transition-colors duration-100',
                        active
                          ? 'bg-surface-4 text-text-primary'
                          : 'text-text-secondary hover:bg-surface-3',
                      )}
                    >
                      <span
                        className={cn(
                          'w-8 h-8 shrink-0 rounded-md flex items-center justify-center',
                          active ? 'bg-gold-400/15 text-gold-400' : 'bg-surface-3 text-text-tertiary',
                        )}
                      >
                        {cmd.icon ?? cmd.label.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-text-tertiary truncate">{cmd.description}</div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <span className="flex items-center gap-1 shrink-0">
                          {cmd.shortcut.map((k, i) => <Kbd key={i} size="xs">{k}</Kbd>)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* ─── Footer hint ─── */}
        <div className="flex items-center justify-between gap-3 px-4 h-9 border-t border-stroke text-2xs text-text-quaternary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><Kbd size="xs">↑</Kbd><Kbd size="xs">↓</Kbd> gez</span>
            <span className="flex items-center gap-1.5"><Kbd size="xs">↵</Kbd> seç</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-text-tertiary">HERMES</span>
            <span className="opacity-60">command palette</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
