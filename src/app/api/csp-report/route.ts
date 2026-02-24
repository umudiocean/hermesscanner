// ═══════════════════════════════════════════════════════════════════
// CSP Violation Report Collector
// POST /api/csp-report — receives CSP violation reports (report-only)
// Logs to server console for monitoring before enforcing CSP
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limiter'
import logger from '@/lib/logger'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed, retryAfterMs } = await checkRateLimit(`csp-report:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json()

    const report = body?.['csp-report'] || body

    if (report) {
      logger.warn('CSP violation detected', {
        module: 'csp-report',
        documentUri: report['document-uri'] || report.documentURL,
        violatedDirective: report['violated-directive'] || report.violatedDirective,
        blockedUri: report['blocked-uri'] || report.blockedURL,
        sourceFile: report['source-file'] || report.sourceFile,
        lineNumber: report['line-number'] || report.lineNumber,
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
