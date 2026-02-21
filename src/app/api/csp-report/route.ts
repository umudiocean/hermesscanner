// ═══════════════════════════════════════════════════════════════════
// CSP Violation Report Collector
// POST /api/csp-report — receives CSP violation reports (report-only)
// Logs to server console for monitoring before enforcing CSP
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const report = body?.['csp-report'] || body

    if (report) {
      console.warn('[CSP-VIOLATION]', JSON.stringify({
        documentUri: report['document-uri'] || report.documentURL,
        violatedDirective: report['violated-directive'] || report.violatedDirective,
        blockedUri: report['blocked-uri'] || report.blockedURL,
        sourceFile: report['source-file'] || report.sourceFile,
        lineNumber: report['line-number'] || report.lineNumber,
        timestamp: new Date().toISOString(),
      }))
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
