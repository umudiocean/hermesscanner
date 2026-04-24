import type { Config } from 'tailwindcss'

// ═══════════════════════════════════════════════════════════════════
// HERMES AI — Premium Design Token System
// Inspired by: Linear, Vercel Dashboard, Stripe, Bloomberg Terminal
// Backward-compatible: legacy `midnight.*` keys preserved.
// ═══════════════════════════════════════════════════════════════════

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      xs: '375px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },
    extend: {
      // ─── TYPOGRAPHY ───────────────────────────────────────────────
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        display: ['var(--font-sans)', 'Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        'xs':  ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'sm':  ['12px', { lineHeight: '18px' }],
        'base':['13px', { lineHeight: '20px' }],
        'md':  ['14px', { lineHeight: '22px' }],
        'lg':  ['16px', { lineHeight: '24px' }],
        'xl':  ['18px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '2xl': ['22px', { lineHeight: '30px', letterSpacing: '-0.015em' }],
        '3xl': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        '4xl': ['36px', { lineHeight: '44px', letterSpacing: '-0.025em' }],
        '5xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.03em' }],
        '6xl': ['64px', { lineHeight: '72px', letterSpacing: '-0.035em' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.025em',
        tight: '-0.015em',
        normal: '0',
        wide: '0.01em',
        wider: '0.04em',
        widest: '0.12em',
      },

      // ─── COLOR SYSTEM ─────────────────────────────────────────────
      colors: {
        // Surface ladder — true black with subtle blue undertone (Linear/Vercel)
        surface: {
          0: '#08090B',   // canvas (deepest)
          1: '#0D0E11',   // raised section (header/sidebar)
          2: '#121317',   // card / panel
          3: '#1A1B20',   // hover / elevated
          4: '#23252C',   // input / field
          5: '#2D2F37',   // borders strong / dividers
        },
        // Strokes (semantic borders)
        stroke: {
          subtle: 'rgba(255,255,255,0.06)',
          DEFAULT: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.16)',
          gold: 'rgba(212,184,106,0.22)',
          'gold-strong': 'rgba(212,184,106,0.40)',
          success: 'rgba(63,202,180,0.28)',
          danger: 'rgba(240,72,72,0.30)',
        },
        // Text scale — WCAG AA compliant on surface-0
        text: {
          primary:    '#F2F0EA', // 14.8:1 ✓
          secondary:  '#B6B2A8', //  8.2:1 ✓
          tertiary:   '#7C7B73', //  4.6:1 ✓
          quaternary: '#56554F', //  2.7   (disabled / placeholder)
          inverse:    '#08090B',
        },
        // Gold — WCAG AA recalibrated (D4B86A → 5.8:1 on surface-0)
        gold: {
          DEFAULT: '#D4B86A',
          50:  '#FBF6E6',
          100: '#F4E9C2',
          200: '#E9D798',
          300: '#DCC273',
          400: '#D4B86A', // ← primary (was #B3945B)
          500: '#B89A4F',
          600: '#8E7536',
          700: '#6A5828',
          800: '#473B1B',
          900: '#291F0E',
        },
        // Semantic states
        success: {
          DEFAULT: '#3FCAB4',
          50:  '#E8FBF7',
          100: '#C4F4EB',
          200: '#8EE8DA',
          300: '#5AD9C5',
          400: '#3FCAB4',
          500: '#2BA896',
          600: '#1F8475',
          700: '#155F54',
          800: '#0D3D36',
          900: '#06201C',
        },
        danger: {
          DEFAULT: '#F04848',
          50:  '#FEECEC',
          100: '#FDC9C9',
          200: '#FA9999',
          300: '#F56868',
          400: '#F04848',
          500: '#D62F2F',
          600: '#A92020',
          700: '#7A1717',
          800: '#4F0F0F',
          900: '#2A0707',
        },
        warning: {
          DEFAULT: '#F5A524',
          400: '#F5A524',
          500: '#D68A1A',
        },
        info: {
          DEFAULT: '#3B82F6',
          400: '#3B82F6',
          500: '#2563EB',
        },

        // ─── LEGACY ALIASES (backward compatibility) ───────────────
        midnight: {
          DEFAULT: '#1A1A1A',
          50: '#2a2a2a',
          100: '#242424',
          200: '#1f1f1f',
          300: '#1A1A1A',
          400: '#151515',
          500: '#111111',
          600: '#0d0d0d',
          700: '#0a0a0a',
          800: '#070707',
          900: '#040404',
        },
        hermes: {
          green: '#3FCAB4',
          red: '#F04848',
          orange: '#F97316',
          gold: '#D4B86A',
        },
      },

      // ─── RADIUS ───────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
        full: '9999px',
      },

      // ─── SHADOW DEPTH SYSTEM ──────────────────────────────────────
      boxShadow: {
        'depth-1': '0 1px 2px rgba(0,0,0,0.30), 0 1px 1px rgba(0,0,0,0.20)',
        'depth-2': '0 4px 12px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.20)',
        'depth-3': '0 10px 28px rgba(0,0,0,0.50), 0 4px 8px rgba(0,0,0,0.25)',
        'depth-4': '0 24px 60px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.28)',
        'glass':    '0 8px 32px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(255,255,255,0.04)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.09), 0 0 0 1px rgba(255,255,255,0.05)',
        'glow-gold':    '0 0 0 1px rgba(212,184,106,0.20), 0 0 24px rgba(212,184,106,0.18)',
        'glow-success': '0 0 0 1px rgba(63,202,180,0.22), 0 0 24px rgba(63,202,180,0.18)',
        'glow-danger':  '0 0 0 1px rgba(240,72,72,0.24), 0 0 24px rgba(240,72,72,0.18)',
        'focus-gold': '0 0 0 2px #08090B, 0 0 0 4px rgba(212,184,106,0.55)',
        'focus-info': '0 0 0 2px #08090B, 0 0 0 4px rgba(59,130,246,0.55)',
        'inset-pressed': 'inset 0 2px 4px rgba(0,0,0,0.40)',
      },

      // ─── SPACING (4-base + extras) ────────────────────────────────
      spacing: {
        '0.5': '2px',
        '1.5': '6px',
        '2.5': '10px',
        '3.5': '14px',
        '4.5': '18px',
        '5.5': '22px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      padding: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },

      // ─── ANIMATION (3-easing, 3-duration discipline) ──────────────
      transitionTimingFunction: {
        'snap': 'cubic-bezier(0.32, 0.72, 0, 1)',          // primary — Linear-style
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',          // material standard
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '0': '0ms',
        '150': '150ms',
        '250': '250ms',
        '400': '400ms',
        '600': '600ms',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'shimmer-skeleton': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up':     'fade-in-up 250ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'fade-in':        'fade-in 200ms ease-out both',
        'scale-in':       'scale-in 200ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'slide-in-right': 'slide-in-right 250ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'shimmer-bg':     'shimmer-skeleton 1.6s ease-in-out infinite',
      },

      // ─── BACKGROUND PRIMITIVES ───────────────────────────────────
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 0deg at 50% 50%, var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
        'aurora-gold': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212,184,106,0.18), transparent)',
      },

      backdropBlur: {
        xs: '4px',
        '2xl': '32px',
        '3xl': '48px',
      },
    },
  },
  plugins: [],
}

export default config
