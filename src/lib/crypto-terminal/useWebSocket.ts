// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — WebSocket Real-Time Hook (K3)
// CoinGecko WebSocket: CGSimplePrice channel
// Client-side only — Vercel serverless does not support WS
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'wss://ws.coincap.io/prices?assets='

export interface RealTimePrice {
  id: string
  price: number
  timestamp: number
}

export interface UseWebSocketOptions {
  coinIds: string[]
  enabled?: boolean
  onPriceUpdate?: (prices: Map<string, RealTimePrice>) => void
}

export function useWebSocket({ coinIds, enabled = true, onPriceUpdate }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const [prices, setPrices] = useState<Map<string, RealTimePrice>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!enabled || coinIds.length === 0) return

    try {
      // CoinCap WebSocket for real-time prices (free, no auth needed)
      const assets = coinIds.join(',')
      const ws = new WebSocket(`${WS_URL}${assets}`)

      ws.onopen = () => {
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const now = Date.now()
          setPrices(prev => {
            const next = new Map(prev)
            for (const [id, price] of Object.entries(data)) {
              next.set(id, {
                id,
                price: parseFloat(price as string),
                timestamp: now,
              })
            }
            if (onPriceUpdate) onPriceUpdate(next)
            return next
          })
        } catch {
          // Silently ignore parse errors
        }
      }

      ws.onerror = () => {
        setError('WebSocket baglanti hatasi')
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null

        // Auto-reconnect with exponential backoff
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        }
      }

      wsRef.current = ws
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WS error')
    }
  }, [coinIds, enabled, onPriceUpdate])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return { connected, prices, error, reconnect: connect, disconnect }
}

// ─── CoinGecko Pro WebSocket (Analyst Plan) ──────────────────────

const CG_WS_URL = 'wss://ws.coingecko.com/api/v2/cable'

export interface CGWebSocketOptions {
  apiKey: string
  channels: string[] // e.g. ['CGSimplePrice:bitcoin:usd', 'OnchainOHLCV:eth:0x...']
  enabled?: boolean
  onMessage?: (channel: string, data: unknown) => void
}

export function useCGWebSocket({ apiKey, channels, enabled = true, onMessage }: CGWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!enabled || !apiKey || channels.length === 0) return

    const ws = new WebSocket(`${CG_WS_URL}?token=${apiKey}`)

    ws.onopen = () => {
      setConnected(true)
      // Subscribe to channels
      for (const channel of channels) {
        ws.send(JSON.stringify({
          command: 'subscribe',
          identifier: JSON.stringify({ channel }),
        }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'ping' || msg.type === 'confirm_subscription') return
        if (msg.message && onMessage) {
          const identifier = msg.identifier ? JSON.parse(msg.identifier) : {}
          onMessage(identifier.channel || 'unknown', msg.message)
        }
      } catch {
        // Silent
      }
    }

    ws.onclose = () => setConnected(false)

    wsRef.current = ws
    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [apiKey, channels, enabled, onMessage])

  return { connected }
}
