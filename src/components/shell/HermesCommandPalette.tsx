'use client'

import { useMemo } from 'react'
import {
  CommandPalette,
  useCommandPaletteShortcut,
  type CommandItem,
} from '@/components/ui'
import type { ModuleId } from '@/components/Layout'

// ═══════════════════════════════════════════════════════════════════
// HermesCommandPalette — wires the generic palette into NASDAQ context
//   • module switching (5 modules)
//   • symbol search (top 50 from results, expandable)
//   • global actions (refresh, watchlist toggle, scroll-to-top)
// ═══════════════════════════════════════════════════════════════════

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  activeModule: ModuleId
  onModuleChange: (m: ModuleId) => void
  symbols?: string[]                   // top symbols from results
  onSelectSymbol?: (symbol: string) => void
  onRefresh?: () => void
  onScrollTop?: () => void
}

const MODULES: Array<{ id: ModuleId; label: string; description: string; icon: string }> = [
  { id: 'nasdaq-terminal', label: 'NASDAQ Terminal AI', description: 'Hisse derinlik analizi + fundamentals', icon: '🧠' },
  { id: 'nasdaq-trade',    label: 'Trade AI',           description: 'V377_Z144 sinyal motoru',                icon: '📊' },
  { id: 'nasdaq-signals',  label: 'AI Signals',         description: 'Confluence + risk filtresi',             icon: '⚡' },
  { id: 'nasdaq-watchlist',label: 'Watchlist',           description: 'Takip listesi',                          icon: '⭐' },
  { id: 'hermes-index',    label: 'HERMES AI Index',     description: 'Composite market index',                 icon: '💎' },
]

export function HermesCommandPalette({
  open,
  onOpenChange,
  activeModule,
  onModuleChange,
  symbols = [],
  onSelectSymbol,
  onRefresh,
  onScrollTop,
}: Props) {
  useCommandPaletteShortcut(() => onOpenChange(!open))

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []

    // ─── Module switcher ─────────────────────────────────────────
    for (const m of MODULES) {
      if (m.id === activeModule) continue
      items.push({
        id: `module-${m.id}`,
        label: m.label,
        description: m.description,
        group: 'Modül',
        icon: <span className="text-md">{m.icon}</span>,
        keywords: [m.id, 'modül', 'module', 'go to', 'aç'],
        onSelect: () => onModuleChange(m.id),
      })
    }

    // ─── Symbols (top 50) ────────────────────────────────────────
    const topSymbols = symbols.slice(0, 50)
    for (const sym of topSymbols) {
      items.push({
        id: `symbol-${sym}`,
        label: sym,
        description: `${sym} sembolünü aç`,
        group: 'Semboller',
        icon: (
          <span className="font-mono text-2xs font-bold text-gold-400">
            {sym.slice(0, 2)}
          </span>
        ),
        keywords: ['stock', 'hisse', 'symbol'],
        onSelect: () => onSelectSymbol?.(sym),
      })
    }

    // ─── Global actions ──────────────────────────────────────────
    if (onRefresh) {
      items.push({
        id: 'action-refresh',
        label: 'Veriyi Yenile',
        description: 'Tüm sinyalleri ve fiyatları güncelle',
        group: 'Aksiyonlar',
        icon: '↻',
        shortcut: ['R'],
        keywords: ['refresh', 'reload', 'sync'],
        onSelect: onRefresh,
      })
    }
    if (onScrollTop) {
      items.push({
        id: 'action-scroll-top',
        label: 'Başa Dön',
        description: 'Sayfanın en üstüne kaydır',
        group: 'Aksiyonlar',
        icon: '↑',
        keywords: ['top', 'scroll'],
        onSelect: onScrollTop,
      })
    }

    return items
  }, [activeModule, symbols, onModuleChange, onSelectSymbol, onRefresh, onScrollTop])

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      commands={commands}
      placeholder="Sembol, modül veya komut ara…"
    />
  )
}
