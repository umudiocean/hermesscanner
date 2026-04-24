// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Design Token Export
// Programmatic access to the design system. Mirrors tailwind.config.ts
// and globals.css :root. Use these for runtime calculations (charts,
// canvas, framer-motion variants, theme switching).
// ═══════════════════════════════════════════════════════════════════

export const colors = {
  surface: {
    0: '#08090B',
    1: '#0D0E11',
    2: '#121317',
    3: '#1A1B20',
    4: '#23252C',
    5: '#2D2F37',
  },
  text: {
    primary:    '#F2F0EA',
    secondary:  '#B6B2A8',
    tertiary:   '#7C7B73',
    quaternary: '#56554F',
    inverse:    '#08090B',
  },
  gold: {
    50:  '#FBF6E6',
    100: '#F4E9C2',
    200: '#E9D798',
    300: '#DCC273',
    400: '#D4B86A',
    500: '#B89A4F',
    600: '#8E7536',
    700: '#6A5828',
    800: '#473B1B',
    900: '#291F0E',
  },
  success: {
    400: '#3FCAB4',
    500: '#2BA896',
    600: '#1F8475',
  },
  danger: {
    400: '#F04848',
    500: '#D62F2F',
    600: '#A92020',
  },
  warning: { 400: '#F5A524', 500: '#D68A1A' },
  info:    { 400: '#3B82F6', 500: '#2563EB' },
  stroke: {
    subtle:       'rgba(255,255,255,0.06)',
    DEFAULT:      'rgba(255,255,255,0.10)',
    strong:       'rgba(255,255,255,0.16)',
    gold:         'rgba(212,184,106,0.22)',
    'gold-strong':'rgba(212,184,106,0.40)',
  },
} as const

export const radius = {
  sm: 4,
  md: 8,
  lg: 10,
  xl: 14,
  '2xl': 18,
  '3xl': 24,
  full: 9999,
} as const

export const spacing = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16,
  4.5: 18, 5: 20, 5.5: 22, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64,
} as const

export const easing = {
  snap:    [0.32, 0.72, 0, 1] as const,
  smooth:  [0.4, 0, 0.2, 1] as const,
  spring:  [0.34, 1.56, 0.64, 1] as const,
  outExpo: [0.16, 1, 0.3, 1] as const,
}

export const duration = {
  instant: 0,
  fast:    150,
  base:    250,
  slow:    400,
  slower:  600,
} as const

export const fontFamily = {
  sans:    'var(--font-sans), Inter, sans-serif',
  mono:    'var(--font-mono), "JetBrains Mono", monospace',
  display: 'var(--font-sans), Inter, sans-serif',
} as const

// ─── Semantic helpers ─────────────────────────────────────────────
export const signal = {
  long:    colors.success[400],
  short:   colors.danger[400],
  neutral: colors.text.tertiary,
  premium: colors.gold[400],
} as const

export const chart = {
  bullish: colors.success[400],
  bearish: colors.danger[400],
  neutral: colors.text.tertiary,
  grid:    colors.stroke.subtle,
  axis:    colors.text.quaternary,
  vwap:    colors.gold[400],
  volume:  'rgba(212,184,106,0.18)',
} as const
