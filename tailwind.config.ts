import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        hermes: {
          gold: '#FFD700',
          purple: '#8B5CF6',
          orange: '#F97316',
          dark: '#0A0A0F',
          card: '#12121A',
          border: '#1E1E2E',
        },
      },
    },
  },
  plugins: [],
}
export default config
