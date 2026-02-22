import type { NextConfig } from 'next'

// HERMES_FIX: SRCMAP 2026-02-19 SEVERITY: MEDIUM
// Disable browser source maps in production to protect scoring algorithm IP
const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://financialmodelingprep.com https://pro-api.coingecko.com https://api.stlouisfed.org https://*.upstash.io",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "report-uri /api/csp-report",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
        ],
      },
    ]
  },
}

export default nextConfig
