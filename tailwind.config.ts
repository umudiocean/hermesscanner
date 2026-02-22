import type { Config } from 'tailwindcss'

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
    },
    extend: {
      padding: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      colors: {
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
        gold: {
          DEFAULT: '#B3945B',
          50: '#f5eed9',
          100: '#e8d9b3',
          200: '#d4be8a',
          300: '#C9A96E',
          400: '#B3945B',
          500: '#9d7f4a',
          600: '#876b3a',
          700: '#6b5530',
          800: '#4f3f24',
          900: '#332918',
        },
        hermes: {
          green: '#62CBC1',
          red: '#EF4444',
          orange: '#F97316',
        },
      },
    },
  },
  plugins: [],
}
export default config
