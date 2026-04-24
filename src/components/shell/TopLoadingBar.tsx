'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// TopLoadingBar — premium NProgress-style 2px gold strip
// • Auto-trickles to ~85%, then snaps to 100% on .done()
// • Programmatic API via window.__hermesLoader (start/done/inc)
// • Auto-listens to Next.js client navigation if available
// ═══════════════════════════════════════════════════════════════════

declare global {
  interface Window {
    __hermesLoader?: {
      start: () => void
      done: () => void
      inc: (amount?: number) => void
    }
  }
}

export function TopLoadingBar() {
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hidden, setHidden] = useState(true)
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopTrickle = useCallback(() => {
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null }
  }, [])

  const start = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
    setHidden(false)
    setActive(true)
    setProgress(8)
    stopTrickle()
    trickleRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 88) return p
        const remaining = 90 - p
        return Math.min(p + Math.random() * remaining * 0.18, 88)
      })
    }, 350)
  }, [stopTrickle])

  const done = useCallback(() => {
    stopTrickle()
    setProgress(100)
    setActive(false)
    hideTimerRef.current = setTimeout(() => {
      setHidden(true)
      setProgress(0)
    }, 400)
  }, [stopTrickle])

  const inc = useCallback((amount = 10) => {
    setProgress(p => Math.min(p + amount, 92))
  }, [])

  useEffect(() => {
    window.__hermesLoader = { start, done, inc }
    return () => { delete window.__hermesLoader }
  }, [start, done, inc])

  // Hook into native fetch for auto-progress on long requests (>300ms)
  useEffect(() => {
    const origFetch = window.fetch
    let activeRequests = 0
    let openTimer: ReturnType<typeof setTimeout> | null = null

    window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
      activeRequests++
      // Only show bar if request takes longer than 300ms
      if (activeRequests === 1) {
        openTimer = setTimeout(() => start(), 300)
      }
      try {
        const res = await origFetch(...args)
        return res
      } finally {
        activeRequests--
        if (activeRequests === 0) {
          if (openTimer) { clearTimeout(openTimer); openTimer = null }
          done()
        }
      }
    }
    return () => { window.fetch = origFetch }
  }, [start, done])

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[9998] h-[2px] pointer-events-none',
        'transition-opacity duration-300',
        hidden && !active ? 'opacity-0' : 'opacity-100',
      )}
      role="progressbar"
      aria-hidden={hidden}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 shadow-[0_0_8px_rgba(212,184,106,0.55)]"
        style={{
          width: `${progress}%`,
          transition: active ? 'width 280ms cubic-bezier(0.32, 0.72, 0, 1)' : 'width 200ms ease-out',
        }}
      />
    </div>
  )
}
