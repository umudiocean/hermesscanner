// Admin auth verification for API routes
// Supports: Authorization header (Bearer), X-API-Key header, Cookie session

import { NextRequest } from 'next/server'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ADMIN_PASSWORD

export function verifyAdminAuth(request: NextRequest): { authorized: boolean; error?: string } {
  // 1) Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim()
    if (token && (token === ADMIN_PASSWORD || token === ADMIN_API_KEY)) {
      return { authorized: true }
    }
  }

  // 2) X-API-Key header
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && (apiKey === ADMIN_API_KEY || apiKey === ADMIN_PASSWORD)) {
    return { authorized: true }
  }

  // 3) Cookie-based session (for browser requests from admin page)
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    const match = cookieHeader.match(/admin_session=([^;]+)/)
    if (match && match[1]) {
      try {
        const decoded = decodeURIComponent(match[1])
        const session = JSON.parse(decoded)
        if (session.token && (session.token === ADMIN_PASSWORD || session.token === ADMIN_API_KEY)) {
          return { authorized: true }
        }
      } catch {
        // Invalid cookie format
      }
    }
  }

  return { authorized: false, error: 'Unauthorized' }
}
