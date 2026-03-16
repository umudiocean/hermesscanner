// Auth session stub for Hermes Scanner
// Fund page uses this to check admin status for showing admin buttons

export function checkSession(): { isAuthenticated: boolean } {
  if (typeof window === 'undefined') return { isAuthenticated: false }
  try {
    const session = localStorage.getItem('hermes_admin_session')
    return { isAuthenticated: !!session }
  } catch {
    return { isAuthenticated: false }
  }
}
