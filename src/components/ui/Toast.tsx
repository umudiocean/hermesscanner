'use client'

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react'

// ─── Toast Types ─────────────────────────────────────
interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
}

interface ToastContextValue {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const COLORS = {
  success: { bg: '#22C55E', border: '#16A34A' },
  error: { bg: '#EF4444', border: '#DC2626' },
  warning: { bg: '#F59E0B', border: '#D97706' },
  info: { bg: '#3B82F6', border: '#2563EB' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const ctx: ToastContextValue = {
    success: (title, message) => addToast('success', title, message),
    error: (title, message) => addToast('error', title, message),
    warning: (title, message) => addToast('warning', title, message),
    info: (title, message) => addToast('info', title, message),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
        {toasts.map(t => {
          const c = COLORS[t.type]
          return (
            <div
              key={t.id}
              className="pointer-events-auto rounded-xl px-4 py-3 shadow-lg backdrop-blur-md animate-slide-in-right"
              style={{
                background: `${c.bg}15`,
                border: `1px solid ${c.border}40`,
                color: '#fff',
              }}
            >
              <div className="font-bold text-sm" style={{ color: c.bg }}>{t.title}</div>
              {t.message && <div className="text-xs text-white/70 mt-0.5">{t.message}</div>}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  // Return safe no-op if used outside provider
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }
  }
  return ctx
}
