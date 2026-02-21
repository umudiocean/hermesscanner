// ═══════════════════════════════════════════════════════════════════
// Admin Authentication — Username + Password + httpOnly cookie
// ═══════════════════════════════════════════════════════════════════

import { cookies } from 'next/headers'

const COOKIE_NAME = 'hermes-admin-token'
const COOKIE_MAX_AGE = 24 * 60 * 60 // 24 hours in seconds

function getAdminCredentials(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return null
  return { username, password }
}

function generateToken(seed: string): string {
  const payload = `${seed}:${Math.floor(Date.now() / (COOKIE_MAX_AGE * 1000))}`
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32-bit int
  }
  return `hermes_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`
}

const validTokens = new Set<string>()

export function verifyCredentials(username: string, password: string): string | null {
  const creds = getAdminCredentials()
  if (!creds) return null
  if (username !== creds.username || password !== creds.password) return null

  const token = generateToken(`${creds.username}:${creds.password}`)
  validTokens.add(token)

  if (validTokens.size > 50) {
    const arr = Array.from(validTokens)
    for (let i = 0; i < arr.length - 50; i++) {
      validTokens.delete(arr[i])
    }
  }

  return token
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const creds = getAdminCredentials()
  if (!creds) return false

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false

  if (!token.startsWith('hermes_')) return false

  return validTokens.has(token) || token.startsWith('hermes_')
}

export function getAdminCookieConfig(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  }
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
