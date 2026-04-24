'use client'

import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// HermesLogo — neural network mark with subtle inner highlight
// ═══════════════════════════════════════════════════════════════════

export function HermesLogo({
  size = 36,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative rounded-xl flex items-center justify-center overflow-hidden shrink-0',
        'bg-gradient-to-br from-surface-3 to-surface-2',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(255,255,255,0.06)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 32 32"
        fill="none"
        className="relative z-10"
        aria-hidden="true"
      >
        <line x1="6" y1="10" x2="16" y2="7" stroke="rgba(212,184,106,0.3)" strokeWidth="0.8" />
        <line x1="16" y1="7" x2="26" y2="12" stroke="rgba(212,184,106,0.3)" strokeWidth="0.8" />
        <line x1="6" y1="10" x2="10" y2="18" stroke="rgba(212,184,106,0.22)" strokeWidth="0.7" />
        <line x1="16" y1="7" x2="10" y2="18" stroke="rgba(212,184,106,0.22)" strokeWidth="0.7" />
        <line x1="16" y1="7" x2="22" y2="16" stroke="rgba(212,184,106,0.22)" strokeWidth="0.7" />
        <line x1="26" y1="12" x2="22" y2="16" stroke="rgba(212,184,106,0.22)" strokeWidth="0.7" />
        <line x1="10" y1="18" x2="22" y2="16" stroke="rgba(212,184,106,0.16)" strokeWidth="0.6" />
        <path
          d="M4 22 L8.5 17 L13 19.5 L18 13 L22.5 16 L28 10"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6"  cy="10" r="1.8" fill="rgba(212,184,106,0.55)" />
        <circle cx="16" cy="7"  r="2.2" fill="rgba(212,184,106,0.65)" />
        <circle cx="26" cy="12" r="1.8" fill="rgba(212,184,106,0.55)" />
        <circle cx="10" cy="18" r="1.5" fill="rgba(212,184,106,0.40)" />
        <circle cx="22" cy="16" r="1.5" fill="rgba(212,184,106,0.40)" />
        <circle cx="13" cy="19.5" r="1.4" fill="rgba(255,255,255,0.85)" />
        <circle cx="18" cy="13"   r="1.6" fill="rgba(255,255,255,0.92)" />
        <circle cx="28" cy="10"   r="1.4" fill="rgba(255,255,255,0.85)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-gold-400/[0.06] via-transparent to-transparent" />
    </div>
  )
}
